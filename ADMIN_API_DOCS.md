# Admin API Documentation

## Overview
Admin API endpoints are available only for users with `type = 'admin'`. All admin routes are protected by middleware that verifies admin permissions.

## Base URL
```
/api/admin
```

## Authentication
All admin endpoints require:
- `user_id` in request body
- User must have `type = 'admin'` in database

## Endpoints

### 1. Update League Status
**POST** `/api/admin/update-league-status`

Manage leagues: add, update, delete, or change status.

#### Request Body
```json
{
  "user_id": "string (required)",
  "action": "string (required) - 'add' | 'update' | 'delete' | 'status'",
  "league_id": "string (required for all actions except add)",
  "league_name": "string (required for add/update)",
  "league_slug": "string (required for add/update)",
  "league_country": "string (required for add/update)",
  "logo": "string (required for add/update)",
  "status": "string (optional) - 'active' | 'inactive'",
  "update_times": "array (optional) - ['HH:MM', 'HH:MM', ...]"
}
```

#### Actions

##### Add New League
```json
{
  "user_id": "admin_user_id",
  "action": "add",
  "league_id": "premier-league",
  "league_name": "Premier League",
  "league_slug": "premier-league",
  "league_country": "England",
  "logo": "https://example.com/logo.png",
  "status": "active",
  "update_times": ["09:00", "15:00", "21:00"]
}
```

##### Update League
```json
{
  "user_id": "admin_user_id",
  "action": "update",
  "league_id": "premier-league",
  "league_name": "Premier League Updated",
  "status": "inactive",
  "update_times": ["10:00", "16:00"]
}
```

##### Change League Status
```json
{
  "user_id": "admin_user_id",
  "action": "status",
  "league_id": "premier-league",
  "status": "active"
}
```

##### Delete League
```json
{
  "user_id": "admin_user_id",
  "action": "delete",
  "league_id": "premier-league"
}
```

#### Response
```json
{
  "response": true,
  "message": "Liga została dodana pomyślnie",
  "data": {
    "id": 1,
    "league_id": "premier-league",
    "league_name": "Premier League",
    "league_slug": "premier-league",
    "league_country": "England",
    "status": "active",
    "logo": "https://example.com/logo.png",
    "update_times": ["09:00", "15:00", "21:00"],
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### 2. Add New League
**POST** `/api/admin/add-league`

Add a new league record to the database. **This endpoint automatically verifies the league exists in API-Football before adding it to the database.**

#### Request Body
```json
{
  "user_id": "string (required)",
  "league_id": "string (required)",
  "league_name": "string (required)",
  "league_slug": "string (required)",
  "league_country": "string (required)",
  "logo": "string (required)",
  "status": "string (optional) - 'active' | 'inactive', default: 'inactive'",
  "update_times": "array (optional) - ['HH:MM', 'HH:MM', ...], default: []",
  "season": "number (optional) - season year, default: current year"
}
```

#### Example Request
```json
{
  "user_id": "admin_user_id",
  "league_id": "bundesliga",
  "league_name": "Bundesliga",
  "league_slug": "bundesliga",
    "league_country": "Germany",
    "logo": "https://example.com/bundesliga-logo.png",
    "status": "active",
    "update_times": ["08:30", "14:30", "20:30"],
    "season": 2024
}
```

#### Response
```json
{
  "response": true,
  "message": "Liga została dodana pomyślnie",
  "data": {
    "id": 2,
    "league_id": "bundesliga",
    "league_name": "Bundesliga",
    "league_slug": "bundesliga",
    "league_country": "Germany",
    "status": "active",
    "logo": "https://example.com/bundesliga-logo.png",
    "update_times": ["08:30", "14:30", "20:30"],
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z",
    "verification": {
      "season": 2024,
      "fixturesCount": 306,
      "verifiedAt": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

### 3. Get All Leagues
**GET** `/api/admin/leagues`

Retrieve all leagues from database.

#### Request Body
```json
{
  "user_id": "admin_user_id"
}
```

#### Response
```json
{
  "response": true,
  "data": [
    {
      "id": 1,
      "league_id": "premier-league",
      "league_name": "Premier League",
      "league_slug": "premier-league",
      "league_country": "England",
      "status": "active",
      "logo": "https://example.com/logo.png",
      "update_times": ["09:00", "15:00", "21:00"],
      "created_at": "2024-01-01T12:00:00.000Z",
      "updated_at": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

## Database Schema

### api_leagues Table
```sql
CREATE TABLE api_leagues (
    id SERIAL PRIMARY KEY,
    league_id VARCHAR(255) NOT NULL,
    league_name VARCHAR(255) NOT NULL,
    league_slug VARCHAR(255) NOT NULL,
    league_country VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'inactive',
    logo VARCHAR(255) NOT NULL,
    update_times TEXT[] DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
    updated_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
);
```

## Error Responses

### 400 Bad Request
```json
{
  "response": false,
  "message": "Brak wymaganych pól: league_id, league_name, league_slug, league_country, logo"
}
```

### 403 Forbidden
```json
{
  "response": false,
  "message": "Brak uprawnień administratora"
}
```

### 404 Not Found
```json
{
  "response": false,
  "message": "Liga o podanym league_id nie istnieje"
}
```

### 500 Internal Server Error
```json
{
  "response": false,
  "message": "Błąd serwera podczas aktualizacji ligi"
}
```

## API-Football Verification

### How it works
Before adding a new league to the database, the system automatically verifies that the league exists in [API-Football](https://www.api-football.com/documentation-v3) by making a request to:

```
GET https://v3.football.api-sports.io/fixtures?league={league_id}&season={year}
```

### Verification Process
1. **API Request**: System sends request to API-Football with league_id and season
2. **Response Check**: Verifies if league has fixtures available
3. **Database Check**: Confirms league_id is unique in our database
4. **Success**: Only if both checks pass, league is added to database

### Required Environment Variable
```
API_FOOTBALL_KEY=your_api_football_key_here
```

### Error Responses
- **League not found**: `Liga o ID {league_id} nie istnieje w API-Football`
- **No fixtures**: `nie ma dostępnych meczów dla sezonu {season}`
- **API error**: `API request failed: {status_code}`

## Validation Rules

1. **update_times**: Must be array of strings in HH:MM format (24-hour)
2. **status**: Must be 'active' or 'inactive'
3. **league_id**: Must be unique for each league AND exist in API-Football
4. **action**: Must be one of: 'add', 'update', 'delete', 'status'
5. **season**: Must be valid year (defaults to current year)

## Examples

### Add Premier League (using dedicated endpoint)
```bash
curl -X POST http://localhost:5001/api/admin/add-league \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "admin_user_id",
    "league_id": "premier-league",
    "league_name": "Premier League",
    "league_slug": "premier-league",
    "league_country": "England",
    "logo": "https://example.com/logo.png",
    "status": "active",
    "update_times": ["09:00", "15:00", "21:00"]
  }'
```

### Add Premier League (using update-league-status with action)
```bash
curl -X POST http://localhost:5001/api/admin/update-league-status \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "admin_user_id",
    "action": "add",
    "league_id": "premier-league",
    "league_name": "Premier League",
    "league_slug": "premier-league",
    "league_country": "England",
    "logo": "https://example.com/logo.png",
    "status": "active",
    "update_times": ["09:00", "15:00", "21:00"]
  }'
```

### Get All Leagues
```bash
curl -X GET http://localhost:5001/api/admin/leagues \
  -H "Content-Type: application/json" \
  -d '{"user_id": "admin_user_id"}'
```
