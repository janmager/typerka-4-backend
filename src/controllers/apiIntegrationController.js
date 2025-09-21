import { sql } from "../config/db.js";
import fetch from 'node-fetch';

// Helper function to log API calls to api_football_logs table
async function logApiCall(description, url) {
    try {
        await sql`
            INSERT INTO api_football_logs (description, url, created_at)
            VALUES (${description}, ${url}, NOW() + INTERVAL '2 hours')
        `;
    } catch (error) {
        console.error('Error logging API call:', error);
        // Don't throw error here to avoid breaking the main functionality
    }
}

// Fetch fixtures from API Sports and process them
export async function fetchAndProcessFixtures(req, res) {
    try {
        const { league_id, season, from_date, to_date } = req.body;

        console.log("Fetch fixtures request:", req.body);

        // Validate required fields
        if (!league_id || !season) {
            return res.status(400).json({
                response: false,
                message: "Brak wymaganych pól: league_id, season"
            });
        }

        // Build API URL with parameters
        let apiUrl = `https://api-football-v1.p.rapidapi.com/v3/fixtures?league=${league_id}&season=${season}`;
        
        // if (from_date) {
        //     apiUrl += `&from=${from_date}`;
        // }
        // if (to_date) {
        //     apiUrl += `&to=${to_date}`;
        // }

        // Log the API call
        const logDescription = `Fetch fixtures - League: ${league_id}, Season: ${season}${from_date ? `, From: ${from_date}` : ''}${to_date ? `, To: ${to_date}` : ''}`;
        await logApiCall(logDescription, apiUrl);

        // Fetch data from API Sports
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const apiData = await response.json();

        // Process the fixtures
        const results = await processFixturesData(apiData);

        return res.status(200).json({
            response: true,
            message: "Dane zostały pobrane i przetworzone pomyślnie",
            data: results
        });

    } catch (error) {
        console.error('Error fetching fixtures from API:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania danych z API Sports"
        });
    }
}

// Helper function to process fixtures data
async function processFixturesData(apiData) {
    const results = {
        teams_added: 0,
        teams_existing: 0,
        matches_added: 0,
        matches_existing: 0,
        errors: []
    };

    if (!apiData.response || !Array.isArray(apiData.response)) {
        throw new Error('Invalid API response format');
    }

    for (const fixture of apiData.response) {
        try {
            const {
                fixture: fixtureData,
                league,
                teams,
                goals,
                score
            } = fixture;

            // Process home team
            const homeTeamResult = await getOrCreateTeam(teams.home);
            if (homeTeamResult.created) {
                results.teams_added++;
            } else {
                results.teams_existing++;
            }

            // Process away team
            const awayTeamResult = await getOrCreateTeam(teams.away);
            if (awayTeamResult.created) {
                results.teams_added++;
            } else {
                results.teams_existing++;
            }

            // Process match
            const matchResult = await getOrCreateMatch(fixture);
            if (matchResult.added) {
                results.matches_added++;
            } else {
                results.matches_existing++;
            }

        } catch (error) {
            console.error('Error processing fixture:', error);
            results.errors.push({
                fixture_id: fixture.fixture?.id,
                error: error.message
            });
        }
    }

    return results;
}

// Process API fixtures response and add teams/matches
export async function processApiFixtures(req, res) {
    try {
        const { fixtures_response } = req.body;

        console.log("Processing API fixtures:", req.body);

        // Log the API call processing
        const fixtureCount = fixtures_response?.response?.length || 0;
        const logDescription = `Process API fixtures - ${fixtureCount} fixtures to process`;
        const logUrl = `POST /api/admin/api/process-fixtures`;
        await logApiCall(logDescription, logUrl);

        if (!fixtures_response || !fixtures_response.response || !Array.isArray(fixtures_response.response)) {
            return res.status(400).json({
                response: false,
                message: "Nieprawidłowy format odpowiedzi API"
            });
        }

        const results = {
            teams_added: 0,
            teams_existing: 0,
            matches_added: 0,
            matches_existing: 0,
            errors: []
        };

        for (const fixture of fixtures_response.response) {
            try {
                const {
                    fixture: fixtureData,
                    league,
                    teams,
                    goals,
                    score
                } = fixture;

                // Process home team
                const homeTeamResult = await getOrCreateTeam(teams.home);
                if (homeTeamResult.created) {
                    results.teams_added++;
                } else {
                    results.teams_existing++;
                }

                // Process away team
                const awayTeamResult = await getOrCreateTeam(teams.away);
                if (awayTeamResult.created) {
                    results.teams_added++;
                } else {
                    results.teams_existing++;
                }

                // Process match
                const matchResult = await getOrCreateMatch(fixture);
                if (matchResult.added) {
                    results.matches_added++;
                } else {
                    results.matches_existing++;
                }

            } catch (error) {
                console.error('Error processing fixture:', error);
                results.errors.push({
                    fixture_id: fixture.fixture?.id,
                    error: error.message
                });
            }
        }

        return res.status(200).json({
            response: true,
            message: "Przetwarzanie zakończone",
            data: results
        });

    } catch (error) {
        console.error('Error processing API fixtures:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas przetwarzania danych z API"
        });
    }
}

// Helper function to get or create team
async function getOrCreateTeam(teamData) {
    try {
        // Check if team exists by API ID
        const existingTeam = await sql`
            SELECT id FROM teams 
            WHERE api_team_id = ${teamData.id}
        `;

        if (existingTeam.length > 0) {
            return { id: existingTeam[0].id, created: false }; // Return existing team ID
        }

        // Create new team
        const slug = teamData.name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');

        // Ensure slug is unique
        let finalSlug = slug;
        let counter = 1;
        while (true) {
            const slugCheck = await sql`
                SELECT id FROM teams 
                WHERE slug = ${finalSlug}
            `;
            
            if (slugCheck.length === 0) break;
            
            finalSlug = `${slug}-${counter}`;
            counter++;
        }

        const newTeam = await sql`
            INSERT INTO teams (
                name, slug, logo, label, country, api_team_id, api_team_name
            ) VALUES (
                ${teamData.name}, ${finalSlug}, ${teamData.logo}, 
                ${teamData.name}, 'Poland', ${teamData.id}, ${teamData.name}
            ) RETURNING id
        `;

        return { id: newTeam[0].id, created: true };
    } catch (error) {
        console.error('Error creating team:', error);
        throw error;
    }
}

// Helper function to get or create match
async function getOrCreateMatch(fixtureData) {
    try {
        const {
            fixture,
            league,
            teams,
            goals,
            score
        } = fixtureData;

        // Check if match exists by API fixture ID
        if (fixture.id) {
            const existingMatch = await sql`
                SELECT id FROM matches 
                WHERE api_fixture_id = ${fixture.id}
            `;

            if (existingMatch.length > 0) {
                return { added: false, id: existingMatch[0].id };
            }
        }

        // Get team IDs (teams should already exist from previous processing)
        const homeTeam = await sql`
            SELECT id FROM teams WHERE api_team_id = ${teams.home.id}
        `;
        const awayTeam = await sql`
            SELECT id FROM teams WHERE api_team_id = ${teams.away.id}
        `;

        if (homeTeam.length === 0 || awayTeam.length === 0) {
            throw new Error('Teams not found for match - teams should be created first');
        }

        // Parse match date and time
        const matchDate = new Date(fixture.date);
        const dateStr = matchDate.toISOString().split('T')[0];
        const timeStr = matchDate.toTimeString().split(' ')[0].substring(0, 5);

        // Map API status to our status
        const statusMap = {
            'Not Started': 'scheduled',
            'In Play': 'live',
            'Match Finished': 'finished',
            'Postponed': 'postponed',
            'Cancelled': 'cancelled'
        };
        const matchStatus = statusMap[fixture.status.long] || 'scheduled';

        // Get scores - preserve null values if they are null in API response
        const homeScore = goals.home === null ? null : (goals.home || 0);
        const awayScore = goals.away === null ? null : (goals.away || 0);

        // Check if league exists in leagues table
        const leagueCheck = await sql`
            SELECT id FROM leagues WHERE league_id = ${league.id}
        `;

        if (leagueCheck.length === 0) {
            throw new Error(`League with ID ${league.id} not found in leagues table`);
        }

        // Insert new match
        const newMatch = await sql`
            INSERT INTO matches (
                home_team, away_team, home_team_score, away_team_score,
                league_id, status, stadium, match_date, match_time,
                round, city, api_fixture_id
            ) VALUES (
                ${homeTeam[0].id}, ${awayTeam[0].id}, ${homeScore}, ${awayScore},
                ${league.id}, ${matchStatus}, ${fixture.venue.name}, 
                ${dateStr}, ${timeStr}, ${league.round || null}, 
                ${fixture.venue.city || null}, ${fixture.id}
            ) RETURNING id
        `;

        return { added: true, id: newMatch[0].id };
    } catch (error) {
        console.error('Error creating match:', error);
        throw error;
    }
}

// Get team by API team ID
export async function getTeamByApiId(req, res) {
    try {
        const { api_team_id } = req.params;

        // Log the API call
        const logDescription = `Get team by API ID - Team ID: ${api_team_id}`;
        const logUrl = `GET /api/admin/api/teams/${api_team_id}`;
        await logApiCall(logDescription, logUrl);

        const team = await sql`
            SELECT * FROM teams 
            WHERE api_team_id = ${api_team_id}
        `;

        if (team.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Drużyna o podanym API ID nie istnieje"
            });
        }

        res.status(200).json({
            response: true,
            data: team[0]
        });
    } catch (error) {
        console.error('Error getting team by API ID:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania drużyny"
        });
    }
}

// Get match by API fixture ID
export async function getMatchByApiFixtureId(req, res) {
    try {
        const { api_fixture_id } = req.params;

        // Log the API call
        const logDescription = `Get match by API fixture ID - Fixture ID: ${api_fixture_id}`;
        const logUrl = `GET /api/admin/api/matches/${api_fixture_id}`;
        await logApiCall(logDescription, logUrl);

        const match = await sql`
            SELECT 
                m.*,
                ht.name as home_team_name,
                ht.logo as home_team_logo,
                ht.label as home_team_label,
                at.name as away_team_name,
                at.logo as away_team_logo,
                at.label as away_team_label,
                l.league_name,
                l.league_country
            FROM matches m
            LEFT JOIN teams ht ON m.home_team = ht.id::text
            LEFT JOIN teams at ON m.away_team = at.id::text
            LEFT JOIN leagues l ON m.league_id = l.league_id::int
            WHERE m.api_fixture_id = ${api_fixture_id}
        `;

        if (match.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Mecz o podanym API fixture ID nie istnieje"
            });
        }

        res.status(200).json({
            response: true,
            data: match[0]
        });
    } catch (error) {
        console.error('Error getting match by API fixture ID:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania meczu"
        });
    }
}
