import { sql } from "../config/db.js";

// Helper function to log API calls to api_football_logs table
export async function logApiCall(description, url) {
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

// Fetch teams for a specific league and season
export async function fetchTeamsForLeague(leagueId, season = new Date().getFullYear()) {
    try {
        const apiKey = process.env.API_FOOTBALL_KEY;
        const teamsUrl = `https://v3.football.api-sports.io/teams?league=${leagueId}&season=${season}`;
        
        
        // Log the API call
        await logApiCall(`Fetch teams - League: ${leagueId}, Season: ${season}`, teamsUrl);
        
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
export async function fetchFixturesForLeague(leagueId, season = new Date().getFullYear()) {
    try {
        const apiKey = process.env.API_FOOTBALL_KEY;
        const url = `https://v3.football.api-sports.io/fixtures?league=${leagueId}&season=${season}&timezone=Europe/Warsaw`;

        // Log the API call
        await logApiCall(`Fetch fixtures - League: ${leagueId}, Season: ${season}`, url);

        const response = await fetch(url, {
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
        return Array.isArray(data.response) ? data.response : [];
    } catch (error) {
        console.error('Error fetching fixtures:', error);
        return [];
    }
}

// Store teams in database (custom table structure)
export async function storeTeams(teams) {
    const storedTeams = [];
    
    for (const teamData of teams) {
        const team = teamData.team;
        
        try {
            const teamIdStr = team.id ? team.id.toString() : null;
            if (!teamIdStr) continue;

            // Check if team already exists by team_id (primary external key)
            const existingById = await sql`
                SELECT id, slug FROM teams WHERE team_id = ${teamIdStr} LIMIT 1
            `;

            if (existingById.length > 0) {
                // Optionally update basic attrs (name/logo/label/country)
                try {
                    await sql`
                        UPDATE teams SET 
                            name = ${team.name},
                            logo = ${team.logo || ''},
                            label = ${team.code || team.name.substring(0, 6).toUpperCase()},
                            country = ${team.country || 'Unknown'},
                            updated_at = NOW() + INTERVAL '2 hours'
                        WHERE team_id = ${teamIdStr}
                    `;
                } catch {}
                storedTeams.push(existingById[0]);
                continue;
            }

            // Create slug from team name
            const baseSlug = team.name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim('-');

            // Ensure slug is unique
            let finalSlug = baseSlug || `team-${teamIdStr}`;
            let counter = 1;
            while (true) {
                const slugCheck = await sql`
                    SELECT id FROM teams 
                    WHERE slug = ${finalSlug}
                `;
                if (slugCheck.length === 0) break;
                finalSlug = `${baseSlug}-${counter}`;
                counter++;
            }

            // Insert new team
            const result = await sql`
                INSERT INTO teams (
                    name, slug, logo, label, country, team_id
                ) VALUES (
                    ${team.name}, ${finalSlug}, ${team.logo || ''}, 
                    ${team.code || team.name.substring(0, 6).toUpperCase()}, 
                    ${team.country || 'Unknown'}, ${teamIdStr}
                ) RETURNING *
            `;
            storedTeams.push(result[0]);
        } catch (error) {
            console.error(`Error storing team ${team?.name || 'unknown'}:`, error.message);
            // Continue with the rest; don't throw to avoid stopping matches storage
            continue;
        }
    }
    
    return storedTeams;
}

// Store matches in database (custom table structure)
export async function storeMatches(fixtures) {
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
                continue;
            }

            // Extract match date and time
            let matchDate = null;
            let matchTime = null;
            
            if (fixture.fixture?.date) {
                try {
                    const dt = getDatePartsInTZ(fixture.fixture.date, 'Europe/Warsaw');
                    matchDate = dt.date; // YYYY-MM-DD
                    matchTime = dt.time; // HH:MM:SS
                } catch (dateError) {
                    matchDate = new Date().toISOString().split('T')[0]; // fallback to today (UTC)
                    matchTime = '00:00:00'; // fallback time
                }
            }
            
            // Check if match already exists using match_id only
            const existingMatch = await sql`
                SELECT id FROM matches WHERE match_id = ${matchId} LIMIT 1
            `;

            // Determine match status 1:1 from API short code
            const status = fixture.fixture?.status?.short ? String(fixture.fixture.status.short) : 'NS';

            // Extract match current time as integer minutes
            const elapsedRaw = fixture.fixture?.status?.elapsed;
            const matchCurrentTime = (typeof elapsedRaw === 'number' && Number.isFinite(elapsedRaw)) ? elapsedRaw : null;

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
                // Insert new match (fields per mapping)
                const result = await sql`
                    INSERT INTO matches (
                        match_id, home_team, away_team, home_team_score, away_team_score,
                        match_current_time, league_id, status, stadium, match_date, match_time,
                        stadium_city, stadium_country,
                        actual_home_score, actual_away_score, goals_home, goals_away,
                        half_time_home_score, half_time_away_score,
                        full_time_home_score, full_time_away_score,
                        round
                    ) VALUES (
                        ${matchId}, ${homeTeamId}, ${awayTeamId}, 
                        ${fullTimeHomeScore ?? 0}, ${fullTimeAwayScore ?? 0},
                        ${matchCurrentTime}, ${parseInt(leagueId)}, ${status}, 
                        ${stadium}, ${matchDate}, ${matchTime},
                        ${stadiumCity}, ${stadiumCountry},
                        ${goalsHome}, ${goalsAway}, ${goalsHome}, ${goalsAway},
                        ${halfTimeHomeScore}, ${halfTimeAwayScore},
                        ${fullTimeHomeScore}, ${fullTimeAwayScore},
                        ${fixture.league?.round || fixture?.league?.round || null}
                    ) RETURNING *
                `;
                storedMatches.push(result[0]);
            } else {
                // Update existing match by id with new information
                const existingId = existingMatch[0].id;
                const result = await sql`
                    UPDATE matches SET
                        match_id = ${matchId},
                        home_team = ${homeTeamId},
                        away_team = ${awayTeamId},
                        home_team_score = ${fullTimeHomeScore ?? 0},
                        away_team_score = ${fullTimeAwayScore ?? 0},
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
                        full_time_away_score = ${fullTimeAwayScore},
                        round = ${fixture.league?.round || fixture?.league?.round || null},
                        updated_at = NOW() + INTERVAL '2 hours'
                    WHERE id = ${existingId}
                    RETURNING *
                `;
                storedMatches.push(result[0]);
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
export async function fetchLeagueDetails(leagueId, season = new Date().getFullYear()) {
    try {
        const apiKey = process.env.API_FOOTBALL_KEY;
        
        if (!apiKey) {
            console.error('API_FOOTBALL_KEY not found in environment variables');
            return { exists: false, error: 'API key not configured' };
        }

        // First, try to get league info directly from leagues endpoint
        const leaguesUrl = `https://v3.football.api-sports.io/leagues?id=${leagueId}`;
        
        
        // Log the API call
        await logApiCall(`Fetch league details - League ID: ${leagueId}`, leaguesUrl);
        
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

// Helper: format ISO date into YYYY-MM-DD and HH:MM:SS in a given timezone
function getDatePartsInTZ(isoString, timeZone = 'Europe/Warsaw') {
    const d = new Date(isoString);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value || '1970';
    const m = parts.find(p => p.type === 'month')?.value || '01';
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const hh = parts.find(p => p.type === 'hour')?.value || '00';
    const mm = parts.find(p => p.type === 'minute')?.value || '00';
    const ss = parts.find(p => p.type === 'second')?.value || '00';
    return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}:${ss}` };
}

// Check if user is admin
// Get all users with pagination and filtering
export async function getAllUsers(req, res) {
    try {
        
        const { 
            page = 1, 
            limit = 20, 
            status = 'all', 
            type = 'all',
            search = '',
            admin_user_id 
        } = req.query;


        // Check if admin_user_id is provided and is valid admin
        if (!admin_user_id) {
            return res.status(400).json({ response: false, message: 'Brak admin_user_id' });
        }

        const adminCheck = await sql`
            SELECT user_id, type FROM users WHERE user_id = ${admin_user_id}
        `;
        
        
        if (adminCheck.length === 0 || adminCheck[0].type !== 'admin') {
            return res.status(403).json({ response: false, message: 'Brak uprawnień administratora' });
        }
        

        const offset = (page - 1) * limit;
        
        // Build WHERE conditions
        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        // Status filter
        if (status !== 'all') {
            whereConditions.push(`u.state = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        // Type filter
        if (type !== 'all') {
            whereConditions.push(`u.type = $${paramIndex}`);
            params.push(type);
            paramIndex++;
        }

        // Search filter
        if (search && search.trim()) {
            whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
            params.push(`%${search.trim()}%`);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Get total count
        let totalResult;
        if (whereConditions.length === 0) {
            totalResult = await sql`SELECT COUNT(*) as total FROM users u`;
        } else if (status !== 'all' && type !== 'all' && search && search.trim()) {
            totalResult = await sql`
                SELECT COUNT(*) as total 
                FROM users u 
                WHERE u.state = ${status} AND u.type = ${type} AND (u.name ILIKE ${`%${search.trim()}%`} OR u.email ILIKE ${`%${search.trim()}%`})
            `;
        } else if (status !== 'all' && type !== 'all') {
            totalResult = await sql`
                SELECT COUNT(*) as total 
                FROM users u 
                WHERE u.state = ${status} AND u.type = ${type}
            `;
        } else if (status !== 'all' && search && search.trim()) {
            totalResult = await sql`
                SELECT COUNT(*) as total 
                FROM users u 
                WHERE u.state = ${status} AND (u.name ILIKE ${`%${search.trim()}%`} OR u.email ILIKE ${`%${search.trim()}%`})
            `;
        } else if (type !== 'all' && search && search.trim()) {
            totalResult = await sql`
                SELECT COUNT(*) as total 
                FROM users u 
                WHERE u.type = ${type} AND (u.name ILIKE ${`%${search.trim()}%`} OR u.email ILIKE ${`%${search.trim()}%`})
            `;
        } else if (status !== 'all') {
            totalResult = await sql`
                SELECT COUNT(*) as total 
                FROM users u 
                WHERE u.state = ${status}
            `;
        } else if (type !== 'all') {
            totalResult = await sql`
                SELECT COUNT(*) as total 
                FROM users u 
                WHERE u.type = ${type}
            `;
        } else if (search && search.trim()) {
            totalResult = await sql`
                SELECT COUNT(*) as total 
                FROM users u 
                WHERE u.name ILIKE ${`%${search.trim()}%`} OR u.email ILIKE ${`%${search.trim()}%`}
            `;
        }
        const total = parseInt(totalResult[0].total);

        // Get users with statistics
        let users;
        if (whereConditions.length === 0) {
            users = await sql`
                SELECT 
                    u.user_id,
                    u.email,
                    u.name,
                    u.type,
                    u.state,
                    u.avatar,
                    u.register_at,
                    u.logged_at as last_login,
                    0 as tournaments_count,
                    0 as predictions_count,
                    0 as total_points
                FROM users u
                ORDER BY u.register_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else if (status !== 'all' && type !== 'all' && search && search.trim()) {
            users = await sql`
                SELECT 
                    u.user_id,
                    u.email,
                    u.name,
                    u.type,
                    u.state,
                    u.avatar,
                    u.created_at as register_at,
                    u.last_login,
                    COALESCE(tournament_stats.tournaments_count, 0) as tournaments_count,
                    COALESCE(prediction_stats.predictions_count, 0) as predictions_count,
                    COALESCE(prediction_stats.total_points, 0) as total_points
                FROM users u
                LEFT JOIN (
                    SELECT 
                        created_by as user_id,
                        COUNT(*) as tournaments_count
                    FROM tournaments 
                    GROUP BY created_by
                ) tournament_stats ON u.user_id = tournament_stats.user_id
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(*) as predictions_count,
                        SUM(points) as total_points
                    FROM predictions 
                    GROUP BY user_id
                ) prediction_stats ON u.user_id = prediction_stats.user_id
                WHERE u.state = ${status} AND u.type = ${type} AND (u.name ILIKE ${`%${search.trim()}%`} OR u.email ILIKE ${`%${search.trim()}%`})
                ORDER BY u.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else if (status !== 'all' && type !== 'all') {
            users = await sql`
                SELECT 
                    u.user_id,
                    u.email,
                    u.name,
                    u.type,
                    u.state,
                    u.avatar,
                    u.created_at as register_at,
                    u.last_login,
                    COALESCE(tournament_stats.tournaments_count, 0) as tournaments_count,
                    COALESCE(prediction_stats.predictions_count, 0) as predictions_count,
                    COALESCE(prediction_stats.total_points, 0) as total_points
                FROM users u
                LEFT JOIN (
                    SELECT 
                        created_by as user_id,
                        COUNT(*) as tournaments_count
                    FROM tournaments 
                    GROUP BY created_by
                ) tournament_stats ON u.user_id = tournament_stats.user_id
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(*) as predictions_count,
                        SUM(points) as total_points
                    FROM predictions 
                    GROUP BY user_id
                ) prediction_stats ON u.user_id = prediction_stats.user_id
                WHERE u.state = ${status} AND u.type = ${type}
                ORDER BY u.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else if (status !== 'all' && search && search.trim()) {
            users = await sql`
                SELECT 
                    u.user_id,
                    u.email,
                    u.name,
                    u.type,
                    u.state,
                    u.avatar,
                    u.created_at as register_at,
                    u.last_login,
                    COALESCE(tournament_stats.tournaments_count, 0) as tournaments_count,
                    COALESCE(prediction_stats.predictions_count, 0) as predictions_count,
                    COALESCE(prediction_stats.total_points, 0) as total_points
                FROM users u
                LEFT JOIN (
                    SELECT 
                        created_by as user_id,
                        COUNT(*) as tournaments_count
                    FROM tournaments 
                    GROUP BY created_by
                ) tournament_stats ON u.user_id = tournament_stats.user_id
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(*) as predictions_count,
                        SUM(points) as total_points
                    FROM predictions 
                    GROUP BY user_id
                ) prediction_stats ON u.user_id = prediction_stats.user_id
                WHERE u.state = ${status} AND (u.name ILIKE ${`%${search.trim()}%`} OR u.email ILIKE ${`%${search.trim()}%`})
                ORDER BY u.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else if (type !== 'all' && search && search.trim()) {
            users = await sql`
                SELECT 
                    u.user_id,
                    u.email,
                    u.name,
                    u.type,
                    u.state,
                    u.avatar,
                    u.created_at as register_at,
                    u.last_login,
                    COALESCE(tournament_stats.tournaments_count, 0) as tournaments_count,
                    COALESCE(prediction_stats.predictions_count, 0) as predictions_count,
                    COALESCE(prediction_stats.total_points, 0) as total_points
                FROM users u
                LEFT JOIN (
                    SELECT 
                        created_by as user_id,
                        COUNT(*) as tournaments_count
                    FROM tournaments 
                    GROUP BY created_by
                ) tournament_stats ON u.user_id = tournament_stats.user_id
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(*) as predictions_count,
                        SUM(points) as total_points
                    FROM predictions 
                    GROUP BY user_id
                ) prediction_stats ON u.user_id = prediction_stats.user_id
                WHERE u.type = ${type} AND (u.name ILIKE ${`%${search.trim()}%`} OR u.email ILIKE ${`%${search.trim()}%`})
                ORDER BY u.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else if (status !== 'all') {
            users = await sql`
                SELECT 
                    u.user_id,
                    u.email,
                    u.name,
                    u.type,
                    u.state,
                    u.avatar,
                    u.created_at as register_at,
                    u.last_login,
                    COALESCE(tournament_stats.tournaments_count, 0) as tournaments_count,
                    COALESCE(prediction_stats.predictions_count, 0) as predictions_count,
                    COALESCE(prediction_stats.total_points, 0) as total_points
                FROM users u
                LEFT JOIN (
                    SELECT 
                        created_by as user_id,
                        COUNT(*) as tournaments_count
                    FROM tournaments 
                    GROUP BY created_by
                ) tournament_stats ON u.user_id = tournament_stats.user_id
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(*) as predictions_count,
                        SUM(points) as total_points
                    FROM predictions 
                    GROUP BY user_id
                ) prediction_stats ON u.user_id = prediction_stats.user_id
                WHERE u.state = ${status}
                ORDER BY u.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else if (type !== 'all') {
            users = await sql`
                SELECT 
                    u.user_id,
                    u.email,
                    u.name,
                    u.type,
                    u.state,
                    u.avatar,
                    u.created_at as register_at,
                    u.last_login,
                    COALESCE(tournament_stats.tournaments_count, 0) as tournaments_count,
                    COALESCE(prediction_stats.predictions_count, 0) as predictions_count,
                    COALESCE(prediction_stats.total_points, 0) as total_points
                FROM users u
                LEFT JOIN (
                    SELECT 
                        created_by as user_id,
                        COUNT(*) as tournaments_count
                    FROM tournaments 
                    GROUP BY created_by
                ) tournament_stats ON u.user_id = tournament_stats.user_id
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(*) as predictions_count,
                        SUM(points) as total_points
                    FROM predictions 
                    GROUP BY user_id
                ) prediction_stats ON u.user_id = prediction_stats.user_id
                WHERE u.type = ${type}
                ORDER BY u.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else if (search && search.trim()) {
            users = await sql`
                SELECT 
                    u.user_id,
                    u.email,
                    u.name,
                    u.type,
                    u.state,
                    u.avatar,
                    u.created_at as register_at,
                    u.last_login,
                    COALESCE(tournament_stats.tournaments_count, 0) as tournaments_count,
                    COALESCE(prediction_stats.predictions_count, 0) as predictions_count,
                    COALESCE(prediction_stats.total_points, 0) as total_points
                FROM users u
                LEFT JOIN (
                    SELECT 
                        created_by as user_id,
                        COUNT(*) as tournaments_count
                    FROM tournaments 
                    GROUP BY created_by
                ) tournament_stats ON u.user_id = tournament_stats.user_id
                LEFT JOIN (
                    SELECT 
                        user_id,
                        COUNT(*) as predictions_count,
                        SUM(points) as total_points
                    FROM predictions 
                    GROUP BY user_id
                ) prediction_stats ON u.user_id = prediction_stats.user_id
                WHERE u.name ILIKE ${`%${search.trim()}%`} OR u.email ILIKE ${`%${search.trim()}%`}
                ORDER BY u.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        }

        return res.status(200).json({
            response: true,
            data: {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({
            response: false,
            message: 'Błąd serwera podczas pobierania użytkowników'
        });
    }
}

// Update user status
export async function updateUserStatus(req, res) {
    try {
        const { user_id, new_status, admin_user_id } = req.body;

        if (!user_id || !new_status || !admin_user_id) {
            return res.status(400).json({
                response: false,
                message: 'Brak wymaganych pól: user_id, new_status, admin_user_id'
            });
        }

        // Check if admin_user_id is valid admin
        const adminCheck = await sql`
            SELECT user_id, type FROM users WHERE user_id = ${admin_user_id}
        `;
        
        if (adminCheck.length === 0 || adminCheck[0].type !== 'admin') {
            return res.status(403).json({ response: false, message: 'Brak uprawnień administratora' });
        }

        // Validate status
        const validStatuses = ['active', 'inactive', 'banned'];
        if (!validStatuses.includes(new_status)) {
            return res.status(400).json({
                response: false,
                message: 'Nieprawidłowy status. Dozwolone: active, inactive, banned'
            });
        }

        // Check if user exists
        const userCheck = await sql`
            SELECT user_id, state, type FROM users WHERE user_id = ${user_id}
        `;
        
        if (userCheck.length === 0) {
            return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
        }

        // Prevent admin from changing their own status
        if (user_id === admin_user_id) {
            return res.status(400).json({
                response: false,
                message: 'Nie możesz zmienić statusu własnego konta'
            });
        }

        // Update user status
        const result = await sql`
            UPDATE users 
            SET state = ${new_status}, updated_at = NOW() + INTERVAL '2 hours'
            WHERE user_id = ${user_id}
            RETURNING user_id, name, email, state, type
        `;

        return res.status(200).json({
            response: true,
            message: `Status użytkownika ${result[0].name} został zmieniony na ${new_status}`,
            data: result[0]
        });

    } catch (error) {
        console.error('Error updating user status:', error);
        return res.status(500).json({
            response: false,
            message: 'Błąd serwera podczas aktualizacji statusu użytkownika'
        });
    }
}

// Get user details for drawer
export async function getUserDetails(req, res) {
    try {
        const { user_id, admin_user_id } = req.query;

        if (!user_id || !admin_user_id) {
            return res.status(400).json({
                response: false,
                message: 'Brak wymaganych pól: user_id, admin_user_id'
            });
        }

        // Check if admin_user_id is valid admin
        const adminCheck = await sql`
            SELECT user_id, type FROM users WHERE user_id = ${admin_user_id}
        `;
        
        if (adminCheck.length === 0 || adminCheck[0].type !== 'admin') {
            return res.status(403).json({ response: false, message: 'Brak uprawnień administratora' });
        }


        const userResult = await sql`
            SELECT 
                u.user_id,
                u.email,
                u.name,
                u.type,
                u.state,
                u.avatar,
                u.register_at,
                u.logged_at as last_login,
                u.updated_at,
                0 as tournaments_count,
                0 as tournaments_created,
                0 as joined_tournaments,
                0 as predictions_count,
                0 as total_points,
                0 as correct_predictions,
                0 as activities_count
            FROM users u
            WHERE u.user_id = ${user_id}
        `;
        
        if (userResult.length === 0) {
            return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
        }

        // Get recent activities
        const recentActivities = await sql`
            SELECT icon, type, title, message, created_at, action_url
            FROM activities 
            WHERE user_id = ${user_id}
            ORDER BY created_at DESC
            LIMIT 10
        `;

        // Get recent tournaments
        const recentTournaments = await sql`
            SELECT t.id, t.name, t.status, t.created_at, tj.status as join_status
            FROM tournaments t
            LEFT JOIN tournaments_joins tj ON t.id = tj.tournament_id AND tj.user_id = ${user_id}
            WHERE t.created_by = ${user_id} OR tj.user_id = ${user_id}
            ORDER BY t.created_at DESC
            LIMIT 5
        `;

        return res.status(200).json({
            response: true,
            data: {
                user: userResult[0],
                recentActivities,
                recentTournaments
            }
        });

    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.status(500).json({
            response: false,
            message: 'Błąd serwera podczas pobierania szczegółów użytkownika'
        });
    }
}

export async function checkAdminUser(req, res, next) {
    try {
        
        // For user management endpoints, use admin_user_id; for others use user_id
        let user_id;
        if (req.path.includes('/users/') || req.path === '/users') {
            // For user management endpoints, always use admin_user_id
            user_id = req.method === 'GET' ? req.query.admin_user_id : req.body.admin_user_id;
        } else {
            // For other endpoints, use user_id or admin_user_id
            user_id = req.method === 'GET' 
                ? (req.query.user_id || req.query.admin_user_id)
                : (req.body.user_id || req.body.admin_user_id);
        }
        
        if (!user_id) {
            return res.status(400).json({
                response: false,
                message: "Brak user_id lub admin_user_id"
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
                const verification = await verifyLeagueExists(league_id, new Date().getFullYear());

                if (!verification.exists) {
                    return res.status(400).json({
                        response: false,
                        message: `Liga o ID ${league_id} nie istnieje w API-Football lub nie ma dostępnych meczów. ${verification.error || ''}`
                    });
                }


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
        const leagueData = await fetchLeagueDetails(league_id, season);

        if (!leagueData.exists) {
            return res.status(400).json({
                response: false,
                message: `Liga o ID ${league_id} nie istnieje w API-Football lub nie ma dostępnych danych. ${leagueData.error || ''}`
            });
        }

        const details = leagueData.leagueDetails;

        // Insert new league with data fetched from API-Football
        const result = await sql`
            INSERT INTO leagues (
                league_id, league_name, league_slug, league_country, 
                logo, status, season
            ) VALUES (
                ${details.league_id}, ${details.league_name}, ${details.league_slug}, ${details.league_country}, 
                ${details.logo}, ${status}, ${season}
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
                storedTeams = await storeTeams(leagueData.teams);
                teamsCount = storedTeams.length;
            } catch (error) {
                teamsError = error.message;
            }
        }
        // Try to store matches
        if (leagueData.fixtures && leagueData.fixtures.length > 0) {
            try {
                storedMatches = await storeMatches(leagueData.fixtures);
                matchesCount = storedMatches.length;
            } catch (error) {
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
                // Check cooldown using database time comparison for accuracy
                const cooldownCheck = await sql`
                    SELECT 
                        updated_at,
                        (updated_at + INTERVAL '15 minutes') as next_allowed,
                        NOW() + INTERVAL '2 hours' as current_time,
                        (NOW() + INTERVAL '2 hours') < (updated_at + INTERVAL '15 minutes') as is_cooldown_active
                    FROM leagues 
                    WHERE league_id = ${league_id}
                `;
                
                if (cooldownCheck.length > 0 && cooldownCheck[0].is_cooldown_active) {
                    const nextAllowed = new Date(cooldownCheck[0].next_allowed);
                    return res.status(429).json({
                        response: false,
                        message: `Odświeżanie dostępne o ${nextAllowed.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })}`,
                        nextAllowed: nextAllowed.toISOString(),
                        lastUpdated: cooldownCheck[0].updated_at
                    });
                }
            } catch (tErr) {
                console.error('Error checking cooldown:', tErr);
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

// Get API football logs (admin only)
export async function getApiFootballLogs(req, res) {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        // Get total count
        const totalResult = await sql`
            SELECT COUNT(*) as total FROM api_football_logs
        `;
        const total = parseInt(totalResult[0].total);

        // Get all logs to count today's logs based on actual created_at dates
        const allLogsResult = await sql`
            SELECT created_at FROM api_football_logs
            ORDER BY created_at DESC
        `;
        
        // Count logs from today using JavaScript date comparison for accuracy
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        const todayCount = allLogsResult.filter(log => {
            const logDate = new Date(log.created_at);
            return logDate >= todayStart && logDate < todayEnd;
        }).length;

        // Group logs by day for additional statistics
        const logsByDay = {};
        allLogsResult.forEach(log => {
            const logDate = new Date(log.created_at);
            const dateKey = logDate.toISOString().split('T')[0]; // YYYY-MM-DD format
            
            if (!logsByDay[dateKey]) {
                logsByDay[dateKey] = 0;
            }
            logsByDay[dateKey]++;
        });

        // Get logs with pagination, sorted by created_at DESC
        const logs = await sql`
            SELECT id, description, created_at, url
            FROM api_football_logs
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        return res.status(200).json({
            response: true,
            data: {
                logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                },
                todayCount,
                logsByDay
            }
        });

    } catch (error) {
        console.error('Error fetching API football logs:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania logów API"
        });
    }
}
