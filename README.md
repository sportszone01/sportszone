# Sports Zone 🏆

A simple sports dashboard with tabbed sections, auto-refreshing live match lists, and a local Node.js backend.

## Features
- Tabs for Football, Cricket, Badminton, Hockey, Chess, Tennis, Basketball
- Simple JavaScript tab switching
- Responsive layout
- `Load Live Matches` action that fetches data dynamically
- `Start Auto Refresh` action (30-second interval)
- Protected backend endpoint: `GET /api/matches?sport=<sport-name>` (requires `x-api-key`)
- API usage endpoint: `GET /api/usage` (per-key usage counters)
- Admin endpoints: `POST /admin/create-key`, `POST /admin/revoke-key`
- Observability endpoint: `GET /api/metrics` (cache + upstream counters)
- Health endpoint: `GET /api/health` (status, uptime, memory usage)
- Optional upstream API proxy support via environment variable
- In-memory backend caching (default TTL: 30 seconds per sport)

## Tech Used
- HTML
- CSS
- JavaScript (Vanilla)
- Node.js (built-in `http` module)

## Project Structure
- `frontend/index.html` – page markup and content sections
- `frontend/styles.css` – visual styles and responsive rules
- `frontend/script.js` – tab switching, fetch logic, auto-refresh behavior
- `backend/server.js` – static file server + API key auth + rate limiting + proxy/fallback
- `package.json` – npm scripts

## Run Locally (Step-by-step)
1. Verify Node.js and npm are installed:
   ```bash
   node -v
   npm -v
   ```
2. Move into the project folder:
   ```bash
   cd path/to/sports-zone
   ```
3. Install dependencies (safe even when none are required):
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open in browser:
   - `http://localhost:8000` for the app (frontend uses default demo key automatically)
   - `http://localhost:8000/api/metrics` for cache/observability counters
   - `http://localhost:8000/api/health` for health/uptime/memory details

6. Create your own API key and call protected endpoints:
   ```bash
   curl -sS -X POST http://127.0.0.1:8000/admin/create-key \
     -H 'Content-Type: application/json' \
     -H 'x-admin-token: dev-admin-token' \
     -d '{"userId":"founder-1","plan":"free"}'
   ```

   Then call matches (replace `<API_KEY>`):
   ```bash
   curl -sS 'http://127.0.0.1:8000/api/matches?sport=cricket' \
     -H 'x-api-key: <API_KEY>'
   ```

   Get per-key usage:
   ```bash
   curl -sS 'http://127.0.0.1:8000/api/usage' \
     -H 'x-api-key: <API_KEY>'
   ```

Stop the server with `Ctrl + C`.

## Optional Configuration
Use environment variables when starting the app:

```bash
CACHE_TTL_MS=30000 SPORTS_API_TIMEOUT_MS=4000 npm start
```

Security and plan controls:

```bash
ADMIN_TOKEN='replace-me' RATE_LIMIT_FREE_PER_MIN=60 MONTHLY_QUOTA_FREE=5000 npm start
```

Use upstream proxy mode:

```bash
SPORTS_API_URL='https://example.com/live-matches' npm start
```

The backend attempts upstream first and automatically falls back to local sample data if upstream fails.

## Troubleshooting
- **Port already in use**: set a different port before start:
  ```bash
  PORT=3000 npm start
  ```
- **Command not found (`node`/`npm`)**: install Node.js from https://nodejs.org
- **Module errors**: run `npm install` again
- **API not responding**: verify server logs and test with:
  ```bash
  curl -sS http://127.0.0.1:8000/api/health
  ```

## Publish to GitHub
If your work is only local and not showing on GitHub yet, connect this repository to your GitHub remote and push the branch you are currently on.

1. Check your current branch and remotes:

```bash
git branch --show-current
git remote -v
```

2. Save your current branch name so push commands stay branch-agnostic:

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

3. If no `origin` exists yet, add it and push:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin "$CURRENT_BRANCH"
```

4. If `origin` already exists but points to the wrong repo, update it and push:

```bash
git remote set-url origin https://github.com/<your-username>/<your-repo>.git
git push -u origin "$CURRENT_BRANCH"
```

5. Verify it is live on GitHub:

```bash
git remote get-url origin
git ls-remote --heads origin
```

## Business Roadmap
If you are turning this project into a product, see `BUSINESS_MVP.md` for:
- reliability-layer positioning
- ICP and lean MVP scope
- pricing starter model
- 30-day go-to-market plan
- landing page copy + outreach template

## Future Improvements
- Add scorecards and match status metadata
- Add backend caching/rate limiting
- Add persistence (favorites/recent matches)
