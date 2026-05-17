# SkillForge OS

A local, gamified, AI-powered personal skill development platform.
Runs 24/7 on your Windows desktop. Generates AI missions, grades your answers, tracks XP/ranks/streaks, and sends Windows notifications.

- **Backend**: FastAPI + SQLAlchemy + SQLite + APScheduler + plyer + OpenAI
- **Frontend**: React 18 + TypeScript + Vite + React Router + Axios
- **AI**: `gpt-3.5-turbo` for mission generation, `gpt-4o` for strict grading

---

## Quick Start

### 1. Prerequisites

- Python 3.11+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- At least one AI API key (OpenAI, Gemini, Claude, or Groq)

### 2. Install dependencies

```bash
# Python dependencies (from project root)
uv sync

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Run

#### Option A — Using `uv` (recommended, single command)

From the `skillforge` directory:

```bash
uv run python app.py
```

This starts both backend (port 8000) and frontend (port 5180) in one terminal. Press `Ctrl+C` to stop both.

#### Option B — Use the batch launcher

```bash
start.bat
```

This will:
- Start the backend on `http://localhost:8000`
- Start the frontend on `http://localhost:5180`
- Open the browser automatically

#### Option C — Run manually (two separate terminals)

**Terminal 1 — Backend:**

```bash
cd skillforge/backend
uv run python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd skillforge/frontend
npm run dev
```

Then open `http://localhost:5180` in your browser.

### 4. Configure your OpenAI API key

Open the app → go to **Settings** → paste your `sk-...` key → click **SAVE**.
Alternatively, create `backend/.env` with:

```
OPENAI_API_KEY=sk-...
```

Then click **GENERATE MISSIONS NOW** in Settings (or wait for 08:00).

---

## Features

| Feature | Description |
|---|---|
| 🎯 **Daily Missions** | 3 AI-generated missions per day targeted at your weakest skill |
| 🤖 **AI Grading** | GPT-4o grades Accuracy (40) + Depth (30) + Clarity (20) + Effort (10) = /100 |
| ⚡ **XP & Ranks** | Rookie → Apprentice → Skilled → Expert → Master → Legend |
| 📊 **10-Level Skill System** | Per-skill XP thresholds and level blocks |
| 🔥 **Streaks** | 7-day streak → 2× XP multiplier, 30-day → "Unstoppable" badge |
| 🏆 **7 Achievements** | First Blood, On Fire, Galaxy Brain, Trader Mind, Code Ninja, Consistent, Legend |
| 🔔 **Windows Notifications** | Desktop notifications via plyer + in-app notification panel |
| ⏰ **24/7 Scheduler** | 08:00 generate, 13:00 reminder, 20:00 review, Sun 09:00 weekly report |
| 📅 **Weekly Report** | 7-day XP chart, skill breakdown, weakest skill recommendation |
| ⚙️ **Skill Management** | Add/remove/rename skills; pre-loaded: Trading, Coding, Aptitude, General IQ |

---

## Project Structure

```
skillforge/
├── app.py                # Single-command launcher (uv run python app.py)
├── pyproject.toml        # Python dependencies (managed by uv)
├── uv.lock               # Locked dependency versions
├── scripts/
│   ├── __init__.py
│   └── dev.py            # Dev launcher module
│
├── backend/
│   ├── requirements.txt
│   ├── models.py         # SQLAlchemy models + seed data
│   ├── agent.py          # OpenAI mission generation + grading
│   ├── grader.py         # XP, rank, level, streak, achievement logic
│   ├── notifier.py       # plyer desktop + in-app notifications
│   ├── scheduler.py      # APScheduler background jobs
│   ├── main.py           # FastAPI routes + lifespan + CORS
│   ├── skillforge.db     # (auto-created SQLite DB)
│   ├── alembic/          # Database migrations
│   ├── alembic.ini       # Alembic configuration
│   └── backups/          # Database backups
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── vite-env.d.ts
│       ├── api/
│       │   ├── client.ts
│       │   ├── hooks.ts
│       │   └── types.ts
│       ├── styles/global.css
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── Topbar.tsx
│       │   ├── RightPanel.tsx
│       │   ├── Breadcrumb.tsx
│       │   ├── ErrorBoundary.tsx
│       │   └── Toast.tsx
│       └── pages/
│           ├── Dashboard.tsx
│           ├── Missions.tsx
│           ├── Skills.tsx
│           ├── Achievements.tsx
│           ├── Report.tsx
│           ├── Settings.tsx
│           ├── AnswerHistory.tsx
│           ├── Bookmarks.tsx
│           ├── CommunityChallenges.tsx
│           ├── FeatureUnlocks.tsx
│           ├── History.tsx
│           ├── Inventory.tsx
│           ├── Leaderboard.tsx
│           ├── LearningPaths.tsx
│           ├── MonthlyReport.tsx
│           ├── Notifications.tsx
│           ├── Profile.tsx
│           ├── Seasons.tsx
│           ├── Support.tsx
│           ├── WeeklyDigest.tsx
│           └── XpDecay.tsx
│
├── start.bat             # Legacy batch launcher
├── guidedoc.md
├── projectdoc.md
└── README.md
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard` | Full dashboard data |
| GET | `/api/skills` | List skills |
| POST | `/api/skills` | Create skill `{name, icon}` |
| DELETE | `/api/skills/{id}` | Delete skill |
| GET | `/api/missions/today` | Today's missions |
| POST | `/api/missions/generate` | Force-generate today's missions |
| POST | `/api/missions/{id}/submit` | Submit answer for AI grading |
| GET | `/api/achievements` | List all achievements |
| GET | `/api/notifications` | List notifications |
| PUT | `/api/notifications/read` | Mark all as read |
| GET | `/api/report/weekly` | Weekly statistics |
| GET | `/api/settings` | Check if API key is set |
| POST | `/api/settings/apikey` | Save OpenAI key `{api_key}` |

---

## Tips

- **Long answers win.** Write detailed reasoning, show calculations, give real-world examples.
- **Keep your streak alive** — 7 consecutive days doubles XP gains.
- The scheduler runs in-process. Keep the backend terminal open 24/7 for automatic daily missions and notifications.
- SQLite DB lives at `backend/skillforge.db`. Delete it to reset all progress.
- If OpenAI is unreachable, the app falls back to pre-seeded missions and heuristic grading so you can still use it offline.

---

## Troubleshooting

**"OpenAI API key not configured"**
→ Open Settings page, paste your key, click SAVE. Or set `OPENAI_API_KEY` in `backend/.env`.

**Backend won't start — port 8000 in use**
→ Kill the old process: `taskkill /F /IM python.exe` (Windows) or change the port in `start.bat`.

**Frontend shows "Could not load data"**
→ Ensure backend is running at `http://localhost:8000`. Visit that URL in your browser — you should see `{"ok": true, ...}`.

**Frontend not loading on expected port**
→ The frontend runs on `http://localhost:5180`, not the default Vite port (5173). Check `start.bat` if you need to change it.

**No desktop notifications appear**
→ Windows "Focus Assist" may suppress them. Open Settings → System → Notifications, allow SkillForge OS, turn off Focus Assist.

---

Built for solo self-improvement. Forge your skills.
