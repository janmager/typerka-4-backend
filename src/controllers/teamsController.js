import { sql } from "../config/db.js";

// Get all teams (admin)
export async function getAllTeams(req, res) {
    try {
        const teams = await sql`
            SELECT * FROM teams 
            ORDER BY name ASC
        `;

        res.status(200).json({
            response: true,
            data: teams
        });
    } catch (error) {
        console.error('Error getting teams:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania drużyn"
        });
    }
}

// Add new team
export async function addTeam(req, res) {
    try {
        const {
            name,
            slug,
            logo,
            label,
            country,
            api_team_id,
            api_team_name
        } = req.body;

        console.log("Add team request:", req.body);

        // Validate required fields
        if (!name || !slug || !logo || !label || !country) {
            return res.status(400).json({
                response: false,
                message: "Brak wymaganych pól: name, slug, logo, label, country"
            });
        }

        // If api_team_id is provided, check if it's unique
        if (api_team_id) {
            const existingApiTeam = await sql`
                SELECT id FROM teams 
                WHERE api_team_id = ${api_team_id}
            `;

            if (existingApiTeam.length > 0) {
                return res.status(400).json({
                    response: false,
                    message: "Drużyna o podanym API team ID już istnieje"
                });
            }
        }

        // Check if slug is unique
        const existingTeam = await sql`
            SELECT id FROM teams 
            WHERE slug = ${slug}
        `;

        if (existingTeam.length > 0) {
            return res.status(400).json({
                response: false,
                message: "Drużyna o podanym slug już istnieje"
            });
        }

        // Insert new team
        const result = await sql`
            INSERT INTO teams (
                name, slug, logo, label, country, api_team_id, api_team_name
            ) VALUES (
                ${name}, ${slug}, ${logo}, ${label}, ${country}, 
                ${api_team_id || null}, ${api_team_name || null}
            ) RETURNING *
        `;

        return res.status(201).json({
            response: true,
            message: `Drużyna "${name}" została dodana pomyślnie`,
            data: result[0]
        });

    } catch (error) {
        console.error('Error adding team:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas dodawania drużyny"
        });
    }
}

// Update team
export async function updateTeam(req, res) {
    try {
        const { team_id } = req.params;
        const updateData = req.body;

        console.log("Update team request:", { team_id, updateData });

        // Remove user_id from update data as it's not part of team fields
        delete updateData.user_id;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                response: false,
                message: "Brak danych do aktualizacji"
            });
        }

        // Check if team exists
        const existingTeam = await sql`
            SELECT id FROM teams 
            WHERE id = ${team_id}
        `;

        if (existingTeam.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Drużyna nie istnieje"
            });
        }

        // Check if slug is unique (if being updated)
        if (updateData.slug) {
            const slugCheck = await sql`
                SELECT id FROM teams 
                WHERE slug = ${updateData.slug} AND id != ${team_id}
            `;

            if (slugCheck.length > 0) {
                return res.status(400).json({
                    response: false,
                    message: "Drużyna o podanym slug już istnieje"
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
        let query = 'UPDATE teams SET ';
        const setParts = updateFields.map((field, index) => {
            if (field === 'updated_at') {
                return `${field} = NOW() + INTERVAL '2 hours'`;
            }
            return `${field} = $${index + 1}`;
        });
        query += setParts.join(', ');
        query += ` WHERE id = $${updateFields.length + 1} RETURNING *`;

        const result = await sql.unsafe(query, [...updateValues.slice(0, -1), team_id]);

        return res.status(200).json({
            response: true,
            message: "Drużyna została zaktualizowana pomyślnie",
            data: result[0]
        });

    } catch (error) {
        console.error('Error updating team:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas aktualizacji drużyny"
        });
    }
}

// Delete team
export async function deleteTeam(req, res) {
    try {
        const { team_id } = req.params;

        console.log("Delete team request:", { team_id });

        // Check if team is used in any matches
        const matchesCheck = await sql`
            SELECT id FROM matches 
            WHERE home_team = ${team_id} OR away_team = ${team_id}
        `;

        if (matchesCheck.length > 0) {
            return res.status(400).json({
                response: false,
                message: "Nie można usunąć drużyny, która jest używana w meczach"
            });
        }

        const result = await sql`
            DELETE FROM teams 
            WHERE id = ${team_id}
            RETURNING *
        `;

        if (result.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Drużyna nie istnieje"
            });
        }

        return res.status(200).json({
            response: true,
            message: "Drużyna została usunięta pomyślnie",
            data: result[0]
        });

    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas usuwania drużyny"
        });
    }
}

// Get team by ID
export async function getTeamById(req, res) {
    try {
        const { team_id } = req.params;

        const team = await sql`
            SELECT * FROM teams 
            WHERE id = ${team_id}
        `;

        if (team.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Drużyna nie istnieje"
            });
        }

        res.status(200).json({
            response: true,
            data: team[0]
        });
    } catch (error) {
        console.error('Error getting team by ID:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania drużyny"
        });
    }
}

// Add team from API response
export async function addTeamFromApi(req, res) {
    try {
        const { api_team_id, name, logo } = req.body;

        console.log("Add team from API request:", req.body);

        // Validate required fields
        if (!api_team_id || !name || !logo) {
            return res.status(400).json({
                response: false,
                message: "Brak wymaganych pól: api_team_id, name, logo"
            });
        }

        // Check if team with this API ID already exists
        const existingTeam = await sql`
            SELECT id FROM teams 
            WHERE api_team_id = ${api_team_id}
        `;

        if (existingTeam.length > 0) {
            return res.status(200).json({
                response: true,
                message: "Drużyna już istnieje",
                data: { id: existingTeam[0].id, api_team_id }
            });
        }

        // Generate slug from name
        const slug = name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .trim('-'); // Remove leading/trailing hyphens

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

        // Insert new team
        const result = await sql`
            INSERT INTO teams (
                name, slug, logo, label, country, api_team_id, api_team_name
            ) VALUES (
                ${name}, ${finalSlug}, ${logo}, ${name}, 'Poland', 
                ${api_team_id}, ${name}
            ) RETURNING *
        `;

        return res.status(201).json({
            response: true,
            message: `Drużyna "${name}" została dodana pomyślnie`,
            data: result[0]
        });

    } catch (error) {
        console.error('Error adding team from API:', error);
        res.status(500).json({
            response: false,
            message: "Błąd serwera podczas dodawania drużyny z API"
        });
    }
}

// Get team by API team ID
export async function getTeamByApiId(req, res) {
    try {
        const { api_team_id } = req.params;

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
