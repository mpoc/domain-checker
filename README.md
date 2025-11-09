# domain-checker

Bulk check domain availability using Vercel Domains API, caching results in a SQLite database.

![Example](example.svg)

## How to run

### Save to `.env`

```env
# Get from https://vercel.com/account/settings/tokens
VERCEL_BEARER_TOKEN=your_vercel_token
# Optional
VERCEL_TEAM_ID=your_vercel_team_id
```

### Run

```bash
bun i
echo example.com > domains.txt
bun src/index.ts domains.txt
```

### View Results

```bash
# Runs Datasette through uv
bun inspect domains.sqlite
```
