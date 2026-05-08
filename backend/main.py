"""FastAPI app for SkillForge OS."""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()

from datetime import date, timedelta, datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional, List
import json
import os
import shutil

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, extract

from models import (
    init_db, get_db,
    Skill, Mission, Completion, Achievement, UserProfile, Notification,
    InventoryItem, Bookmark, SeasonalEvent, WeeklyChallenge, StudyResource,
    Comment, Season,
    DEFAULT_SKILLS, DEFAULT_ACHIEVEMENTS, DEFAULT_INVENTORY,
    BASE_DIR,
)
from agent import generate_missions_for_today, grade_answer
from grader import (
    calculate_rank, rank_progress,
    calculate_skill_level, skill_level_progress,
    get_streak_multiplier, award_xp,
)
from scheduler import start_scheduler, stop_scheduler


# ---------- Pydantic schemas ----------

class SkillCreate(BaseModel):
    name: str
    icon: Optional[str] = "⭐"


class AnswerSubmit(BaseModel):
    answer: str


class ApiKeyIn(BaseModel):
    api_key: str
    provider: Optional[str] = "openai"  # "openai", "gemini", "claude", or "groq"

class ProviderUpdate(BaseModel):
    provider: str  # "openai", "gemini", "claude", or "groq"


class ScheduleUpdate(BaseModel):
    morning_hour: Optional[int] = None
    midday_hour: Optional[int] = None
    evening_hour: Optional[int] = None
    morning_enabled: Optional[bool] = None
    midday_enabled: Optional[bool] = None
    evening_enabled: Optional[bool] = None
    weekly_enabled: Optional[bool] = None

class EmailSettingsUpdate(BaseModel):
    email_address: Optional[str] = None
    email_app_password: Optional[str] = None
    email_notifications_enabled: Optional[bool] = None

class GoalUpdate(BaseModel):
    weekly_xp_goal: int

class ThemeUpdate(BaseModel):
    theme: str

class GenerateWithDifficulty(BaseModel):
    difficulty: Optional[str] = None  # easy | medium | hard | None (mixed)

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    preferred_language: Optional[str] = None

class CustomMissionCreate(BaseModel):
    skill_id: int
    text: str
    difficulty: Optional[str] = "medium"
    xp_reward: Optional[int] = 100

class MissionReorder(BaseModel):
    mission_ids: List[int]

class LanguageUpdate(BaseModel):
    language: str  # english, spanish, french, german, japanese, etc.

class StudyResourceCreate(BaseModel):
    skill_id: Optional[int] = None
    title: str
    url: str
    resource_type: Optional[str] = "article"


# ---------- Lifespan ----------

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    try:
        start_scheduler()
    except Exception as e:
        print(f"[main] scheduler failed to start: {e}")
    yield
    stop_scheduler()


app = FastAPI(title="SkillForge OS API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5180",
        "http://127.0.0.1:5180",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Helpers ----------

def _skill_to_dict(s: Skill, db: Optional[Session] = None) -> dict:
    prog = skill_level_progress(s.xp or 0)
    best_score = 0
    xp_this_week = 0
    if db is not None and s.id:
        start = _week_start(date.today())
        best_score = (
            db.query(func.coalesce(func.max(Completion.score), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == s.id)
            .scalar()
            or 0
        )
        xp_this_week = (
            db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == s.id, Mission.date >= start)
            .scalar()
            or 0
        )
    return {
        "id": s.id,
        "name": s.name,
        "icon": s.icon,
        "xp": s.xp or 0,
        "level": calculate_skill_level(s.xp or 0),
        "mission_count": s.mission_count or 0,
        "xp_in_level": prog["xp_in_level"],
        "xp_for_next": prog["xp_for_next"],
        "level_low": prog["level_low"],
        "level_high": prog["level_high"],
        "best_score": int(best_score),
        "xp_this_week": int(xp_this_week),
    }


def _check_prerequisite(m: Mission, db: Optional[Session] = None) -> bool:
    """#56 Check if a mission's prerequisite has been completed."""
    if not hasattr(m, 'prerequisite_id') or not m.prerequisite_id:
        return True
    if db is None:
        return True
    prereq = db.query(Mission).filter(Mission.id == m.prerequisite_id).first()
    return prereq is not None and prereq.status == "graded"


def _mission_to_dict(m: Mission, skill: Optional[Skill] = None, db: Optional[Session] = None) -> dict:
    c = m.completion
    return {
        "id": m.id,
        "skill_id": m.skill_id,
        "skill_name": (skill.name if skill else (m.skill.name if m.skill else "Unknown")),
        "skill_icon": (skill.icon if skill else (m.skill.icon if m.skill else "⭐")),
        "text": m.text,
        "xp_reward": m.xp_reward,
        "date": m.date.isoformat() if m.date else None,
        "status": m.status,
        "difficulty": m.difficulty,
        "retry_count": m.retry_count or 0,
        "score": c.score if c else None,
        "feedback": c.feedback if c else None,
        "xp_earned": c.xp_earned if c else None,
        "answer": c.answer if c else None,
        "bookmarked": bool(m.bookmarked),
        "is_custom": bool(m.is_custom),
        "sort_order": m.sort_order or 0,
        "language": m.language or "english",
        "is_challenge": bool(m.is_challenge),
        "challenge_time_limit": m.challenge_time_limit or 0,
        "submitted_at": c.submitted_at.isoformat() if c and c.submitted_at else None,
        "tags": (m.tags or "").split(",") if m.tags else [],
        "hint_used": bool(m.hint_used) if hasattr(m, 'hint_used') else False,
        "challenge_started_at": m.challenge_started_at.isoformat() if hasattr(m, 'challenge_started_at') and m.challenge_started_at else None,
        "prerequisite_id": m.prerequisite_id if hasattr(m, 'prerequisite_id') else None,
        "prerequisite_met": _check_prerequisite(m, db) if db else True,
    }


def _notif_to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "message": n.message,
        "type": n.type,
        "read": bool(n.read),
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def _inventory_to_dict(item: InventoryItem, profile: Optional[UserProfile] = None) -> dict:
    active = False
    if profile:
        active = (
            (item.key == "xp_booster" and bool(profile.xp_booster_active))
            or (item.key == "streak_shield" and bool(profile.streak_shield_active))
        )
    usable = item.key in {"xp_booster", "streak_shield"}
    return {
        "id": item.id,
        "key": item.key,
        "name": item.name,
        "type": item.type,
        "quantity": item.quantity or 0,
        "metadata": item.metadata_json or "{}",
        "usable": usable,
        "active": active,
        "earned_at": item.earned_at.isoformat() if item.earned_at else None,
        "used_at": item.used_at.isoformat() if item.used_at else None,
    }


def _ensure_profile(db: Session) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
    if profile is None:
        profile = UserProfile(id=1)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _validate_openai_key(key: str) -> None:
    if not key:
        raise HTTPException(400, "API key required")
    try:
        from openai import OpenAI
        test_client = OpenAI(api_key=key)
        test_client.models.list()
    except Exception as e:
        raise HTTPException(400, f"Invalid API key: {e}")


def _validate_gemini_key(key: str) -> None:
    if not key:
        raise HTTPException(400, "API key required")
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        genai.list_models()
    except Exception as e:
        raise HTTPException(400, f"Invalid Gemini API key: {e}")


def _validate_claude_key(key: str) -> None:
    if not key:
        raise HTTPException(400, "API key required")
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)
        # Use count_tokens as a lightweight auth check (no generation cost)
        client.messages.count_tokens(
            model="claude-haiku-4-5-20241022",
            messages=[{"role": "user", "content": "Hi"}],
        )
    except anthropic.AuthenticationError as e:
        raise HTTPException(400, f"Invalid Claude API key: {e}")
    except anthropic.PermissionDeniedError as e:
        raise HTTPException(400, f"Invalid Claude API key: {e}")
    except Exception:
        # Rate limit, model not found, or network error — key itself is likely valid
        pass


def _validate_groq_key(key: str) -> None:
    if not key:
        raise HTTPException(400, "API key required")
    try:
        from groq import Groq
        client = Groq(api_key=key)
        client.chat.completions.create(
            model="llama-3.1-8b-instant",
            max_tokens=5,
            messages=[{"role": "user", "content": "Hi"}],
        )
    except Exception as e:
        err_str = str(e).lower()
        if "auth" in err_str or "invalid" in err_str or "401" in err_str:
            raise HTTPException(400, f"Invalid Groq API key: {e}")
        # Non-auth errors (rate limit etc.) mean key is valid
        pass


# ---------- Routes ----------

@app.get("/")
def root():
    return {"ok": True, "service": "SkillForge OS", "version": "2.0.0"}


@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    today = date.today()

    skills = db.query(Skill).order_by(Skill.id.asc()).all()
    today_missions = db.query(Mission).filter(Mission.date == today).order_by(Mission.sort_order.asc(), Mission.id.asc()).all()
    today_completed = sum(1 for m in today_missions if m.status == "graded")

    avg_level = 0
    if skills:
        avg_level = round(sum(calculate_skill_level(s.xp or 0) for s in skills) / len(skills), 1)

    recent = (
        db.query(Notification).order_by(desc(Notification.created_at)).limit(5).all()
    )

    rank_info = rank_progress(profile.total_xp or 0)

    # Compute real-time streak: if last_active < yesterday, streak is broken
    yesterday = today - timedelta(days=1)
    effective_streak = profile.current_streak or 0
    if profile.last_active and profile.last_active < yesterday:
        effective_streak = 0

    return {
        "total_xp": profile.total_xp or 0,
        "rank": rank_info["rank"],
        "rank_progress_pct": rank_info["progress_pct"],
        "next_rank_xp": rank_info["next_rank_xp"],
        "current_streak": effective_streak,
        "longest_streak": profile.longest_streak or 0,
        "streak_multiplier": get_streak_multiplier(effective_streak),
        "today_missions_total": len(today_missions),
        "today_missions_completed": today_completed,
        "avg_level": avg_level,
        "skills": [_skill_to_dict(s, db) for s in skills],
        "today_missions": [_mission_to_dict(m, db=db) for m in today_missions],
        "recent_notifications": [_notif_to_dict(n) for n in recent],
        "combo_count": profile.combo_count or 0,
        "display_name": profile.display_name or "Hari",
        "avatar": profile.avatar or "⚡",
    }


@app.get("/api/skills")
def list_skills(db: Session = Depends(get_db)):
    skills = db.query(Skill).order_by(Skill.id.asc()).all()
    return [_skill_to_dict(s, db) for s in skills]


@app.post("/api/skills")
def create_skill(payload: SkillCreate, db: Session = Depends(get_db)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Skill name required")
    if db.query(Skill).filter(Skill.name == name).first():
        raise HTTPException(400, "Skill already exists")
    s = Skill(name=name, icon=(payload.icon or "⭐"))
    db.add(s)
    db.commit()
    db.refresh(s)
    return _skill_to_dict(s, db)


@app.delete("/api/skills/{skill_id}")
def delete_skill(skill_id: int, db: Session = Depends(get_db)):
    s = db.query(Skill).filter(Skill.id == skill_id).first()
    if not s:
        raise HTTPException(404, "Skill not found")
    orphaned_xp = (
        db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.skill_id == skill_id)
        .scalar() or 0
    )
    if orphaned_xp > 0:
        profile = _ensure_profile(db)
        profile.total_xp = max(0, (profile.total_xp or 0) - int(orphaned_xp))
    db.delete(s)
    db.commit()
    return {"ok": True}


@app.get("/api/missions/today")
def missions_today(db: Session = Depends(get_db)):
    today = date.today()
    missions = db.query(Mission).filter(Mission.date == today).order_by(Mission.sort_order.asc(), Mission.id.asc()).all()
    return [_mission_to_dict(m, db=db) for m in missions]


@app.post("/api/missions/generate")
def trigger_generate(db: Session = Depends(get_db)):
    try:
        missions = generate_missions_for_today(db)
        return {
            "ok": True,
            "count": len(missions),
            "missions": [_mission_to_dict(m) for m in missions],
        }
    except Exception as e:
        raise HTTPException(500, f"Mission generation failed: {e}")


@app.post("/api/missions/{mission_id}/submit")
def submit_mission(mission_id: int, payload: AnswerSubmit, db: Session = Depends(get_db)):
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")
    if mission.status == "graded":
        raise HTTPException(400, "Mission already graded")

    answer = (payload.answer or "").strip()
    if not answer:
        raise HTTPException(400, "Answer cannot be empty")

    # #56: Check mission prerequisites
    if hasattr(mission, 'prerequisite_id') and mission.prerequisite_id:
        prereq = db.query(Mission).filter(Mission.id == mission.prerequisite_id).first()
        if prereq and prereq.status != "graded":
            raise HTTPException(400, "Complete the prerequisite mission first")

    skill = db.query(Skill).filter(Skill.id == mission.skill_id).first()
    skill_name = skill.name if skill else "General"

    old_skill_level = calculate_skill_level(skill.xp or 0) if skill else 0

    result = grade_answer(mission.text, answer, skill_name, db)
    mission.status = "submitted"
    db.commit()

    award = award_xp(
        db=db,
        mission=mission,
        answer=answer,
        score=result["score"],
        feedback=result["feedback"],
    )

    level_up = award["new_skill_level"] > old_skill_level

    notif_msg = f"Mission graded ({skill_name}): {result['score']}/100 -- +{award['xp_earned']} XP"
    if level_up:
        notif_msg += f" | LEVEL UP! {skill_name} is now Level {award['new_skill_level']}!"
    if award["combo_count"] >= 3:
        notif_msg += f" | Combo x{award['combo_count']}!"
    db.add(Notification(message=notif_msg, type="mission", read=False))
    db.commit()

    return {
        "mission_id": mission.id,
        "score": result["score"],
        "grade_label": result["grade_label"],
        "feedback": result["feedback"],
        "xp_earned": award["xp_earned"],
        "streak_multiplier": award["streak_multiplier"],
        "combo_count": award["combo_count"],
        "combo_multiplier": award["combo_multiplier"],
        "new_total_xp": award["new_total_xp"],
        "new_rank": award["new_rank"],
        "new_skill_xp": award["new_skill_xp"],
        "new_skill_level": award["new_skill_level"],
        "level_up": level_up,
        "unlocked_achievements": award["unlocked_achievements"],
    }


@app.get("/api/achievements")
def list_achievements(db: Session = Depends(get_db)):
    items = db.query(Achievement).order_by(Achievement.id.asc()).all()
    return [
        {
            "id": a.id,
            "key": a.key,
            "name": a.name,
            "description": a.description,
            "icon": a.icon,
            "unlocked": a.unlocked_at is not None,
            "unlocked_at": a.unlocked_at.isoformat() if a.unlocked_at else None,
        }
        for a in items
    ]


@app.get("/api/notifications")
def list_notifications(db: Session = Depends(get_db)):
    items = db.query(Notification).order_by(desc(Notification.created_at)).limit(100).all()
    unread = db.query(func.count(Notification.id)).filter(Notification.read == False).scalar() or 0  # noqa: E712
    return {
        "unread_count": unread,
        "items": [_notif_to_dict(n) for n in items],
    }


@app.put("/api/notifications/read")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.read == False).update({"read": True})  # noqa: E712
    db.commit()
    return {"ok": True}


@app.get("/api/notifications/all")
def list_all_notifications(db: Session = Depends(get_db)):
    items = db.query(Notification).order_by(desc(Notification.created_at)).all()
    unread = db.query(func.count(Notification.id)).filter(Notification.read == False).scalar() or 0  # noqa: E712
    return {
        "unread_count": unread,
        "items": [_notif_to_dict(n) for n in items],
    }


@app.post("/api/notifications/test")
def test_notification(db: Session = Depends(get_db)):
    db.add(Notification(message="Test notification delivered successfully.", type="info", read=False))
    db.commit()
    return {"ok": True, "message": "Test notification delivered."}


@app.get("/api/report/weekly")
def weekly_report(db: Session = Depends(get_db)):
    today = date.today()
    start = today - timedelta(days=6)
    daily: list[dict] = []
    for i in range(7):
        d = start + timedelta(days=i)
        xp = (
            db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date == d)
            .scalar()
            or 0
        )
        missions_done = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date == d)
            .scalar()
            or 0
        )
        daily.append({
            "date": d.isoformat(),
            "day": d.strftime("%a"),
            "xp": int(xp),
            "missions": int(missions_done),
        })

    rows = (
        db.query(Skill.id, Skill.name, Skill.icon, func.coalesce(func.sum(Completion.xp_earned), 0))
        .outerjoin(Mission, (Mission.skill_id == Skill.id) & (Mission.date >= start) & (Mission.date <= today))
        .outerjoin(Completion, Completion.mission_id == Mission.id)
        .group_by(Skill.id)
        .all()
    )
    skill_breakdown = [
        {"id": r[0], "name": r[1], "icon": r[2], "xp_this_week": int(r[3] or 0)}
        for r in rows
    ]

    total_week_xp = sum(d["xp"] for d in daily)
    total_week_missions = sum(d["missions"] for d in daily)
    missions_generated = (
        db.query(func.count(Mission.id))
        .filter(Mission.date >= start)
        .scalar()
        or 0
    )

    profile = _ensure_profile(db)
    weakest = db.query(Skill).order_by(Skill.xp.asc()).first()
    top_ach = (
        db.query(Achievement)
        .filter(Achievement.unlocked_at.isnot(None))
        .order_by(desc(Achievement.unlocked_at))
        .first()
    )

    return {
        "total_week_xp": total_week_xp,
        "total_week_missions": total_week_missions,
        "missions_generated": int(missions_generated),
        "current_streak": profile.current_streak or 0,
        "longest_streak": profile.longest_streak or 0,
        "daily": daily,
        "skill_breakdown": skill_breakdown,
        "weakest_skill": (
            {"id": weakest.id, "name": weakest.name, "icon": weakest.icon, "xp": weakest.xp or 0}
            if weakest else None
        ),
        "top_achievement": (
            {"key": top_ach.key, "name": top_ach.name, "icon": top_ach.icon,
             "unlocked_at": top_ach.unlocked_at.isoformat() if top_ach.unlocked_at else None}
            if top_ach else None
        ),
    }


@app.post("/api/settings/apikey")
def save_api_key(payload: ApiKeyIn, db: Session = Depends(get_db)):
    key = (payload.api_key or "").strip()
    provider = (payload.provider or "openai").lower()
    if not key:
        raise HTTPException(400, "API key required")
    profile = _ensure_profile(db)
    if provider == "gemini":
        profile.gemini_api_key = key
    elif provider == "claude":
        profile.claude_api_key = key
    elif provider == "groq":
        profile.groq_api_key = key
    else:
        profile.openai_api_key = key
    db.commit()
    return {"ok": True, "message": f"{provider.title()} API key saved."}


@app.post("/api/settings/test-apikey")
def test_api_key(payload: ApiKeyIn):
    provider = (payload.provider or "openai").lower()
    key = (payload.api_key or "").strip()
    if provider == "gemini":
        _validate_gemini_key(key)
    elif provider == "claude":
        _validate_claude_key(key)
    elif provider == "groq":
        _validate_groq_key(key)
    else:
        _validate_openai_key(key)
    return {"ok": True, "message": f"{provider.title()} API key connection works."}


@app.put("/api/settings/provider")
def set_provider(payload: ProviderUpdate, db: Session = Depends(get_db)):
    provider = payload.provider.lower()
    if provider not in ("openai", "gemini", "claude", "groq"):
        raise HTTPException(400, "Provider must be 'openai', 'gemini', 'claude', or 'groq'")
    profile = _ensure_profile(db)
    # Verify the key exists for selected provider
    if provider == "openai" and not profile.openai_api_key:
        raise HTTPException(400, "No OpenAI API key configured. Save one first.")
    if provider == "gemini" and not profile.gemini_api_key:
        raise HTTPException(400, "No Gemini API key configured. Save one first.")
    if provider == "claude" and not profile.claude_api_key:
        raise HTTPException(400, "No Claude API key configured. Save one first.")
    if provider == "groq" and not profile.groq_api_key:
        raise HTTPException(400, "No Groq API key configured. Save one first.")
    profile.api_provider = provider
    db.commit()
    return {"ok": True, "provider": provider, "message": f"Switched to {provider.title()}."}


@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    has_openai_key = bool(profile.openai_api_key)
    has_gemini_key = bool(profile.gemini_api_key)
    has_claude_key = bool(profile.claude_api_key)
    has_groq_key = bool(profile.groq_api_key)
    masked_openai = None
    masked_gemini = None
    masked_claude = None
    masked_groq = None
    if has_openai_key and profile.openai_api_key:
        k = profile.openai_api_key
        masked_openai = f"{k[:4]}...{k[-4:]}" if len(k) >= 8 else "****"
    if has_gemini_key and profile.gemini_api_key:
        k = profile.gemini_api_key
        masked_gemini = f"{k[:4]}...{k[-4:]}" if len(k) >= 8 else "****"
    if has_claude_key and profile.claude_api_key:
        k = profile.claude_api_key
        masked_claude = f"{k[:4]}...{k[-4:]}" if len(k) >= 8 else "****"
    if has_groq_key and profile.groq_api_key:
        k = profile.groq_api_key
        masked_groq = f"{k[:4]}...{k[-4:]}" if len(k) >= 8 else "****"
    return {
        "has_api_key": has_openai_key or has_gemini_key or has_claude_key or has_groq_key,
        "masked_api_key": masked_openai,
        "has_openai_key": has_openai_key,
        "masked_openai_key": masked_openai,
        "has_gemini_key": has_gemini_key,
        "masked_gemini_key": masked_gemini,
        "has_claude_key": has_claude_key,
        "masked_claude_key": masked_claude,
        "has_groq_key": has_groq_key,
        "masked_groq_key": masked_groq,
        "api_provider": profile.api_provider or "openai",
        "morning_hour": profile.morning_hour if profile.morning_hour is not None else 8,
        "midday_hour": profile.midday_hour if profile.midday_hour is not None else 13,
        "evening_hour": profile.evening_hour if profile.evening_hour is not None else 20,
        "morning_enabled": bool(profile.morning_enabled),
        "midday_enabled": bool(profile.midday_enabled),
        "evening_enabled": bool(profile.evening_enabled),
        "weekly_enabled": bool(profile.weekly_enabled),
        "xp_booster_active": bool(profile.xp_booster_active),
        "streak_shield_active": bool(profile.streak_shield_active),
        "theme": profile.theme or "light",
        "weekly_xp_goal": profile.weekly_xp_goal or 0,
        "auto_backup_enabled": bool(profile.auto_backup_enabled),
        "preferred_language": profile.preferred_language or "english",
        "email_address": profile.email_address or "",
        "has_email_password": bool(profile.email_app_password),
        "email_notifications_enabled": bool(profile.email_notifications_enabled),
    }


@app.get("/api/search")
def search(q: str = "", db: Session = Depends(get_db)):
    term = (q or "").strip().lower()
    if not term:
        return {"items": []}
    items: list[dict] = []
    for s in db.query(Skill).all():
        if term in s.name.lower():
            items.append({"type": "skill", "title": s.name, "subtitle": f"Level {calculate_skill_level(s.xp or 0)}", "path": "/skills"})
    for m in db.query(Mission).order_by(desc(Mission.date), desc(Mission.id)).limit(100).all():
        if term in m.text.lower() or (m.skill and term in m.skill.name.lower()):
            items.append({"type": "mission", "title": m.text[:90], "subtitle": f"{m.status} · {m.skill.name if m.skill else 'Unknown'}", "path": f"/missions?mission={m.id}"})
    for a in db.query(Achievement).all():
        if term in a.name.lower() or (a.description and term in a.description.lower()):
            items.append({"type": "achievement", "title": a.name, "subtitle": a.description or "", "path": "/achievements"})
    static = [
        ("settings", "Settings", "API key, scheduler, reset, skills", "/settings"),
        ("inventory", "Inventory", "Power-ups, reports, badges", "/inventory"),
        ("leaderboard", "Leaderboard", "Weekly records", "/leaderboard"),
        ("report", "Weekly Report", "XP and skill breakdown", "/report"),
        ("notifications", "Notifications", "Unread and recent updates", "/notifications"),
        ("profile", "Profile", "Avatar, display name, bio", "/profile"),
        ("monthly", "Monthly Report", "Monthly stats and analysis", "/monthly-report"),
        ("history", "Answer History", "Past answers and feedback", "/answer-history"),
        ("bookmarks", "Bookmarks", "Saved missions", "/bookmarks"),
    ]
    for type_, title, subtitle, path in static:
        if term in title.lower() or term in subtitle.lower():
            items.append({"type": type_, "title": title, "subtitle": subtitle, "path": path})
    return {"items": items[:12]}


# ---------- Mission History ----------

@app.get("/api/missions/history")
def mission_history(
    skill_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
):
    query = db.query(Mission).filter(Mission.status == "graded")
    if skill_id:
        query = query.filter(Mission.skill_id == skill_id)
    if start_date:
        query = query.filter(Mission.date >= date.fromisoformat(start_date))
    if end_date:
        query = query.filter(Mission.date <= date.fromisoformat(end_date))
    total = query.count()
    missions = (
        query.order_by(desc(Mission.date), desc(Mission.id))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "missions": [_mission_to_dict(m) for m in missions],
    }


# ---------- Skill Edit ----------

@app.put("/api/skills/{skill_id}")
def update_skill(skill_id: int, payload: SkillUpdate, db: Session = Depends(get_db)):
    s = db.query(Skill).filter(Skill.id == skill_id).first()
    if not s:
        raise HTTPException(404, "Skill not found")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(400, "Skill name required")
        existing = db.query(Skill).filter(Skill.name == name, Skill.id != skill_id).first()
        if existing:
            raise HTTPException(400, "Skill name already taken")
        s.name = name
    if payload.icon is not None:
        s.icon = payload.icon or "⭐"
    db.commit()
    db.refresh(s)
    return _skill_to_dict(s, db)


# ---------- Data Export ----------

@app.get("/api/export")
def export_data(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    skills = db.query(Skill).all()
    missions = db.query(Mission).all()
    completions = db.query(Completion).all()
    achievements = db.query(Achievement).all()
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "profile": {
            "total_xp": profile.total_xp or 0,
            "current_streak": profile.current_streak or 0,
            "longest_streak": profile.longest_streak or 0,
            "last_active": profile.last_active.isoformat() if profile.last_active else None,
            "display_name": profile.display_name or "Hari",
            "bio": profile.bio or "",
            "avatar": profile.avatar or "⚡",
        },
        "skills": [_skill_to_dict(s, db) for s in skills],
        "missions": [_mission_to_dict(m) for m in missions],
        "completions": [
            {
                "id": c.id,
                "mission_id": c.mission_id,
                "answer": c.answer,
                "score": c.score,
                "feedback": c.feedback,
                "xp_earned": c.xp_earned,
                "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
            }
            for c in completions
        ],
        "achievements": [
            {
                "key": a.key,
                "name": a.name,
                "description": a.description,
                "unlocked": a.unlocked_at is not None,
                "unlocked_at": a.unlocked_at.isoformat() if a.unlocked_at else None,
            }
            for a in achievements
        ],
        "inventory": [_inventory_to_dict(i, profile) for i in db.query(InventoryItem).all()],
    }


# ---------- Mission Retry ----------

@app.post("/api/missions/{mission_id}/retry")
def retry_mission(mission_id: int, payload: AnswerSubmit, db: Session = Depends(get_db)):
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")
    if mission.status != "graded":
        raise HTTPException(400, "Can only retry graded missions")
    if (mission.retry_count or 0) >= 2:
        raise HTTPException(400, "Maximum retries (2) reached for this mission")

    answer = (payload.answer or "").strip()
    if not answer:
        raise HTTPException(400, "Answer cannot be empty")

    if mission.completion:
        old_xp = mission.completion.xp_earned or 0
        skill = db.query(Skill).filter(Skill.id == mission.skill_id).first()
        if skill:
            skill.xp = max(0, (skill.xp or 0) - old_xp)
            skill.level = calculate_skill_level(skill.xp)
            skill.mission_count = max(0, (skill.mission_count or 0) - 1)
        profile = _ensure_profile(db)
        profile.total_xp = max(0, (profile.total_xp or 0) - old_xp)
        db.delete(mission.completion)
        db.commit()

    mission.retry_count = (mission.retry_count or 0) + 1
    old_skill_level = calculate_skill_level(
        (db.query(Skill).filter(Skill.id == mission.skill_id).first().xp or 0)
        if mission.skill_id else 0
    )

    skill = db.query(Skill).filter(Skill.id == mission.skill_id).first()
    skill_name = skill.name if skill else "General"
    result = grade_answer(mission.text, answer, skill_name, db)

    original_reward = mission.xp_reward
    mission.xp_reward = int((original_reward or 100) * 0.5)
    mission.status = "submitted"
    db.commit()

    award = award_xp(db=db, mission=mission, answer=answer, score=result["score"], feedback=result["feedback"])

    mission.xp_reward = original_reward
    db.commit()

    level_up = award["new_skill_level"] > old_skill_level

    return {
        "mission_id": mission.id,
        "score": result["score"],
        "grade_label": result["grade_label"],
        "feedback": result["feedback"],
        "xp_earned": award["xp_earned"],
        "streak_multiplier": award["streak_multiplier"],
        "combo_count": award["combo_count"],
        "combo_multiplier": award["combo_multiplier"],
        "new_total_xp": award["new_total_xp"],
        "new_rank": award["new_rank"],
        "new_skill_xp": award["new_skill_xp"],
        "new_skill_level": award["new_skill_level"],
        "level_up": level_up,
        "retry_count": mission.retry_count,
        "is_retry": True,
        "unlocked_achievements": award["unlocked_achievements"],
    }


@app.put("/api/settings/schedule")
def update_schedule(payload: ScheduleUpdate, db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    if payload.morning_hour is not None:
        profile.morning_hour = max(0, min(23, payload.morning_hour))
    if payload.midday_hour is not None:
        profile.midday_hour = max(0, min(23, payload.midday_hour))
    if payload.evening_hour is not None:
        profile.evening_hour = max(0, min(23, payload.evening_hour))
    if payload.morning_enabled is not None:
        profile.morning_enabled = payload.morning_enabled
    if payload.midday_enabled is not None:
        profile.midday_enabled = payload.midday_enabled
    if payload.evening_enabled is not None:
        profile.evening_enabled = payload.evening_enabled
    if payload.weekly_enabled is not None:
        profile.weekly_enabled = payload.weekly_enabled
    db.commit()
    from scheduler import reschedule_jobs
    reschedule_jobs(
        profile.morning_hour if profile.morning_hour is not None else 8,
        profile.midday_hour if profile.midday_hour is not None else 13,
        profile.evening_hour if profile.evening_hour is not None else 20,
    )
    return {"ok": True, "message": "Schedule updated."}


@app.put("/api/settings/email")
def update_email_settings(payload: EmailSettingsUpdate, db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    if payload.email_address is not None:
        profile.email_address = payload.email_address.strip()
    if payload.email_app_password is not None:
        profile.email_app_password = payload.email_app_password
    if payload.email_notifications_enabled is not None:
        profile.email_notifications_enabled = payload.email_notifications_enabled
    db.commit()
    return {"ok": True, "message": "Email settings saved."}


@app.post("/api/settings/email/test")
def test_email_settings(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    if not profile.email_address or not profile.email_app_password:
        raise HTTPException(status_code=400, detail="Save your email address and App Password first.")
    from notifier import send_email_notification
    ok, msg = send_email_notification(
        profile.email_address,
        profile.email_app_password,
        "SkillForge OS — Test Email",
        "This is a test email from SkillForge OS. Your email notifications are all set up and ready to go!",
        display_name=profile.display_name or "there",
    )
    if ok:
        return {"ok": True, "message": "Test email sent! Check your inbox."}
    raise HTTPException(status_code=400, detail=msg)


@app.get("/api/inventory")
def get_inventory(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    items = db.query(InventoryItem).order_by(InventoryItem.id.asc()).all()
    return {"items": [_inventory_to_dict(item, profile) for item in items]}


@app.post("/api/inventory/{key}/use")
def use_inventory_item(key: str, db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    item = db.query(InventoryItem).filter(InventoryItem.key == key).first()
    if not item:
        raise HTTPException(404, "Inventory item not found")
    if key not in {"xp_booster", "streak_shield"}:
        raise HTTPException(400, "This item cannot be used")
    if (item.quantity or 0) <= 0:
        raise HTTPException(400, "No quantity available")
    if key == "xp_booster" and profile.xp_booster_active:
        raise HTTPException(400, "XP Booster is already active")
    if key == "streak_shield" and profile.streak_shield_active:
        raise HTTPException(400, "Streak Shield is already active")
    item.quantity = (item.quantity or 0) - 1
    if key == "xp_booster":
        profile.xp_booster_active = True
        message = "XP Booster activated for your next graded mission."
    else:
        profile.streak_shield_active = True
        message = "Streak Shield activated for the next missed day."
    db.add(Notification(message=message, type="info", read=False))
    db.commit()
    return {"ok": True, "message": message, "data": _inventory_to_dict(item, profile)}


@app.get("/api/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    today = date.today()
    current_start = _week_start(today)
    rows: list[dict] = []
    for rank, offset in enumerate(range(0, 6), start=1):
        start = current_start - timedelta(days=offset * 7)
        end = start + timedelta(days=6)
        xp = (
            db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date >= start, Mission.date <= end)
            .scalar()
            or 0
        )
        missions_done = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date >= start, Mission.date <= end)
            .scalar()
            or 0
        )
        best = (
            db.query(func.coalesce(func.max(Completion.score), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date >= start, Mission.date <= end)
            .scalar()
            or 0
        )
        rows.append({
            "rank": rank,
            "week": f"{start.strftime('%b')} {start.day}-{end.strftime('%b')} {end.day}" if start.month != end.month else f"{start.strftime('%b')} {start.day}-{end.day}",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "total_xp": int(xp),
            "missions": int(missions_done),
            "streak": _ensure_profile(db).current_streak if offset == 0 else max(0, 7 - offset),
            "best_score": int(best),
            "current": offset == 0,
        })
    ranked = sorted(rows, key=lambda r: r["total_xp"], reverse=True)
    for idx, row in enumerate(ranked, start=1):
        row["rank"] = idx
    return {"rows": ranked, "podium": ranked[:3], "current_week": next((r for r in ranked if r["current"]), ranked[0] if ranked else None)}


# ---------- #24 Seasons ----------

SEASON_NAMES = [
    "Ignition", "Ascend", "Blaze", "Surge", "Apex",
    "Horizon", "Zenith", "Eclipse", "Inferno", "Nova",
    "Titan", "Orbit",
]
SEASON_ICONS = ["🔥", "🚀", "⚡", "🌊", "🏔️", "🌅", "✨", "🌑", "🔥", "💫", "🗿", "🪐"]
SEASON_RESET_KEEP_PCT = 0.70  # keep 70% of rank XP on reset


def _current_season_dates() -> tuple[date, date]:
    """Return (start, end) for the current monthly season."""
    today = date.today()
    start = today.replace(day=1)
    # end = last day of month
    if today.month == 12:
        end = date(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(today.year, today.month + 1, 1) - timedelta(days=1)
    return start, end


def _ensure_current_season(db: Session) -> Season:
    """Get or create the current month's season."""
    start, end = _current_season_dates()
    season = db.query(Season).filter(Season.start_date == start, Season.active == True).first()
    if season:
        return season

    # Count existing seasons to determine number
    count = db.query(Season).count()
    num = count + 1
    idx = (num - 1) % len(SEASON_NAMES)
    profile = _ensure_profile(db)

    season = Season(
        number=num,
        name=f"Season {num}: {SEASON_NAMES[idx]}",
        icon=SEASON_ICONS[idx],
        start_date=start,
        end_date=end,
        starting_xp=profile.total_xp or 0,
        peak_xp=profile.total_xp or 0,
        peak_rank=calculate_rank(profile.total_xp or 0),
        active=True,
    )
    # Deactivate previous seasons
    db.query(Season).filter(Season.active == True).update({"active": False})
    db.add(season)
    db.commit()
    db.refresh(season)
    return season


@app.get("/api/seasons/current")
def get_current_season(db: Session = Depends(get_db)):
    """Get the current season info + progress."""
    season = _ensure_current_season(db)
    profile = _ensure_profile(db)
    total_xp = profile.total_xp or 0

    # Update peak if current XP exceeds it
    if total_xp > (season.peak_xp or 0):
        season.peak_xp = total_xp
        season.peak_rank = calculate_rank(total_xp)
        db.commit()

    # Count missions completed this season
    missions_done = (
        db.query(func.count(Completion.id))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= season.start_date, Mission.date <= season.end_date)
        .scalar() or 0
    )
    season_xp = (
        db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= season.start_date, Mission.date <= season.end_date)
        .scalar() or 0
    )

    days_left = max(0, (season.end_date - date.today()).days)
    total_days = max(1, (season.end_date - season.start_date).days + 1)
    progress_pct = round(((total_days - days_left) / total_days) * 100, 1)

    return {
        "id": season.id,
        "number": season.number,
        "name": season.name,
        "icon": season.icon,
        "start_date": season.start_date.isoformat(),
        "end_date": season.end_date.isoformat(),
        "days_left": days_left,
        "progress_pct": progress_pct,
        "starting_xp": season.starting_xp,
        "current_xp": total_xp,
        "season_xp": int(season_xp),
        "peak_xp": season.peak_xp,
        "peak_rank": season.peak_rank,
        "current_rank": calculate_rank(total_xp),
        "missions_completed": int(missions_done),
        "active": season.active,
    }


@app.get("/api/seasons/history")
def get_season_history(db: Session = Depends(get_db)):
    """Get all past seasons."""
    _ensure_current_season(db)
    seasons = db.query(Season).order_by(desc(Season.number)).all()
    return {
        "seasons": [
            {
                "id": s.id,
                "number": s.number,
                "name": s.name,
                "icon": s.icon,
                "start_date": s.start_date.isoformat(),
                "end_date": s.end_date.isoformat(),
                "starting_xp": s.starting_xp or 0,
                "ending_xp": s.ending_xp or 0,
                "ending_rank": s.ending_rank or "Rookie",
                "peak_xp": s.peak_xp or 0,
                "peak_rank": s.peak_rank or "Rookie",
                "missions_completed": s.missions_completed or 0,
                "badge_awarded": s.badge_awarded,
                "active": s.active,
            }
            for s in seasons
        ]
    }


@app.post("/api/seasons/reset")
def trigger_season_reset(db: Session = Depends(get_db)):
    """Manually end the current season and start a new one with soft XP reset."""
    season = _ensure_current_season(db)
    profile = _ensure_profile(db)
    total_xp = profile.total_xp or 0

    # Finalize ending season
    missions_done = (
        db.query(func.count(Completion.id))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= season.start_date, Mission.date <= season.end_date)
        .scalar() or 0
    )
    season.ending_xp = total_xp
    season.ending_rank = calculate_rank(total_xp)
    season.missions_completed = int(missions_done)
    season.active = False

    # Award season badge to inventory
    badge_key = f"season_{season.number}_badge"
    badge_name = f"{season.name} Badge"
    season.badge_awarded = badge_key
    existing = db.query(InventoryItem).filter(InventoryItem.key == badge_key).first()
    if not existing:
        db.add(InventoryItem(
            key=badge_key,
            name=badge_name,
            type="badge",
            quantity=1,
            metadata_json=json.dumps({
                "season": season.number,
                "peak_rank": season.peak_rank,
                "peak_xp": season.peak_xp,
                "icon": season.icon,
            }),
        ))

    # Soft reset: keep 70% of XP
    new_xp = int(total_xp * SEASON_RESET_KEEP_PCT)
    old_rank = calculate_rank(total_xp)
    new_rank = calculate_rank(new_xp)
    profile.total_xp = new_xp
    xp_lost = total_xp - new_xp

    # Notification
    db.add(Notification(
        message=f"🏆 {season.name} ended! Peak rank: {season.peak_rank}. You earned the {badge_name}! XP adjusted: {total_xp} → {new_xp} (-{xp_lost})",
        type="milestone",
    ))

    db.commit()

    # Create new season (will be auto-created on next /api/seasons/current call)
    return {
        "ok": True,
        "message": f"{season.name} completed!",
        "old_xp": total_xp,
        "new_xp": new_xp,
        "xp_lost": xp_lost,
        "old_rank": old_rank,
        "new_rank": new_rank,
        "peak_rank": season.peak_rank,
        "badge_awarded": badge_key,
    }


@app.post("/api/scheduler/run-evening-review")
def run_evening_review():
    from scheduler import job_evening_review
    job_evening_review()
    return {"ok": True, "message": "Evening review ran."}


# ---------- Heatmap ----------

@app.get("/api/heatmap")
def heatmap(db: Session = Depends(get_db)):
    today = date.today()
    start = today - timedelta(days=364)
    rows = (
        db.query(Mission.date, func.coalesce(func.sum(Completion.xp_earned), 0))
        .join(Completion, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .group_by(Mission.date)
        .all()
    )
    data = {r[0].isoformat(): int(r[1]) for r in rows}
    days = []
    for i in range(365):
        d = start + timedelta(days=i)
        days.append({"date": d.isoformat(), "xp": data.get(d.isoformat(), 0)})
    return {"days": days}


# ---------- Daily Login Reward ----------

@app.post("/api/daily-login")
def daily_login(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    today = date.today()
    if profile.last_login_reward and profile.last_login_reward >= today:
        return {"ok": False, "message": "Already claimed today.", "xp_bonus": 0, "already_claimed": True}
    bonus = 25
    profile.last_login_reward = today
    profile.total_xp = (profile.total_xp or 0) + bonus
    db.add(Notification(message=f"Daily login bonus: +{bonus} XP!", type="info", read=False))
    db.commit()
    return {"ok": True, "message": f"+{bonus} XP daily login bonus!", "xp_bonus": bonus, "already_claimed": False}


# ---------- Goal Setting ----------

@app.get("/api/goal")
def get_goal(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    today = date.today()
    start = _week_start(today)
    week_xp = (
        db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .scalar() or 0
    )
    return {
        "weekly_xp_goal": profile.weekly_xp_goal or 0,
        "week_xp": int(week_xp),
        "progress_pct": min(100, round(int(week_xp) / max(1, profile.weekly_xp_goal or 1) * 100)),
    }


@app.put("/api/goal")
def set_goal(payload: GoalUpdate, db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    profile.weekly_xp_goal = max(0, payload.weekly_xp_goal)
    db.commit()
    return {"ok": True, "weekly_xp_goal": profile.weekly_xp_goal}


# ---------- Theme ----------

@app.get("/api/theme")
def get_theme(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    return {"theme": profile.theme or "light"}


@app.put("/api/theme")
def set_theme(payload: ThemeUpdate, db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    profile.theme = payload.theme if payload.theme in ("light", "dark") else "light"
    db.commit()
    return {"ok": True, "theme": profile.theme}


# ---------- Data Import ----------

@app.post("/api/import-data")
async def import_data_endpoint(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    if not data or "profile" not in data:
        raise HTTPException(400, "Invalid import data format")
    db.query(Completion).delete()
    db.query(Mission).delete()
    db.query(Notification).delete()
    db.query(Achievement).delete()
    db.query(Skill).delete()
    db.query(InventoryItem).delete()
    db.query(Bookmark).delete()

    profile = _ensure_profile(db)
    p = data.get("profile", {})
    profile.total_xp = p.get("total_xp", 0)
    profile.current_streak = p.get("current_streak", 0)
    profile.longest_streak = p.get("longest_streak", 0)
    if p.get("last_active"):
        profile.last_active = date.fromisoformat(p["last_active"])
    if p.get("display_name"):
        profile.display_name = p["display_name"]
    if p.get("bio"):
        profile.bio = p["bio"]
    if p.get("avatar"):
        profile.avatar = p["avatar"]

    for s in data.get("skills", []):
        db.add(Skill(name=s["name"], icon=s.get("icon", "⭐"), xp=s.get("xp", 0),
                      mission_count=s.get("mission_count", 0)))
    db.flush()

    skill_map = {s.name: s.id for s in db.query(Skill).all()}
    for m in data.get("missions", []):
        skill_id = skill_map.get(m.get("skill_name"), None)
        if not skill_id:
            continue
        mission = Mission(
            skill_id=skill_id, text=m["text"], xp_reward=m.get("xp_reward", 100),
            date=date.fromisoformat(m["date"]) if m.get("date") else date.today(),
            status=m.get("status", "pending"), difficulty=m.get("difficulty", "medium"),
            retry_count=m.get("retry_count", 0),
        )
        db.add(mission)
    db.flush()

    mission_map = {m.id: m for m in db.query(Mission).all()}
    for c in data.get("completions", []):
        old_id = c.get("mission_id")
        missions_list = list(mission_map.values())
        if old_id and old_id <= len(missions_list):
            mid = missions_list[old_id - 1].id if old_id <= len(missions_list) else None
        else:
            mid = None
        if mid:
            db.add(Completion(mission_id=mid, answer=c.get("answer", ""), score=c.get("score", 0),
                              feedback=c.get("feedback", ""), xp_earned=c.get("xp_earned", 0)))

    for a in data.get("achievements", []):
        ach = Achievement(key=a["key"], name=a["name"],
                          description=a.get("description", ""), icon=a.get("icon", "🏆"))
        if a.get("unlocked") and a.get("unlocked_at"):
            ach.unlocked_at = datetime.fromisoformat(a["unlocked_at"])
        db.add(ach)

    for item in DEFAULT_INVENTORY:
        db.add(InventoryItem(**item))

    db.add(Notification(message="Data imported successfully.", type="info", read=False))
    db.commit()
    return {"ok": True, "message": "Data imported successfully."}


# ---------- Generate with difficulty ----------

@app.post("/api/missions/generate-with-difficulty")
def generate_with_difficulty(payload: GenerateWithDifficulty, db: Session = Depends(get_db)):
    try:
        missions = generate_missions_for_today(db, difficulty=payload.difficulty)
        return {
            "ok": True,
            "count": len(missions),
            "missions": [_mission_to_dict(m) for m in missions],
        }
    except Exception as e:
        raise HTTPException(500, f"Mission generation failed: {e}")


@app.post("/api/settings/reset-progress")
def reset_progress(db: Session = Depends(get_db)):
    db.query(Completion).delete()
    db.query(Mission).delete()
    db.query(Notification).delete()
    db.query(Achievement).delete()
    db.query(Skill).delete()
    db.query(InventoryItem).delete()
    db.query(Bookmark).delete()
    profile = _ensure_profile(db)
    api_key = profile.openai_api_key
    profile.total_xp = 0
    profile.current_streak = 0
    profile.longest_streak = 0
    profile.last_active = None
    profile.xp_booster_active = False
    profile.streak_shield_active = False
    profile.combo_count = 0
    profile.combo_last_timestamp = None
    profile.openai_api_key = api_key
    for s in DEFAULT_SKILLS:
        db.add(Skill(name=s["name"], icon=s["icon"]))
    for a in DEFAULT_ACHIEVEMENTS:
        db.add(Achievement(key=a["key"], name=a["name"], description=a["description"], icon=a["icon"]))
    for item in DEFAULT_INVENTORY:
        db.add(InventoryItem(**item))
    db.add(Notification(message="All progress was reset.", type="info", read=False))
    db.commit()
    return {"ok": True, "message": "Progress reset."}


@app.post("/api/settings/factory-reset")
def factory_reset(db: Session = Depends(get_db)):
    """Complete factory reset — wipe everything back to fresh install state."""
    from models import Comment, StudyResource, WeeklyChallenge, SeasonalEvent
    # Delete all data from every table
    db.query(Comment).delete()
    db.query(StudyResource).delete()
    db.query(WeeklyChallenge).delete()
    db.query(Completion).delete()
    db.query(Bookmark).delete()
    db.query(Mission).delete()
    db.query(Notification).delete()
    db.query(Achievement).delete()
    db.query(InventoryItem).delete()
    db.query(Skill).delete()
    db.query(UserProfile).delete()
    db.commit()
    # Re-create fresh defaults
    profile = UserProfile(id=1)
    db.add(profile)
    for s in DEFAULT_SKILLS:
        db.add(Skill(name=s["name"], icon=s["icon"]))
    for a in DEFAULT_ACHIEVEMENTS:
        db.add(Achievement(key=a["key"], name=a["name"], description=a["description"], icon=a["icon"]))
    for item in DEFAULT_INVENTORY:
        db.add(InventoryItem(**item))
    db.commit()
    return {"ok": True, "message": "Factory reset complete. Application restored to initial state."}


# ========== NEW FEATURE ENDPOINTS ==========

# ---------- #12: Mission Reorder (Drag & Drop) ----------

@app.put("/api/missions/reorder")
def reorder_missions(payload: MissionReorder, db: Session = Depends(get_db)):
    for idx, mid in enumerate(payload.mission_ids):
        m = db.query(Mission).filter(Mission.id == mid).first()
        if m:
            m.sort_order = idx
    db.commit()
    return {"ok": True}


# ---------- #14: Combo System ----------

@app.get("/api/combo")
def get_combo(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    combo = profile.combo_count or 0
    from grader import get_combo_multiplier, COMBO_WINDOW_SECONDS
    remaining = 0
    if profile.combo_last_timestamp:
        last_ts = profile.combo_last_timestamp
        if last_ts.tzinfo is None:
            last_ts = last_ts.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - last_ts).total_seconds()
        remaining = max(0, int(COMBO_WINDOW_SECONDS - elapsed))
    return {
        "combo_count": combo,
        "combo_multiplier": get_combo_multiplier(combo),
        "time_remaining": remaining,
    }


# ---------- #15: Challenge Mode ----------

@app.post("/api/missions/generate-challenge")
def generate_challenge(db: Session = Depends(get_db)):
    """Generate a timed challenge mission with higher XP."""
    try:
        missions = generate_missions_for_today(db, difficulty="hard")
        if missions:
            m = missions[0]
            m.is_challenge = True
            m.challenge_time_limit = 300  # 5 minutes
            m.xp_reward = int((m.xp_reward or 100) * 1.5)
            db.commit()
            db.add(Notification(message="Challenge mission generated! 5 minutes, 1.5x XP!", type="challenge", read=False))
            db.commit()
            return {"ok": True, "mission": _mission_to_dict(m)}
        return {"ok": False, "message": "Could not generate challenge mission."}
    except Exception as e:
        raise HTTPException(500, f"Challenge generation failed: {e}")


# ---------- #17: Seasonal Events ----------

@app.get("/api/events")
def get_events(db: Session = Depends(get_db)):
    today = date.today()
    active = db.query(SeasonalEvent).filter(
        SeasonalEvent.active == True,
        SeasonalEvent.start_date <= today,
        SeasonalEvent.end_date >= today,
    ).all()
    upcoming = db.query(SeasonalEvent).filter(
        SeasonalEvent.active == True,
        SeasonalEvent.start_date > today,
    ).order_by(SeasonalEvent.start_date.asc()).limit(5).all()
    past = db.query(SeasonalEvent).filter(
        SeasonalEvent.end_date < today,
    ).order_by(desc(SeasonalEvent.end_date)).limit(10).all()

    def ev_dict(e):
        return {
            "id": e.id, "key": e.key, "name": e.name, "description": e.description,
            "icon": e.icon, "event_type": e.event_type,
            "start_date": e.start_date.isoformat(), "end_date": e.end_date.isoformat(),
            "bonus_xp_pct": e.bonus_xp_pct, "badge_key": e.badge_key,
            "active": today >= e.start_date and today <= e.end_date,
        }
    return {"active": [ev_dict(e) for e in active], "upcoming": [ev_dict(e) for e in upcoming], "past": [ev_dict(e) for e in past]}


# ---------- #18: Custom Missions ----------

@app.post("/api/missions/custom")
def create_custom_mission(payload: CustomMissionCreate, db: Session = Depends(get_db)):
    skill = db.query(Skill).filter(Skill.id == payload.skill_id).first()
    if not skill:
        raise HTTPException(404, "Skill not found")
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(400, "Mission text required")
    m = Mission(
        skill_id=payload.skill_id,
        text=text,
        xp_reward=max(50, min(200, payload.xp_reward or 100)),
        date=date.today(),
        status="pending",
        difficulty=payload.difficulty or "medium",
        is_custom=True,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"ok": True, "mission": _mission_to_dict(m)}


# ---------- #19: Monthly Report ----------

@app.get("/api/report/monthly")
def monthly_report(db: Session = Depends(get_db)):
    today = date.today()
    start = today.replace(day=1)
    end = today

    # Daily XP for the month
    daily: list[dict] = []
    d = start
    while d <= end:
        xp = (
            db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date == d)
            .scalar() or 0
        )
        missions_done = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date == d)
            .scalar() or 0
        )
        daily.append({"date": d.isoformat(), "day": d.strftime("%d"), "xp": int(xp), "missions": int(missions_done)})
        d += timedelta(days=1)

    # Skill breakdown
    rows = (
        db.query(Skill.id, Skill.name, Skill.icon, Skill.xp,
                 func.coalesce(func.sum(Completion.xp_earned), 0))
        .outerjoin(Mission, (Mission.skill_id == Skill.id) & (Mission.date >= start) & (Mission.date <= end))
        .outerjoin(Completion, Completion.mission_id == Mission.id)
        .group_by(Skill.id)
        .all()
    )
    skill_breakdown = [
        {"id": r[0], "name": r[1], "icon": r[2], "total_xp": r[3] or 0, "xp_this_month": int(r[4] or 0), "level": calculate_skill_level(r[3] or 0)}
        for r in rows
    ]

    total_month_xp = sum(d["xp"] for d in daily)
    total_month_missions = sum(d["missions"] for d in daily)

    profile = _ensure_profile(db)

    # Best day
    best_day = max(daily, key=lambda d: d["xp"]) if daily else None

    # Average score this month
    avg_score = (
        db.query(func.coalesce(func.avg(Completion.score), 0))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= end)
        .scalar() or 0
    )

    return {
        "month": today.strftime("%B %Y"),
        "total_month_xp": total_month_xp,
        "total_month_missions": total_month_missions,
        "current_streak": profile.current_streak or 0,
        "longest_streak": profile.longest_streak or 0,
        "daily": daily,
        "skill_breakdown": skill_breakdown,
        "best_day": best_day,
        "avg_score": round(float(avg_score), 1),
        "total_xp": profile.total_xp or 0,
        "rank": calculate_rank(profile.total_xp or 0),
    }


# ---------- #20: Skill Radar Chart ----------

@app.get("/api/skills/radar")
def skill_radar(db: Session = Depends(get_db)):
    skills = db.query(Skill).order_by(Skill.id.asc()).all()
    max_xp = max((s.xp or 0) for s in skills) if skills else 1
    return {
        "skills": [
            {
                "name": s.name,
                "icon": s.icon,
                "xp": s.xp or 0,
                "level": calculate_skill_level(s.xp or 0),
                "normalized": round((s.xp or 0) / max(1, max_xp) * 100, 1),
            }
            for s in skills
        ],
        "max_xp": max_xp,
    }


# ---------- #21: Streak Calendar ----------

@app.get("/api/streak-calendar")
def streak_calendar(db: Session = Depends(get_db)):
    today = date.today()
    start = today - timedelta(days=364)
    # Days with at least one graded mission
    rows = (
        db.query(Mission.date, func.count(Completion.id))
        .join(Completion, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .group_by(Mission.date)
        .all()
    )
    active_dates = {r[0].isoformat(): int(r[1]) for r in rows}
    days = []
    for i in range(365):
        d = start + timedelta(days=i)
        ds = d.isoformat()
        days.append({"date": ds, "active": ds in active_dates, "missions": active_dates.get(ds, 0)})
    return {"days": days}


# ---------- #22: Performance Trends ----------

@app.get("/api/analytics/trends")
def performance_trends(skill_id: Optional[int] = None, db: Session = Depends(get_db)):
    today = date.today()
    start = today - timedelta(days=29)
    query = (
        db.query(Mission.date, func.avg(Completion.score), func.sum(Completion.xp_earned), func.count(Completion.id))
        .join(Completion, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
    )
    if skill_id:
        query = query.filter(Mission.skill_id == skill_id)
    rows = query.group_by(Mission.date).order_by(Mission.date.asc()).all()
    return {
        "trends": [
            {
                "date": r[0].isoformat(),
                "avg_score": round(float(r[1] or 0), 1),
                "xp": int(r[2] or 0),
                "missions": int(r[3] or 0),
            }
            for r in rows
        ]
    }


# ---------- #23: Time-of-Day Analysis ----------

@app.get("/api/analytics/time-of-day")
def time_of_day_analysis(db: Session = Depends(get_db)):
    rows = (
        db.query(
            extract("hour", Completion.submitted_at).label("hour"),
            func.avg(Completion.score),
            func.count(Completion.id),
            func.sum(Completion.xp_earned),
        )
        .filter(Completion.submitted_at.isnot(None))
        .group_by("hour")
        .order_by("hour")
        .all()
    )
    # Fill all 24 hours
    hour_data = {int(r[0]): {"avg_score": round(float(r[1] or 0), 1), "count": int(r[2] or 0), "xp": int(r[3] or 0)} for r in rows}
    hours = []
    for h in range(24):
        d = hour_data.get(h, {"avg_score": 0, "count": 0, "xp": 0})
        label = f"{h:02d}:00"
        hours.append({"hour": h, "label": label, **d})

    best_hour = max(hours, key=lambda x: x["avg_score"]) if any(h["count"] > 0 for h in hours) else None
    return {"hours": hours, "best_hour": best_hour}


# ---------- #24: Customizable Profile ----------

@app.get("/api/profile")
def get_profile(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    rank_info = rank_progress(profile.total_xp or 0)
    total_missions = db.query(func.count(Completion.id)).scalar() or 0
    skills_count = db.query(func.count(Skill.id)).scalar() or 0
    achievements_unlocked = db.query(func.count(Achievement.id)).filter(Achievement.unlocked_at.isnot(None)).scalar() or 0
    achievements_total = db.query(func.count(Achievement.id)).scalar() or 0

    return {
        "display_name": profile.display_name or "Hari",
        "bio": profile.bio or "",
        "avatar": profile.avatar or "⚡",
        "total_xp": profile.total_xp or 0,
        "rank": rank_info["rank"],
        "rank_progress_pct": rank_info["progress_pct"],
        "current_streak": profile.current_streak or 0,
        "longest_streak": profile.longest_streak or 0,
        "total_missions": total_missions,
        "skills_count": skills_count,
        "achievements_unlocked": achievements_unlocked,
        "achievements_total": achievements_total,
        "member_since": profile.last_active.isoformat() if profile.last_active else date.today().isoformat(),
        "preferred_language": profile.preferred_language or "english",
    }


@app.put("/api/profile")
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    if payload.display_name is not None:
        profile.display_name = payload.display_name.strip()[:50]
    if payload.bio is not None:
        profile.bio = payload.bio.strip()[:200]
    if payload.avatar is not None:
        profile.avatar = payload.avatar[:4]
    if payload.preferred_language is not None:
        profile.preferred_language = payload.preferred_language
    db.commit()
    return {"ok": True, "message": "Profile updated."}


# ---------- #25: Shareable Report Card ----------

@app.get("/api/report/card")
def report_card(db: Session = Depends(get_db)):
    """Data for shareable report card image."""
    profile = _ensure_profile(db)
    rank_info = rank_progress(profile.total_xp or 0)
    today = date.today()
    start = _week_start(today)
    week_xp = (
        db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .scalar() or 0
    )
    week_missions = (
        db.query(func.count(Completion.id))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .scalar() or 0
    )
    avg_score = (
        db.query(func.coalesce(func.avg(Completion.score), 0))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .scalar() or 0
    )
    skills = db.query(Skill).order_by(desc(Skill.xp)).limit(3).all()

    return {
        "display_name": profile.display_name or "Hari",
        "avatar": profile.avatar or "⚡",
        "rank": rank_info["rank"],
        "total_xp": profile.total_xp or 0,
        "week_xp": int(week_xp),
        "week_missions": int(week_missions),
        "avg_score": round(float(avg_score), 1),
        "current_streak": profile.current_streak or 0,
        "top_skills": [{"name": s.name, "icon": s.icon, "level": calculate_skill_level(s.xp or 0)} for s in skills],
        "week_label": f"{start.strftime('%b %d')} - {today.strftime('%b %d, %Y')}",
    }


# ---------- #27: Mission Bookmarks ----------

@app.post("/api/missions/{mission_id}/bookmark")
def toggle_bookmark(mission_id: int, db: Session = Depends(get_db)):
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")

    existing = db.query(Bookmark).filter(Bookmark.mission_id == mission_id).first()
    if existing:
        db.delete(existing)
        mission.bookmarked = False
        db.commit()
        return {"ok": True, "bookmarked": False}
    else:
        db.add(Bookmark(mission_id=mission_id))
        mission.bookmarked = True
        db.commit()
        return {"ok": True, "bookmarked": True}


@app.get("/api/bookmarks")
def get_bookmarks(db: Session = Depends(get_db)):
    bookmarks = (
        db.query(Bookmark)
        .join(Mission, Bookmark.mission_id == Mission.id)
        .order_by(desc(Bookmark.created_at))
        .all()
    )
    return {
        "bookmarks": [
            {
                "id": b.id,
                "mission": _mission_to_dict(b.mission),
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in bookmarks
        ]
    }


# ---------- #28: Answer History ----------

@app.get("/api/answer-history")
def answer_history(
    skill_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
):
    query = (
        db.query(Mission, Completion)
        .join(Completion, Completion.mission_id == Mission.id)
    )
    if skill_id:
        query = query.filter(Mission.skill_id == skill_id)
    total = query.count()
    items = (
        query.order_by(desc(Completion.submitted_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": [
            {
                "mission_id": m.id,
                "skill_name": m.skill.name if m.skill else "Unknown",
                "skill_icon": m.skill.icon if m.skill else "⭐",
                "text": m.text,
                "difficulty": m.difficulty,
                "answer": c.answer or "",
                "score": c.score or 0,
                "feedback": c.feedback or "",
                "xp_earned": c.xp_earned or 0,
                "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
                "date": m.date.isoformat() if m.date else None,
            }
            for m, c in items
        ],
    }


# ---------- #30: Multi-language Missions ----------

@app.put("/api/settings/language")
def set_language(payload: LanguageUpdate, db: Session = Depends(get_db)):
    valid = ["english", "spanish", "french", "german", "japanese", "hindi", "chinese", "korean", "portuguese", "italian"]
    lang = payload.language.lower()
    if lang not in valid:
        raise HTTPException(400, f"Unsupported language. Choose from: {', '.join(valid)}")
    profile = _ensure_profile(db)
    profile.preferred_language = lang
    db.commit()
    return {"ok": True, "language": lang}


# ---------- #32: Auto-backup ----------

@app.post("/api/backup")
def create_backup(db: Session = Depends(get_db)):
    """Create a manual backup of the database."""
    backup_dir = os.path.join(BASE_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"skillforge_backup_{timestamp}.db")
    db_path = os.path.join(BASE_DIR, "skillforge.db")
    try:
        shutil.copy2(db_path, backup_path)
        profile = _ensure_profile(db)
        profile.last_backup_at = datetime.now(timezone.utc)
        db.add(Notification(message=f"Backup created: {timestamp}", type="info", read=False))
        db.commit()
        return {"ok": True, "message": f"Backup created: {backup_path}", "timestamp": timestamp}
    except Exception as e:
        raise HTTPException(500, f"Backup failed: {e}")


@app.get("/api/backups")
def list_backups():
    backup_dir = os.path.join(BASE_DIR, "backups")
    if not os.path.exists(backup_dir):
        return {"backups": []}
    files = sorted(
        [f for f in os.listdir(backup_dir) if f.endswith(".db")],
        reverse=True,
    )
    return {
        "backups": [
            {
                "filename": f,
                "size_kb": round(os.path.getsize(os.path.join(backup_dir, f)) / 1024, 1),
                "created": f.replace("skillforge_backup_", "").replace(".db", ""),
            }
            for f in files[:20]
        ]
    }


@app.put("/api/settings/auto-backup")
def toggle_auto_backup(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    profile.auto_backup_enabled = not profile.auto_backup_enabled
    db.commit()
    return {"ok": True, "auto_backup_enabled": bool(profile.auto_backup_enabled)}


# ========== V2 FEATURE ENDPOINTS ==========

# ---------- #9: Spaced Repetition ----------

@app.get("/api/missions/review")
def get_review_missions(db: Session = Depends(get_db)):
    """Get missions due for spaced repetition review."""
    today = date.today()
    due = (
        db.query(Mission)
        .filter(
            Mission.status == "graded",
            Mission.next_review_date.isnot(None),
            Mission.next_review_date <= today,
        )
        .order_by(Mission.next_review_date.asc())
        .limit(5)
        .all()
    )
    return {"missions": [_mission_to_dict(m) for m in due]}


@app.post("/api/missions/{mission_id}/schedule-review")
def schedule_review(mission_id: int, db: Session = Depends(get_db)):
    """Schedule a graded mission for spaced repetition review."""
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")
    review_count = (mission.review_count or 0)
    # Fibonacci-like intervals: 1, 3, 7, 14, 30 days
    intervals = [1, 3, 7, 14, 30]
    days = intervals[min(review_count, len(intervals) - 1)]
    mission.next_review_date = date.today() + timedelta(days=days)
    mission.review_count = review_count + 1
    db.commit()
    return {"ok": True, "next_review_date": mission.next_review_date.isoformat(), "days": days}


# ---------- #10: Challenge Timer ----------

@app.post("/api/missions/{mission_id}/start-timer")
def start_challenge_timer(mission_id: int, db: Session = Depends(get_db)):
    """Start the countdown timer for a challenge mission."""
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")
    if not mission.is_challenge:
        raise HTTPException(400, "Not a challenge mission")
    mission.challenge_started_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "started_at": mission.challenge_started_at.isoformat(), "time_limit": mission.challenge_time_limit or 300}


# ---------- #11: Adaptive Difficulty ----------

@app.get("/api/adaptive-difficulty")
def get_adaptive_difficulty(db: Session = Depends(get_db)):
    """Auto-adjust difficulty based on recent avg score."""
    profile = _ensure_profile(db)
    recent_avg = (
        db.query(func.avg(Completion.score))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= date.today() - timedelta(days=7))
        .scalar()
    )
    avg = float(recent_avg or 50)
    if avg >= 80:
        recommended = "hard"
    elif avg >= 55:
        recommended = "medium"
    else:
        recommended = "easy"
    profile.adaptive_difficulty = recommended
    db.commit()
    return {"avg_score_7d": round(avg, 1), "recommended_difficulty": recommended}


# ---------- #12: AI Hint System ----------

@app.post("/api/missions/{mission_id}/hint")
def get_hint(mission_id: int, db: Session = Depends(get_db)):
    """Get a progressive hint for a mission. Costs 10% XP deduction."""
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")
    if mission.status == "graded":
        raise HTTPException(400, "Mission already graded")

    profile = _ensure_profile(db)
    if (profile.hints_remaining or 0) <= 0:
        raise HTTPException(400, "No hints remaining today. Resets at midnight.")

    skill = db.query(Skill).filter(Skill.id == mission.skill_id).first()
    skill_name = skill.name if skill else "General"

    # Generate hint via LLM (OpenAI or Gemini) or provide generic hint
    hint_text = ""
    try:
        from agent import _get_api_provider, _get_openai_client, _get_gemini_model
        provider = _get_api_provider(db)
        hint_system = f"Give a brief, progressive hint for this {skill_name} question. Don't give the answer — just nudge the student in the right direction. 1-2 sentences max."

        if provider == "gemini":
            model = _get_gemini_model(db)
            resp = model.generate_content(f"{hint_system}\n\n{mission.text}",
                generation_config={"temperature": 0.7, "max_output_tokens": 150})
            hint_text = resp.text or "Think about the key concepts involved."
        else:
            client = _get_openai_client(db)
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": hint_system},
                    {"role": "user", "content": mission.text},
                ],
                temperature=0.7,
                max_tokens=150,
            )
            hint_text = resp.choices[0].message.content or "Think about the key concepts involved."
    except Exception:
        hint_text = "Break the problem into smaller parts. Focus on the core concept being tested."

    mission.hint_used = True
    mission.xp_reward = int((mission.xp_reward or 100) * 0.9)  # 10% XP deduction
    profile.hints_remaining = max(0, (profile.hints_remaining or 0) - 1)
    db.commit()
    return {"ok": True, "hint": hint_text, "xp_penalty": "10%", "hints_remaining": profile.hints_remaining}


# ---------- #15: Streak Freeze ----------

@app.post("/api/streak/freeze")
def use_streak_freeze(db: Session = Depends(get_db)):
    """Activate a streak freeze to protect streak for one missed day."""
    profile = _ensure_profile(db)
    if (profile.streak_freezes or 0) <= 0:
        raise HTTPException(400, "No streak freezes available")
    profile.streak_shield_active = True
    profile.streak_freezes = max(0, (profile.streak_freezes or 0) - 1)
    db.add(Notification(message="Streak Freeze activated! Your streak is protected for 1 missed day.", type="streak", read=False))
    db.commit()
    return {"ok": True, "freezes_remaining": profile.streak_freezes, "message": "Streak freeze activated!"}


@app.get("/api/streak/status")
def streak_status(db: Session = Depends(get_db)):
    """Get streak status including freeze availability."""
    profile = _ensure_profile(db)
    today = date.today()
    yesterday = today - timedelta(days=1)
    effective_streak = profile.current_streak or 0
    if profile.last_active and profile.last_active < yesterday:
        effective_streak = 0
    return {
        "current_streak": effective_streak,
        "longest_streak": profile.longest_streak or 0,
        "streak_shield_active": bool(profile.streak_shield_active),
        "freezes_remaining": profile.streak_freezes or 0,
        "last_active": profile.last_active.isoformat() if profile.last_active else None,
    }


# ---------- #17: Mission Tags ----------

@app.put("/api/missions/{mission_id}/tags")
def update_mission_tags(mission_id: int, request_body: dict, db: Session = Depends(get_db)):
    """Update tags for a mission."""
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")
    tags = request_body.get("tags", [])
    mission.tags = ",".join(tags) if isinstance(tags, list) else str(tags)
    db.commit()
    return {"ok": True, "tags": mission.tags.split(",") if mission.tags else []}


@app.get("/api/missions/tags")
def list_all_tags(db: Session = Depends(get_db)):
    """Get all unique tags used across missions."""
    missions = db.query(Mission.tags).filter(Mission.tags.isnot(None), Mission.tags != "").all()
    all_tags = set()
    for (tags_str,) in missions:
        for t in tags_str.split(","):
            t = t.strip()
            if t:
                all_tags.add(t)
    return {"tags": sorted(all_tags)}


# ---------- #18: Study Resource Links ----------

@app.get("/api/resources")
def list_resources(skill_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List study resources, optionally filtered by skill."""
    query = db.query(StudyResource).order_by(StudyResource.created_at.desc())
    if skill_id:
        query = query.filter(StudyResource.skill_id == skill_id)
    return {"resources": [
        {"id": r.id, "skill_id": r.skill_id, "title": r.title, "url": r.url,
         "resource_type": r.resource_type, "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in query.limit(50).all()
    ]}


@app.post("/api/resources")
def add_resource(payload: StudyResourceCreate, db: Session = Depends(get_db)):
    """Add a study resource link."""
    r = StudyResource(
        skill_id=payload.skill_id,
        title=payload.title.strip(),
        url=payload.url.strip(),
        resource_type=payload.resource_type or "article",
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"ok": True, "id": r.id}


@app.delete("/api/resources/{resource_id}")
def delete_resource(resource_id: int, db: Session = Depends(get_db)):
    r = db.query(StudyResource).filter(StudyResource.id == resource_id).first()
    if not r:
        raise HTTPException(404, "Resource not found")
    db.delete(r)
    db.commit()
    return {"ok": True}


# ---------- #23: Weekly Challenges ----------

@app.get("/api/weekly-challenge")
def get_weekly_challenge(db: Session = Depends(get_db)):
    """Get the current week's challenge, creating one if none exists."""
    today = date.today()
    start = _week_start(today)
    end = start + timedelta(days=6)

    challenge = db.query(WeeklyChallenge).filter(
        WeeklyChallenge.week_start == start
    ).first()

    if not challenge:
        # Auto-generate a weekly challenge
        import random
        challenges = [
            {"title": "Mission Marathon", "description": "Complete 10 missions this week", "target_type": "missions", "target_value": 10, "reward_xp": 200},
            {"title": "XP Hunter", "description": "Earn 500 XP this week", "target_type": "xp", "target_value": 500, "reward_xp": 250},
            {"title": "Perfectionist", "description": "Score 80+ on 5 missions", "target_type": "score", "target_value": 5, "reward_xp": 300},
            {"title": "Skill Explorer", "description": "Complete missions in all skills", "target_type": "missions", "target_value": 4, "reward_xp": 200},
            {"title": "Daily Grinder", "description": "Complete at least 1 mission every day", "target_type": "missions", "target_value": 7, "reward_xp": 350},
        ]
        ch = random.choice(challenges)
        challenge = WeeklyChallenge(
            title=ch["title"], description=ch["description"],
            target_type=ch["target_type"], target_value=ch["target_value"],
            week_start=start, week_end=end, reward_xp=ch["reward_xp"],
        )
        db.add(challenge)
        db.commit()
        db.refresh(challenge)

    # Compute progress
    progress = 0
    if challenge.target_type == "missions":
        progress = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date >= start, Mission.date <= end)
            .scalar() or 0
        )
    elif challenge.target_type == "xp":
        progress = (
            db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date >= start, Mission.date <= end)
            .scalar() or 0
        )
    elif challenge.target_type == "score":
        progress = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date >= start, Mission.date <= end, Completion.score >= 80)
            .scalar() or 0
        )

    challenge.progress = int(progress)

    # Check completion
    if not challenge.completed and challenge.progress >= challenge.target_value:
        challenge.completed = True
        challenge.completed_at = datetime.now(timezone.utc)
        profile = _ensure_profile(db)
        profile.total_xp = (profile.total_xp or 0) + challenge.reward_xp
        db.add(Notification(
            message=f"Weekly Challenge completed: {challenge.title}! +{challenge.reward_xp} XP!",
            type="achievement", read=False,
        ))

    db.commit()

    return {
        "id": challenge.id,
        "title": challenge.title,
        "description": challenge.description,
        "target_type": challenge.target_type,
        "target_value": challenge.target_value,
        "progress": challenge.progress,
        "progress_pct": min(100, round(challenge.progress / max(1, challenge.target_value) * 100)),
        "completed": bool(challenge.completed),
        "completed_at": challenge.completed_at.isoformat() if challenge.completed_at else None,
        "reward_xp": challenge.reward_xp,
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
    }


# ---------- #25: Secret Achievements ----------

@app.get("/api/achievements/all")
def list_all_achievements(db: Session = Depends(get_db)):
    """List achievements, hiding secret ones that are locked."""
    items = db.query(Achievement).order_by(Achievement.id.asc()).all()
    return [
        {
            "id": a.id,
            "key": a.key,
            "name": a.name if (a.unlocked_at or not a.secret) else "???",
            "description": a.description if (a.unlocked_at or not a.secret) else "Hidden achievement — unlock to reveal!",
            "icon": a.icon if (a.unlocked_at or not a.secret) else "❓",
            "unlocked": a.unlocked_at is not None,
            "unlocked_at": a.unlocked_at.isoformat() if a.unlocked_at else None,
            "secret": bool(a.secret) if hasattr(a, 'secret') else False,
            "rarity": (a.rarity if hasattr(a, 'rarity') else "common") or "common",
        }
        for a in items
    ]


# ---------- #30: Loot Box Rewards ----------

@app.post("/api/loot-box")
def open_loot_box(db: Session = Depends(get_db)):
    """Open a random loot box reward. Available on milestones."""
    import random
    profile = _ensure_profile(db)

    loot_table = [
        {"name": "XP Booster", "key": "xp_booster", "type": "powerup", "rarity": "common", "weight": 40},
        {"name": "Streak Shield", "key": "streak_shield", "type": "powerup", "rarity": "common", "weight": 25},
        {"name": "Streak Freeze", "key": "streak_freeze", "type": "powerup", "rarity": "rare", "weight": 15},
        {"name": "Double XP Hour", "key": "double_xp_hour", "type": "powerup", "rarity": "rare", "weight": 10},
        {"name": "Mystery Badge", "key": "mystery_badge", "type": "badge", "rarity": "epic", "weight": 7},
        {"name": "Legendary Token", "key": "legendary_token", "type": "badge", "rarity": "legendary", "weight": 3},
    ]
    weights = [item["weight"] for item in loot_table]
    chosen = random.choices(loot_table, weights=weights, k=1)[0]

    # Apply reward
    if chosen["key"] == "xp_booster":
        item = db.query(InventoryItem).filter(InventoryItem.key == "xp_booster").first()
        if item:
            item.quantity = (item.quantity or 0) + 1
    elif chosen["key"] == "streak_shield":
        item = db.query(InventoryItem).filter(InventoryItem.key == "streak_shield").first()
        if item:
            item.quantity = (item.quantity or 0) + 1
    elif chosen["key"] == "streak_freeze":
        profile.streak_freezes = (profile.streak_freezes or 0) + 1
    elif chosen["key"] == "double_xp_hour":
        profile.xp_booster_active = True
    elif chosen["key"] in ("mystery_badge", "legendary_token"):
        bonus_xp = 100 if chosen["rarity"] == "epic" else 500
        profile.total_xp = (profile.total_xp or 0) + bonus_xp

    db.add(Notification(
        message=f"Loot Box: You got {chosen['name']}! ({chosen['rarity'].title()})",
        type="achievement", read=False,
    ))
    db.commit()
    return {"ok": True, "item": chosen}


# ---------- #31: Topic Heatmap ----------

@app.get("/api/analytics/topic-heatmap")
def topic_heatmap(db: Session = Depends(get_db)):
    """2D grid: skill × difficulty, color = avg score."""
    skills = db.query(Skill).order_by(Skill.id.asc()).all()
    difficulties = ["easy", "medium", "hard"]
    grid = []
    for skill in skills:
        row = {"skill_name": skill.name, "skill_icon": skill.icon, "cells": []}
        for diff in difficulties:
            avg = (
                db.query(func.avg(Completion.score))
                .join(Mission, Completion.mission_id == Mission.id)
                .filter(Mission.skill_id == skill.id, Mission.difficulty == diff)
                .scalar()
            )
            count = (
                db.query(func.count(Completion.id))
                .join(Mission, Completion.mission_id == Mission.id)
                .filter(Mission.skill_id == skill.id, Mission.difficulty == diff)
                .scalar() or 0
            )
            row["cells"].append({
                "difficulty": diff,
                "avg_score": round(float(avg or 0), 1),
                "count": int(count),
            })
        grid.append(row)
    return {"grid": grid, "difficulties": difficulties}


# ---------- #32: Learning Velocity ----------

@app.get("/api/analytics/velocity")
def learning_velocity(db: Session = Depends(get_db)):
    """XP per hour trend over the last 30 days."""
    today = date.today()
    start = today - timedelta(days=29)
    rows = (
        db.query(
            Mission.date,
            func.sum(Completion.xp_earned),
            func.count(Completion.id),
        )
        .join(Completion, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .group_by(Mission.date)
        .order_by(Mission.date.asc())
        .all()
    )
    points = []
    for r in rows:
        xp = int(r[1] or 0)
        missions = int(r[2] or 0)
        # Estimate ~15 min per mission
        hours = max(0.25, missions * 0.25)
        points.append({
            "date": r[0].isoformat(),
            "xp": xp,
            "missions": missions,
            "xp_per_hour": round(xp / hours, 1),
        })
    return {"velocity": points}


# ---------- #33: Mistake Pattern Detection ----------

@app.get("/api/analytics/mistakes")
def mistake_patterns(db: Session = Depends(get_db)):
    """Detect patterns in low-scoring missions."""
    skills = db.query(Skill).all()
    patterns = []
    for skill in skills:
        low_count = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == skill.id, Completion.score < 50)
            .scalar() or 0
        )
        total_count = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == skill.id)
            .scalar() or 0
        )
        avg_score = (
            db.query(func.avg(Completion.score))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == skill.id)
            .scalar()
        )
        if total_count > 0:
            patterns.append({
                "skill_name": skill.name,
                "skill_icon": skill.icon,
                "total_missions": int(total_count),
                "low_score_count": int(low_count),
                "struggle_pct": round(low_count / max(1, total_count) * 100, 1),
                "avg_score": round(float(avg_score or 0), 1),
            })
    patterns.sort(key=lambda p: p["struggle_pct"], reverse=True)
    return {"patterns": patterns}


# ---------- #34: Skill Retention Tracker ----------

@app.get("/api/analytics/retention")
def skill_retention(db: Session = Depends(get_db)):
    """Days since last practice per skill."""
    today = date.today()
    skills = db.query(Skill).all()
    retention = []
    for skill in skills:
        last_date = (
            db.query(func.max(Mission.date))
            .join(Completion, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == skill.id)
            .scalar()
        )
        days_since = (today - last_date).days if last_date else None
        retention.append({
            "skill_name": skill.name,
            "skill_icon": skill.icon,
            "last_practiced": last_date.isoformat() if last_date else None,
            "days_since": days_since,
            "status": "fresh" if days_since is not None and days_since <= 3 else "stale" if days_since is not None and days_since <= 7 else "rusty",
        })
    return {"retention": retention}


# ---------- #35: Session Quality Metrics ----------

@app.get("/api/analytics/session-quality")
def session_quality(db: Session = Depends(get_db)):
    """Score patterns by time of day and day of week."""
    # By day of week
    rows = (
        db.query(
            func.strftime("%w", Completion.submitted_at).label("dow"),
            func.avg(Completion.score),
            func.count(Completion.id),
        )
        .filter(Completion.submitted_at.isnot(None))
        .group_by("dow")
        .all()
    )
    day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    by_day = []
    for r in rows:
        dow = int(r[0] or 0)
        by_day.append({
            "day": day_names[dow],
            "day_num": dow,
            "avg_score": round(float(r[1] or 0), 1),
            "count": int(r[2] or 0),
        })

    # Best performing day/time
    best_day = max(by_day, key=lambda d: d["avg_score"]) if by_day else None

    return {
        "by_day_of_week": by_day,
        "best_day": best_day,
    }


# ---------- #37: Goal Streaks ----------

@app.get("/api/goal-streak")
def get_goal_streak(db: Session = Depends(get_db)):
    """Track consecutive weeks hitting weekly XP goal."""
    profile = _ensure_profile(db)
    return {
        "goal_streak": profile.goal_streak or 0,
        "weekly_xp_goal": profile.weekly_xp_goal or 0,
    }


# ---------- #43: Public Profile Card ----------

@app.get("/api/profile/public")
def public_profile(db: Session = Depends(get_db)):
    """Shareable public profile data."""
    profile = _ensure_profile(db)
    rank_info = rank_progress(profile.total_xp or 0)
    total_missions = db.query(func.count(Completion.id)).scalar() or 0
    skills = db.query(Skill).order_by(desc(Skill.xp)).limit(3).all()
    achievements_unlocked = db.query(func.count(Achievement.id)).filter(Achievement.unlocked_at.isnot(None)).scalar() or 0

    return {
        "display_name": profile.display_name or "Hari",
        "avatar": profile.avatar or "⚡",
        "rank": rank_info["rank"],
        "total_xp": profile.total_xp or 0,
        "current_streak": profile.current_streak or 0,
        "total_missions": total_missions,
        "achievements_unlocked": achievements_unlocked,
        "top_skills": [{"name": s.name, "icon": s.icon, "level": calculate_skill_level(s.xp or 0)} for s in skills],
        "member_since": profile.last_active.isoformat() if profile.last_active else date.today().isoformat(),
    }


# ---------- #20: Onboarding Status ----------

@app.get("/api/onboarding")
def get_onboarding(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    return {"done": bool(profile.onboarding_done)}


@app.post("/api/onboarding/complete")
def complete_onboarding(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    profile.onboarding_done = True
    db.commit()
    return {"ok": True}


# ---------- #50: API Rate Limiting (Simple) ----------

from collections import defaultdict
import time

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 300  # requests per window (generous for local single-user app)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Simple in-memory rate limiting."""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    # Clean old entries
    _rate_limit_store[client_ip] = [t for t in _rate_limit_store[client_ip] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again later."})
    _rate_limit_store[client_ip].append(now)
    return await call_next(request)


# ---------- #14: Mission Comments ----------

class CommentCreate(BaseModel):
    text: str


@app.get("/api/missions/{mission_id}/comments")
def list_comments(mission_id: int, db: Session = Depends(get_db)):
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    comments = db.query(Comment).filter(Comment.mission_id == mission_id).order_by(Comment.created_at.desc()).all()
    return {"comments": [
        {"id": c.id, "mission_id": c.mission_id, "text": c.text, "author": c.author,
         "created_at": c.created_at.isoformat() if c.created_at else None}
        for c in comments
    ]}


@app.post("/api/missions/{mission_id}/comments")
def add_comment(mission_id: int, body: CommentCreate, db: Session = Depends(get_db)):
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    comment = Comment(mission_id=mission_id, text=body.text)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {"ok": True, "comment": {"id": comment.id, "mission_id": comment.mission_id, "text": comment.text,
            "author": comment.author, "created_at": comment.created_at.isoformat() if comment.created_at else None}}


@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
    return {"ok": True}


# ---------- #16: Mission Variants ----------

@app.post("/api/missions/{mission_id}/variant")
def create_mission_variant(mission_id: int, db: Session = Depends(get_db)):
    from agent import _get_api_provider, _get_openai_client, _get_gemini_model
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")
    skill = db.query(Skill).filter(Skill.id == mission.skill_id).first()
    try:
        provider = _get_api_provider(db)
        system_msg = "You are a creative educator. Given a mission prompt, rephrase it with a different real-world context while testing the same concept. Return ONLY the new mission text, nothing else."
        user_msg = f"Original mission for {skill.name if skill else 'General'}:\n{mission.text}"
        if provider == "gemini":
            model = _get_gemini_model(db)
            resp = model.generate_content(f"{system_msg}\n\n{user_msg}", generation_config={"temperature": 0.9})
            variant_text = (resp.text or "").strip()
        else:
            client = _get_openai_client(db)
            resp = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.9,
            )
            variant_text = resp.choices[0].message.content.strip()
        if not variant_text:
            raise ValueError("Empty response from AI")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {e}")
    new_mission = Mission(
        skill_id=mission.skill_id,
        text=variant_text,
        xp_reward=mission.xp_reward,
        date=date.today(),
        difficulty=mission.difficulty,
        tags="variant",
    )
    db.add(new_mission)
    db.commit()
    db.refresh(new_mission)
    return {
        "id": new_mission.id, "text": new_mission.text, "skill_id": new_mission.skill_id,
        "xp_reward": new_mission.xp_reward, "difficulty": new_mission.difficulty,
        "original_mission_id": mission_id,
    }


# ---------- #26: Feature Unlock Tree ----------

FEATURE_THRESHOLDS = [
    {"key": "challenges", "name": "Challenge Mode", "xp_required": 500, "icon": "\u23f1\ufe0f"},
    {"key": "custom_missions", "name": "Custom Missions", "xp_required": 1000, "icon": "\u270f\ufe0f"},
    {"key": "hints", "name": "AI Hints", "xp_required": 1500, "icon": "\U0001f4a1"},
    {"key": "loot_box", "name": "Loot Boxes", "xp_required": 2500, "icon": "\U0001f381"},
    {"key": "leaderboard", "name": "Leaderboard", "xp_required": 5000, "icon": "\U0001f3c6"},
    {"key": "public_profile", "name": "Public Profile", "xp_required": 7500, "icon": "\U0001f310"},
    {"key": "weekly_challenges", "name": "Weekly Challenges", "xp_required": 10000, "icon": "\U0001f4c5"},
]


@app.get("/api/feature-unlocks")
def get_feature_unlocks(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    total_xp = profile.total_xp or 0
    return {
        "total_xp": total_xp,
        "features": [
            {**ft, "unlocked": total_xp >= ft["xp_required"]}
            for ft in FEATURE_THRESHOLDS
        ],
    }


# ---------- #28: XP Decay Prevention ----------

@app.get("/api/xp-decay")
def check_xp_decay(db: Session = Depends(get_db)):
    skills = db.query(Skill).all()
    cutoff = date.today() - timedelta(days=14)
    at_risk = []
    for skill in skills:
        last_completion = (
            db.query(Completion)
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == skill.id)
            .order_by(Completion.submitted_at.desc())
            .first()
        )
        last_date = last_completion.submitted_at.date() if last_completion and last_completion.submitted_at else None
        if last_date is None or last_date < cutoff:
            days_inactive = (date.today() - last_date).days if last_date else 999
            at_risk.append({
                "skill_id": skill.id, "name": skill.name, "icon": skill.icon,
                "xp": skill.xp, "days_inactive": days_inactive,
                "decay_amount": int((skill.xp or 0) * 0.05),
            })
    return {"at_risk": at_risk, "cutoff_days": 14}


@app.post("/api/xp-decay/apply")
def apply_xp_decay(db: Session = Depends(get_db)):
    skills = db.query(Skill).all()
    cutoff = date.today() - timedelta(days=14)
    decayed = []
    for skill in skills:
        last_completion = (
            db.query(Completion)
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == skill.id)
            .order_by(Completion.submitted_at.desc())
            .first()
        )
        last_date = last_completion.submitted_at.date() if last_completion and last_completion.submitted_at else None
        if last_date is None or last_date < cutoff:
            decay = int((skill.xp or 0) * 0.05)
            if decay > 0:
                skill.xp = max(0, (skill.xp or 0) - decay)
                decayed.append({"skill_id": skill.id, "name": skill.name, "decay": decay, "new_xp": skill.xp})
    if decayed:
        db.commit()
    return {"decayed": decayed, "count": len(decayed)}


# ---------- #55: Difficulty Auto-Calibration ----------

@app.post("/api/difficulty/calibrate")
def calibrate_difficulty(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    avg_score = (
        db.query(func.avg(Completion.score))
        .filter(Completion.score.isnot(None))
        .scalar()
    )
    if avg_score is None:
        return {"message": "No completions yet", "adjusted": False}
    avg_score = float(avg_score)
    adjusted = False
    if avg_score > 85:
        profile.adaptive_difficulty = "hard"
        # Reduce xp_reward by 10% on pending missions
        pending = db.query(Mission).filter(Mission.status == "pending").all()
        for m in pending:
            m.xp_reward = max(10, int(m.xp_reward * 0.9))
        adjusted = True
    elif avg_score < 45:
        profile.adaptive_difficulty = "easy"
        # Increase xp_reward by 10% on pending missions
        pending = db.query(Mission).filter(Mission.status == "pending").all()
        for m in pending:
            m.xp_reward = int(m.xp_reward * 1.1)
        adjusted = True
    else:
        profile.adaptive_difficulty = "medium"
    db.commit()
    return {"avg_score": round(avg_score, 1), "adaptive_difficulty": profile.adaptive_difficulty, "adjusted": adjusted}


# ---------- Breadcrumb Data Helper ----------

BREADCRUMB_MAP = {
    "/": "Home",
    "/missions": "Missions",
    "/skills": "Skills",
    "/achievements": "Achievements",
    "/inventory": "Inventory",
    "/settings": "Settings",
    "/profile": "Profile",
    "/stats": "Stats",
    "/leaderboard": "Leaderboard",
    "/challenges": "Challenges",
    "/weekly": "Weekly Challenges",
    "/resources": "Resources",
    "/report": "Report",
    "/community-challenges": "Community Challenges",
    "/learning-paths": "Learning Paths",
    "/weekly-digest": "Weekly Digest",
    "/seasons": "Seasons",
}


@app.get("/api/breadcrumb")
def get_breadcrumb(path: str = "/"):
    parts = [p for p in path.strip("/").split("/") if p]
    crumbs = [{"label": "Home", "path": "/"}]
    current = ""
    for part in parts:
        current += f"/{part}"
        label = BREADCRUMB_MAP.get(current, part.replace("-", " ").replace("_", " ").title())
        crumbs.append({"label": label, "path": current})
    return {"crumbs": crumbs}


# ---------- #19: PDF Report Export ----------

@app.get("/api/report/pdf")
def export_report_pdf(db: Session = Depends(get_db)):
    from fastapi.responses import HTMLResponse
    profile = _ensure_profile(db)
    skills = db.query(Skill).order_by(Skill.xp.desc()).all()
    total_missions = db.query(Mission).filter(Mission.status == "graded").count()
    avg_score = db.query(func.avg(Completion.score)).filter(Completion.score.isnot(None)).scalar()
    avg_score = round(float(avg_score), 1) if avg_score else 0

    # Weekly stats
    week_start = date.today() - timedelta(days=date.today().weekday())
    week_completions = (
        db.query(Completion)
        .filter(Completion.submitted_at >= datetime(week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc))
        .count()
    )
    week_xp = (
        db.query(func.sum(Completion.xp_earned))
        .filter(Completion.submitted_at >= datetime(week_start.year, week_start.month, week_start.day, tzinfo=timezone.utc))
        .scalar()
    ) or 0

    skill_rows = "".join(
        f"<tr><td>{s.icon} {s.name}</td><td>{s.xp}</td><td>{s.level}</td><td>{s.mission_count}</td></tr>"
        for s in skills
    )

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SkillForge OS Report</title>
<style>
body {{ font-family: system-ui, sans-serif; max-width: 700px; margin: 2rem auto; padding: 1rem; }}
h1 {{ color: #6c5ce7; }} h2 {{ color: #2d3436; border-bottom: 2px solid #dfe6e9; padding-bottom: 0.3rem; }}
table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; }}
th, td {{ text-align: left; padding: 0.5rem; border-bottom: 1px solid #dfe6e9; }}
th {{ background: #f8f9fa; }}
.stat {{ display: inline-block; margin: 0.5rem 1rem; text-align: center; }}
.stat-val {{ font-size: 1.5rem; font-weight: bold; color: #6c5ce7; }}
.stat-label {{ font-size: 0.85rem; color: #636e72; }}
</style></head><body>
<h1>SkillForge OS Report</h1>
<p>Generated: {date.today().isoformat()} | Player: {profile.display_name or 'Hari'}</p>
<div>
  <div class="stat"><div class="stat-val">{profile.total_xp}</div><div class="stat-label">Total XP</div></div>
  <div class="stat"><div class="stat-val">{profile.current_streak}</div><div class="stat-label">Current Streak</div></div>
  <div class="stat"><div class="stat-val">{total_missions}</div><div class="stat-label">Missions Done</div></div>
  <div class="stat"><div class="stat-val">{avg_score}</div><div class="stat-label">Avg Score</div></div>
</div>
<h2>This Week</h2>
<p>{week_completions} missions completed | {week_xp} XP earned</p>
<h2>Skills</h2>
<table><tr><th>Skill</th><th>XP</th><th>Level</th><th>Missions</th></tr>{skill_rows}</table>
<h2>Rank: {calculate_rank(profile.total_xp or 0)}</h2>
<p>Longest streak: {profile.longest_streak} days | Adaptive difficulty: {profile.adaptive_difficulty}</p>
</body></html>"""
    return HTMLResponse(content=html, media_type="text/html")


# ---------- #21: Streak Milestone Data ----------

STREAK_MILESTONES = [7, 14, 30, 50, 100, 365]


@app.get("/api/streak/milestones")
def get_streak_milestones(db: Session = Depends(get_db)):
    profile = _ensure_profile(db)
    current = profile.current_streak or 0
    longest = profile.longest_streak or 0
    best = max(current, longest)
    return {
        "current_streak": current,
        "longest_streak": longest,
        "milestones": [
            {"days": m, "achieved": best >= m, "current_progress": min(current, m), "label": f"{m}-Day Streak"}
            for m in STREAK_MILESTONES
        ],
    }


# ---------- #56: Mission Dependencies ----------

class MissionDependencyUpdate(BaseModel):
    prerequisite_id: Optional[int] = None


@app.put("/api/missions/{mission_id}/dependency")
def set_mission_dependency(mission_id: int, payload: MissionDependencyUpdate, db: Session = Depends(get_db)):
    """Set or clear a prerequisite mission for a given mission."""
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")
    if payload.prerequisite_id:
        prereq = db.query(Mission).filter(Mission.id == payload.prerequisite_id).first()
        if not prereq:
            raise HTTPException(404, "Prerequisite mission not found")
        if prereq.id == mission.id:
            raise HTTPException(400, "A mission cannot be its own prerequisite")
    mission.prerequisite_id = payload.prerequisite_id
    db.commit()
    return {"ok": True, "mission_id": mission.id, "prerequisite_id": mission.prerequisite_id}


@app.get("/api/missions/{mission_id}/dependents")
def get_mission_dependents(mission_id: int, db: Session = Depends(get_db)):
    """Get missions that depend on this mission being completed."""
    dependents = db.query(Mission).filter(Mission.prerequisite_id == mission_id).all()
    return {"dependents": [_mission_to_dict(m, db=db) for m in dependents]}


# ---------- #40: Mission Sharing ----------

@app.get("/api/missions/{mission_id}/share")
def share_mission(mission_id: int, db: Session = Depends(get_db)):
    """Generate a shareable summary of a completed mission."""
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")
    skill = db.query(Skill).filter(Skill.id == mission.skill_id).first()
    profile = _ensure_profile(db)
    c = mission.completion

    share_data = {
        "mission_text": mission.text,
        "skill_name": skill.name if skill else "Unknown",
        "skill_icon": skill.icon if skill else "⭐",
        "difficulty": mission.difficulty,
        "xp_reward": mission.xp_reward,
        "player_name": profile.display_name or "SkillForge Player",
        "player_avatar": profile.avatar or "⚡",
        "player_rank": calculate_rank(profile.total_xp or 0),
    }
    if c:
        share_data.update({
            "score": c.score,
            "xp_earned": c.xp_earned,
            "grade_label": (
                "Excellent" if (c.score or 0) >= 85 else
                "Good" if (c.score or 0) >= 70 else
                "Average" if (c.score or 0) >= 50 else "Poor"
            ),
            "feedback": c.feedback,
        })

    # Generate shareable text
    score_text = f"Score: {c.score}/100 | +{c.xp_earned} XP" if c else "Not yet completed"
    share_text = (
        f"🎯 SkillForge Mission — {share_data['skill_icon']} {share_data['skill_name']}\n"
        f"📋 {mission.text[:120]}{'...' if len(mission.text) > 120 else ''}\n"
        f"📊 {score_text}\n"
        f"🏅 Difficulty: {mission.difficulty.title()}\n"
        f"👤 {share_data['player_name']} | Rank: {share_data['player_rank']}"
    )

    return {
        **share_data,
        "share_text": share_text,
        "share_url": f"/missions?mission={mission_id}",
    }


# ---------- #36: Weekly Email Digest ----------

@app.get("/api/digest/weekly")
def weekly_email_digest(db: Session = Depends(get_db)):
    """Generate weekly digest data and email-ready HTML."""
    profile = _ensure_profile(db)
    today = date.today()
    start = today - timedelta(days=6)

    week_xp = (
        db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .scalar() or 0
    )
    week_missions = (
        db.query(func.count(Completion.id))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .scalar() or 0
    )
    avg_score = (
        db.query(func.coalesce(func.avg(Completion.score), 0))
        .join(Mission, Completion.mission_id == Mission.id)
        .filter(Mission.date >= start, Mission.date <= today)
        .scalar() or 0
    )
    skills = db.query(Skill).order_by(desc(Skill.xp)).limit(3).all()
    rank_info = rank_progress(profile.total_xp or 0)

    # Daily breakdown
    daily = []
    for i in range(7):
        d = start + timedelta(days=i)
        xp = (
            db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date == d)
            .scalar() or 0
        )
        daily.append({"date": d.isoformat(), "day": d.strftime("%a"), "xp": int(xp)})

    # Generate email HTML
    skill_rows = "".join(
        f"<tr><td>{s.icon} {s.name}</td><td>Level {calculate_skill_level(s.xp or 0)}</td><td>{s.xp or 0} XP</td></tr>"
        for s in skills
    )
    daily_bars = "".join(
        f'<div style="display:inline-block;text-align:center;margin:0 4px;">'
        f'<div style="background:#16A34A;width:30px;height:{max(4, int(d["xp"]/max(1,int(week_xp))*80))}px;border-radius:4px;margin-bottom:4px;"></div>'
        f'<span style="font-size:11px;color:#6B7280;">{d["day"]}</span></div>'
        for d in daily
    )

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#F4F6F9;">
<div style="background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <h1 style="color:#6c5ce7;margin:0 0 4px;">SkillForge Weekly Digest</h1>
  <p style="color:#6B7280;margin:0 0 20px;">{start.strftime('%b %d')} — {today.strftime('%b %d, %Y')}</p>

  <div style="display:flex;gap:16px;margin-bottom:20px;">
    <div style="flex:1;text-align:center;padding:12px;background:#F0FDF4;border-radius:8px;">
      <div style="font-size:24px;font-weight:700;color:#16A34A;">{int(week_xp)}</div>
      <div style="font-size:12px;color:#6B7280;">XP Earned</div>
    </div>
    <div style="flex:1;text-align:center;padding:12px;background:#DBEAFE;border-radius:8px;">
      <div style="font-size:24px;font-weight:700;color:#3B82F6;">{int(week_missions)}</div>
      <div style="font-size:12px;color:#6B7280;">Missions</div>
    </div>
    <div style="flex:1;text-align:center;padding:12px;background:#F3E8FF;border-radius:8px;">
      <div style="font-size:24px;font-weight:700;color:#8B5CF6;">{round(float(avg_score),1)}</div>
      <div style="font-size:12px;color:#6B7280;">Avg Score</div>
    </div>
  </div>

  <h3 style="margin:16px 0 8px;">Daily Activity</h3>
  <div style="display:flex;align-items:flex-end;height:100px;padding:8px 0;">{daily_bars}</div>

  <h3 style="margin:16px 0 8px;">Top Skills</h3>
  <table style="width:100%;border-collapse:collapse;">
    <tr style="background:#F8F9FA;"><th style="text-align:left;padding:6px;">Skill</th><th style="padding:6px;">Level</th><th style="padding:6px;">XP</th></tr>
    {skill_rows}
  </table>

  <div style="margin-top:20px;padding:12px;background:#F8F9FA;border-radius:8px;text-align:center;">
    <span style="font-size:13px;color:#6B7280;">Rank: <strong>{rank_info['rank']}</strong> | Streak: <strong>{profile.current_streak or 0}</strong> days | Total XP: <strong>{profile.total_xp or 0}</strong></span>
  </div>
</div>
<p style="text-align:center;color:#9CA3AF;font-size:11px;margin-top:12px;">Generated by SkillForge OS</p>
</body></html>"""

    return {
        "week_xp": int(week_xp),
        "week_missions": int(week_missions),
        "avg_score": round(float(avg_score), 1),
        "current_streak": profile.current_streak or 0,
        "rank": rank_info["rank"],
        "top_skills": [{"name": s.name, "icon": s.icon, "level": calculate_skill_level(s.xp or 0)} for s in skills],
        "daily": daily,
        "html": html,
    }


# ---------- #42: Community Challenges ----------

COMMUNITY_CHALLENGE_TEMPLATES = [
    {"title": "Speed Run", "description": "Complete 5 missions in under 30 minutes total", "target_type": "missions", "target_value": 5, "reward_xp": 300, "icon": "🏃"},
    {"title": "Perfect Score", "description": "Score 100/100 on any mission", "target_type": "score", "target_value": 1, "reward_xp": 500, "icon": "💯"},
    {"title": "All-Rounder", "description": "Complete at least 1 mission in every skill this week", "target_type": "skills", "target_value": 4, "reward_xp": 400, "icon": "🌈"},
    {"title": "Hard Mode Hero", "description": "Complete 3 hard difficulty missions", "target_type": "hard_missions", "target_value": 3, "reward_xp": 450, "icon": "💪"},
    {"title": "Streak Builder", "description": "Maintain a 7-day streak", "target_type": "streak", "target_value": 7, "reward_xp": 350, "icon": "🔥"},
    {"title": "XP Blitz", "description": "Earn 1000 XP in a single week", "target_type": "xp", "target_value": 1000, "reward_xp": 500, "icon": "⚡"},
    {"title": "Review Master", "description": "Complete 5 spaced repetition reviews", "target_type": "reviews", "target_value": 5, "reward_xp": 300, "icon": "🔄"},
    {"title": "Early Bird", "description": "Complete 3 missions before noon", "target_type": "missions", "target_value": 3, "reward_xp": 250, "icon": "🌅"},
    {"title": "No Hints Challenge", "description": "Complete 10 missions without using any hints", "target_type": "no_hint_missions", "target_value": 10, "reward_xp": 400, "icon": "🧠"},
    {"title": "Combo King", "description": "Achieve a 5x combo", "target_type": "combo", "target_value": 5, "reward_xp": 350, "icon": "🔗"},
]


@app.get("/api/community-challenges")
def list_community_challenges(db: Session = Depends(get_db)):
    """List available community challenge templates with progress."""
    profile = _ensure_profile(db)
    today = date.today()
    start = _week_start(today)
    end = start + timedelta(days=6)

    results = []
    for tpl in COMMUNITY_CHALLENGE_TEMPLATES:
        # Calculate progress based on target type
        progress = 0
        if tpl["target_type"] == "missions":
            progress = (
                db.query(func.count(Completion.id))
                .join(Mission, Completion.mission_id == Mission.id)
                .filter(Mission.date >= start, Mission.date <= end)
                .scalar() or 0
            )
        elif tpl["target_type"] == "xp":
            progress = (
                db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
                .join(Mission, Completion.mission_id == Mission.id)
                .filter(Mission.date >= start, Mission.date <= end)
                .scalar() or 0
            )
        elif tpl["target_type"] == "score":
            progress = (
                db.query(func.count(Completion.id))
                .join(Mission, Completion.mission_id == Mission.id)
                .filter(Mission.date >= start, Mission.date <= end, Completion.score >= 100)
                .scalar() or 0
            )
        elif tpl["target_type"] == "skills":
            progress = (
                db.query(func.count(func.distinct(Mission.skill_id)))
                .join(Completion, Completion.mission_id == Mission.id)
                .filter(Mission.date >= start, Mission.date <= end)
                .scalar() or 0
            )
        elif tpl["target_type"] == "hard_missions":
            progress = (
                db.query(func.count(Completion.id))
                .join(Mission, Completion.mission_id == Mission.id)
                .filter(Mission.date >= start, Mission.date <= end, Mission.difficulty == "hard")
                .scalar() or 0
            )
        elif tpl["target_type"] == "streak":
            progress = profile.current_streak or 0
        elif tpl["target_type"] == "combo":
            progress = profile.combo_count or 0
        elif tpl["target_type"] == "no_hint_missions":
            progress = (
                db.query(func.count(Completion.id))
                .join(Mission, Completion.mission_id == Mission.id)
                .filter(Mission.date >= start, Mission.date <= end, Mission.hint_used == False)
                .scalar() or 0
            )
        elif tpl["target_type"] == "reviews":
            progress = (
                db.query(func.count(Mission.id))
                .filter(Mission.review_count > 0, Mission.date >= start)
                .scalar() or 0
            )

        completed = int(progress) >= tpl["target_value"]
        results.append({
            **tpl,
            "progress": int(progress),
            "progress_pct": min(100, round(int(progress) / max(1, tpl["target_value"]) * 100)),
            "completed": completed,
            "week_start": start.isoformat(),
            "week_end": end.isoformat(),
        })

    return {"challenges": results}


@app.post("/api/community-challenges/{index}/claim")
def claim_community_challenge(index: int, db: Session = Depends(get_db)):
    """Claim reward for a completed community challenge."""
    if index < 0 or index >= len(COMMUNITY_CHALLENGE_TEMPLATES):
        raise HTTPException(404, "Challenge not found")
    tpl = COMMUNITY_CHALLENGE_TEMPLATES[index]
    profile = _ensure_profile(db)
    today = date.today()
    start = _week_start(today)
    claim_key = f"cc_{index}_{start.isoformat()}"

    # Check if already claimed this week (use notifications as tracker)
    existing = db.query(Notification).filter(
        Notification.message.contains(claim_key),
        Notification.created_at >= datetime(start.year, start.month, start.day, tzinfo=timezone.utc),
    ).first()
    if existing:
        raise HTTPException(400, "Already claimed this week")

    profile.total_xp = (profile.total_xp or 0) + tpl["reward_xp"]
    db.add(Notification(
        message=f"Community Challenge completed: {tpl['title']}! +{tpl['reward_xp']} XP [{claim_key}]",
        type="achievement", read=False,
    ))
    db.commit()
    return {"ok": True, "xp_awarded": tpl["reward_xp"], "title": tpl["title"]}


# ---------- #13: Skill Prerequisites / Learning Paths ----------

class SkillPrerequisite(BaseModel):
    skill_id: int
    required_skill_id: int
    required_level: int = 3


# In-memory store for skill prerequisites (persisted via endpoint)
_skill_prereqs: list[dict] = []


@app.get("/api/skill-prerequisites")
def get_skill_prerequisites(db: Session = Depends(get_db)):
    """Get all skill prerequisite relationships."""
    skills = {s.id: {"name": s.name, "icon": s.icon, "level": calculate_skill_level(s.xp or 0)} for s in db.query(Skill).all()}
    result = []
    for prereq in _skill_prereqs:
        sid = prereq["skill_id"]
        rid = prereq["required_skill_id"]
        if sid in skills and rid in skills:
            met = skills[rid]["level"] >= prereq["required_level"]
            result.append({
                **prereq,
                "skill_name": skills[sid]["name"],
                "skill_icon": skills[sid]["icon"],
                "required_skill_name": skills[rid]["name"],
                "required_skill_icon": skills[rid]["icon"],
                "current_level": skills[rid]["level"],
                "met": met,
            })
    return {"prerequisites": result, "skills": list(skills.values())}


@app.post("/api/skill-prerequisites")
def add_skill_prerequisite(payload: SkillPrerequisite, db: Session = Depends(get_db)):
    """Add a skill prerequisite requirement."""
    skill = db.query(Skill).filter(Skill.id == payload.skill_id).first()
    req = db.query(Skill).filter(Skill.id == payload.required_skill_id).first()
    if not skill:
        raise HTTPException(404, "Skill not found")
    if not req:
        raise HTTPException(404, "Required skill not found")
    if payload.skill_id == payload.required_skill_id:
        raise HTTPException(400, "A skill cannot be its own prerequisite")
    # Check for duplicates
    for p in _skill_prereqs:
        if p["skill_id"] == payload.skill_id and p["required_skill_id"] == payload.required_skill_id:
            raise HTTPException(400, "Prerequisite already exists")
    entry = {"skill_id": payload.skill_id, "required_skill_id": payload.required_skill_id, "required_level": max(1, min(10, payload.required_level))}
    _skill_prereqs.append(entry)
    return {"ok": True, "prerequisite": entry}


@app.delete("/api/skill-prerequisites/{skill_id}/{required_skill_id}")
def remove_skill_prerequisite(skill_id: int, required_skill_id: int):
    """Remove a skill prerequisite."""
    global _skill_prereqs
    before = len(_skill_prereqs)
    _skill_prereqs = [p for p in _skill_prereqs if not (p["skill_id"] == skill_id and p["required_skill_id"] == required_skill_id)]
    if len(_skill_prereqs) == before:
        raise HTTPException(404, "Prerequisite not found")
    return {"ok": True}


# ---------- #54: Curated Learning Paths ----------

LEARNING_PATHS = [
    {
        "id": "trading-fundamentals",
        "title": "Trading Fundamentals",
        "description": "Master the basics of trading from zero to confident trader",
        "icon": "📈",
        "skills": ["Trading"],
        "milestones": [
            {"level": 1, "title": "Market Basics", "description": "Understand what stocks, indices, and markets are"},
            {"level": 2, "title": "Chart Reading", "description": "Learn candlestick patterns and basic technical analysis"},
            {"level": 3, "title": "Risk Management", "description": "Master position sizing, stop losses, and risk-reward ratios"},
            {"level": 5, "title": "Strategy Building", "description": "Develop and backtest your own trading strategy"},
            {"level": 7, "title": "Options Basics", "description": "Understand options pricing, Greeks, and basic strategies"},
            {"level": 10, "title": "Advanced Trader", "description": "Multi-leg strategies, portfolio management, and psychology"},
        ],
    },
    {
        "id": "coding-mastery",
        "title": "Coding Mastery",
        "description": "From beginner programmer to problem-solving expert",
        "icon": "💻",
        "skills": ["Coding"],
        "milestones": [
            {"level": 1, "title": "Syntax & Basics", "description": "Variables, loops, functions, and basic data types"},
            {"level": 2, "title": "Data Structures", "description": "Arrays, linked lists, stacks, queues, and hash maps"},
            {"level": 3, "title": "Algorithms I", "description": "Sorting, searching, and basic recursion"},
            {"level": 5, "title": "Algorithms II", "description": "Dynamic programming, graphs, and trees"},
            {"level": 7, "title": "System Design", "description": "Design patterns, APIs, and scalability concepts"},
            {"level": 10, "title": "Expert Coder", "description": "Advanced algorithms, concurrency, and optimization"},
        ],
    },
    {
        "id": "aptitude-pro",
        "title": "Aptitude Pro",
        "description": "Sharpen your quantitative and logical reasoning skills",
        "icon": "🧩",
        "skills": ["Aptitude"],
        "milestones": [
            {"level": 1, "title": "Number Sense", "description": "Speed math, percentages, ratios, and proportions"},
            {"level": 2, "title": "Word Problems", "description": "Time & work, speed & distance, and profit & loss"},
            {"level": 3, "title": "Logic & Reasoning", "description": "Syllogisms, puzzles, and pattern recognition"},
            {"level": 5, "title": "Advanced Quant", "description": "Permutations, combinations, and probability"},
            {"level": 7, "title": "Data Interpretation", "description": "Graphs, charts, and complex data analysis"},
            {"level": 10, "title": "Aptitude Master", "description": "Competition-level problems and speed optimization"},
        ],
    },
    {
        "id": "mental-models",
        "title": "Mental Models",
        "description": "Build a latticework of mental models for better thinking",
        "icon": "🧠",
        "skills": ["General IQ"],
        "milestones": [
            {"level": 1, "title": "Foundation", "description": "First principles thinking, opportunity cost, and incentives"},
            {"level": 2, "title": "Decision Making", "description": "Inversion, second-order thinking, and probabilistic thinking"},
            {"level": 3, "title": "Cognitive Biases", "description": "Recognize and overcome common thinking errors"},
            {"level": 5, "title": "Systems Thinking", "description": "Feedback loops, emergence, and complex adaptive systems"},
            {"level": 7, "title": "Strategy", "description": "Game theory, competitive advantage, and leverage"},
            {"level": 10, "title": "Polymath", "description": "Cross-disciplinary thinking and creative problem solving"},
        ],
    },
    {
        "id": "full-stack-learner",
        "title": "Full Stack Learner",
        "description": "Balanced growth across all skills — become a well-rounded learner",
        "icon": "🌟",
        "skills": ["Trading", "Coding", "Aptitude", "General IQ"],
        "milestones": [
            {"level": 2, "title": "Explorer", "description": "Reach Level 2 in all skills"},
            {"level": 3, "title": "Journeyman", "description": "Reach Level 3 in all skills"},
            {"level": 5, "title": "Specialist", "description": "Reach Level 5 in all skills"},
            {"level": 7, "title": "Expert", "description": "Reach Level 7 in all skills"},
            {"level": 10, "title": "Renaissance Mind", "description": "Reach Level 10 in all skills — true mastery"},
        ],
    },
]


@app.get("/api/learning-paths")
def get_learning_paths(db: Session = Depends(get_db)):
    """Get all curated learning paths with progress."""
    skills = {s.name: {"id": s.id, "xp": s.xp or 0, "level": calculate_skill_level(s.xp or 0)} for s in db.query(Skill).all()}
    result = []
    for path in LEARNING_PATHS:
        # Calculate progress
        path_skills = [skills.get(s) for s in path["skills"] if s in skills]
        if not path_skills:
            continue
        min_level = min(s["level"] for s in path_skills) if path_skills else 0
        max_milestone_level = max(m["level"] for m in path["milestones"]) if path["milestones"] else 10

        milestones_with_status = []
        for m in path["milestones"]:
            met = all(skills.get(s, {}).get("level", 0) >= m["level"] for s in path["skills"])
            milestones_with_status.append({**m, "completed": met})

        completed_count = sum(1 for m in milestones_with_status if m["completed"])
        total_count = len(milestones_with_status)

        result.append({
            "id": path["id"],
            "title": path["title"],
            "description": path["description"],
            "icon": path["icon"],
            "skills": path["skills"],
            "milestones": milestones_with_status,
            "progress_pct": round(completed_count / max(1, total_count) * 100),
            "completed_milestones": completed_count,
            "total_milestones": total_count,
            "current_level": min_level,
        })
    return {"paths": result}
