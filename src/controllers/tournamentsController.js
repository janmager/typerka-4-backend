import { sql } from "../config/db.js";

// Get all active tournaments with relations (public endpoint)
export async function getAllTournaments(req, res) {
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
            WHERE t.status != 'inactive'
            ORDER BY t.created_at DESC
        `;

        // Fetch players and matches for each tournament
        const tournamentsWithRelations = await Promise.all(
            tournaments.map(async (tournament) => {
                // Get players information
                let players = [];
                if (tournament.players && tournament.players.length > 0) {
                    const playersData = await sql`
                        SELECT user_id, name, email
                        FROM users 
                        WHERE user_id = ANY(${tournament.players})
                    `;
                    players = playersData;
                }

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
                    players: players,
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

        // Fetch players and matches for each tournament
        const tournamentsWithRelations = await Promise.all(
            tournaments.map(async (tournament) => {
                // Get players information
                let players = [];
                if (tournament.players && tournament.players.length > 0) {
                    const playersData = await sql`
                        SELECT user_id, name, email
                        FROM users 
                        WHERE user_id = ANY(${tournament.players})
                    `;
                    players = playersData;
                }

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
                    players: players,
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
            players = [],
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
        if (!Array.isArray(players) || !Array.isArray(matches) || !Array.isArray(update_times)) {
            return res.status(400).json({
                response: false,
                message: "players, matches i update_times muszą być tablicami"
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
                name, slug, description, status, league_id, players, 
                max_participants, start_date, matches, update_times, 
                end_date, entry_fee, prize_pool, created_by
            ) VALUES (
                ${name}, ${slug}, ${descriptionValue}, ${status}, ${league_id}, 
                ${players}, ${max_participants}, ${start_date}, ${matches}, 
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
        console.log(updateData);

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

        // Validate arrays if provided
        if (updateData.players && !Array.isArray(updateData.players)) {
            return res.status(400).json({
                response: false,
                message: "players musi być tablicą"
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

        // Build dynamic update query with correct parameter indexing
        const updateFields = [];
        const updateValues = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                updateFields.push(key);
                updateValues.push(updateData[key]);
            }
        });

        // Create SQL query dynamically
        let query = 'UPDATE tournaments SET ';
        const setParts = [];
        let paramIndex = 1;
        for (const field of updateFields) {
            if (field === 'updated_at') {
                // Ignore any provided value for updated_at
                continue;
            }
            setParts.push(`${field} = $${paramIndex}`);
            paramIndex += 1;
        }
        // Always update updated_at using server time
        setParts.push(`updated_at = NOW() + INTERVAL '2 hours'`);
        query += setParts.join(', ');
        // WHERE placeholder index should be the next param index
        query += ` WHERE id = $${paramIndex} RETURNING *`;

        const result = await sql.unsafe(
            query,
            [
                ...updateValues.filter((_, i) => updateFields[i] !== 'updated_at'),
                Number.isNaN(Number(tournament_id)) ? tournament_id : Number(tournament_id)
            ]
        );

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
