-- Ensure FK: matches.league_id -> leagues.league_id with cleanup
BEGIN;

-- Normalize types: leagues.league_id must be INT
ALTER TABLE leagues ALTER COLUMN league_id TYPE INT USING league_id::int;

-- Ensure unique index on leagues.league_id
CREATE UNIQUE INDEX IF NOT EXISTS leagues_league_id_unique_idx ON leagues(league_id);

-- Delete orphaned matches (no matching league)
DELETE FROM matches m
WHERE NOT EXISTS (
  SELECT 1 FROM leagues l WHERE l.league_id = m.league_id
);

-- Drop old FK if exists (regardless of target)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_league_id_fk') THEN
    ALTER TABLE matches DROP CONSTRAINT matches_league_id_fk;
  END IF;
END $$;

-- Create FK to leagues.league_id
ALTER TABLE matches
  ADD CONSTRAINT matches_league_id_fk
  FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE RESTRICT;

COMMIT;


