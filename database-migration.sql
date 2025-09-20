-- Database Migration Script
-- Migration: Rename api_leagues to leagues and keep schema consistent

BEGIN;

-- If leagues doesn't exist yet, rename api_leagues -> leagues
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'leagues'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'api_leagues'
    ) THEN
        EXECUTE 'ALTER TABLE api_leagues RENAME TO leagues';
    END IF;
END $$;

-- Ensure column types and presence
ALTER TABLE leagues ALTER COLUMN league_id TYPE INT USING league_id::int;

-- Recreate unique index on leagues.league_id
DROP INDEX IF EXISTS api_leagues_league_id_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS leagues_league_id_unique_idx ON leagues(league_id);

-- Optional: legacy index name used elsewhere
DROP INDEX IF EXISTS api_leagues_league_id_idx;
CREATE INDEX IF NOT EXISTS leagues_league_id_idx ON leagues(league_id);

COMMIT;

-- Clean up orphaned matches referencing non-existing leagues
DELETE FROM matches m
WHERE NOT EXISTS (SELECT 1 FROM leagues l WHERE l.league_id = m.league_id);

-- Ensure FK from matches.league_id to leagues.league_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_league_id_fk') THEN
        ALTER TABLE matches DROP CONSTRAINT matches_league_id_fk;
    END IF;
    ALTER TABLE matches
    ADD CONSTRAINT matches_league_id_fk
    FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE RESTRICT;
END $$;

-- Remove any legacy api_leagues view/table if present
DROP VIEW IF EXISTS api_leagues;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='api_leagues') THEN EXECUTE 'DROP TABLE IF EXISTS api_leagues'; END IF; END $$;

-- Create tournaments table
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
    end_date DATE NOT NULL,
    entry_fee INT NOT NULL DEFAULT 0,
    prize_pool INT NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Add constraints
    CONSTRAINT tournaments_status_check CHECK (status IN ('inactive', 'open', 'closed', 'finished')),
    CONSTRAINT tournaments_max_participants_check CHECK (max_participants > 0),
    CONSTRAINT tournaments_entry_fee_check CHECK (entry_fee >= 0),
    CONSTRAINT tournaments_prize_pool_check CHECK (prize_pool >= 0),
    CONSTRAINT tournaments_dates_check CHECK (end_date >= start_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS tournaments_league_id_idx ON tournaments(league_id);
CREATE INDEX IF NOT EXISTS tournaments_status_idx ON tournaments(status);
CREATE INDEX IF NOT EXISTS tournaments_start_date_idx ON tournaments(start_date);
CREATE INDEX IF NOT EXISTS tournaments_created_by_idx ON tournaments(created_by);
CREATE INDEX IF NOT EXISTS tournaments_slug_idx ON tournaments(slug);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tournaments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP + INTERVAL '2 hours';
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tournaments_updated_at ON tournaments;
CREATE TRIGGER update_tournaments_updated_at
    BEFORE UPDATE ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION update_tournaments_updated_at();
