-- Ensure tournaments.end_date allows NULL
BEGIN;
ALTER TABLE tournaments ALTER COLUMN end_date DROP NOT NULL;
COMMIT;


