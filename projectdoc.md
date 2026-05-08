# SkillForge OS - Complete Project Documentation

## Overview

**SkillForge OS** is a gamified personal skill development platform that runs locally on Windows. It generates daily AI-powered missions based on your weakest skills, grades your answers using LLMs, and tracks progression through an RPG-style XP/rank/streak system. The entire application is self-contained - no cloud servers required (except optional AI API calls).

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Launcher** | Windows Batch Script (`start.bat`) | Starts backend + frontend, opens browser |
| **Backend Framework** | FastAPI (Python 3.10+) | REST API, business logic |
| **Server Process** | Uvicorn ASGI | HTTP server (port 8000) |
| **Database** | SQLite (`backend/skillforge.db`) | Persistent local data |
| **ORM** | SQLAlchemy 2.0 | Database abstraction |
| **Migrations** | Alembic 1.13+ | Lightweight column migrations |
| **Task Scheduling** | APScheduler 3.10+ | 5 cron jobs (morning/midday/evening/weekly) |
| **Desktop Notifications** | plyer 2.1+ | Windows native toast notifications |
| **Email Notifications** | smtplib + Gmail SMTP | Optional email alerts |
| **AI - Mission Generation** | OpenAI (gpt-3.5-turbo) / Gemini (2.0-flash) / Claude (haiku-4-5) / Groq (llama-3.1-8b) | Generates daily missions |
| **AI - Answer Grading** | OpenAI (gpt-4o) / Gemini (2.0-flash) / Claude (sonnet-4) / Groq (llama-3.3-70b) | Strict grading with feedback |
| **Frontend Framework** | React 18.2 | UI rendering |
| **Frontend Language** | TypeScript 5.4 | Type-safe JavaScript |
| **Build Tool** | Vite 5.2 | Fast bundling (dev server port 5180) |
| **HTTP Client** | Axios 1.6 | API calls (30s timeout) |
| **Routing** | React Router DOM 6.22 | Client-side navigation |
| **State Management** | TanStack React Query 5.100 | API caching (30s stale, 5min GC) |
| **Styling** | Custom CSS + CSS Variables | Light/dark theming |
| **Font** | Google Fonts - Inter (400-900) | Typography |
| **Validation** | Pydantic 2.9+ | Request/response validation |
| **Config** | python-dotenv | Environment variable loading |

---

## Project Structure

```
skillforge/
├── backend/
│   ├── main.py               (3464 lines) — 55+ FastAPI routes
│   ├── models.py             (350+ lines) — 11 SQLAlchemy tables
│   ├── agent.py              (400+ lines) — Multi-provider AI (OpenAI/Gemini/Claude/Groq)
│   ├── grader.py             (479 lines)  — XP calculation, ranks, streaks, combos, achievements
│   ├── scheduler.py          (231 lines)  — APScheduler with 5 background jobs
│   ├── notifier.py           (234 lines)  — Desktop + email + in-app notifications
│   ├── requirements.txt      — Python dependencies
│   ├── alembic/              — Database migration scripts
│   ├── alembic.ini           — Alembic config
│   └── skillforge.db         — SQLite database (auto-created)
│
├── frontend/
│   ├── index.html            — Entry point
│   ├── package.json          — Node dependencies
│   ├── tsconfig.json         — TypeScript config (ES2020, strict)
│   ├── vite.config.ts        — Vite config (port 5180)
│   └── src/
│       ├── main.tsx          — React root (QueryClient, BrowserRouter)
│       ├── App.tsx           (400+ lines) — Router, lazy pages, onboarding, confetti
│       ├── api/
│       │   ├── client.ts     (500+ lines) — 80+ API endpoint functions via Axios
│       │   └── types.ts      — TypeScript interfaces for API responses
│       ├── components/
│       │   ├── Sidebar.tsx   — Navigation menu (10 routes + dropdown)
│       │   ├── Topbar.tsx    (400+ lines) — Notifications, theme toggle, user menu
│       │   ├── RightPanel.tsx — Mini profile/stats panel
│       │   ├── Breadcrumb.tsx — Navigation breadcrumbs
│       │   ├── ErrorBoundary.tsx — React error boundary
│       │   └── Toast.tsx     — Toast notification system
│       ├── pages/            — 21 lazy-loaded page components
│       │   ├── Dashboard.tsx      — Main stats, today's missions, charts
│       │   ├── Missions.tsx       — Mission list + submit/grade UI
│       │   ├── Skills.tsx         — Skill management + level progress
│       │   ├── Achievements.tsx   — Achievement gallery + unlock status
│       │   ├── Settings.tsx       — API keys, schedule, email, theme, export/import
│       │   ├── Report.tsx         — Weekly analytics (7-day chart, skill breakdown)
│       │   ├── MonthlyReport.tsx  — Monthly analytics + radar chart
│       │   ├── History.tsx        — Paginated mission history
│       │   ├── Inventory.tsx      — Powerups, badges, reports
│       │   ├── Leaderboard.tsx    — Top 20 + podium
│       │   ├── Notifications.tsx  — All notifications + mark read
│       │   ├── Bookmarks.tsx      — Bookmarked missions
│       │   ├── Profile.tsx        — Display name, bio, avatar, language
│       │   ├── AnswerHistory.tsx  — Paginated answer submissions
│       │   ├── Seasons.tsx        — Seasonal rank resets + history
│       │   ├── WeeklyDigest.tsx   — Weekly summary page
│       │   ├── CommunityChallenges.tsx — Shared challenges
│       │   ├── LearningPaths.tsx  — Skill prerequisites & paths
│       │   ├── FeatureUnlocks.tsx — Locked features by XP
│       │   ├── XpDecay.tsx        — Passive XP decay mechanic
│       │   └── Support.tsx        — Help page
│       └── styles/
│           └── global.css    — Root CSS variables, layout grid, responsive design
│
├── start.bat                 — Launch script (backend + frontend + browser)
├── README.md                 — Quick start guide
├── TODO.md                   — Bug tracker
└── newupdate v2.md           — Feature roadmap (50+ planned features)
```

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────-────┐
│                     Windows Desktop                      │
│                                                          │
│  ┌─────────────-─┐     HTTP/REST      ┌───────────────┐  │
│  │   Frontend    │◄─────────────────► │   Backend     │  │
│  │  React + TS   │   localhost:8000   │   FastAPI     │  │
│  │  Vite :5180   │                    │   Python      │  │
│  └─────────────-─┘                    └───────┬───────┘  │
│                                               │          │
│                                     ┌─────────┼─────────┐│
│                                     │         │         ││
│                               ┌─────▼──┐ ┌───▼──  ─┐ ┌───▼── ─┐
│                               │SQLite  │ │Scheduler│ │Notifier│
│                               │  DB    │ │APSched  │ │plyer   │
│                               └────────┘ └─────── ─┘ └────────┘
│                                                          │
└──────────────────────────────────────────────────────────┘
                          │
                    AI API Calls
                          │
        ┌─────────────────┼──────────┐
        │        │         │         │
   ┌────▼───┐ ┌──▼────┐ ┌──▼────┐ ┌──▼───┐
   │OpenAI  │ │Gemini │ │Claude │ │ Groq │
   │gpt-4o  │ │2.0    │ │sonnet │ │llama │
   └────────┘ └───────┘ └───────┘ └──────┘
```

### Data Flow

1. **Frontend** sends HTTP requests via Axios to the FastAPI backend
2. **Backend** processes requests, interacts with SQLite via SQLAlchemy
3. **AI Agent** (agent.py) calls external LLM APIs for mission generation and grading
4. **Scheduler** runs background cron jobs for daily mission generation, reminders, and reviews
5. **Notifier** sends desktop toasts, in-app notifications, and optional email alerts

### AI Fallback Chain

The app supports 4 AI providers with automatic fallback:
1. **Primary**: User's selected provider (OpenAI by default)
2. **Fallback**: If primary fails, tries the next provider in chain
3. **Offline mode**: If all APIs fail, uses pre-seeded missions + rule-based heuristic grading

---

## Database Schema

### Tables (11 total)

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| **skills** | id, name, icon, xp, level, mission_count | Per-skill tracking (e.g., Trading, Coding, Aptitude) |
| **missions** | id, skill_id, text, xp_reward, date, status, difficulty, bookmarked, is_challenge, challenge_time_limit, tags, prerequisite_id | Daily missions with rich metadata |
| **completions** | id, mission_id, answer, score, feedback, xp_earned, submitted_at | Graded answers + XP awarded |
| **achievements** | id, key, name, description, icon, unlocked_at, secret, rarity | 26+ achievements with unlock timestamps |
| **user_profile** | id(=1), total_xp, current_streak, longest_streak, api_keys, api_provider, schedule, combo_count, streak_freezes, adaptive_difficulty, hints_remaining | Singleton user profile |
| **notifications** | id, message, type, read, created_at | In-app notifications (100 kept) |
| **inventory_items** | id, key, name, type, quantity, metadata_json | Powerups (XP Booster, Streak Shield), badges, reports |
| **bookmarks** | id, mission_id | Bookmarked missions |
| **weekly_challenges** | id, title, target_type, target_value, week_start, week_end, reward_xp, progress | Recurring weekly goals |
| **study_resources** | id, skill_id, title, url, resource_type | Learning materials (articles/videos/tutorials) |
| **seasons** | id, number, name, start_date, end_date, starting_xp, peak_xp, badge_awarded | Monthly season resets |

---

## Application Working Flow

### User Journey

1. **Launch**: Run `start.bat` - spawns backend (port 8000) + frontend (port 5180), opens browser
2. **First-time Setup**:
   - Navigate to Settings page
   - Paste API key (OpenAI, Gemini, Claude, or Groq)
   - Choose AI provider
   - Set schedule preferences (mission generation: 8am, reminder: 1pm, review: 8pm)
3. **Daily Mission Generation**:
   - Scheduler auto-generates 3 daily missions at 08:00 targeting your weakest skill
   - Or manually click "GENERATE MISSIONS NOW" in Settings
   - AI creates missions based on skill gaps and adaptive difficulty
4. **Mission Completion**:
   - Browse today's 3 missions on Dashboard or Missions page
   - Read mission text, write answer in textarea
   - Click "SUBMIT" - backend sends answer to AI for strict grading
   - Receive score (0-100), detailed feedback, and XP earned
5. **Progression**:
   - XP accumulates per skill and globally
   - Skills level up (10 levels with exponential XP thresholds)
   - Global rank advances: Rookie -> Apprentice -> Skilled -> Expert -> Master -> Legend
   - Achievements unlock at milestones
6. **Daily Notifications**:
   - 08:00 - "3 new missions ready"
   - 13:00 - Reminder if 0 missions done (protect streak)
   - 20:00 - Day summary (missions done, XP earned, rank, streak)
   - Sunday 09:00 - Weekly report

### XP Calculation Formula

```
XP = base_reward x (score / 100) x streak_multiplier x combo_multiplier x challenge_bonus
```

- **Base reward**: Mission XP value (varies by difficulty)
- **Score**: AI-graded 0-100
- **Streak multiplier**: Up to 2x at 7-day streak
- **Combo multiplier**: +25% at 3 missions in 1hr, +50% at 5
- **Challenge bonus**: 1.5x for timed challenge missions

### Rank Progression

| Rank | XP Required |
|------|-------------|
| Rookie | 0 |
| Apprentice | 500 |
| Skilled | 2,000 |
| Expert | 5,000 |
| Master | 12,000 |
| Legend | 25,000 |

### Skill Levels (10 levels)

Exponential XP thresholds: 0, 200, 500, 1000, 2000, 3500, 5500, 8000, 11000, 15000+

---

## Game Mechanics

| Mechanic | Description |
|----------|-------------|
| **Streak System** | +1 day per completed mission, resets on missed day. 7-day streak = 2x XP. Streak Shield powerup protects one missed day. |
| **Combo System** | Complete multiple missions within 1 hour. 3 in combo = 1.25x XP, 5 in combo = 1.5x XP. |
| **Challenge Mode** | Timed missions with countdown timer. 1.5x XP bonus. Auto-submit on timer expiry. |
| **Adaptive Difficulty** | Auto-adjusts mission difficulty (easy/medium/hard) based on average score. |
| **Spaced Repetition** | Failed missions resurface 3-7 days later for targeted review. |
| **AI Hints** | Progressive hints available with small XP penalty. Daily hint budget refreshes. |
| **Streak Freezes** | Powerup tokens that protect streak during vacation days. |
| **Seasonal Resets** | Monthly seasons with soft XP reset + badges for achievements. |
| **Loot Boxes** | Random drops from high-score missions (common/rare/epic/legendary items). |
| **XP Decay** | Passive XP penalty for extended inactivity (configurable). |
| **Feature Unlocks** | Certain features gate behind XP milestones. |
| **Weekly Challenges** | Recurring engagement goals (e.g., "Complete 5 missions this week"). |
| **Learning Paths** | Skill prerequisites creating guided progression trees. |

---

## API Endpoints (55+)

### Core
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Health check |
| GET | `/api/dashboard` | Full dashboard data |

### Skills
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/skills` | Create skill |
| GET | `/api/skills` | List all skills |
| PUT | `/api/skills/{id}` | Update skill |
| DELETE | `/api/skills/{id}` | Delete skill |
| GET | `/api/skills/radar` | Radar chart data |

### Missions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/missions/today` | Today's 3 missions |
| POST | `/api/missions/generate` | Force-generate missions |
| POST | `/api/missions/generate-with-difficulty` | Generate with difficulty filter |
| POST | `/api/missions/{id}/submit` | Submit answer for grading |
| POST | `/api/missions/{id}/retry` | Re-attempt mission |
| GET | `/api/missions/history` | Paginated history |
| PUT | `/api/missions/reorder` | Reorder missions |
| POST | `/api/missions/custom` | Create custom mission |
| POST | `/api/missions/generate-challenge` | Generate timed challenge |
| GET | `/api/missions/review` | Spaced repetition queue |
| POST | `/api/missions/{id}/bookmark` | Toggle bookmark |
| POST | `/api/missions/{id}/hint` | Get AI hint |
| POST | `/api/missions/{id}/variant` | Generate variant |
| POST | `/api/missions/{id}/dependency` | Set prerequisite |

### Achievements & Inventory
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/achievements` | List achievements |
| GET | `/api/achievements/all` | All including secret |
| GET | `/api/inventory` | Powerups, badges, reports |
| POST | `/api/inventory/{key}/use` | Use powerup |
| POST | `/api/loot-box` | Open loot box |

### Notifications
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/notifications` | Last 100 notifications |
| PUT | `/api/notifications/read` | Mark all read |

### Reports & Analytics
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/report/weekly` | Weekly report |
| GET | `/api/report/monthly` | Monthly report |
| GET | `/api/report/card` | Summary card |
| GET | `/api/report/pdf` | PDF export |
| GET | `/api/analytics/trends` | Performance trends |
| GET | `/api/analytics/time-of-day` | Best time analysis |
| GET | `/api/analytics/topic-heatmap` | Topic heatmap |
| GET | `/api/analytics/velocity` | Learning velocity |
| GET | `/api/heatmap` | Contribution heatmap |
| GET | `/api/streak-calendar` | Streak calendar |

### Settings & Profile
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/settings` | Current settings |
| POST | `/api/settings/apikey` | Save API key |
| PUT | `/api/settings/provider` | Switch AI provider |
| PUT | `/api/settings/schedule` | Update schedule |
| PUT | `/api/settings/email` | Email config |
| PUT | `/api/settings/language` | Set language |
| PUT | `/api/theme` | Switch theme |
| POST | `/api/settings/reset-progress` | Reset progress |
| POST | `/api/settings/factory-reset` | Factory reset |
| GET | `/api/profile` | Get profile |
| PUT | `/api/profile` | Update profile |

### Gamification
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/combo` | Current combo |
| GET/PUT | `/api/goal` | Weekly XP goal |
| POST | `/api/daily-login` | Claim login bonus (5 XP) |
| GET | `/api/streak/status` | Streak + freezes |
| POST | `/api/streak/freeze` | Use freeze token |
| GET | `/api/adaptive-difficulty` | Difficulty recommendation |
| GET | `/api/feature-unlocks` | Feature gates |
| GET | `/api/events` | Seasonal events |
| GET | `/api/weekly-challenge` | Weekly challenge |
| GET | `/api/leaderboard` | Top 20 leaderboard |
| GET | `/api/seasons/current` | Current season |

### Data Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/export` | Export all data as JSON |
| POST | `/api/import-data` | Import JSON backup |
| POST | `/api/backup` | Create backup |
| GET | `/api/search` | Search missions/skills |

---

## Authentication

**No traditional authentication** - SkillForge OS is a single-user local desktop application:
- User profile is a singleton record (id=1) in the database
- API keys stored in the user profile (not encrypted, but local-only)
- CORS whitelist restricts access to `localhost` origins only
- No login/logout flow required
- Optional Gmail SMTP credentials for email notifications

---

## Third-Party Integrations

### AI Providers (Multi-provider with fallback)

| Provider | Generation Model | Grading Model | Key Source |
|----------|-----------------|---------------|-----------|
| OpenAI | gpt-3.5-turbo | gpt-4o | Settings UI or `OPENAI_API_KEY` env |
| Google Gemini | gemini-2.0-flash | gemini-2.0-flash | `GEMINI_API_KEY` env |
| Anthropic Claude | claude-haiku-4-5 | claude-sonnet-4 | `ANTHROPIC_API_KEY` env |
| Groq | llama-3.1-8b-instant | llama-3.3-70b-versatile | `GROQ_API_KEY` env |

### Notification Channels
- **Windows Desktop**: plyer library (native toast notifications)
- **Gmail SMTP**: Optional email alerts (user provides Gmail + app password)
- **In-App**: Database-backed notification feed

---

## How to Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- At least one AI API key (OpenAI, Gemini, Claude, or Groq)

### Quick Start (Windows)
```bash
# Just run:
start.bat
```
This will:
1. Activate the Python virtual environment
2. Start the FastAPI backend on port 8000
3. Start the Vite dev server on port 5180
4. Open `http://localhost:5180` in your browser

### Manual Start

**Backend:**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Production Build
```bash
cd frontend
npm run build    # Outputs to frontend/dist/
```

---

## Key Features Summary

- **AI-Powered Missions**: 3 daily missions generated by LLMs targeting your weakest skills
- **Multi-Provider AI**: OpenAI, Gemini, Claude, Groq with automatic fallback
- **RPG Gamification**: XP, 6 ranks, 10 skill levels, 26+ achievements, streaks, combos
- **Adaptive Learning**: Difficulty auto-adjusts, spaced repetition for failed missions
- **Rich Analytics**: Weekly/monthly reports, contribution heatmaps, skill radar charts, trend analysis
- **Inventory System**: XP Boosters, Streak Shields, badges, loot boxes
- **Scheduled Automation**: Morning generation, midday reminders, evening reviews, weekly reports
- **Multi-Channel Notifications**: Desktop toasts, in-app feed, optional email
- **Offline Capable**: Falls back to pre-seeded missions + heuristic grading without API keys
- **Data Portability**: JSON export/import, timestamped backups
- **Responsive UI**: Light/dark themes, mobile-friendly, lazy-loaded pages
- **21 Pages**: Dashboard, Missions, Skills, Achievements, Settings, Reports, History, Inventory, Leaderboard, Profile, and more
