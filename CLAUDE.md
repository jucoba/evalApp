# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Single-page workshop scoring app for "Academias Ágiles". No build step, no framework, no package manager. Frontend is vanilla JS/HTML/CSS deployed to GitHub Pages. Backend is Google Apps Script (`Code.gs`) deployed as a web app, using Google Sheets as the database.

## Commands

```bash
npm install        # first time only
npm run dev        # dev server → http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build locally
```

Add the dev server URL to OAuth authorized origins in Google Cloud Console. For GitHub Pages subpath deployment, uncomment and set `base` in `vite.config.js`.

## Configuration

`src/config.js` holds three values that must be set before the app works:
- `API_URL` — the deployed Apps Script web app URL
- `GOOGLE_CLIENT_ID` — OAuth 2.0 client ID (web application type)
- `ADMIN_EMAIL` — must match `ADMIN_EMAIL` in `Code.gs`

## Architecture

### Frontend stack

Vite + React 18. No routing library — view state is a string (`'leaderboard' | 'score-entry' | 'admin'`) in `App.jsx`. Old `js/` and `css/` directories are dead code from the pre-React version and can be deleted.

```
src/
  App.jsx          top-level state + view routing
  api.js           fetch wrapper (callApi)
  config.js        API_URL, GOOGLE_CLIENT_ID, ADMIN_EMAIL, WORKSHOP_COUNT
  scoring.js       pure scoring math (no DOM)
  style.css
  components/
    Header.jsx     level switcher + nav tabs + user bar
    Login.jsx      Google Identity Services button
    Leaderboard.jsx
    ScoreEntry.jsx  session select → ScoreForm → TeamRow (each row owns its own state)
    Admin.jsx      TeamsTab, EvaluatorsTab, ScoresTab (all in one file)
```

### Request flow

All API calls go through `callApi()` in `src/api.js`, which appends `?action=...&email=...&level=...` to `API_URL` and calls `fetch`. The Apps Script `doGet(e)` dispatches on `action`. Every write action re-authorizes against `email` server-side (admin check or evaluator session assignment check).

### Frontend state

`App.jsx` holds: `currentUser`, `appData`, `currentLevel`, `currentView`. `appData` is the full `getAll` response — all views read from it. Mutations optimistically patch `appData` locally (via `onDataUpdate`) without a full reload.

### Role model

Three roles derived at runtime from the signed-in Google email:
- `admin` — email matches `ADMIN_EMAIL`
- `evaluator` — email has a row in the `EvaluatorAssignments` sheet
- `none` — everyone else (read-only leaderboard)

Role is returned by `getAll` and controls which nav tabs render.

### Session 10 = Initiative

Workshop sessions are 1–9. Session `10` is a special "Iniciativa Final" with a direct 0–370 score input instead of the attendance/grade/days-late form. This convention appears throughout `app.js` and `Code.gs`.

### Scoring logic

All scoring math lives in `js/scoring.js` (pure functions, no DOM). These same formulas must be mirrored manually if the backend ever needs to recalculate — the Apps Script receives pre-calculated `total` from the frontend and stores it directly.

### Backend sheets

`Code.gs` targets four sheets by name (constants in `SHEET` object): `Teams`, `WorkshopScores`, `InitiativeScores`, `EvaluatorAssignments`. `setupSpreadsheet()` creates them with headers — run it once after deploying.

## Deploying backend changes

Editing `Code.gs` requires a **new deployment** in Apps Script (not redeploying the same version) to pick up changes, then updating `API_URL` in `js/config.js`.
