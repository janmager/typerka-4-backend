-- Migration: Enforce relation matches.home_team/away_team -> teams.team_id
-- Steps:
-- 1) Ensure teams.team_id exists and is VARCHAR
-- 2) Deduplicate teams by team_id (keep lowest id)
-- 3) Create UNIQUE index on teams.team_id
-- 4) Rewrite matches.home_team/away_team from teams.id to teams.team_id where possible
-- 5) Delete orphan matches that cannot be resolved
-- 6) Add FKs from matches.home_team and matches.away_team to teams(team_id)

BEGIN;

-- Ensure column type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='teams' AND column_name='team_id'
    ) THEN
        EXECUTE 'ALTER TABLE teams ADD COLUMN team_id VARCHAR(255)';
    END IF;
END $$;

-- Deduplicate teams by team_id (ignore NULLs)
WITH dups AS (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY team_id ORDER BY id) AS rn
        FROM teams
        WHERE team_id IS NOT NULL
    ) x
    WHERE rn > 1
)
DELETE FROM teams WHERE id IN (SELECT id FROM dups);

-- Enforce uniqueness on team_id (allows multiple NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS teams_team_id_unique_idx ON teams(team_id);

-- Rewrite matches.home_team and away_team from teams.id -> teams.team_id
UPDATE matches m
SET home_team = t.team_id
FROM teams t
WHERE t.id::text = m.home_team
  AND t.team_id IS NOT NULL;

UPDATE matches m
SET away_team = t.team_id
FROM teams t
WHERE t.id::text = m.away_team
  AND t.team_id IS NOT NULL;

-- Remove orphaned matches referencing unknown team_id
DELETE FROM matches m
WHERE NOT EXISTS (SELECT 1 FROM teams t WHERE t.team_id = m.home_team)
   OR NOT EXISTS (SELECT 1 FROM teams t WHERE t.team_id = m.away_team);

-- Add FKs if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_home_team_fk') THEN
        ALTER TABLE matches
        ADD CONSTRAINT matches_home_team_fk
        FOREIGN KEY (home_team) REFERENCES teams(team_id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_away_team_fk') THEN
        ALTER TABLE matches
        ADD CONSTRAINT matches_away_team_fk
        FOREIGN KEY (away_team) REFERENCES teams(team_id) ON DELETE RESTRICT;
    END IF;
END $$;

COMMIT;


