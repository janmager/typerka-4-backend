-- Make tournaments.end_date nullable and add FK to leagues
BEGIN;

-- Make end_date nullable
ALTER TABLE tournaments ALTER COLUMN end_date DROP NOT NULL;

-- Clean tournaments with invalid league_id
DELETE FROM tournaments t
WHERE NOT EXISTS (SELECT 1 FROM leagues l WHERE l.league_id = t.league_id);

-- Recreate FK
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_league_id_fk') THEN
    ALTER TABLE tournaments DROP CONSTRAINT tournaments_league_id_fk;
  END IF;
END $$;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_league_id_fk
  FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE RESTRICT;

COMMIT;


