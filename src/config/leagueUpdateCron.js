import cron from "cron";
import { sql } from "./db.js";
import { fetchLeagueDetails, fetchTeamsForLeague, fetchFixturesForLeague, logApiCall, storeTeams, storeMatches } from "../controllers/adminController.js";

// Globalny obiekt przechowujący czasy aktualizacji lig
let toUpdateTimes = [];

// Funkcja do aktualizacji ligi (używa tej samej logiki co refreshLeague endpoint)
async function updateLeagueData(league_id, season = new Date().getFullYear()) {
    try {
        
        // Fetch fresh data from API-Football
        const leagueData = await fetchLeagueDetails(league_id, season);
        if (!leagueData.exists) {
            console.error(`❌ [CRON] Liga o ID ${league_id} nie istnieje w API-Football: ${leagueData.error || ''}`);
            return false;
        }

        const details = leagueData.leagueDetails;

        // Upsert league basic data
        const existingLeague = await sql`
            SELECT * FROM leagues WHERE league_id = ${league_id}
        `;

        if (existingLeague.length === 0) {
            await sql`
                INSERT INTO leagues (
                    league_id, league_name, league_slug, league_country, logo, status, season
                ) VALUES (
                    ${details.league_id}, ${details.league_name}, ${details.league_slug}, ${details.league_country}, ${details.logo}, 'active', ${season}
                )
            `;
        } else {
            await sql`
                UPDATE leagues SET 
                    league_name = ${details.league_name},
                    league_slug = ${details.league_slug},
                    league_country = ${details.league_country},
                    logo = ${details.logo},
                    updated_at = NOW() + INTERVAL '2 hours'
                WHERE league_id = ${league_id}
            `;
        }

        // Store teams and matches using the same functions as refreshLeague endpoint
        let storedTeams = [];
        let storedMatches = [];
        let teamsCount = 0;
        let matchesCount = 0;
        let teamsError = null;
        let matchesError = null;

        if (leagueData.teams && leagueData.teams.length > 0) {
            try {
                storedTeams = await storeTeams(leagueData.teams);
                teamsCount = storedTeams.length;
            } catch (error) {
                teamsError = error.message;
                console.error(`❌ [CRON] Błąd podczas zapisywania drużyn dla ligi ${league_id}:`, error);
            }
        }

        if (leagueData.fixtures && leagueData.fixtures.length > 0) {
            try {
                storedMatches = await storeMatches(leagueData.fixtures);
                matchesCount = storedMatches.length;
            } catch (error) {
                matchesError = error.message;
                console.error(`❌ [CRON] Błąd podczas zapisywania meczów dla ligi ${league_id}:`, error);
            }
        }

        return true;

    } catch (error) {
        console.error(`❌ [CRON] Błąd podczas aktualizacji ligi ${league_id}:`, error);
        return false;
    }
}

// Funkcja do sprawdzania i aktualizacji lig co minutę
function checkAndUpdateLeagues() {
    const now = new Date();
    const warsawTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Warsaw"}));
    const currentTime = warsawTime.getHours().toString().padStart(2, '0') + ':' + warsawTime.getMinutes().toString().padStart(2, '0');
    
    
    for (let i = 0; i < toUpdateTimes.length; i++) {
        const item = toUpdateTimes[i];
        
        if (item.time === currentTime && !item.updated_today) {
            
            // Wykonaj aktualizację
            updateLeagueData(item.league).then(success => {
                if (success) {
                    // Oznacz jako zaktualizowane dzisiaj
                    toUpdateTimes[i].updated_today = true;
                }
            }).catch(error => {
                console.error(`❌ [CRON] Błąd podczas aktualizacji ligi ${item.league}:`, error);
            });
        }
    }
}

// Funkcja do logowania toUpdateTimes co godzinę
function logUpdateTimes() {
}

// Funkcja do pobierania update_times z tournaments codziennie o 00:01
async function refreshUpdateTimes() {
    try {
        
        const tournaments = await sql`
            SELECT league_id, update_times 
            FROM tournaments 
            WHERE update_times IS NOT NULL AND array_length(update_times, 1) > 0
        `;
        
        const newUpdateTimes = [];
        
        for (const tournament of tournaments) {
            if (tournament.update_times && Array.isArray(tournament.update_times)) {
                for (const time of tournament.update_times) {
                    newUpdateTimes.push({
                        time: time,
                        league: tournament.league_id,
                        updated_today: false
                    });
                }
            }
        }
        
        toUpdateTimes = newUpdateTimes;
        
        // Reset updated_today flag for all items at the start of new day
        toUpdateTimes.forEach(item => {
            item.updated_today = false;
        });
        
        
    } catch (error) {
        console.error('❌ [CRON] Błąd podczas pobierania update_times:', error);
    }
}

// Tworzenie zadań cron
export const leagueUpdateJob = new cron.CronJob("0 * * * * *", checkAndUpdateLeagues); // Co minutę
export const logUpdateTimesJob = new cron.CronJob("0 0 * * * *", logUpdateTimes); // Co godzinę
export const refreshUpdateTimesJob = new cron.CronJob("0 1 0 * * *", refreshUpdateTimes); // Codziennie o 00:01

// Funkcja do inicjalizacji (pobranie początkowych danych)
export async function initializeLeagueUpdateSystem() {
    await refreshUpdateTimes();
}

// Eksport obiektu do debugowania
export { toUpdateTimes };