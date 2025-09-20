import { neon } from "@neondatabase/serverless";
import 'dotenv/config';

// create a sql connection
export const sql = neon(process.env.DATABASE_URL);

export const API_URL = process.env.API_URL;

// Initialize database tables
export async function initializeDatabase() {
    try {
        // Set timezone to Europe/Warsaw for consistent timestamps
        await sql`SET timezone = 'Europe/Warsaw'`;
        
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT UNIQUE PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                email_token TEXT NOT NULL,
                password TEXT NOT NULL,
                type TEXT DEFAULT 'user',
                state TEXT DEFAULT 'to-confirm',
                phone TEXT,
                register_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours'),
                updated_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours'),
                logged_at TIMESTAMP DEFAULT NULL,
                active_room TEXT DEFAULT NULL,
                push_notifications BOOLEAN DEFAULT TRUE,
                avatar TEXT DEFAULT '👤'
            )
        `;
        
        await sql`
            CREATE TABLE IF NOT EXISTS leagues (
                id SERIAL PRIMARY KEY,
                league_id VARCHAR(255) NOT NULL,
                league_name VARCHAR(255) NOT NULL,
                league_slug VARCHAR(255) NOT NULL,
                league_country VARCHAR(255) NOT NULL,
                status VARCHAR(255) NOT NULL DEFAULT 'inactive',
                logo VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                updated_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
            )
        `;

        // Removed legacy api_leagues compatibility view

        // Create teams table
        await sql`
            CREATE TABLE IF NOT EXISTS teams (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                logo VARCHAR(255) NOT NULL,
                label VARCHAR(255) NOT NULL,
                country VARCHAR(255) NOT NULL,
                team_id VARCHAR(255),
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                updated_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
            )
        `;

        // Create matches table
        await sql`
            CREATE TABLE IF NOT EXISTS matches (
                id SERIAL PRIMARY KEY,
                match_id VARCHAR(255),
                home_team VARCHAR(255) NOT NULL,
                away_team VARCHAR(255) NOT NULL,
                home_team_score INT NOT NULL DEFAULT 0,
                away_team_score INT NOT NULL DEFAULT 0,
                match_current_time TIME,
                league_id INT NOT NULL,
                status VARCHAR(255) NOT NULL DEFAULT 'scheduled',
                stadium VARCHAR(255) NOT NULL,
                stadium_city VARCHAR(255),
                stadium_country VARCHAR(255),
                match_date DATE NOT NULL,
                match_time TIME NOT NULL,
                actual_home_score INT,
                actual_away_score INT,
                half_time_home_score INT,
                half_time_away_score INT,
                goals_home INT,
                goals_away INT,
                full_time_home_score INT,
                full_time_away_score INT,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                updated_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
            )
        `;

        // Create tournaments table
        await sql`
            CREATE TABLE IF NOT EXISTS tournaments (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description TEXT NOT NULL,
                status VARCHAR(255) NOT NULL DEFAULT 'inactive',
                league_id INT NOT NULL,
                players INT[] NOT NULL DEFAULT '{}',
                max_participants INT NOT NULL,
                start_date DATE NOT NULL,
                matches INT[] NOT NULL DEFAULT '{}',
                update_times TEXT[] NOT NULL DEFAULT '{}',
                end_date DATE,
                entry_fee INT NOT NULL DEFAULT 0,
                prize_pool INT NOT NULL DEFAULT 0,
                created_by VARCHAR(255) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                updated_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
            )
        `;
        
        // Add constraints and indexes
        try {
			// Align league_id types and add FK between matches.league_id and leagues.league_id
			try {
				await sql`ALTER TABLE leagues ALTER COLUMN league_id TYPE INT USING league_id::int`;
			} catch (alterTypeError) {}

			// Ensure uniqueness on leagues.league_id
			try {
				await sql`CREATE UNIQUE INDEX IF NOT EXISTS leagues_league_id_unique_idx ON leagues(league_id)`;
			} catch (idxError) {}

			// Remove orphaned matches that reference non-existent leagues
			try {
				await sql`DELETE FROM matches m WHERE NOT EXISTS (SELECT 1 FROM leagues l WHERE l.league_id = m.league_id)`;
			} catch (cleanupError) {}

			// Ensure foreign key constraint points to leagues.league_id (drop/recreate if needed)
			await sql`
				DO $$
				DECLARE 
					con_exists boolean;
					con_matches boolean;
				BEGIN
					SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'matches_league_id_fk') INTO con_exists;
					IF con_exists THEN
						SELECT (
							SELECT relname FROM pg_class WHERE oid = c.confrelid
						) = 'leagues' INTO con_matches
						FROM pg_constraint c
						WHERE c.conname = 'matches_league_id_fk';
						IF NOT con_matches THEN
							ALTER TABLE matches DROP CONSTRAINT matches_league_id_fk;
						END IF;
					END IF;
					IF NOT con_exists OR NOT con_matches THEN
						ALTER TABLE matches 
						ADD CONSTRAINT matches_league_id_fk 
						FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE RESTRICT;
					END IF;
				END $$;
			`;

            // Add constraints for matches table
            await sql`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_status_check') THEN
                        ALTER TABLE matches ADD CONSTRAINT matches_status_check 
                        CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled'));
                    END IF;
                END $$;
            `;
            
            await sql`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_scores_check') THEN
                        ALTER TABLE matches ADD CONSTRAINT matches_scores_check 
                        CHECK (home_team_score >= 0 AND away_team_score >= 0);
                    END IF;
                END $$;
            `;

            // Add constraints for tournaments table
            await sql`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_status_check') THEN
                        ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check 
                        CHECK (status IN ('inactive', 'open', 'closed', 'finished'));
                    END IF;
                END $$;
            `;

            // Create indexes
            await sql`CREATE INDEX IF NOT EXISTS teams_slug_idx ON teams(slug)`;
            await sql`CREATE INDEX IF NOT EXISTS teams_name_idx ON teams(name)`;
            await sql`CREATE INDEX IF NOT EXISTS teams_team_id_idx ON teams(team_id)`;
            await sql`CREATE INDEX IF NOT EXISTS leagues_league_id_idx ON leagues(league_id)`;
            await sql`CREATE INDEX IF NOT EXISTS matches_league_id_idx ON matches(league_id)`;
            await sql`CREATE INDEX IF NOT EXISTS matches_match_date_idx ON matches(match_date)`;
            await sql`CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status)`;
            await sql`CREATE INDEX IF NOT EXISTS matches_match_id_idx ON matches(match_id)`;
            await sql`CREATE INDEX IF NOT EXISTS matches_goals_home_idx ON matches(goals_home)`;
            await sql`CREATE INDEX IF NOT EXISTS matches_goals_away_idx ON matches(goals_away)`;
            await sql`CREATE INDEX IF NOT EXISTS matches_actual_home_score_idx ON matches(actual_home_score)`;
            await sql`CREATE INDEX IF NOT EXISTS matches_actual_away_score_idx ON matches(actual_away_score)`;
            await sql`CREATE INDEX IF NOT EXISTS tournaments_league_id_idx ON tournaments(league_id)`;
            await sql`CREATE INDEX IF NOT EXISTS tournaments_status_idx ON tournaments(status)`;
            await sql`CREATE INDEX IF NOT EXISTS tournaments_slug_idx ON tournaments(slug)`;

            // Ensure FK tournaments.league_id -> leagues.league_id
            await sql`
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_league_id_fk') THEN
                        ALTER TABLE tournaments DROP CONSTRAINT tournaments_league_id_fk;
                    END IF;
                    ALTER TABLE tournaments
                    ADD CONSTRAINT tournaments_league_id_fk
                    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE RESTRICT;
                END $$;
            `;
            
            // Ensure uniqueness on teams.team_id for FK referencing
            try {
                await sql`CREATE UNIQUE INDEX IF NOT EXISTS teams_team_id_unique_idx ON teams(team_id)`;
            } catch (idxError) {}

            // Normalize matches teams to store teams.team_id and remove unmatched records
            try {
                // Map home_team by slug/name/label to team_id when possible
                await sql`
                    UPDATE matches m
                    SET home_team = t.team_id
                    FROM teams t
                    WHERE t.team_id IS NOT NULL
                      AND m.home_team <> t.team_id
                      AND (m.home_team = t.slug OR m.home_team = t.name OR m.home_team = t.label)
                `;

                // Map away_team by slug/name/label to team_id when possible
                await sql`
                    UPDATE matches m
                    SET away_team = t.team_id
                    FROM teams t
                    WHERE t.team_id IS NOT NULL
                      AND m.away_team <> t.team_id
                      AND (m.away_team = t.slug OR m.away_team = t.name OR m.away_team = t.label)
                `;

                // Remove matches that still do not reference existing teams by team_id
                await sql`
                    DELETE FROM matches m
                    WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.team_id = m.home_team)
                       OR NOT EXISTS (SELECT 1 FROM teams t WHERE t.team_id = m.away_team)
                `;
            } catch (normalizeError) {}

            // Add foreign keys from matches.home_team/away_team to teams.team_id
            await sql`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_home_team_fk') THEN
                        ALTER TABLE matches 
                        ADD CONSTRAINT matches_home_team_fk 
                        FOREIGN KEY (home_team) REFERENCES teams(team_id) ON DELETE RESTRICT;
                    END IF;
                END $$;
            `;

            await sql`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_away_team_fk') THEN
                        ALTER TABLE matches 
                        ADD CONSTRAINT matches_away_team_fk 
                        FOREIGN KEY (away_team) REFERENCES teams(team_id) ON DELETE RESTRICT;
                    END IF;
                END $$;
            `;
            
        } catch (constraintError) {}

        // Add new columns to existing users table if they don't exist
        try {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS register_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours')`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours')`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS logged_at TIMESTAMP DEFAULT NULL`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_room TEXT DEFAULT NULL`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT TRUE`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '👤'`;
        } catch (alterError) {}

        // Add new columns to existing teams table if they don't exist
        try {
            await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_id VARCHAR(255)`;
            console.log('Added team_id column to teams table (if not exists)');
        } catch (alterError) {}

        // Add new columns to existing matches table if they don't exist
        try {
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_id VARCHAR(255)`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS stadium_city VARCHAR(255)`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS stadium_country VARCHAR(255)`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS actual_home_score INT`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS actual_away_score INT`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS half_time_home_score INT`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS half_time_away_score INT`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS goals_home INT`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS goals_away INT`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS full_time_home_score INT`;
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS full_time_away_score INT`;
        } catch (alterError) {}
        
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}