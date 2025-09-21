-- Migration to create api_football_logs table
-- This table will store logs of all API-Sports API calls

CREATE TABLE IF NOT EXISTS api_football_logs (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    url TEXT NOT NULL
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_api_football_logs_created_at ON api_football_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_football_logs_url ON api_football_logs(url);

-- Add comment to table
COMMENT ON TABLE api_football_logs IS 'Logs of all API calls to API-Sports endpoints';
COMMENT ON COLUMN api_football_logs.id IS 'Primary key';
COMMENT ON COLUMN api_football_logs.description IS 'Description of the API call operation';
COMMENT ON COLUMN api_football_logs.created_at IS 'Timestamp when the API call was made';
COMMENT ON COLUMN api_football_logs.url IS 'Full URL of the API call';


