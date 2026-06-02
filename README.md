# Academias Ágiles — Sistema de Recompensas

Single-page app for workshop team scoring. Frontend on GitHub Pages, data in Google Sheets via Apps Script.

## Setup (one-time, ~20 min)

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
5. Run the `setupSpreadsheet` function once (Run → Run function → `setupSpreadsheet`) — this creates the 4 required sheets with headers
6. Deploy as web app:
   - Click **Deploy → New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the web app URL

### 3. Create Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select the project linked to your Google account (or create one)
3. Enable the **Google Identity** API if not already enabled
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add **Authorized JavaScript origins**:
   - `https://YOUR_USERNAME.github.io` (your GitHub Pages URL)
   - `http://localhost:8080` (for local testing)
7. Copy the **Client ID**

### 4. Configure the app

Edit `js/config.js`:

```js
const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const ADMIN_EMAIL = 'admin@example.com';
```

### 5. Deploy to GitHub Pages

1. Push the project to a GitHub repository
2. Go to repository **Settings → Pages**
3. Source: **Deploy from branch → main → / (root)**
4. Your app will be live at `https://YOUR_USERNAME.github.io/REPO_NAME`

---

## Using the app

### Admin
- Sign in with the configured admin Google account
- Go to **Admin → Equipos** to create teams (name + number of members)
- Go to **Admin → Evaluadores** to assign evaluators:
  - Enter their Google account email
  - Select which workshop sessions (1–9) and/or Initiative they will score
  - Each evaluator scores **all teams** for their assigned sessions

### Evaluators
- Sign in with their Google account
- Go to **Calificar**, select their session
- For each team, enter:
  - Number of attendees
  - Challenge grade (1–10)
  - Days late (0 = on time)
- The app shows a live point preview and saves per team

### Leaderboard
- Auto-refreshes every 60 seconds
- Shows total workshop points, initiative score, grand total, and prize tier

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

---

## Local testing

```bash
npx serve .
# Open http://localhost:3000
```

Make sure `http://localhost:3000` (or the port shown) is listed in your OAuth authorized origins.
