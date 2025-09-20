import { sql } from "../config/db.js";

// Fetch teams for a specific league and season
async function fetchTeamsForLeague(leagueId, season = new Date().getFullYear()) {
    try {
        const apiKey = process.env.API_FOOTBALL_KEY;
        const teamsUrl = `https://v3.football.api-sports.io/teams?league=${leagueId}&season=${season}`;
        
        console.log(`Fetching teams for league ${leagueId}, season ${season}...`);
        
        const response = await fetch(teamsUrl, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': 'v3.football.api-sports.io'
            }
        });

        if (!response.ok) {
            console.error(`API-Football teams request failed with status: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.response || [];
    } catch (error) {
        console.error('Error fetching teams:', error);
        return [];
    }
}

// Fetch fixtures for a specific league and season
async function fetchFixturesForLeague(leagueId, season = new Date().getFullYear()) {
    try {
        const apiKey = process.env.API_FOOTBALL_KEY;
        // Compute 'from' as yesterday in Europe/Warsaw (YYYY-MM-DD)
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Warsaw',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(now);
        const yearPart = parts.find(p => p.type === 'year');
        const monthPart = parts.find(p => p.type === 'month');
        const dayPart = parts.find(p => p.type === 'day');
        const warsawTodayUTC = new Date(Date.UTC(
            Number(yearPart?.value),
            Number(monthPart?.value) - 1,
            Number(dayPart?.value)
        ));
        warsawTodayUTC.setUTCDate(warsawTodayUTC.getUTCDate() - 1);
        const from = `${warsawTodayUTC.getUTCFullYear()}-${String(warsawTodayUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(warsawTodayUTC.getUTCDate()).padStart(2, '0')}`;

        const fixturesUrl = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&timezone=Europe/Warsaw&from=${from}`;
        console.log(fixturesUrl);
        console.log(`Fetching fixtures for league ${leagueId}, season ${season}...`);
        
        const response = await fetch(fixturesUrl, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': 'v3.football.api-sports.io'
            }
        });

        if (!response.ok) {
            console.error(`API-Football fixtures request failed with status: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.response || [];
    } catch (error) {
        console.error('Error fetching fixtures:', error);
        return [];
    }
}

// Store teams in database (custom table structure)
async function storeTeams(teams) {
    const storedTeams = [];
    
    for (const teamData of teams) {
        const team = teamData.team;
        
        try {
            // Check if team already exists (using name as identifier for custom table)
            const existingTeam = await sql`
                SELECT id FROM teams WHERE name = ${team.name}
            `;

            if (existingTeam.length === 0) {
                // Create slug from team name
                const slug = team.name
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim('-');

                // Insert new team with custom table structure
                const result = await sql`
                    INSERT INTO teams (
                        name, slug, logo, label, country, team_id
                    ) VALUES (
                        ${team.name}, ${slug}, ${team.logo || ''}, 
                        ${team.code || team.name.substring(0, 6).toUpperCase()}, 
                        ${team.country || 'Unknown'}, ${team.id ? team.id.toString() : null}
                    ) RETURNING *
                `;
                storedTeams.push(result[0]);
                console.log(`Stored team: ${team.name}`);
            } else {
                console.log(`Team ${team.name} already exists, skipping...`);
                storedTeams.push(existingTeam[0]);
            }
        } catch (error) {
            console.error(`Error storing team ${team.name}:`, error);
            throw error; // Re-throw to be caught by the calling function
        }
    }
    
    return storedTeams;
}

// Store matches in database (custom table structure)
async function storeMatches(fixtures) {
    const storedMatches = [];
    
    for (const fixture of fixtures) {
        try {
            // Extract data from API response according to the mapping
            const matchId = fixture.fixture?.id ? fixture.fixture.id.toString() : null;
            const homeTeamId = fixture.teams?.home?.id ? fixture.teams.home.id.toString() : null;
            const awayTeamId = fixture.teams?.away?.id ? fixture.teams.away.id.toString() : null;
            const leagueId = fixture.league?.id ? fixture.league.id.toString() : null;
            
            // Skip if essential data is missing
            if (!matchId || !homeTeamId || !awayTeamId || !leagueId) {
                console.log(`Skipping match ${matchId}: missing essential data (homeTeamId: ${homeTeamId}, awayTeamId: ${awayTeamId}, leagueId: ${leagueId})`);
                continue;
            }

            // Ensure teams exist in our custom teams table using team_id
            let homeTeamExists = await sql`
                SELECT team_id FROM teams WHERE team_id = ${homeTeamId}
            `;
            
            let awayTeamExists = await sql`
                SELECT team_id FROM teams WHERE team_id = ${awayTeamId}
            `;
            
            // Skip match if teams don't exist in our system
            if (homeTeamExists.length === 0 || awayTeamExists.length === 0) {
                console.log(`Skipping match ${matchId}: teams not found in custom teams table (home: ${homeTeamId}, away: ${awayTeamId})`);
                continue;
            }

            // Extract match date and time
            let matchDate = null;
            let matchTime = null;
            
            if (fixture.fixture?.date) {
                try {
                    const dateObj = new Date(fixture.fixture.date);
                    matchDate = dateObj.toISOString().split('T')[0];
                    matchTime = dateObj.toTimeString().split(' ')[0];
                } catch (dateError) {
                    console.log(`Error parsing date for match ${matchId}:`, dateError);
                    matchDate = new Date().toISOString().split('T')[0]; // fallback to today
                    matchTime = '00:00:00'; // fallback time
                }
            }
            
            // Check if match already exists using match_id
            const existingMatch = await sql`
                SELECT id FROM matches WHERE match_id = ${matchId}
            `;

            // Determine match status
            let status = 'scheduled';
            if (fixture.fixture?.status?.short) {
                const statusShort = fixture.fixture.status.short;
                if (statusShort === 'FT') status = 'finished';
                else if (statusShort === 'LIVE' || statusShort === '1H' || statusShort === '2H' || statusShort === 'HT') status = 'live';
                else if (statusShort === 'PST') status = 'postponed';
                else if (statusShort === 'CANC') status = 'cancelled';
            }

            // Extract match current time (elapsed time)
            const matchCurrentTime = fixture.fixture?.status?.elapsed ? 
                `00:${fixture.fixture.status.elapsed.toString().padStart(2, '0')}:00` : null;

            // Extract venue information
            const stadium = fixture.fixture?.venue?.name || 'Unknown Stadium';
            const stadiumCity = fixture.fixture?.venue?.city || null;
            const stadiumCountry = fixture.fixture?.venue?.country || null;

            // Extract score information with safe checks
            const goalsHome = fixture.goals?.home !== undefined && fixture.goals?.home !== null ? fixture.goals.home : null;
            const goalsAway = fixture.goals?.away !== undefined && fixture.goals?.away !== null ? fixture.goals.away : null;
            
            const halfTimeHomeScore = fixture.score?.halftime?.home !== undefined && fixture.score?.halftime?.home !== null ? fixture.score.halftime.home : null;
            const halfTimeAwayScore = fixture.score?.halftime?.away !== undefined && fixture.score?.halftime?.away !== null ? fixture.score.halftime.away : null;
            
            const fullTimeHomeScore = fixture.score?.fulltime?.home !== undefined && fixture.score?.fulltime?.home !== null ? fixture.score.fulltime.home : null;
            const fullTimeAwayScore = fixture.score?.fulltime?.away !== undefined && fixture.score?.fulltime?.away !== null ? fixture.score.fulltime.away : null;

            if (existingMatch.length === 0) {
                // Insert new match with all the new fields
                const result = await sql`
                    INSERT INTO matches (
                        match_id, home_team, away_team, home_team_score, away_team_score,
                        match_current_time, league_id, status, stadium, match_date, match_time,
                        stadium_city, stadium_country,
                        actual_home_score, actual_away_score, goals_home, goals_away,
                        half_time_home_score, half_time_away_score,
                        full_time_home_score, full_time_away_score
                    ) VALUES (
                        ${matchId}, ${homeTeamId}, ${awayTeamId}, 
                        ${goalsHome || 0}, ${goalsAway || 0},
                        ${matchCurrentTime}, ${parseInt(leagueId)}, ${status}, 
                        ${stadium}, ${matchDate}, ${matchTime},
                        ${stadiumCity}, ${stadiumCountry},
                        ${goalsHome}, ${goalsAway}, ${goalsHome}, ${goalsAway},
                        ${halfTimeHomeScore}, ${halfTimeAwayScore},
                        ${fullTimeHomeScore}, ${fullTimeAwayScore}
                    ) RETURNING *
                `;
                storedMatches.push(result[0]);
                console.log(`Stored match: ${fixture.teams?.home?.name || 'Unknown'} vs ${fixture.teams?.away?.name || 'Unknown'} (ID: ${matchId})`);
            } else {
                // Update existing match with new information
                const result = await sql`
                    UPDATE matches SET
                        home_team_score = ${goalsHome || 0},
                        away_team_score = ${goalsAway || 0},
                        match_current_time = ${matchCurrentTime},
                        status = ${status},
                        stadium = ${stadium},
                        match_date = ${matchDate},
                        match_time = ${matchTime},
                        stadium_city = ${stadiumCity},
                        stadium_country = ${stadiumCountry},
                        actual_home_score = ${goalsHome},
                        actual_away_score = ${goalsAway},
                        goals_home = ${goalsHome},
                        goals_away = ${goalsAway},
                        half_time_home_score = ${halfTimeHomeScore},
                        half_time_away_score = ${halfTimeAwayScore},
                        full_time_home_score = ${fullTimeHomeScore},
                        full_time_away_score = ${fullTimeAwayScore}
                    WHERE match_id = ${matchId}
                    RETURNING *
                `;
                storedMatches.push(result[0]);
                console.log(`Updated match: ${fixture.teams?.home?.name || 'Unknown'} vs ${fixture.teams?.away?.name || 'Unknown'} (ID: ${matchId})`);
            }
        } catch (error) {
            console.error(`Error storing/updating match ${fixture.fixture?.id || 'unknown'}:`, error);
            // Don't throw error - continue processing other matches
            continue;
        }
    }
    
    return storedMatches;
}

// Fetch league details from API-Football
async function fetchLeagueDetails(leagueId, season = new Date().getFullYear()) {
    try {
        const apiKey = process.env.API_FOOTBALL_KEY;
        
        if (!apiKey) {
            console.error('API_FOOTBALL_KEY not found in environment variables');
            return { exists: false, error: 'API key not configured' };
        }

        // First, try to get league info directly from leagues endpoint
        const leaguesUrl = `https://v3.football.api-sports.io/leagues?id=${leagueId}`;
        
        console.log(`Fetching league details for ${leagueId}...`);
        
        const leaguesResponse = await fetch(leaguesUrl, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': 'v3.football.api-sports.io'
            }
        });

        if (!leaguesResponse.ok) {
            console.error(`API-Football leagues request failed with status: ${leaguesResponse.status}`);
            return { exists: false, error: `API request failed: ${leaguesResponse.status}` };
        }

        const leaguesData = await leaguesResponse.json();
        
        if (leaguesData.results > 0 && leaguesData.response && leaguesData.response.length > 0) {
            const leagueData = leaguesData.response[0];
            const league = leagueData.league;
            const country = leagueData.country;
            
            // Fetch teams and fixtures for this league
            const [teams, fixtures] = await Promise.all([
                fetchTeamsForLeague(leagueId, season),
                fetchFixturesForLeague(leagueId, season)
            ]);
            
            console.log(`League ${leagueId} found successfully. Name: ${league.name}, Country: ${country.name}, Teams: ${teams.length}, Fixtures: ${fixtures.length}`);
            
            // Create a slug from the league name
            const slug = league.name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
                .replace(/\s+/g, '-') // Replace spaces with hyphens
                .replace(/-+/g, '-') // Replace multiple hyphens with single
                .trim('-'); // Remove leading/trailing hyphens

            return { 
                exists: true,
                leagueDetails: {
                    league_id: leagueId.toString(),
                    league_name: league.name,
                    league_slug: slug,
                    league_country: country.name,
                    logo: league.logo,
                    season: season,
                    teamsCount: teams.length,
                    fixturesCount: fixtures.length
                },
                teams: teams,
                fixtures: fixtures
            };
        } else {
            console.log(`League ${leagueId} not found in API-Football`);
            return { exists: false, error: 'League not found in API-Football' };
        }

    } catch (error) {
        console.error('Error fetching league details:', error);
        return { exists: false, error: error.message };
    }
}

// Verify league exists in API-Football (legacy function for compatibility)
async function verifyLeagueExists(leagueId, season = new Date().getFullYear()) {
    const result = await fetchLeagueDetails(leagueId, season);
    if (result.exists) {
        return {
            exists: true,
            leagueInfo: {
                name: result.leagueDetails.league_name,
                logo: result.leagueDetails.logo
            },
            season: result.leagueDetails.season,
            fixturesCount: result.leagueDetails.fixturesCount
        };
    }
    return result;
}

// Check if user is admin
export async function checkAdminUser(req, res, next) {
    try {
        // For GET requests, check query parameters; for POST requests, check body
        const user_id = req.method === 'GET' ? req.query.user_id : req.body.user_id;
        
        if (!user_id) {
            return res.status(400).json({
                response: false,
                message: "Brak user_id"
            });
        }

        const user = await sql`
            SELECT type FROM users 
            WHERE user_id = ${user_id}
        `;

        if (user.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Użytkownik nie istnieje"
            });
        }

        if (user[0].type !== 'admin') {
            return res.status(403).json({
                response: false,
                message: "Brak uprawnień administratora"
            });
        }

        // Add user info to request for use in next middleware
        req.adminUser = user[0];
        next();
    } catch (error) {
        console.error('Error checking admin user:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas weryfikacji uprawnień"
        });
    }
}

// Update league status
export async function updateLeagueStatus(req, res) {
    try {
        const { 
            league_id, 
            league_name, 
            league_slug, 
            league_country, 
            logo, 
            status, 
            update_times, 
            action 
        } = req.body;

        console.log("Update league status request:", req.body);

        // Validate required fields based on action
        if (action === 'add' || action === 'update') {
            if (!league_id || !league_name || !league_slug || !league_country || !logo) {
                return res.status(400).json({
                    response: false,
                    message: "Brak wymaganych pól: league_id, league_name, league_slug, league_country, logo"
                });
            }
        }

        if (action === 'delete' && !league_id) {
            return res.status(400).json({
                response: false,
                message: "Brak league_id do usunięcia"
            });
        }

        // Validate status
        if (status && !['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                response: false,
                message: "Status musi być 'active' lub 'inactive'"
            });
        }

        // Validate update_times format
        if (update_times && !Array.isArray(update_times)) {
            return res.status(400).json({
                response: false,
                message: "update_times musi być tablicą"
            });
        }

        if (update_times) {
            for (const time of update_times) {
                if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                    return res.status(400).json({
                        response: false,
                        message: `Nieprawidłowy format czasu: ${time}. Użyj formatu HH:MM`
                    });
                }
            }
        }

        let result;

        switch (action) {
            case 'add':
                // Check if league already exists
                const existingLeague = await sql`
                    SELECT id FROM leagues 
                    WHERE league_id = ${league_id}
                `;

                if (existingLeague.length > 0) {
                    return res.status(400).json({
                        response: false,
                        message: "Liga o podanym league_id już istnieje w bazie danych"
                    });
                }

                // Verify league exists in API-Football before adding
                console.log(`Verifying league ${league_id} in API-Football...`);
                const verification = await verifyLeagueExists(league_id, new Date().getFullYear());

                if (!verification.exists) {
                    return res.status(400).json({
                        response: false,
                        message: `Liga o ID ${league_id} nie istnieje w API-Football lub nie ma dostępnych meczów. ${verification.error || ''}`
                    });
                }

                console.log(`League ${league_id} verified successfully. Adding to database...`);

                result = await sql`
                    INSERT INTO leagues (
                        league_id, league_name, league_slug, league_country, 
                        logo, status
                    ) VALUES (
                        ${league_id}, ${league_name}, ${league_slug}, ${league_country}, 
                        ${logo}, ${status || 'inactive'}
                    ) RETURNING *
                `;

                return res.status(200).json({
                    response: true,
                    message: `Liga została dodana pomyślnie. Zweryfikowano w API-Football (${verification.fixturesCount} meczów)`,
                    data: {
                        ...result[0],
                        verification: {
                            season: verification.season,
                            fixturesCount: verification.fixturesCount,
                            verifiedAt: new Date().toISOString()
                        }
                    }
                });

            case 'update':
                // Check if league exists
                const leagueToUpdate = await sql`
                    SELECT id FROM leagues 
                    WHERE league_id = ${league_id}
                `;

                if (leagueToUpdate.length === 0) {
                    return res.status(404).json({
                        response: false,
                        message: "Liga o podanym league_id nie istnieje"
                    });
                }

                // Build update query dynamically
                const updateFields = [];
                const updateValues = [];

                if (league_name) {
                    updateFields.push('league_name');
                    updateValues.push(league_name);
                }
                if (league_slug) {
                    updateFields.push('league_slug');
                    updateValues.push(league_slug);
                }
                if (league_country) {
                    updateFields.push('league_country');
                    updateValues.push(league_country);
                }
                if (logo) {
                    updateFields.push('logo');
                    updateValues.push(logo);
                }
                if (status) {
                    updateFields.push('status');
                    updateValues.push(status);
                }
                // update_times removed from leagues

                if (updateFields.length === 0) {
                    return res.status(400).json({
                        response: false,
                        message: "Brak pól do aktualizacji"
                    });
                }

                updateFields.push('updated_at');
                updateValues.push(new Date());

                // Build update query using template literals
                let updateQuery = 'UPDATE leagues SET ';
                const updateParts = [];
                
                if (league_name) updateParts.push(`league_name = '${league_name}'`);
                if (league_slug) updateParts.push(`league_slug = '${league_slug}'`);
                if (league_country) updateParts.push(`league_country = '${league_country}'`);
                if (logo) updateParts.push(`logo = '${logo}'`);
                if (status) updateParts.push(`status = '${status}'`);
                // update_times removed from leagues
                
                updateParts.push(`updated_at = NOW() + INTERVAL '2 hours'`);
                updateQuery += updateParts.join(', ');
                updateQuery += ` WHERE league_id = '${league_id}' RETURNING *`;

                result = await sql.unsafe(updateQuery);

                return res.status(200).json({
                    response: true,
                    message: "Liga została zaktualizowana pomyślnie",
                    data: result[0]
                });

            case 'delete':
                const leagueToDelete = await sql`
                    DELETE FROM leagues 
                    WHERE league_id = ${league_id}
                    RETURNING *
                `;

                if (leagueToDelete.length === 0) {
                    return res.status(404).json({
                        response: false,
                        message: "Liga o podanym league_id nie istnieje"
                    });
                }

                return res.status(200).json({
                    response: true,
                    message: "Liga została usunięta pomyślnie",
                    data: leagueToDelete[0]
                });

            case 'status':
                if (!status) {
                    return res.status(400).json({
                        response: false,
                        message: "Brak statusu do aktualizacji"
                    });
                }

                result = await sql`
                    UPDATE leagues 
                    SET status = ${status}, updated_at = NOW() + INTERVAL '2 hours'
                    WHERE league_id = ${league_id}
                    RETURNING *
                `;

                if (result.length === 0) {
                    return res.status(404).json({
                        response: false,
                        message: "Liga o podanym league_id nie istnieje"
                    });
                }

                return res.status(200).json({
                    response: true,
                    message: `Status ligi został zmieniony na: ${status}`,
                    data: result[0]
                });

            default:
                return res.status(400).json({
                    response: false,
                    message: "Nieprawidłowa akcja. Dostępne akcje: add, update, delete, status"
                });
        }

    } catch (error) {
        console.error('Error updating league status:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas aktualizacji ligi"
        });
    }
}

// Add new league record
export async function addLeagueRecord(req, res) {
    try {
        const { 
            league_id, 
            status = 'inactive', 
            season = new Date().getFullYear()
        } = req.body;

        console.log("Add league record request:", req.body);

        // Validate required fields - only league_id is required now
        if (!league_id) {
            return res.status(400).json({
                response: false,
                message: "Brak wymaganego pola: league_id"
            });
        }

        // Validate status
        if (!['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                response: false,
                message: "Status musi być 'active' lub 'inactive'"
            });
        }


        // Check if league already exists in our database
        const existingLeague = await sql`
            SELECT id FROM leagues 
            WHERE league_id = ${league_id}
        `;

        if (existingLeague.length > 0) {
            return res.status(400).json({
                response: false,
                message: "Liga o podanym league_id już istnieje w bazie danych"
            });
        }

        // Fetch league details from API-Football
        console.log(`Fetching league details for ${league_id} from API-Football...`);
        const leagueData = await fetchLeagueDetails(league_id, season);

        if (!leagueData.exists) {
            return res.status(400).json({
                response: false,
                message: `Liga o ID ${league_id} nie istnieje w API-Football lub nie ma dostępnych danych. ${leagueData.error || ''}`
            });
        }

        const details = leagueData.leagueDetails;
        console.log(`League ${league_id} found successfully. Adding to database with details:`, details);

        // Insert new league with data fetched from API-Football
        const result = await sql`
            INSERT INTO leagues (
                league_id, league_name, league_slug, league_country, 
                logo, status
            ) VALUES (
                ${details.league_id}, ${details.league_name}, ${details.league_slug}, ${details.league_country}, 
                ${details.logo}, ${status}
            ) RETURNING *
        `;

        // Store teams and matches data
        let storedTeams = [];
        let storedMatches = [];
        let teamsCount = 0;
        let matchesCount = 0;
        let teamsError = null;
        let matchesError = null;

        // Try to store teams
        if (leagueData.teams && leagueData.teams.length > 0) {
            try {
                console.log(`Storing ${leagueData.teams.length} teams...`);
                storedTeams = await storeTeams(leagueData.teams);
                teamsCount = storedTeams.length;
            } catch (error) {
                console.log(`Teams table not compatible or doesn't exist, skipping teams storage:`, error.message);
                teamsError = error.message;
            }
        }

        // Try to store matches
        if (leagueData.fixtures && leagueData.fixtures.length > 0) {
            try {
                console.log(`Storing ${leagueData.fixtures.length} matches...`);
                storedMatches = await storeMatches(leagueData.fixtures);
                matchesCount = storedMatches.length;
            } catch (error) {
                console.log(`Matches table not compatible or doesn't exist, skipping matches storage:`, error.message);
                matchesError = error.message;
            }
        }

        // Create success message with details about what was stored
        let message = `Liga "${details.league_name}" została dodana pomyślnie. Dane pobrane automatycznie z API-Football`;
        let warnings = [];
        
        if (teamsCount > 0) {
            message += ` (${teamsCount} drużyn`;
        } else if (teamsError) {
            warnings.push(`Drużyny nie zostały zapisane: ${teamsError}`);
        }
        
        if (matchesCount > 0) {
            message += teamsCount > 0 ? `, ${matchesCount} meczów` : ` (${matchesCount} meczów`;
        } else if (matchesError) {
            warnings.push(`Mecze nie zostały zapisane: ${matchesError}`);
        }
        
        if (teamsCount > 0 || matchesCount > 0) {
            message += ` dla sezonu ${season})`;
        }
        
        if (warnings.length > 0) {
            message += `. Uwagi: ${warnings.join(', ')}`;
        }

        return res.status(201).json({
            response: true,
            message: message,
            data: {
                league: result[0],
                verification: {
                    season: details.season,
                    teamsCount: teamsCount,
                    fixturesCount: matchesCount,
                    verifiedAt: new Date().toISOString(),
                    autoPopulated: true
                },
                summary: {
                    teamsStored: teamsCount,
                    matchesStored: matchesCount,
                    teamsError: teamsError,
                    matchesError: matchesError
                }
            }
        });

    } catch (error) {
        console.error('Error adding league record:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas dodawania ligi"
        });
    }
}

// Refresh existing league data: re-fetch from API and upsert teams and matches
export async function refreshLeague(req, res) {
    try {
        const { league_id, season = new Date().getFullYear() } = req.body;

        if (!league_id) {
            return res.status(400).json({ response: false, message: "Brak wymaganego pola: league_id" });
        }

        // Check if league exists in our DB
        const existingLeague = await sql`
            SELECT * FROM leagues WHERE league_id = ${league_id}
        `;

        // Enforce 15-minute cooldown from last updated_at
        if (existingLeague.length > 0 && existingLeague[0].updated_at) {
            try {
                const lastUpdated = new Date(existingLeague[0].updated_at);
                const nextAllowed = new Date(lastUpdated.getTime() + 15 * 60 * 1000);
                const now = new Date();
                if (now < nextAllowed) {
                    return res.status(429).json({
                        response: false,
                        message: `Odświeżanie dostępne o ${nextAllowed.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}`,
                        nextAllowed: nextAllowed.toISOString()
                    });
                }
            } catch (tErr) {
                // If parsing fails, continue without cooldown
            }
        }

        // Fetch fresh data from API-Football
        const leagueData = await fetchLeagueDetails(league_id, season);
        if (!leagueData.exists) {
            return res.status(400).json({ response: false, message: `Liga o ID ${league_id} nie istnieje w API-Football lub nie ma dostępnych danych. ${leagueData.error || ''}` });
        }

        const details = leagueData.leagueDetails;

        // Upsert league basic data
        if (existingLeague.length === 0) {
            await sql`
                INSERT INTO leagues (
                    league_id, league_name, league_slug, league_country, logo, status
                ) VALUES (
                    ${details.league_id}, ${details.league_name}, ${details.league_slug}, ${details.league_country}, ${details.logo}, 'inactive'
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

        // Store teams and matches
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
            }
        }

        if (leagueData.fixtures && leagueData.fixtures.length > 0) {
            try {
                storedMatches = await storeMatches(leagueData.fixtures);
                matchesCount = storedMatches.length;
            } catch (error) {
                matchesError = error.message;
            }
        }

        return res.status(200).json({
            response: true,
            message: `Liga została odświeżona. Zaktualizowano dane podstawowe, drużyny i mecze dla sezonu ${season}.`,
            data: {
                league_id: details.league_id,
                season: details.season,
                updated: true,
                counts: {
                    teams: teamsCount,
                    matches: matchesCount
                },
                errors: {
                    teams: teamsError,
                    matches: matchesError
                }
            }
        });
    } catch (error) {
        console.error('Error refreshing league:', error);
        res.status(500).json({ response: false, message: 'Błąd serwera podczas odświeżania ligi' });
    }
}

// Get all leagues
export async function getAllLeagues(req, res) {
    try {
        const leagues = await sql`
            SELECT * FROM leagues 
            ORDER BY created_at DESC
        `;

        res.status(200).json({
            response: true,
            data: leagues
        });
    } catch (error) {
        console.error('Error getting leagues:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania lig"
        });
    }
}
