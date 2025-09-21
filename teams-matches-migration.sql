-- Teams and Matches Tables Migration Script
-- Create teams and matches tables for storing API-Sports data

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    team_id INT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10),
    country VARCHAR(255),
    founded INT,
    national BOOLEAN DEFAULT false,
    logo TEXT,
    venue_id INT,
    venue_name VARCHAR(255),
    venue_address VARCHAR(255),
    venue_city VARCHAR(255),
    venue_capacity INT,
    venue_surface VARCHAR(100),
    venue_image TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '2 hours',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '2 hours'
);

-- Create matches table
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    fixture_id INT NOT NULL UNIQUE,
    referee VARCHAR(255),
    timezone VARCHAR(50),
    match_date TIMESTAMP NOT NULL,
    venue_id INT,
    venue_name VARCHAR(255),
    venue_city VARCHAR(255),
    status_long VARCHAR(100),
    status_short VARCHAR(20),
    status_elapsed INT,
    league_id INT NOT NULL,
    league_name VARCHAR(255),
    league_country VARCHAR(255),
    league_logo TEXT,
    league_flag TEXT,
    season INT NOT NULL,
    round VARCHAR(255),
    home_team_id INT NOT NULL,
    home_team_name VARCHAR(255),
    home_team_logo TEXT,
    away_team_id INT NOT NULL,
    away_team_name VARCHAR(255),
    away_team_logo TEXT,
    goals_home INT,
    goals_away INT,
    score_halftime_home INT,
    score_halftime_away INT,
    score_fulltime_home INT,
    score_fulltime_away INT,
    score_extratime_home INT,
    score_extratime_away INT,
    score_penalty_home INT,
    score_penalty_away INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '2 hours',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '2 hours'
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS teams_team_id_idx ON teams(team_id);
CREATE INDEX IF NOT EXISTS teams_name_idx ON teams(name);
CREATE INDEX IF NOT EXISTS teams_country_idx ON teams(country);

CREATE INDEX IF NOT EXISTS matches_fixture_id_idx ON matches(fixture_id);
CREATE INDEX IF NOT EXISTS matches_league_id_idx ON matches(league_id);
CREATE INDEX IF NOT EXISTS matches_season_idx ON matches(season);
CREATE INDEX IF NOT EXISTS matches_match_date_idx ON matches(match_date);
CREATE INDEX IF NOT EXISTS matches_home_team_id_idx ON matches(home_team_id);
CREATE INDEX IF NOT EXISTS matches_away_team_id_idx ON matches(away_team_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status_short);

-- Add triggers to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP + INTERVAL '2 hours';
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_matches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP + INTERVAL '2 hours';
    RETURN NEW;
END;
$$ language 'plpgsql';

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
