-- Migration to add season column to leagues table
-- This migration adds a season column to store the year/season of the league

-- Add season column to leagues table
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS season INTEGER;

-- Set season to 2025 for all existing records
UPDATE leagues SET season = 2025 WHERE season IS NULL;

-- Add NOT NULL constraint after setting default values
ALTER TABLE leagues ALTER COLUMN season SET NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leagues_season ON leagues(season);

-- Add comment to column
COMMENT ON COLUMN leagues.season IS 'Year/season of the league (e.g., 2025)';
