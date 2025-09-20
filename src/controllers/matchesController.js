import { sql } from "../config/db.js";

// Helper: get Europe/Warsaw start of today + 1 minute as JS Date
function getWarsawTodayStartPlusOneMinute() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const y = parts.find(p => p.type === 'year')?.value || '1970';
    const m = parts.find(p => p.type === 'month')?.value || '01';
    const d = parts.find(p => p.type === 'day')?.value || '01';
    return new Date(`${y}-${m}-${d}T00:01:00`);
}

// Get all matches with team details (admin)
export async function getAllMatches(req, res) {
    try {
        const matches = await sql`
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
            LEFT JOIN teams ht ON m.home_team = ht.team_id
            LEFT JOIN teams at ON m.away_team = at.team_id
            LEFT JOIN leagues l ON m.league_id = l.league_id::int
            ORDER BY m.match_date DESC, m.match_time DESC
        `;

        res.status(200).json({
            response: true,
            data: matches
        });
    } catch (error) {
        console.error('Error getting matches:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania meczów"
        });
    }
}

// Add new match
export async function addMatch(req, res) {
    try {
        const {
            home_team,
            away_team,
            home_team_score,
            away_team_score,
            match_current_time,
            league_id,
            status = 'scheduled',
            stadium,
            match_date,
            match_time,
            round,
            city,
            api_fixture_id
        } = req.body;

        console.log("Add match request:", req.body);

        // Validate required fields
        if (!home_team || !away_team || !league_id || !stadium || !match_date || !match_time) {
            return res.status(400).json({
                response: false,
                message: "Brak wymaganych pól: home_team, away_team, league_id, stadium, match_date, match_time"
            });
        }

        // Validate that home_team and away_team are different
        if (home_team === away_team) {
            return res.status(400).json({
                response: false,
                message: "Drużyna domowa i gości muszą być różne"
            });
        }

        // Validate status
        if (!['scheduled', 'live', 'finished', 'postponed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                response: false,
                message: "Status musi być jednym z: scheduled, live, finished, postponed, cancelled"
            });
        }

        // Expect home_team, away_team to be teams.team_id; validate existence
        const homeTeamCheck = await sql`
            SELECT id FROM teams WHERE team_id = ${home_team}
        `;
        const awayTeamCheck = await sql`
            SELECT id FROM teams WHERE team_id = ${away_team}
        `;

        if (homeTeamCheck.length === 0) {
            return res.status(400).json({
                response: false,
                message: "Drużyna domowa nie istnieje"
            });
        }

        if (awayTeamCheck.length === 0) {
            return res.status(400).json({
                response: false,
                message: "Drużyna gości nie istnieje"
            });
        }

        // Check if league exists
        const leagueCheck = await sql`
            SELECT id FROM leagues WHERE league_id = ${league_id.toString()}
        `;

        if (leagueCheck.length === 0) {
            return res.status(400).json({
                response: false,
                message: "Liga o podanym ID nie istnieje"
            });
        }

        // Check if API fixture ID is unique (if provided)
        if (api_fixture_id) {
            const existingFixture = await sql`
                SELECT id FROM matches WHERE api_fixture_id = ${api_fixture_id}
            `;

            if (existingFixture.length > 0) {
                return res.status(400).json({
                    response: false,
                    message: "Mecz o podanym API fixture ID już istnieje"
                });
            }
        }

        // Insert new match
        const result = await sql`
            INSERT INTO matches (
                home_team, away_team, home_team_score, away_team_score,
                match_current_time, league_id, status, stadium, match_date, match_time,
                round, city, api_fixture_id
            ) VALUES (
                ${home_team}, ${away_team}, ${home_team_score}, ${away_team_score},
                ${match_current_time || null}, ${league_id}, ${status}, ${stadium}, 
                ${match_date}, ${match_time}, ${round || null}, ${city || null}, 
                ${api_fixture_id || null}
            ) RETURNING *
        `;

        return res.status(201).json({
            response: true,
            message: "Mecz został dodany pomyślnie",
            data: result[0]
        });

    } catch (error) {
        console.error('Error adding match:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas dodawania meczu"
        });
    }
}

// Update match
export async function updateMatch(req, res) {
    try {
        const { match_id } = req.params;
        const updateData = req.body;

        console.log("Update match request:", { match_id, updateData });

        // Remove user_id from update data as it's not part of match fields
        delete updateData.user_id;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                response: false,
                message: "Brak danych do aktualizacji"
            });
        }

        // Check if match exists
        const existingMatch = await sql`
            SELECT id FROM matches 
            WHERE id = ${match_id}
        `;

        if (existingMatch.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Mecz nie istnieje"
            });
        }

        // Validate status if provided
        if (updateData.status && !['scheduled', 'live', 'finished', 'postponed', 'cancelled'].includes(updateData.status)) {
            return res.status(400).json({
                response: false,
                message: "Status musi być jednym z: scheduled, live, finished, postponed, cancelled"
            });
        }

        // Validate teams if provided
        if (updateData.home_team && updateData.away_team && updateData.home_team === updateData.away_team) {
            return res.status(400).json({
                response: false,
                message: "Drużyna domowa i gości muszą być różne"
            });
        }

        // Check if teams exist if being updated
        if (updateData.home_team) {
            const homeTeamCheck = await sql`
                SELECT id FROM teams WHERE id = ${updateData.home_team}
            `;
            if (homeTeamCheck.length === 0) {
                return res.status(400).json({
                    response: false,
                    message: "Drużyna domowa nie istnieje"
                });
            }
        }

        if (updateData.away_team) {
            const awayTeamCheck = await sql`
                SELECT id FROM teams WHERE id = ${updateData.away_team}
            `;
            if (awayTeamCheck.length === 0) {
                return res.status(400).json({
                    response: false,
                    message: "Drużyna gości nie istnieje"
                });
            }
        }

        // Build dynamic update query
        const updateFields = [];
        const updateValues = [];
        
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                updateFields.push(key);
                updateValues.push(updateData[key]);
            }
        });

        // Add updated_at
        updateFields.push('updated_at');
        updateValues.push(new Date());

        // Create SQL query dynamically
        let query = 'UPDATE matches SET ';
        const setParts = updateFields.map((field, index) => {
            if (field === 'updated_at') {
                return `${field} = NOW() + INTERVAL '2 hours'`;
            }
            return `${field} = $${index + 1}`;
        });
        query += setParts.join(', ');
        query += ` WHERE id = $${updateFields.length + 1} RETURNING *`;

        const result = await sql.unsafe(query, [...updateValues.slice(0, -1), match_id]);

        return res.status(200).json({
            response: true,
            message: "Mecz został zaktualizowany pomyślnie",
            data: result[0]
        });

    } catch (error) {
        console.error('Error updating match:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas aktualizacji meczu"
        });
    }
}

// Delete match
export async function deleteMatch(req, res) {
    try {
        const { match_id } = req.params;

        console.log("Delete match request:", { match_id });

        const result = await sql`
            DELETE FROM matches 
            WHERE id = ${match_id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Mecz nie istnieje"
            });
        }

        return res.status(200).json({
            response: true,
            message: "Mecz został usunięty pomyślnie",
            data: result[0]
        });

    } catch (error) {
        console.error('Error deleting match:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas usuwania meczu"
        });
    }
}

// Get match by ID
export async function getMatchById(req, res) {
    try {
        const { match_id } = req.params;

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
            LEFT JOIN teams ht ON m.home_team = ht.team_id
            LEFT JOIN teams at ON m.away_team = at.team_id
            LEFT JOIN leagues l ON m.league_id = l.league_id::int
            WHERE m.id = ${match_id}
        `;

        if (match.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Mecz nie istnieje"
            });
        }

        res.status(200).json({
            response: true,
            data: match[0]
        });
    } catch (error) {
        console.error('Error getting match by ID:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania meczu"
        });
    }
}

// Add match from API response
export async function addMatchFromApi(req, res) {
    try {
        const { fixture_data } = req.body;

        console.log("Add match from API request:", req.body);

        if (!fixture_data) {
            return res.status(400).json({
                response: false,
                message: "Brak danych meczu z API"
            });
        }

        const {
            fixture,
            league,
            teams,
            goals,
            score
        } = fixture_data;

        // Check if match with this API fixture ID already exists (by match_id)
        if (fixture.id) {
            const existingMatch = await sql`
                SELECT id FROM matches 
                WHERE match_id = ${fixture.id}
            `;

            if (existingMatch.length > 0) {
                return res.status(200).json({
                    response: true,
                    message: "Mecz już istnieje",
                    data: { id: existingMatch[0].id, match_id: fixture.id }
                });
            }
        }

        // Get or create home team (by team_id)
        let homeTeamId = String(teams.home.id);
        const existingHomeTeam = await sql`
            SELECT id FROM teams 
            WHERE team_id = ${homeTeamId}
        `;

        if (existingHomeTeam.length === 0) {
            // Create home team
            const homeTeamSlug = teams.home.name.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim('-');

            // Ensure slug is unique
            let finalHomeSlug = homeTeamSlug;
            let counter = 1;
            while (true) {
                const slugCheck = await sql`
                    SELECT id FROM teams 
                    WHERE slug = ${finalHomeSlug}
                `;
                
                if (slugCheck.length === 0) break;
                
                finalHomeSlug = `${homeTeamSlug}-${counter}`;
                counter++;
            }

            await sql`
                INSERT INTO teams (
                    name, slug, logo, label, country, team_id
                ) VALUES (
                    ${teams.home.name}, ${finalHomeSlug}, ${teams.home.logo}, 
                    ${teams.home.name}, 'Poland', ${homeTeamId}
                )
            `;
        }

        // Get or create away team (by team_id)
        let awayTeamId = String(teams.away.id);
        const existingAwayTeam = await sql`
            SELECT id FROM teams 
            WHERE team_id = ${awayTeamId}
        `;

        if (existingAwayTeam.length === 0) {
            // Create away team
            const awayTeamSlug = teams.away.name.toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .trim('-');

            // Ensure slug is unique
            let finalAwaySlug = awayTeamSlug;
            let counter = 1;
            while (true) {
                const slugCheck = await sql`
                    SELECT id FROM teams 
                    WHERE slug = ${finalAwaySlug}
                `;
                
                if (slugCheck.length === 0) break;
                
                finalAwaySlug = `${awayTeamSlug}-${counter}`;
                counter++;
            }

            await sql`
                INSERT INTO teams (
                    name, slug, logo, label, country, team_id
                ) VALUES (
                    ${teams.away.name}, ${finalAwaySlug}, ${teams.away.logo}, 
                    ${teams.away.name}, 'Poland', ${awayTeamId}
                )
            `;
        }

        // Parse match date and time
        const matchDate = new Date(fixture.date);
        const dateStr = matchDate.toISOString().split('T')[0];
        const timeStr = matchDate.toTimeString().split(' ')[0].substring(0, 5);

        // Map API short status to our status
        const short = fixture.status?.short || 'NS';
        const mapShortToStatus = (s) => {
            if (!s) return 'scheduled';
            const upper = String(s).toUpperCase();
            if (['NS', 'TBD', 'TBA'].includes(upper)) return 'scheduled';
            if (['FT', 'AET'].includes(upper)) return 'finished';
            if (['1H', '2H', 'HT', 'LIVE', 'ET', 'PEN'].includes(upper)) return 'live';
            if (['PST', 'SUSP', 'INT'].includes(upper)) return 'postponed';
            if (['CANC', 'ABD', 'AWD', 'WO'].includes(upper)) return 'cancelled';
            return 'scheduled';
        };
        const matchStatus = mapShortToStatus(short);

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

        // Insert new match (use team_id values) with match_id only
        const result = await sql`
            INSERT INTO matches (
                match_id, home_team, away_team, home_team_score, away_team_score,
                league_id, status, stadium, match_date, match_time,
                round, city
            ) VALUES (
                ${fixture.id}, ${homeTeamId}, ${awayTeamId}, ${homeScore}, ${awayScore},
                ${league.id}, ${matchStatus}, ${fixture.venue.name}, 
                ${dateStr}, ${timeStr}, ${league.round || null}, 
                ${fixture.venue.city || null}
            ) RETURNING *
        `;

        return res.status(201).json({
            response: true,
            message: "Mecz został dodany pomyślnie z API",
            data: result[0]
        });

    } catch (error) {
        console.error('Error adding match from API:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas dodawania meczu z API"
        });
    }
}

// Get match by API fixture ID
export async function getMatchByApiFixtureId(req, res) {
    try {
        const { api_fixture_id } = req.params;

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
            LEFT JOIN teams ht ON m.home_team = ht.team_id
            LEFT JOIN teams at ON m.away_team = at.team_id
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

// Public: Get matches for user's active tournament (by tournament's league)
export async function getMatchesForActiveTournament(req, res) {
    try {
        const { user_id } = req.query;
        const limitRaw = req.query.limit ? Number(req.query.limit) : 20;
        const beforeRaw = req.query.before ? String(req.query.before) : null;
        const filterStatusRaw = req.query.status ? String(req.query.status).toUpperCase() : null; // NS, FT, LIVE
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;
        const todayStart = getWarsawTodayStartPlusOneMinute();

        if (!user_id) return res.status(400).json({ response: false, message: 'Brak user_id' });
        const userRows = await sql`SELECT user_id, state, active_tournament FROM users WHERE user_id = ${user_id}`;
        if (userRows.length === 0) return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
        if (userRows[0].state !== 'active') return res.status(403).json({ response: false, message: 'Konto nieaktywne' });
        const activeTournamentId = userRows[0].active_tournament;
        if (!activeTournamentId) return res.status(200).json({ response: true, data: [], next_cursor: null });

        const tours = await sql`SELECT league_id FROM tournaments WHERE id = ${activeTournamentId} LIMIT 1`;
        if (tours.length === 0) return res.status(200).json({ response: true, data: [], next_cursor: null });
        const leagueId = tours[0].league_id;

        // Build conditions
        let where = sql`m.league_id = ${leagueId}`;
        let orderDir = sql`ASC`;
        if (filterStatusRaw === 'NS') {
            where = sql`${where} AND m.status = 'NS' AND (m.match_date::timestamp + m.match_time) >= ${todayStart}`;
            orderDir = sql`ASC`;
        } else if (filterStatusRaw === 'FT') {
            where = sql`${where} AND m.status = 'FT'`;
            orderDir = sql`DESC`;
        } else if (filterStatusRaw === 'LIVE') {
            where = sql`${where} AND m.status IN ('1H','2H','HT')`;
            orderDir = sql`ASC`;
        } else {
            where = sql`${where} AND (m.match_date::timestamp + m.match_time) >= ${todayStart}`;
            orderDir = sql`ASC`;
        }

        let rows = [];
        if (beforeRaw) {
            const beforeTs = new Date(beforeRaw);
            const compOp = (String(orderDir.strings?.join('') || '') === 'DESC') ? sql`<` : sql`>`;
            rows = await sql`
                SELECT m.*, 
                    ht.name as home_team_name, ht.logo as home_team_logo, ht.label as home_team_label,
                    at.name as away_team_name, at.logo as away_team_logo, at.label as away_team_label,
                    l.league_name, l.league_country,
                    (m.match_date::timestamp + m.match_time) as dt
                FROM matches m
                LEFT JOIN teams ht ON m.home_team = ht.team_id
                LEFT JOIN teams at ON m.away_team = at.team_id
                LEFT JOIN leagues l ON m.league_id = l.league_id::int
                WHERE ${where} AND (m.match_date::timestamp + m.match_time) ${compOp} ${beforeTs}
                ORDER BY dt ${orderDir}
                LIMIT ${limit + 1}
            `;
        } else {
            rows = await sql`
                SELECT m.*, 
                    ht.name as home_team_name, ht.logo as home_team_logo, ht.label as home_team_label,
                    at.name as away_team_name, at.logo as away_team_logo, at.label as away_team_label,
                    l.league_name, l.league_country,
                    (m.match_date::timestamp + m.match_time) as dt
                FROM matches m
                LEFT JOIN teams ht ON m.home_team = ht.team_id
                LEFT JOIN teams at ON m.away_team = at.team_id
                LEFT JOIN leagues l ON m.league_id = l.league_id::int
                WHERE ${where}
                ORDER BY dt ${orderDir}
                LIMIT ${limit + 1}
            `;
        }
        let next_cursor = null;
        if (rows.length > limit) {
            const last = rows[limit - 1];
            next_cursor = last.dt;
            rows = rows.slice(0, limit);
        }
        return res.status(200).json({ response: true, data: rows, next_cursor });
    } catch (error) {
        console.error('Error getting matches for active tournament:', error);
        return res.status(500).json({ response: false, message: 'Błąd serwera podczas pobierania meczów' });
    }
}

// Public: Get all matches across user's tournaments (by their leagues)
export async function getAllUserMatches(req, res) {
    try {
        const { user_id } = req.query;
        const limitRaw = req.query.limit ? Number(req.query.limit) : 20;
        const beforeRaw = req.query.before ? String(req.query.before) : null;
        const filterStatusRaw = req.query.status ? String(req.query.status).toUpperCase() : null; // NS, FT, LIVE
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;
        const todayStart = getWarsawTodayStartPlusOneMinute();
        if (!user_id) return res.status(400).json({ response: false, message: 'Brak user_id' });

        const userRows = await sql`SELECT user_id, state FROM users WHERE user_id = ${user_id}`;
        if (userRows.length === 0) return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
        if (userRows[0].state !== 'active') return res.status(403).json({ response: false, message: 'Konto nieaktywne' });

        const leagues = await sql`
            SELECT DISTINCT t.league_id
            FROM tournaments_joins tj
            JOIN tournaments t ON t.id = tj.tournament_id
            WHERE tj.user_id = ${user_id} AND tj.status IN ('pending','active')
        `;
        if (leagues.length === 0) return res.status(200).json({ response: true, data: [], next_cursor: null });
        const leagueIds = leagues.map(r => r.league_id);

        // Build conditions
        let where = sql`m.league_id = ANY(${leagueIds})`;
        let orderDir = sql`ASC`;
        if (filterStatusRaw === 'NS') {
            where = sql`${where} AND m.status = 'NS' AND (m.match_date::timestamp + m.match_time) >= ${todayStart}`;
            orderDir = sql`ASC`;
        } else if (filterStatusRaw === 'FT') {
            where = sql`${where} AND m.status = 'FT'`;
            orderDir = sql`DESC`;
        } else if (filterStatusRaw === 'LIVE') {
            where = sql`${where} AND m.status IN ('1H','2H','HT')`;
            orderDir = sql`ASC`;
        } else {
            where = sql`${where} AND (m.match_date::timestamp + m.match_time) >= ${todayStart}`;
            orderDir = sql`ASC`;
        }

        let rows = [];
        if (beforeRaw) {
            const beforeTs = new Date(beforeRaw);
            const compOp = (String(orderDir.strings?.join('') || '') === 'DESC') ? sql`<` : sql`>`;
            rows = await sql`
                SELECT m.*, 
                    ht.name as home_team_name, ht.logo as home_team_logo, ht.label as home_team_label,
                    at.name as away_team_name, at.logo as away_team_logo, at.label as away_team_label,
                    l.league_name, l.league_country,
                    (m.match_date::timestamp + m.match_time) as dt
                FROM matches m
                LEFT JOIN teams ht ON m.home_team = ht.team_id
                LEFT JOIN teams at ON m.away_team = at.team_id
                LEFT JOIN leagues l ON m.league_id = l.league_id::int
                WHERE ${where} AND (m.match_date::timestamp + m.match_time) ${compOp} ${beforeTs}
                ORDER BY dt ${orderDir}
                LIMIT ${limit + 1}
            `;
        } else {
            rows = await sql`
                SELECT m.*, 
                    ht.name as home_team_name, ht.logo as home_team_logo, ht.label as home_team_label,
                    at.name as away_team_name, at.logo as away_team_logo, at.label as away_team_label,
                    l.league_name, l.league_country,
                    (m.match_date::timestamp + m.match_time) as dt
                FROM matches m
                LEFT JOIN teams ht ON m.home_team = ht.team_id
                LEFT JOIN teams at ON m.away_team = at.team_id
                LEFT JOIN leagues l ON m.league_id = l.league_id::int
                WHERE ${where}
                ORDER BY dt ${orderDir}
                LIMIT ${limit + 1}
            `;
        }
        let next_cursor = null;
        if (rows.length > limit) {
            const last = rows[limit - 1];
            next_cursor = last.dt;
            rows = rows.slice(0, limit);
        }
        return res.status(200).json({ response: true, data: rows, next_cursor });
    } catch (error) {
        console.error('Error getting all user matches:', error);
        return res.status(500).json({ response: false, message: 'Błąd serwera podczas pobierania meczów' });
    }
}
