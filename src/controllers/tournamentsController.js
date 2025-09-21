import { sql } from "../config/db.js";
import { addActivityInternal } from "./activitiesController.js";

// Get all active tournaments with relations (public endpoint)
export async function getAllTournaments(req, res) {
    try {
        const userId = req.query.user_id;
        if (!userId) {
            return res.status(401).json({ response: false, message: 'Brak user_id' });
        }
        const user = await sql`SELECT user_id, state FROM users WHERE user_id = ${userId}`;
        if (user.length === 0) {
            return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
        }
        if (user[0].state !== 'active') {
            return res.status(403).json({ response: false, message: 'Konto nieaktywne' });
        }
        const tournaments = await sql`
            SELECT 
                t.*,
                l.league_name,
                l.league_country,
                l.logo as league_logo,
                l.league_slug,
                (
                  SELECT COUNT(*)::int 
                  FROM tournaments_joins tjc 
                  WHERE tjc.tournament_id = t.id AND tjc.status IN ('pending','active')
                ) AS join_count,
                (tj.id IS NOT NULL) AS joined, tj.status AS join_status, tj.local_ranking AS join_local_ranking, tj.points AS join_points
            FROM tournaments t
            LEFT JOIN leagues l ON t.league_id = l.league_id::int
            LEFT JOIN tournaments_joins tj ON tj.tournament_id = t.id AND tj.user_id = ${userId}
            WHERE t.status != 'inactive'
            ORDER BY t.created_at DESC
        `;

        // Fetch matches for each tournament
        const tournamentsWithRelations = await Promise.all(
            tournaments.map(async (tournament) => {
                // Get matches information (if matches table exists)
                let matches = [];
                if (tournament.matches && tournament.matches.length > 0) {
                    try {
                        const matchesData = await sql`
                            SELECT *
                            FROM matches 
                            WHERE id = ANY(${tournament.matches})
                        `;
                        matches = matchesData;
                    } catch (error) {
                        // Matches table might not exist yet, ignore error
                        // Matches table not found, skipping matches data
                    }
                }

                return {
                    ...tournament,
                    league: {
                        league_name: tournament.league_name,
                        league_country: tournament.league_country,
                        logo: tournament.league_logo,
                        league_slug: tournament.league_slug
                    },
                    joined: tournament.joined || false,
                    join_status: tournament.join_status || null,
                    join_local_ranking: tournament.join_local_ranking ?? null,
                    join_points: tournament.join_points ?? 0,
                    join_count: tournament.join_count || 0,
                    matches: matches,
                    // Remove the individual league fields from the root object
                    league_name: undefined,
                    league_country: undefined,
                    league_logo: undefined,
                    league_slug: undefined
                };
            })
        );

        res.status(200).json({
            response: true,
            data: tournamentsWithRelations
        });
    } catch (error) {
        console.error('Error getting tournaments:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania turniejów"
        });
    }
}

// Public: Join tournament
export async function joinTournament(req, res) {
    try {
        const { user_id, tournament_id } = req.body;
        if (!user_id || !tournament_id) {
            return res.status(400).json({ response: false, message: 'Brak wymaganych pól: user_id, tournament_id' });
        }
        const user = await sql`SELECT user_id, state FROM users WHERE user_id = ${user_id}`;
        if (user.length === 0) {
            return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
        }
        if (user[0].state !== 'active') {
            return res.status(403).json({ response: false, message: 'Konto nieaktywne' });
        }

        // Ensure tournament exists
        const tour = await sql`SELECT id, max_participants, name FROM tournaments WHERE id = ${tournament_id}`;
        if (tour.length === 0) {
            return res.status(404).json({ response: false, message: 'Turniej nie istnieje' });
        }

        // Check if already joined
        const existing = await sql`SELECT id FROM tournaments_joins WHERE tournament_id = ${tournament_id} AND user_id = ${user_id}`;
        if (existing.length > 0) {
            return res.status(200).json({ response: true, message: 'Już dołączyłeś do tego turnieju' });
        }

        // Insert join as pending
        const inserted = await sql`
            INSERT INTO tournaments_joins (tournament_id, user_id, status)
            VALUES (${tournament_id}, ${user_id}, 'pending')
            RETURNING *
        `;

        try {
            await sql`
                UPDATE users
                SET active_tournament = ${tournament_id}, updated_at = NOW()
                WHERE user_id = ${user_id}
            `;
        } catch (e) {}

        // Activity log
        addActivityInternal(user_id, {
            icon: '🏆',
            type: 'tournament_join',
            title: 'Zgłoszenie do turnieju',
            message: `Dołączyłeś do turnieju ${tour[0].name || 'bez nazwy'}`,
            action_url: `/panel/turnieje/${tournament_id}`
        });

        return res.status(201).json({ response: true, message: 'Zgłoszenie do turnieju wysłane', data: inserted[0] });
    } catch (error) {
        console.error('Error joining tournament:', error);
        return res.status(500).json({ response: false, message: 'Błąd serwera podczas dołączania do turnieju' });
    }
}

// Public: Get participants of a tournament
export async function getTournamentParticipants(req, res) {
    try {
        const { tournament_id } = req.params;
        const { user_id } = req.query;
        if (!user_id) return res.status(401).json({ response: false, message: 'Brak user_id' });
        const user = await sql`SELECT user_id, state FROM users WHERE user_id = ${user_id}`;
        if (user.length === 0) return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
        if (user[0].state !== 'active') return res.status(403).json({ response: false, message: 'Konto nieaktywne' });

        // Ensure tournament exists
        const tour = await sql`SELECT id FROM tournaments WHERE id = ${tournament_id}`;
        if (tour.length === 0) return res.status(404).json({ response: false, message: 'Turniej nie istnieje' });

        const participants = await sql`
            SELECT u.user_id, u.name, u.avatar, tj.status AS join_status, tj.points, tj.local_ranking
            FROM tournaments_joins tj
            JOIN users u ON u.user_id = tj.user_id
            WHERE tj.tournament_id = ${tournament_id}
            ORDER BY 
                CASE tj.status WHEN 'active' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
                tj.points DESC
        `;

        return res.status(200).json({ response: true, data: participants });
    } catch (e) {
        console.error('Error getting participants:', e);
        return res.status(500).json({ response: false, message: 'Błąd serwera podczas pobierania uczestników' });
    }
}

// Public: Get active tournament details for a user
export async function getActiveTournament(req, res) {
    try {
        const { user_id } = req.query;
        if (!user_id) return res.status(401).json({ response: false, message: 'Brak user_id' });
        const user = await sql`SELECT user_id, state, active_tournament FROM users WHERE user_id = ${user_id}`;
        if (user.length === 0) return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
        if (user[0].state !== 'active') return res.status(403).json({ response: false, message: 'Konto nieaktywne' });

        const activeId = user[0].active_tournament;
        if (!activeId) return res.status(200).json({ response: true, data: null });

        const rows = await sql`
            SELECT t.*, 
                   l.league_name, l.league_country, l.logo AS league_logo, l.league_slug,
                   (SELECT COUNT(*)::int FROM tournaments_joins tjc WHERE tjc.tournament_id = t.id AND tjc.status IN ('pending','active')) AS join_count,
                   tj.status AS join_status, tj.local_ranking AS join_local_ranking, tj.points AS join_points
            FROM tournaments t
            LEFT JOIN leagues l ON t.league_id = l.league_id::int
            LEFT JOIN tournaments_joins tj ON tj.tournament_id = t.id AND tj.user_id = ${user_id}
            WHERE t.id = ${activeId}
            LIMIT 1
        `;
        if (rows.length === 0) return res.status(200).json({ response: true, data: null });

        const t = rows[0];
        const data = {
            ...t,
            league: {
                league_name: t.league_name,
                league_country: t.league_country,
                logo: t.league_logo,
                league_slug: t.league_slug
            },
            join_count: t.join_count || 0,
            join_status: t.join_status || null,
            join_local_ranking: t.join_local_ranking ?? null,
            join_points: t.join_points ?? 0,
            league_name: undefined,
            league_country: undefined,
            league_logo: undefined,
            league_slug: undefined
        };
        return res.status(200).json({ response: true, data });
    } catch (e) {
        console.error('Error getting active tournament:', e);
        return res.status(500).json({ response: false, message: 'Błąd serwera' });
    }
}

// Public: Set active tournament for a user
export async function setActiveTournament(req, res) {
    try {
        const { user_id, tournament_id } = req.body;
        if (!user_id || !tournament_id) return res.status(400).json({ response: false, message: 'Brak wymaganych pól: user_id, tournament_id' });
        const user = await sql`SELECT user_id, state FROM users WHERE user_id = ${user_id}`;
        if (user.length === 0) return res.status(404).json({ response: false, message: 'Użytkownik nie istnieje' });
        if (user[0].state !== 'active') return res.status(403).json({ response: false, message: 'Konto nieaktywne' });

        const tour = await sql`SELECT id FROM tournaments WHERE id = ${tournament_id}`;
        if (tour.length === 0) return res.status(404).json({ response: false, message: 'Turniej nie istnieje' });

        // opcjonalnie: sprawdź, czy user jest uczestnikiem
        const joined = await sql`SELECT 1 FROM tournaments_joins WHERE tournament_id = ${tournament_id} AND user_id = ${user_id} LIMIT 1`;
        if (joined.length === 0) return res.status(403).json({ response: false, message: 'Nie jesteś uczestnikiem tego turnieju' });

        await sql`UPDATE users SET active_tournament = ${tournament_id}, updated_at = NOW() WHERE user_id = ${user_id}`;
        // addActivityInternal(user_id, {
        //     icon: '🎯',
        //     type: 'active_tournament_change',
        //     title: 'Aktywny turniej zmieniony',
        //     message: `Ustawiono aktywny turniej (${tournament_id})`,
        //     action_url: `/panel/turnieje/${tournament_id}`
        // });
        return res.status(200).json({ response: true, message: 'Aktywny turniej został ustawiony' });
    } catch (e) {
        console.error('Error setting active tournament:', e);
        return res.status(500).json({ response: false, message: 'Błąd serwera' });
    }
}

// Admin: Get all tournaments (including inactive)
export async function getAllTournamentsAdmin(req, res) {
    try {
        const tournaments = await sql`
            SELECT 
                t.*,
                l.league_name,
                l.league_country,
                l.logo as league_logo,
                l.league_slug
            FROM tournaments t
            LEFT JOIN leagues l ON t.league_id = l.league_id::int
            ORDER BY t.created_at DESC
        `;

        // Fetch matches for each tournament
        const tournamentsWithRelations = await Promise.all(
            tournaments.map(async (tournament) => {
                // Get matches information (if matches table exists)
                let matches = [];
                if (tournament.matches && tournament.matches.length > 0) {
                    try {
                        const matchesData = await sql`
                            SELECT *
                            FROM matches 
                            WHERE id = ANY(${tournament.matches})
                        `;
                        matches = matchesData;
                    } catch (error) {
                        // Matches table might not exist yet, ignore error
                        // Matches table not found, skipping matches data
                    }
                }

                return {
                    ...tournament,
                    league: {
                        league_name: tournament.league_name,
                        league_country: tournament.league_country,
                        logo: tournament.league_logo,
                        league_slug: tournament.league_slug
                    },
                    matches: matches,
                    // Remove the individual league fields from the root object
                    league_name: undefined,
                    league_country: undefined,
                    league_logo: undefined,
                    league_slug: undefined
                };
            })
        );

        res.status(200).json({
            response: true,
            data: tournamentsWithRelations
        });
    } catch (error) {
        console.error('Error getting admin tournaments:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania turniejów"
        });
    }
}

// Admin: Add new tournament
export async function addTournament(req, res) {
    try {
        const {
            name,
            slug,
            description,
            status = 'inactive',
            league_id,
            max_participants,
            start_date,
            matches = [],
            update_times = [],
            end_date,
            entry_fee = 0,
            prize_pool = 0,
            created_by
        } = req.body;

        // Add tournament request

        // Validate required fields
        if (!name || !slug || !league_id || !max_participants || !start_date || !created_by) {
            return res.status(400).json({
                response: false,
                message: "Brak wymaganych pól: name, slug, league_id, max_participants, start_date, created_by"
            });
        }

        // Validate status
        if (!['inactive', 'open', 'closed', 'finished'].includes(status)) {
            return res.status(400).json({
                response: false,
                message: "Status musi być jednym z: 'inactive', 'open', 'closed', 'finished'"
            });
        }

        // Validate arrays
        if (!Array.isArray(matches) || !Array.isArray(update_times)) {
            return res.status(400).json({
                response: false,
                message: "matches i update_times muszą być tablicami"
            });
        }

        // Validate update_times format
        for (const time of update_times) {
            if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                return res.status(400).json({
                    response: false,
                    message: `Nieprawidłowy format czasu: ${time}. Użyj formatu HH:MM`
                });
            }
        }

        // Normalize optional fields
        const descriptionValue = description || '';
        const endDateValue = (end_date && !isNaN(Date.parse(end_date))) ? end_date : null;

        // Check if league exists
        const league = await sql`
            SELECT id FROM leagues 
            WHERE league_id = ${league_id.toString()}
        `;

        if (league.length === 0) {
            return res.status(400).json({
                response: false,
                message: "Liga o podanym league_id nie istnieje"
            });
        }

        // Check if slug is unique
        const existingTournament = await sql`
            SELECT id FROM tournaments 
            WHERE slug = ${slug}
        `;

        if (existingTournament.length > 0) {
            return res.status(400).json({
                response: false,
                message: "Turniej o podanym slug już istnieje"
            });
        }

        // Insert new tournament
        const result = await sql`
            INSERT INTO tournaments (
                name, slug, description, status, league_id, 
                max_participants, start_date, matches, update_times, 
                end_date, entry_fee, prize_pool, created_by
            ) VALUES (
                ${name}, ${slug}, ${descriptionValue}, ${status}, ${league_id}, 
                ${max_participants}, ${start_date}, ${matches}, 
                ${update_times}, ${endDateValue}, ${entry_fee}, ${prize_pool}, ${created_by}
            ) RETURNING *
        `;

        return res.status(201).json({
            response: true,
            message: `Turniej "${name}" został dodany pomyślnie`,
            data: result[0]
        });

    } catch (error) {
        console.error('Error adding tournament:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas dodawania turnieju"
        });
    }
}

// Admin: Update tournament
export async function updateTournament(req, res) {
    try {
        const { tournament_id } = req.params;
        const updateData = req.body;

        // Update tournament request

        // Remove user_id from update data as it's not part of tournament fields
        delete updateData.user_id;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                response: false,
                message: "Brak danych do aktualizacji"
            });
        }

        // Check if tournament exists
        const existingTournament = await sql`
            SELECT id FROM tournaments 
            WHERE id = ${tournament_id}
        `;

        if (existingTournament.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Turniej nie istnieje"
            });
        }

        // Validate status if provided
        if (updateData.status && !['inactive', 'open', 'closed', 'finished'].includes(updateData.status)) {
            return res.status(400).json({
                response: false,
                message: "Status musi być jednym z: 'inactive', 'open', 'closed', 'finished'"
            });
        }

        if (updateData.matches && !Array.isArray(updateData.matches)) {
            return res.status(400).json({
                response: false,
                message: "matches musi być tablicą"
            });
        }

        if (updateData.update_times && !Array.isArray(updateData.update_times)) {
            return res.status(400).json({
                response: false,
                message: "update_times musi być tablicą"
            });
        }

        // Validate update_times format if provided
        if (updateData.update_times) {
            for (const time of updateData.update_times) {
                if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                    return res.status(400).json({
                        response: false,
                        message: `Nieprawidłowy format czasu: ${time}. Użyj formatu HH:MM`
                    });
                }
            }
        }

        // Whitelist allowed fields
        const allowedFields = new Set([
            'name', 'description', 'status', 'league_id', 'max_participants',
            'start_date', 'matches', 'update_times', 'end_date', 'entry_fee', 'prize_pool'
        ]);
        const updateFields = Object.keys(updateData).filter(k => updateData[k] !== undefined && allowedFields.has(k));
        const updateValues = updateFields.map(k => updateData[k]);

        if (updateFields.length === 0) {
            return res.status(400).json({ response: false, message: 'Brak dozwolonych pól do aktualizacji' });
        }

        // If status is provided, update it directly first (ensures status always persists)
        if (updateData.status !== undefined) {
            await sql`
                UPDATE tournaments
                SET status = ${updateData.status}, updated_at = NOW()
                WHERE id = ${tournament_id}
            `;
            // Remove status from dynamic set
            const idx = updateFields.indexOf('status');
            if (idx !== -1) {
                updateFields.splice(idx, 1);
                updateValues.splice(idx, 1);
            }
        }

        // Apply update_times with a dedicated parameterized update (ensures proper array handling)
        if (updateData.update_times !== undefined) {
            await sql`
                UPDATE tournaments
                SET update_times = ${updateData.update_times}, updated_at = NOW()
                WHERE id = ${tournament_id}
            `;
            const idxUT = updateFields.indexOf('update_times');
            if (idxUT !== -1) {
                updateFields.splice(idxUT, 1);
                updateValues.splice(idxUT, 1);
            }
        }

        // Create SQL query dynamically for remaining fields
        let query = 'UPDATE tournaments SET ';
        const setParts = [];
        let paramIndex = 1;
        for (const field of updateFields) {
            if (field === 'updated_at') {
                // Ignore any provided value for updated_at
                continue;
            }
            // Cast specific field types to ensure proper binding
            if (field === 'matches') {
                setParts.push(`${field} = CAST($${paramIndex} AS INT[])`);
            } else if (field === 'league_id') {
                setParts.push(`${field} = CAST($${paramIndex} AS INT)`);
            } else {
                setParts.push(`${field} = $${paramIndex}`);
            }
            paramIndex += 1;
        }
        // Always update updated_at using server time
        setParts.push(`updated_at = NOW()`);
        query += setParts.join(', ');
        // WHERE placeholder index should be the next param index
        query += ` WHERE id = $${paramIndex} RETURNING *`;

        let result = [];
        if (updateFields.length > 0) {
            result = await sql.unsafe(
                query,
                [
                    ...updateValues.filter((_, i) => updateFields[i] !== 'updated_at'),
                    tournament_id
                ]
            );
        } else {
            // Only status/update_times updated; fetch the updated row
            result = await sql`
                SELECT * FROM tournaments WHERE id = ${tournament_id}
            `;
        }

        if (!result || result.length === 0) {
            return res.status(404).json({ response: false, message: 'Turniej nie został zaktualizowany' });
        }

        return res.status(200).json({
            response: true,
            message: "Turniej został zaktualizowany pomyślnie",
            data: result[0]
        });

    } catch (error) {
        console.error('Error updating tournament:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas aktualizacji turnieju"
        });
    }
}

// Admin: Delete tournament
export async function deleteTournament(req, res) {
    try {
        const { tournament_id } = req.params;

        // Delete tournament request

        const result = await sql`
            DELETE FROM tournaments 
            WHERE id = ${tournament_id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Turniej nie istnieje"
            });
        }

        return res.status(200).json({
            response: true,
            message: "Turniej został usunięty pomyślnie",
            data: result[0]
        });

    } catch (error) {
        console.error('Error deleting tournament:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas usuwania turnieju"
        });
    }
}

// Admin: Get joins for a tournament
export async function getTournamentJoinsAdmin(req, res) {
    try {
        const { tournament_id } = req.params;
        const rows = await sql`
            SELECT tj.id, tj.user_id, u.name, u.email, u.avatar, tj.status, tj.points, tj.local_ranking, tj.deposit, tj.created_at, tj.updated_at
            FROM tournaments_joins tj
            JOIN users u ON u.user_id = tj.user_id
            WHERE tj.tournament_id = ${tournament_id}
            ORDER BY 
                CASE tj.status WHEN 'active' THEN 1 WHEN 'pending' THEN 2 WHEN 'blocked' THEN 3 ELSE 4 END,
                tj.points DESC
        `;
        return res.status(200).json({ response: true, data: rows });
    } catch (e) {
        console.error('Error getting tournament joins:', e);
        return res.status(500).json({ response: false, message: 'Błąd serwera podczas pobierania uczestników turnieju' });
    }
}

// Admin: Update join status for a user in a tournament
export async function updateTournamentJoinStatusAdmin(req, res) {
    try {
        const { tournament_id, join_id } = req.params;
        const { status } = req.body;
        if (!['pending','active','blocked','finished'].includes(status)) {
            return res.status(400).json({ response: false, message: 'Nieprawidłowy status' });
        }
        const updated = await sql`
            UPDATE tournaments_joins
            SET status = ${status}, updated_at = (NOW())
            WHERE id = ${join_id} AND tournament_id = ${tournament_id}
            RETURNING *
        `;
        if (updated.length === 0) {
            return res.status(404).json({ response: false, message: 'Rekord nie istnieje' });
        }
        // Log activity for the affected user
        try {
            const join = updated[0];
            const trows = await sql`SELECT name FROM tournaments WHERE id = ${tournament_id} LIMIT 1`;
            const tname = trows.length ? trows[0].name : 'turnieju';
            const statusLabel = (() => {
                const map = {
                    pending: 'Oczekuje',
                    active: 'Aktywny',
                    blocked: 'Zablokowany',
                    finished: 'Zakończony'
                };
                return map[status] || (typeof status === 'string' ? (status.charAt(0).toUpperCase() + status.slice(1)) : String(status));
            })();

            await addActivityInternal(join.user_id, {
                icon: '🔔',
                type: 'tournament_join_status',
                title: 'Zmieniono status',
                message: `Status w ${tname} zmieniono na ${statusLabel}`,
                action_url: `/panel/turnieje/${tournament_id}`
            });
        } catch (e) {
            // non-fatal
        }
        return res.status(200).json({ response: true, data: updated[0] });
    } catch (e) {
        console.error('Error updating tournament join status:', e);
        return res.status(500).json({ response: false, message: 'Błąd serwera podczas aktualizacji statusu' });
    }
}
