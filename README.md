# domain-checker

Bulk check domain availability using Vercel Domains API, caching results in a SQLite database.

## How to run

### Save to .env

```env
# Get from https://vercel.com/account/settings/tokens
VERCEL_BEARER_TOKEN=your_vercel_token
VERCEL_TEAM_ID=your_vercel_team_id
```

### Run

```bash
echo example.com > domains.txt
bun i
bun src/index.ts domains.txt
```

## View Results

```bash
uvx datasette serve domains.sqlite
```
