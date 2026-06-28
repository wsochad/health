# Beast Mode — Fitness Dashboard

Self-hosted fitness tracker with PostgreSQL persistence, XP system, streak tracking, and exercise history charts.

---

## Stack

- **Frontend**: React + Vite + Recharts
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Hosting**: Railway

---

## Deploy to Railway (5 minutes)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "init beast mode"
git remote add origin https://github.com/YOUR_USERNAME/beast-mode.git
git push -u origin main
```

### 2. Create Railway project

1. Go to [railway.app](https://railway.app) and log in
2. Click **New Project → Deploy from GitHub repo**
3. Select your `beast-mode` repo

### 3. Add PostgreSQL

1. In your Railway project, click **+ New**
2. Select **Database → PostgreSQL**
3. Done — Railway automatically sets `DATABASE_URL` for you

### 4. Set environment variables

In your Railway service settings → Variables, add:

```
NODE_ENV=production
```

That's it. `DATABASE_URL` and `PORT` are set automatically by Railway.

### 5. Set build & start commands

In Railway service settings:

| Setting | Value |
|---|---|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |

Railway will deploy automatically on every `git push`.

---

## Run locally

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (or use Railway's Postgres and copy the DATABASE_URL)

### Setup

```bash
# Install all dependencies
npm install

# Create your .env file
cp .env.example .env
# Edit .env and add your DATABASE_URL

# Run backend (terminal 1)
npm run dev:server

# Run frontend (terminal 2)
cd client && npm run dev
```

Frontend: http://localhost:5173  
Backend API: http://localhost:3001

---

## Features

- **Today tab** — Log reps per exercise, accumulates within the day, tap "edit/del" to correct mistakes
- **Weight tab** — Log daily weight, area chart with 95kg goal line, delete any entry
- **History tab** — Bar chart for any exercise showing daily reps over time, with best/avg stats
- **Progress tab** — Level roadmap (Rookie → Legend), streak, days trained, weight goal progress

## XP System

| Action | XP |
|---|---|
| Each rep (up to target) | 1 XP |
| Palace loop done | 200 XP |
| Full day completion bonus | 300 XP |
| **Perfect day total** | **~1,050 XP** |

| Level | XP needed | Perfect days |
|---|---|---|
| WARRIOR | 1,000 | ~1 day |
| BEAST | 5,000 | ~5 days |
| SHREDDED | 15,000 | ~14 days |
| LEGEND | 30,000 | ~29 days |

---

## Data

All data lives in your Railway PostgreSQL database — three tables:

- `daily_logs` — exercise reps per day (JSONB)
- `weight_logs` — weight entries
- `user_xp` — running XP total

You will never lose data. Railway PostgreSQL has automatic backups.
