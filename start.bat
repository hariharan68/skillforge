@echo off
setlocal

REM --- SkillForge OS launcher ---

REM Resolve script directory
cd /d "%~dp0"

echo [SkillForge] Starting backend (FastAPI on :8000)...
start "SkillForge Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --reload --port 8000"

echo [SkillForge] Waiting 3 seconds for backend to boot...
timeout /t 3 /nobreak >nul

echo [SkillForge] Starting frontend (Vite on :5180)...
start "SkillForge Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [SkillForge] Waiting 4 seconds for frontend to boot...
timeout /t 4 /nobreak >nul

echo [SkillForge] Opening browser...
start http://localhost:5180

echo [SkillForge] Launched. Close the two spawned terminals to stop servers.
endlocal
