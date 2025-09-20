-- Migration script to update teams and matches tables for API integration
-- This script adds new columns and modifies existing structure

-- Add new columns to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS api_team_id INTEGER UNIQUE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS api_team_name VARCHAR(255);

-- Add new columns to matches table  
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS api_fixture_id INTEGER UNIQUE;

-- Update existing columns to allow NULL values for scores
ALTER TABLE matches ALTER COLUMN home_team_score DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team_score DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN home_team_score DROP DEFAULT;
ALTER TABLE matches ALTER COLUMN away_team_score DROP DEFAULT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS teams_api_team_id_idx ON teams(api_team_id);
CREATE INDEX IF NOT EXISTS matches_api_fixture_id_idx ON matches(api_fixture_id);
CREATE INDEX IF NOT EXISTS matches_round_idx ON matches(round);
CREATE INDEX IF NOT EXISTS matches_city_idx ON matches(city);

-- Update existing teams table structure comments
COMMENT ON COLUMN teams.api_team_id IS 'External API team ID from fixtures response';
COMMENT ON COLUMN teams.api_team_name IS 'External API team name from fixtures response';
COMMENT ON COLUMN matches.round IS 'Round information from API (e.g., "Regular Season - 9")';
COMMENT ON COLUMN matches.city IS 'City where the match is played from venue data';
COMMENT ON COLUMN matches.api_fixture_id IS 'External API fixture ID from fixtures response';
