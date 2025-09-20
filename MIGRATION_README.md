# Database Migration Guide

## Overview
This migration creates a new `tournaments` table with comprehensive tournament management functionality and uses the `leagues` table for league relations.

## Changes Made

### 1. Leagues table
- Relations reference `leagues.league_id`

### 2. Created `tournaments` table with columns:
- `id` - SERIAL PRIMARY KEY
- `name` - VARCHAR(255) NOT NULL
- `slug` - VARCHAR(255) NOT NULL UNIQUE
- `description` - TEXT NOT NULL
- `status` - VARCHAR(255) NOT NULL DEFAULT 'inactive'
- `league_id` - INT NOT NULL (relation to leagues)
- `players` - INT[] NOT NULL DEFAULT '{}' (array of user_ids)
- `max_participants` - INT NOT NULL
- `start_date` - DATE NOT NULL
- `matches` - INT[] NOT NULL DEFAULT '{}' (array of match IDs)
- `update_times` - TEXT[] NOT NULL DEFAULT '{}' (array of times like ["22:30", "21:45"])
- `end_date` - DATE NOT NULL
- `entry_fee` - INT NOT NULL DEFAULT 0
- `prize_pool` - INT NOT NULL DEFAULT 0
- `created_by` - VARCHAR(255) NOT NULL
- `created_at` - TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` - TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP

### 3. Added constraints and indexes:
- Status constraint (active, inactive, upcoming, ongoing, finished)
- Validation constraints for positive values
- Date validation (end_date >= start_date)
- Performance indexes on key columns
- Auto-update trigger for updated_at column

## How to Run the Migration

### Option 1: Using psql command line
```bash
psql -h your_host -U your_username -d your_database -f database-migration.sql
```

### Option 2: Using your database GUI tool
1. Open your database management tool (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Open and execute the `database-migration.sql` file

### Option 3: Using Node.js script
```javascript
import { sql } from './config/db.js';
import fs from 'fs';

async function runMigration() {
    try {
        const migrationSQL = fs.readFileSync('./database-migration.sql', 'utf8');
        await sql.unsafe(migrationSQL);
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

runMigration();
```

## API Endpoints Added

### Admin Tournaments Routes (`/api/admin/tournaments`)
- `GET /api/admin/tournaments` - Get all tournaments (including inactive)
- `POST /api/admin/tournaments` - Add new tournament
- `PUT /api/admin/tournaments/:tournament_id` - Update tournament
- `DELETE /api/admin/tournaments/:tournament_id` - Delete tournament

### Public Tournaments Routes (`/api/tournaments`)
- `GET /api/tournaments` - Get all active tournaments with league and player relations

## Example API Usage

### Create Tournament
```javascript
POST /api/admin/tournaments
{
  "name": "Premier League Championship 2024",
  "slug": "premier-league-2024",
  "description": "Annual Premier League tournament",
  "status": "upcoming",
  "league_id": 39,
  "max_participants": 64,
  "start_date": "2024-03-01",
  "end_date": "2024-05-31",
  "entry_fee": 100,
  "prize_pool": 5000,
  "created_by": "admin_user_id",
  "update_times": ["22:30", "11:00"]
}
```

### Get Tournaments with Relations
```javascript
GET /api/tournaments
// Returns tournaments with league info and player details
```

## Verification

After running the migration, verify:
1. `tournaments` table exists with all specified columns
2. Indexes and constraints are created
3. API endpoints respond correctly
4. Relations work properly (league_id to leagues, players to users)

## Rollback (if needed)

To rollback this migration:
```sql
-- Add back update_times to api_leagues
-- (legacy) api_leagues no longer used

-- Drop tournaments table
DROP TABLE IF EXISTS tournaments;
```

## Notes
- The migration is designed to be safe and non-destructive
- All existing data in `api_leagues` will be preserved
- The new `tournaments` table starts empty
- Update times functionality has been moved from leagues to tournaments
- Foreign key relationships are logical (not enforced with FK constraints for flexibility)
