import { sql } from "../config/db.js";

// User: Create or update bet
export async function createOrUpdateBet(req, res) {
    try {
        const { match_id, home_bet, away_bet } = req.body;
        const { user_id } = req.query;
        
        console.log(`🎯 [BETS] Create/Update bet request - User: ${user_id}, Match: ${match_id}, Bet: ${home_bet}-${away_bet}`);

        if (!user_id) {
            return res.status(400).json({
                response: false,
                message: "Brak user_id"
            });
        }

        if (!match_id) {
            return res.status(400).json({
                response: false,
                message: "Brak match_id"
            });
        }

        // Validate bet values
        if (home_bet === undefined && away_bet === undefined) {
            return res.status(400).json({
                response: false,
                message: "Musisz podać przynajmniej jeden typ"
            });
        }

        if (home_bet !== undefined && (home_bet < 0 || home_bet > 20)) {
            return res.status(400).json({
                response: false,
                message: "Typ na gospodarza musi być między 0 a 20"
            });
        }

        if (away_bet !== undefined && (away_bet < 0 || away_bet > 20)) {
            return res.status(400).json({
                response: false,
                message: "Typ na gościa musi być między 0 a 20"
            });
        }

        // Check if match exists
        const match = await sql`
            SELECT id, match_id, home_team, away_team, match_date, match_time, status
            FROM matches 
            WHERE match_id = ${match_id}
        `;

        if (match.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Mecz nie istnieje"
            });
        }

        // Check if match is still available for betting (not started)
        const matchDate = new Date(`${match[0].match_date}T${match[0].match_time}`);
        const now = new Date();
        
        if (matchDate <= now) {
            return res.status(400).json({
                response: false,
                message: "Nie można typować na mecz, który już się rozpoczął"
            });
        }

        // Check if bet already exists
        const existingBet = await sql`
            SELECT id, home_bet, away_bet, status
            FROM bets 
            WHERE match_id = ${match_id} AND user_id = ${user_id}
        `;

        let result;
        if (existingBet.length > 0) {
            // Update existing bet
            result = await sql`
                UPDATE bets SET
                    home_bet = ${home_bet},
                    away_bet = ${away_bet},
                    updated_at = NOW() + INTERVAL '2 hours'
                WHERE match_id = ${match_id} AND user_id = ${user_id}
                RETURNING *
            `;
        } else {
            // Create new bet
            result = await sql`
                INSERT INTO bets (match_id, user_id, home_bet, away_bet)
                VALUES (${match_id}, ${user_id}, ${home_bet}, ${away_bet})
                RETURNING *
            `;
        }

        console.log(`✅ [BETS] Bet ${existingBet.length > 0 ? 'updated' : 'created'} successfully - ID: ${result[0].id}`);
        
        return res.status(200).json({
            response: true,
            data: result[0],
            message: existingBet.length > 0 ? "Typ został zaktualizowany" : "Typ został dodany"
        });

    } catch (error) {
        console.error('Error creating/updating bet:', error);
        return res.status(500).json({
            response: false,
            message: "Błąd serwera podczas zapisywania typu"
        });
    }
}

// User: Get user's bets
export async function getUserBets(req, res) {
    try {
        const { user_id } = req.query;
        const { page = 1, limit = 10 } = req.query;

        if (!user_id) {
            return res.status(400).json({
                response: false,
                message: "Brak user_id"
            });
        }

        const offset = (page - 1) * limit;

        const bets = await sql`
            SELECT 
                b.*,
                m.home_team, m.away_team, m.home_score, m.away_score,
                m.match_date, m.match_time, m.status as match_status,
                ht.name as home_team_name, ht.logo as home_team_logo,
                at.name as away_team_name, at.logo as away_team_logo
            FROM bets b
            JOIN matches m ON b.match_id = m.match_id
            LEFT JOIN teams ht ON m.home_team = ht.team_id
            LEFT JOIN teams at ON m.away_team = at.team_id
            WHERE b.user_id = ${user_id}
            ORDER BY m.match_date DESC, m.match_time DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const totalCount = await sql`
            SELECT COUNT(*) as count
            FROM bets b
            WHERE b.user_id = ${user_id}
        `;

        return res.status(200).json({
            response: true,
            data: bets,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(totalCount[0].count),
                pages: Math.ceil(totalCount[0].count / limit)
            }
        });

    } catch (error) {
        console.error('Error getting user bets:', error);
        return res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania typów"
        });
    }
}

// Admin: Get all bets with pagination and filtering
export async function getAllBets(req, res) {
    try {
        const { 
            page = 1, 
            limit = 5, 
            status = 'all', 
            user_id = '',
            match_id = ''
        } = req.query;

        const offset = (page - 1) * limit;

        // Build WHERE conditions
        let whereConditions = [];
        let params = [];

        if (status !== 'all') {
            whereConditions.push(`b.status = $${params.length + 1}`);
            params.push(status);
        }

        if (user_id) {
            whereConditions.push(`b.user_id ILIKE $${params.length + 1}`);
            params.push(`%${user_id}%`);
        }

        if (match_id) {
            whereConditions.push(`b.match_id ILIKE $${params.length + 1}`);
            params.push(`%${match_id}%`);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const bets = await sql.unsafe(`
            SELECT 
                b.*,
                u.name as user_name, u.email as user_email,
                m.home_team, m.away_team, m.home_score, m.away_score,
                m.match_date, m.match_time, m.status as match_status,
                ht.name as home_team_name, ht.logo as home_team_logo,
                at.name as away_team_name, at.logo as away_team_logo
            FROM bets b
            JOIN users u ON b.user_id = u.user_id
            JOIN matches m ON b.match_id = m.match_id
            LEFT JOIN teams ht ON m.home_team = ht.team_id
            LEFT JOIN teams at ON m.away_team = at.team_id
            ${whereClause}
            ORDER BY b.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, limit, offset]);

        const totalCount = await sql.unsafe(`
            SELECT COUNT(*) as count
            FROM bets b
            ${whereClause}
        `, params);

        return res.status(200).json({
            response: true,
            data: bets,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(totalCount[0].count),
                pages: Math.ceil(totalCount[0].count / limit)
            }
        });

    } catch (error) {
        console.error('Error getting all bets:', error);
        return res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania typów"
        });
    }
}

// Admin: Update bet status
export async function updateBetStatus(req, res) {
    try {
        const { bet_id } = req.params;
        const { status, points } = req.body;
        
        console.log(`🔄 [BETS] Update bet status - ID: ${bet_id}, Status: ${status}, Points: ${points}`);

        if (!bet_id) {
            return res.status(400).json({
                response: false,
                message: "Brak bet_id"
            });
        }

        if (!status || !['pending', 'confirmed', 'blocked'].includes(status)) {
            return res.status(400).json({
                response: false,
                message: "Nieprawidłowy status. Dozwolone wartości: pending, confirmed, blocked"
            });
        }

        // Check if bet exists
        const existingBet = await sql`
            SELECT id, status, points
            FROM bets 
            WHERE id = ${bet_id}
        `;

        if (existingBet.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Typ nie istnieje"
            });
        }

        // Update bet status and points
        const updateData = {
            status,
            updated_at: new Date()
        };

        if (points !== undefined) {
            updateData.points = points;
        }

        const result = await sql`
            UPDATE bets SET
                status = ${status},
                points = ${points !== undefined ? points : null},
                updated_at = NOW() + INTERVAL '2 hours'
            WHERE id = ${bet_id}
            RETURNING *
        `;

        console.log(`✅ [BETS] Bet status updated successfully - ID: ${bet_id}, New Status: ${status}`);
        
        return res.status(200).json({
            response: true,
            data: result[0],
            message: "Status typu został zaktualizowany"
        });

    } catch (error) {
        console.error('Error updating bet status:', error);
        return res.status(500).json({
            response: false,
            message: "Błąd serwera podczas aktualizacji statusu typu"
        });
    }
}

// Admin: Get bet details
export async function getBetDetails(req, res) {
    try {
        const { bet_id } = req.params;

        if (!bet_id) {
            return res.status(400).json({
                response: false,
                message: "Brak bet_id"
            });
        }

        const bet = await sql`
            SELECT 
                b.*,
                u.name as user_name, u.email as user_email, u.avatar as user_avatar,
                m.home_team, m.away_team, m.home_score, m.away_score,
                m.match_date, m.match_time, m.status as match_status,
                m.stadium, m.league_id,
                ht.name as home_team_name, ht.logo as home_team_logo,
                at.name as away_team_name, at.logo as away_team_logo,
                l.league_name, l.league_country
            FROM bets b
            JOIN users u ON b.user_id = u.user_id
            JOIN matches m ON b.match_id = m.match_id
            LEFT JOIN teams ht ON m.home_team = ht.team_id
            LEFT JOIN teams at ON m.away_team = at.team_id
            LEFT JOIN leagues l ON m.league_id = l.league_id
            WHERE b.id = ${bet_id}
        `;

        if (bet.length === 0) {
            return res.status(404).json({
                response: false,
                message: "Typ nie istnieje"
            });
        }

        return res.status(200).json({
            response: true,
            data: bet[0]
        });

    } catch (error) {
        console.error('Error getting bet details:', error);
        return res.status(500).json({
            response: false,
            message: "Błąd serwera podczas pobierania szczegółów typu"
        });
    }
}

