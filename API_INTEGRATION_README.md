# API Integration Guide

This document explains how to use the new API integration features for teams and matches.

## Database Changes

### Teams Table Updates
- Added `api_team_id` column to store external API team ID
- Added `api_team_name` column to store external API team name

### Matches Table Updates
- Added `round` column to store round information (e.g., "Regular Season - 9")
- Added `city` column to store city where the match is played
- Added `api_fixture_id` column to store external API fixture ID

## New Endpoints

### Teams API

#### Add Team from API Response
```
POST /api/admin/teams/api
Content-Type: application/json

{
  "api_team_id": 4248,
  "name": "Radomiak Radom",
  "logo": "https://media.api-sports.io/football/teams/4248.png"
}
```

#### Get Team by API Team ID
```
GET /api/admin/teams/api/:api_team_id
```

### Matches API

#### Add Match from API Response
```
POST /api/admin/matches/api
Content-Type: application/json

{
  "fixture_data": {
    "fixture": {
      "id": 1380461,
      "date": "2025-09-20T10:15:00+00:00",
      "venue": {
        "name": "Stadion Radomiaka",
        "city": "Radom"
      },
      "status": {
        "long": "Not Started",
        "short": "NS"
      }
    },
    "league": {
      "id": 106,
      "name": "Ekstraklasa",
      "round": "Regular Season - 9"
    },
    "teams": {
      "home": {
        "id": 4248,
        "name": "Radomiak Radom",
        "logo": "https://media.api-sports.io/football/teams/4248.png"
      },
      "away": {
        "id": 349,
        "name": "Piast Gliwice",
        "logo": "https://media.api-sports.io/football/teams/349.png"
      }
    },
    "goals": {
      "home": null,
      "away": null
    }
  }
}
```

#### Get Match by API Fixture ID
```
GET /api/admin/matches/api/:api_fixture_id
```

### Bulk Processing

#### Fetch Fixtures from API Sports and Process Them
```
POST /api/admin/api/fetch-fixtures
Content-Type: application/json

{
  "league_id": 106,
  "season": 2025,
  "from_date": "2025-09-20",
  "to_date": "2025-09-21"
}
```

#### Process Multiple Fixtures from API Response
```
POST /api/admin/api/process-fixtures
Content-Type: application/json

{
  "fixtures_response": {
    "get": "fixtures",
    "parameters": {
      "league": "106",
      "season": "2025",
      "date": "2025-09-20"
    },
    "response": [
      {
        "fixture": {
          "id": 1380461,
          "date": "2025-09-20T10:15:00+00:00",
          "venue": {
            "name": "Stadion Radomiaka",
            "city": "Radom"
          },
          "status": {
            "long": "Not Started",
            "short": "NS"
          }
        },
        "league": {
          "id": 106,
          "name": "Ekstraklasa",
          "round": "Regular Season - 9"
        },
        "teams": {
          "home": {
            "id": 4248,
            "name": "Radomiak Radom",
            "logo": "https://media.api-sports.io/football/teams/4248.png"
          },
          "away": {
            "id": 349,
            "name": "Piast Gliwice",
            "logo": "https://media.api-sports.io/football/teams/349.png"
          }
        },
        "goals": {
          "home": null,
          "away": null
        }
      }
    ]
  }
}
```

## Response Format

### Bulk Processing Response
```json
{
  "response": true,
  "message": "Przetwarzanie zakończone",
  "data": {
    "teams_added": 2,
    "teams_existing": 0,
    "matches_added": 1,
    "matches_existing": 0,
    "errors": []
  }
}
```

## Status Mapping

The system automatically maps API status to internal status:

| API Status | Internal Status |
|------------|----------------|
| Not Started | scheduled |
| In Play | live |
| Match Finished | finished |
| Postponed | postponed |
| Cancelled | cancelled |

## Features

1. **Automatic Team Creation**: Teams are automatically created if they don't exist
2. **Duplicate Prevention**: Checks for existing teams/matches by API ID before creating
3. **Slug Generation**: Automatic slug generation from team names
4. **Date/Time Parsing**: Automatic parsing of API date format to internal format
5. **Error Handling**: Comprehensive error handling with detailed error messages

## Environment Variables

Add the following environment variable to your `.env` file:

```env
RAPIDAPI_KEY=your_rapidapi_key_here
```

## Migration

Run the migration script to update your database:

```sql
-- Run the teams-matches-api-migration.sql file
```

## Usage Examples

### Fetching and Processing Fixtures from API Sports

```javascript
// Example of fetching fixtures from API Sports
fetch('/api/admin/api/fetch-fixtures', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-admin-token'
  },
  body: JSON.stringify({
    league_id: 106,
    season: 2025,
    from_date: "2025-09-20",
    to_date: "2025-09-21"
  })
})
.then(response => response.json())
.then(data => {
  console.log('Fetch and processing results:', data);
});
```

### Processing API Response

```javascript
// Example of processing API response
const apiResponse = {
  "get": "fixtures",
  "response": [
    // ... fixture data
  ]
};

fetch('/api/admin/api/process-fixtures', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-admin-token'
  },
  body: JSON.stringify({
    fixtures_response: apiResponse
  })
})
.then(response => response.json())
.then(data => {
  console.log('Processing results:', data);
});
```

### Adding Individual Match

```javascript
// Example of adding individual match
const matchData = {
  fixture_data: {
    fixture: {
      id: 1380461,
      date: "2025-09-20T10:15:00+00:00",
      venue: {
        name: "Stadion Radomiaka",
        city: "Radom"
      },
      status: {
        long: "Not Started"
      }
    },
    league: {
      id: 106,
      round: "Regular Season - 9"
    },
    teams: {
      home: { id: 4248, name: "Radomiak Radom", logo: "..." },
      away: { id: 349, name: "Piast Gliwice", logo: "..." }
    },
    goals: { home: null, away: null }
  }
};

fetch('/api/admin/matches/api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-admin-token'
  },
  body: JSON.stringify(matchData)
});
```
