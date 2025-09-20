# Custom Tables Implementation Guide

## Overview
This implementation creates custom, simplified tables for teams, matches, and tournaments instead of using complex API-Sports data structures. All tables are automatically initialized when the server starts.

## Database Tables Created

### 1. **Teams Table**
```sql
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
```

### 2. **Matches Table**
```sql
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    home_team VARCHAR(255) NOT NULL,        -- References teams.id
    away_team VARCHAR(255) NOT NULL,        -- References teams.id
    home_team_score INT NOT NULL DEFAULT 0,
    away_team_score INT NOT NULL DEFAULT 0,
    match_current_time TIME,
    league_id INT NOT NULL,                 -- References leagues.league_id
    status VARCHAR(255) NOT NULL DEFAULT 'scheduled',
    stadium VARCHAR(255) NOT NULL,
    match_date DATE NOT NULL,
    match_time TIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 3. **Tournaments Table** (Updated)
```sql
CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'inactive',
    league_id INT NOT NULL,                 -- References leagues.league_id
    players INT[] NOT NULL DEFAULT '{}',    -- Array of user_ids
    max_participants INT NOT NULL,
    start_date DATE NOT NULL,
    matches INT[] NOT NULL DEFAULT '{}',    -- Array of match IDs
    update_times TEXT[] NOT NULL DEFAULT '{}', -- Array of times ["22:30", "21:45"]
    end_date DATE NOT NULL,
    entry_fee INT NOT NULL DEFAULT 0,
    prize_pool INT NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Admin Teams Routes (`/api/admin/teams`)
- `GET /api/admin/teams` - Get all teams
- `GET /api/admin/teams/:team_id` - Get team by ID
- `POST /api/admin/teams` - Add new team
- `PUT /api/admin/teams/:team_id` - Update team
- `DELETE /api/admin/teams/:team_id` - Delete team

### Admin Matches Routes (`/api/admin/matches`)
- `GET /api/admin/matches` - Get all matches with team and league details
- `GET /api/admin/matches/:match_id` - Get match by ID
- `POST /api/admin/matches` - Add new match
- `PUT /api/admin/matches/:match_id` - Update match
- `DELETE /api/admin/matches/:match_id` - Delete match

### Admin Tournaments Routes (`/api/admin/tournaments`)
- `GET /api/admin/tournaments` - Get all tournaments
- `POST /api/admin/tournaments` - Add new tournament
- `PUT /api/admin/tournaments/:tournament_id` - Update tournament
- `DELETE /api/admin/tournaments/:tournament_id` - Delete tournament

### Public Tournaments Routes (`/api/tournaments`)
- `GET /api/tournaments` - Get active tournaments with relations

## Example API Usage

### Create Team
```javascript
POST /api/admin/teams
{
  "name": "Manchester United",
  "slug": "manchester-united",
  "logo": "https://example.com/mu-logo.png",
  "label": "MAN UTD",
  "country": "England"
}
```

### Create Match
```javascript
POST /api/admin/matches
{
  "home_team": "1",              // Team ID
  "away_team": "2",              // Team ID
  "home_team_score": 0,
  "away_team_score": 0,
  "league_id": 39,               // League ID from leagues
  "status": "scheduled",
  "stadium": "Old Trafford",
  "match_date": "2024-03-15",
  "match_time": "20:00",
  "match_current_time": null
}
```

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
  "players": [],                 // Array of user IDs
  "matches": [1, 2, 3],          // Array of match IDs
  "update_times": ["22:30", "11:00"]
}
```

## Data Relationships

### Teams ↔ Matches
- `matches.home_team` references `teams.id`
- `matches.away_team` references `teams.id`
- When fetching matches, team details are joined automatically

### Leagues ↔ Matches
- `matches.league_id` references `leagues.league_id`
- League information is joined when fetching matches

### Tournaments ↔ Everything
- `tournaments.league_id` references `leagues.league_id`
- `tournaments.players` array contains user IDs from `users` table
- `tournaments.matches` array contains match IDs from `matches` table

## Validation Rules

### Teams
- `name` is required and must be unique
- `slug` is required and must be unique
- `logo`, `label`, `country` are required

### Matches
- `home_team` and `away_team` must be different
- Both teams must exist in the teams table
- `league_id` must exist in leagues table
- `status` must be one of: scheduled, live, finished, postponed, cancelled
- Scores must be >= 0

### Tournaments
- `slug` must be unique
- `max_participants` must be > 0
- `entry_fee` and `prize_pool` must be >= 0
- `end_date` must be >= `start_date`
- `status` must be one of: active, inactive, upcoming, ongoing, finished

## Automatic Features

### Database Initialization
- All tables are created automatically when the server starts
- Constraints and indexes are added automatically
- No manual migration required

### Timestamps
- `created_at` and `updated_at` are managed automatically
- Timezone is set to Europe/Warsaw
- `updated_at` is automatically updated on record changes

### Data Integrity
- Foreign key relationships are validated in application logic
- Constraints prevent invalid data
- Unique constraints prevent duplicates

## File Structure
```
src/
├── controllers/
│   ├── teamsController.js      # Teams CRUD operations
│   ├── matchesController.js    # Matches CRUD operations
│   └── tournamentsController.js # Tournaments CRUD operations
├── routes/
│   ├── adminTeamsRoute.js      # Admin teams routes
│   ├── adminMatchesRoute.js    # Admin matches routes
│   └── adminTournamentsRoute.js # Admin tournaments routes
└── config/
    └── db.js                   # Database initialization
```

## Getting Started

1. **Start the server** - Tables are created automatically
2. **Create teams** using `/api/admin/teams`
3. **Create matches** using `/api/admin/matches`
4. **Create tournaments** using `/api/admin/tournaments`
5. **Manage everything** through the admin API endpoints

## Notes

- All admin endpoints require admin authentication
- Teams cannot be deleted if they're used in matches
- Match team relationships are validated before creation
- Tournament matches array can reference match IDs
- All endpoints return consistent JSON responses with `response` and `data/message` fields
