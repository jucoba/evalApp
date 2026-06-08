# Academias Ágiles — Sistema de Recompensas

Single-page app for workshop team scoring. React frontend on GitHub Pages, data in Google Sheets via Apps Script. Supports two independent competition levels: **Intermedio** and **Avanzado**.

## Setup (one-time, ~25 min)

### 1. Create the Google Spreadsheet

1. Create a new Google Spreadsheet
2. Copy the spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`

### 2. Deploy the Apps Script backend

1. Open the spreadsheet → **Extensions → Apps Script**
2. Delete the default `myFunction` code
3. Paste the entire contents of `Code.gs` into the editor
4. In `Code.gs`, replace:
   - `YOUR_SPREADSHEET_ID` with your spreadsheet ID
   - `admin@example.com` with the admin's Google account email
5. Run the `setupSpreadsheet` function once (Run → Run function → `setupSpreadsheet`) — this creates the **8 required sheets** (4 per level: Teams, WorkshopScores, InitiativeScores, EvaluatorAssignments, each prefixed `Intermedio_` or `Avanzado_`)
6. Deploy as web app:
   - Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the web app URL

> **Important:** Every time you modify `Code.gs`, create a **new deployment** (not a redeployment of the existing version) and update `API_URL` in `src/config.js`.

### 3. Create Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select the project linked to your Google account (or create one)
3. Enable the **Google Identity** API if not already enabled
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add **Authorized JavaScript origins**:
   - `https://YOUR_USERNAME.github.io` (your GitHub Pages URL)
   - `http://localhost:5173` (Vite dev server)
7. Copy the **Client ID**

### 3b. Allow external (non-organization) users

By default, Google restricts OAuth apps to users within the same Google Workspace organization (`org_internal`). To allow external Gmail accounts (viewers or evaluators outside your org):

1. Go to **APIs & Services → OAuth consent screen**
2. Change **User type** from `Internal` → `External`
3. Set publishing status to **Testing**
4. Under **Test users**, add every external email that needs access (up to 100)

> External users will see a "Google hasn't verified this app" warning — they must click **Continue** to proceed. This is normal for internal tools in Testing mode.

### 4. Configure the app

Edit `src/config.js`:

```js
export const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
export const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'
export const ADMIN_EMAIL = 'admin@example.com'
```

### 5. Build and deploy to GitHub Pages

```bash
npm install
npm run build   # outputs to dist/
```

For GitHub Pages with a subpath (e.g. `github.io/evalApp`), uncomment and set `base` in `vite.config.js` before building:

```js
base: '/evalApp/',
```

Then push `dist/` to GitHub Pages (or use the [vite-plugin-gh-pages](https://github.com/nicksrandall/vite-plugin-gh-pages) workflow).

---

## Local development

```bash
npm install
npm run dev     # → http://localhost:5173
```

---

## Using the app

### Levels

The header shows **Intermedio** and **Avanzado** switcher buttons. Teams, evaluator assignments, and scores are fully independent between levels. Facilitators can be assigned to sessions in both levels simultaneously.

### Admin

- Sign in with the configured admin Google account
- Select the level (Intermedio / Avanzado) in the header
- Go to **Admin → Equipos** to create teams (name + number of members)
- Go to **Admin → Evaluadores** to assign evaluators:
  - Enter their Google account email
  - Select which workshop sessions (1–9) and/or Initiative they will score
  - Each evaluator scores **all teams** for their assigned sessions within that level

### Evaluators

- Sign in with their Google account
- Select their level in the header
- Go to **Calificar**, select their session
- For each team, enter:
  - Number of attendees
  - Challenge grade (1–10)
  - Days late (0 = on time)
- The app shows a live point preview and saves per team

### Leaderboard

- Auto-refreshes every 60 seconds
- Shows total workshop points, initiative score, grand total, and prize tier
- Scoped to the currently selected level

---

## Scoring rules

| Metric | Calculation |
|--------|-------------|
| Attendance | `10 × (attendees / team size)` |
| Challenge grade 1–10 | Linear: grade 1 = 1 pt, grade 10 = 60 pts |
| Late penalty | Total (attendance + challenge) × `max(0, 1 − 0.1 × days late)` → floor |
| Max per workshop | 70 pts |
| Max all workshops | 630 pts (9 sessions) |
| Max initiative | 370 pts |
| **Max total** | **1000 pts** |

| Prize | Score range |
|-------|-------------|
| Premio Mayor | 900–1000 |
| Premio Medio | 700–899 |
| Premio Menor | 400–699 |
| Sin Premio | 0–399 |

Team with the highest score receives a special prize (★).
