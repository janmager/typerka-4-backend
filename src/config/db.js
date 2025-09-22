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
        // Ensure pgcrypto for UUIDs
        try { await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`; } catch (e) {}
        
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
                register_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours' + INTERVAL '2 hours'),
                updated_at TIMESTAMP DEFAULT (NOW() + INTERVAL '2 hours' + INTERVAL '2 hours'),
                logged_at TIMESTAMP DEFAULT NULL,
                active_room TEXT DEFAULT NULL,
                push_notifications BOOLEAN DEFAULT TRUE,
                avatar TEXT DEFAULT '👤'
            )
        `;
        
        await sql`
            CREATE TABLE IF NOT EXISTS leagues (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                match_id VARCHAR(255),
                home_team VARCHAR(255) NOT NULL,
                away_team VARCHAR(255) NOT NULL,
                home_team_score INT NOT NULL DEFAULT 0,
                away_team_score INT NOT NULL DEFAULT 0,
                match_current_time INT,
                league_id INT NOT NULL,
                status VARCHAR(255) NOT NULL DEFAULT 'scheduled',
                stadium VARCHAR(255) NOT NULL,
                stadium_city VARCHAR(255),
                stadium_country VARCHAR(255),
                match_date DATE NOT NULL,
                match_time TIME NOT NULL,
                round TEXT,
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
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) NOT NULL UNIQUE,
                description TEXT NOT NULL,
                status VARCHAR(255) NOT NULL DEFAULT 'inactive',
                league_id INT NOT NULL,
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

        // Drop legacy players column if exists
        try {
            await sql`ALTER TABLE tournaments DROP COLUMN IF EXISTS players`;
        } catch (dropPlayersError) {}

        // Create tournaments_joins table
        await sql`
            CREATE TABLE IF NOT EXISTS tournaments_joins (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                tournament_id TEXT NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                status VARCHAR(255) NOT NULL DEFAULT 'pending',
                points INT NOT NULL DEFAULT 0,
                local_ranking INT NOT NULL DEFAULT 0,
                deposit INT NOT NULL DEFAULT 0,
                updated_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                CONSTRAINT tournaments_joins_status_check CHECK (status IN ('pending','active','blocked','finished')),
                CONSTRAINT tournaments_joins_tournament_fk FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
                CONSTRAINT tournaments_joins_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `;
        // Ensure unique join per user/tournament and helpful indexes
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS tournaments_joins_unique ON tournaments_joins(tournament_id, user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS tournaments_joins_user_idx ON tournaments_joins(user_id)`;

        // Ensure matches.match_id has unique constraint for foreign key
        try {
            await sql`CREATE UNIQUE INDEX IF NOT EXISTS matches_match_id_unique ON matches(match_id)`;
        } catch (error) {
            // Index might already exist, continue
        }

        // Create bets table
        await sql`
            CREATE TABLE IF NOT EXISTS bets (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                match_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                home_bet INT,
                away_bet INT,
                status VARCHAR(255) NOT NULL DEFAULT 'pending',
                points INT DEFAULT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                updated_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                CONSTRAINT bets_status_check CHECK (status IN ('pending','confirmed','blocked')),
                CONSTRAINT bets_match_fk FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE,
                CONSTRAINT bets_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `;
        // Ensure unique bet per user/match and helpful indexes
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS bets_unique ON bets(match_id, user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS bets_user_idx ON bets(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS bets_match_idx ON bets(match_id)`;
        await sql`CREATE INDEX IF NOT EXISTS bets_status_idx ON bets(status)`;
        
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
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_status_check') THEN
                        ALTER TABLE matches DROP CONSTRAINT matches_status_check;
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
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT TRUE`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT DEFAULT '👤'`;
        } catch (alterError) {}

        // Rename active_room -> active_tournament and add FK
        try {
            const col = await sql`SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='active_room'`;
            if (col.length > 0) {
                await sql`ALTER TABLE users RENAME COLUMN active_room TO active_tournament`;
            } else {
                await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_tournament TEXT DEFAULT NULL`;
            }
            // Ensure column type is TEXT
            try { await sql`ALTER TABLE users ALTER COLUMN active_tournament TYPE TEXT`; } catch (e) {}
            // Drop existing FK if any and add new FK to tournaments(id)
            await sql`
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name='users' AND constraint_name='users_active_tournament_fk') THEN
                        ALTER TABLE users DROP CONSTRAINT users_active_tournament_fk;
                    END IF;
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tournaments' AND column_name='id') THEN
                        ALTER TABLE users
                        ADD CONSTRAINT users_active_tournament_fk
                        FOREIGN KEY (active_tournament) REFERENCES tournaments(id) ON DELETE SET NULL;
                    END IF;
                END $$;
            `;
            // Helpful index for lookups
            try { await sql`CREATE INDEX IF NOT EXISTS users_active_tournament_idx ON users(active_tournament)`; } catch (e) {}
        } catch (e) {}

        // Migrate existing numeric ids to text (uuid) by casting where needed
        try { await sql`ALTER TABLE leagues ALTER COLUMN id TYPE TEXT USING id::text`; } catch (e) {}
        try { await sql`ALTER TABLE teams ALTER COLUMN id TYPE TEXT USING id::text`; } catch (e) {}
        try { await sql`ALTER TABLE matches ALTER COLUMN id TYPE TEXT USING id::text`; } catch (e) {}
        try { await sql`ALTER TABLE tournaments ALTER COLUMN id TYPE TEXT USING id::text`; } catch (e) {}
        try { await sql`ALTER TABLE tournaments_joins ALTER COLUMN id TYPE TEXT USING id::text`; } catch (e) {}
        try { await sql`ALTER TABLE tournaments_joins ALTER COLUMN tournament_id TYPE TEXT USING tournament_id::text`; } catch (e) {}

        // Add new columns to existing teams table if they don't exist
        try {
            await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_id VARCHAR(255)`;
        } catch (alterError) {}

        // Activities table
        await sql`
            CREATE TABLE IF NOT EXISTS activities (
                id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                user_id TEXT NOT NULL,
                icon VARCHAR(255),
                type VARCHAR(255),
                title VARCHAR(255),
                message TEXT,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                action_url TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                updated_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
                CONSTRAINT activities_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `;
        // Migrate legacy columns if present
        try { await sql`ALTER TABLE activities DROP COLUMN IF EXISTS timestamp`; } catch (e) {}
        try { await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')`; } catch (e) {}
        try { await sql`ALTER TABLE activities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')`; } catch (e) {}
        await sql`CREATE INDEX IF NOT EXISTS activities_user_idx ON activities(user_id)`;
        await sql`CREATE INDEX IF NOT EXISTS activities_created_at_idx ON activities(created_at)`;

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
            await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS round TEXT`;
            await sql`
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='matches' AND column_name='match_current_time' AND data_type='time without time zone'
                    ) THEN
                        ALTER TABLE matches
                        ALTER COLUMN match_current_time TYPE INT
                        USING CASE WHEN match_current_time IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM match_current_time)::int)/60 END;
                    END IF;
                END $$;
            `;
        } catch (alterError) {}
        
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}