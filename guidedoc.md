## How to Run SkillForge OS

### Prerequisites
- Python 3.11+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) installed (`pip install uv` or see docs)
- At least one AI API key (OpenAI, Gemini, Claude, or Groq) — configure in Settings page after launch

### Quick Start (Recommended)

```bash
# Install Python dependencies (first time or when deps change):
uv sync

# Install frontend dependencies (first time only):
cd frontend
npm install
cd ..

# Run both backend + frontend in one command:
uv run python app.py
```

Then open http://localhost:5180 in your browser.
Press Ctrl+C to stop both servers.

### Manual Start (two terminals)

Terminal 1 — Backend:
```bash
cd skillforge/backend
uv run python -m uvicorn main:app --reload --port 8000
```

Terminal 2 — Frontend:
```bash
cd skillforge/frontend
npm install
npm run dev
```

Then open http://localhost:5180 in your browser.

### Legacy Launcher

```bash
start.bat
```

This spawns two separate terminal windows and opens the browser automatically.
