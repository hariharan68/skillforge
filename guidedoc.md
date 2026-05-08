

Terminal 1 - Backend:
cd skillforge/backend
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload  --host 0.0.0.0 --port 8000


Terminal 2 - Frontend:
cd skillforge/frontend:
npm install
npm run dev

Then open http://localhost:5180 in you browser 

Prerequistes you need:
-Python 3.10+ installed
-Node.js 18+ installed
-A virtual environment already set up in backend/.venv (if not, run python -m  venv .venv first)
-At least one AI API key (OpenAI, Gemini, Claude, or Groq) - configure in Settings page after launch