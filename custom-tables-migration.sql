-- Custom Teams, Matches, and Tournaments Tables Migration Script
-- Drop existing API-Sports tables if they exist and create custom ones

-- Drop existing tables if they exist (to avoid conflicts)
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS tournaments CASCADE;

-- Create custom teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    logo VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create custom matches table
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    home_team VARCHAR(255) NOT NULL,
    away_team VARCHAR(255) NOT NULL,
    home_team_score INT NOT NULL DEFAULT 0,
    away_team_score INT NOT NULL DEFAULT 0,
    match_current_time TIME,
    league_id INT NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'scheduled',
    stadium VARCHAR(255) NOT NULL,
    match_date DATE NOT NULL,
    match_time TIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Recreate tournaments table with proper structure
CREATE TABLE tournaments (
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
CREATE INDEX IF NOT EXISTS teams_slug_idx ON teams(slug);
CREATE INDEX IF NOT EXISTS teams_country_idx ON teams(country);
CREATE INDEX IF NOT EXISTS teams_name_idx ON teams(name);

CREATE INDEX IF NOT EXISTS matches_league_id_idx ON matches(league_id);
CREATE INDEX IF NOT EXISTS matches_match_date_idx ON matches(match_date);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);
CREATE INDEX IF NOT EXISTS matches_home_team_idx ON matches(home_team);
CREATE INDEX IF NOT EXISTS matches_away_team_idx ON matches(away_team);

CREATE INDEX IF NOT EXISTS tournaments_league_id_idx ON tournaments(league_id);
CREATE INDEX IF NOT EXISTS tournaments_status_idx ON tournaments(status);
CREATE INDEX IF NOT EXISTS tournaments_start_date_idx ON tournaments(start_date);
CREATE INDEX IF NOT EXISTS tournaments_created_by_idx ON tournaments(created_by);
CREATE INDEX IF NOT EXISTS tournaments_slug_idx ON tournaments(slug);

-- Add triggers to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_tournaments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_teams_updated_at();

DROP TRIGGER IF EXISTS update_matches_updated_at ON matches;
CREATE TRIGGER update_matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW
    EXECUTE FUNCTION update_matches_updated_at();

DROP TRIGGER IF EXISTS update_tournaments_updated_at ON tournaments;
CREATE TRIGGER update_tournaments_updated_at
    BEFORE UPDATE ON tournaments
    FOR EACH ROW
    EXECUTE FUNCTION update_tournaments_updated_at();

-- Add some constraints for matches
ALTER TABLE matches ADD CONSTRAINT matches_status_check 
CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled'));

ALTER TABLE matches ADD CONSTRAINT matches_scores_check 
CHECK (home_team_score >= 0 AND away_team_score >= 0);
