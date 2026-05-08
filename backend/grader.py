"""XP, rank, level, streak, and achievement logic."""
from __future__ import annotations

from datetime import date, timedelta, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from models import Skill, Mission, Completion, Achievement, UserProfile, Notification, InventoryItem, Bookmark


# ---------- Rank ----------

def calculate_rank(total_xp: int) -> str:
    if total_xp >= 25000:
        return "Legend"
    if total_xp >= 12000:
        return "Master"
    if total_xp >= 5000:
        return "Expert"
    if total_xp >= 2000:
        return "Skilled"
    if total_xp >= 500:
        return "Apprentice"
    return "Rookie"


RANK_THRESHOLDS = [
    ("Rookie", 0, 500),
    ("Apprentice", 500, 2000),
    ("Skilled", 2000, 5000),
    ("Expert", 5000, 12000),
    ("Master", 12000, 25000),
    ("Legend", 25000, 999999),
]


def rank_progress(total_xp: int) -> dict:
    """Return current rank and progress to next rank."""
    for name, low, high in RANK_THRESHOLDS:
        if low <= total_xp < high:
            span = high - low
            within = total_xp - low
            return {
                "rank": name,
                "current_xp": total_xp,
                "next_rank_xp": high,
                "progress_pct": round((within / span) * 100, 1) if span > 0 else 100.0,
            }
    return {"rank": "Legend", "current_xp": total_xp, "next_rank_xp": total_xp, "progress_pct": 100.0}


# ---------- Skill Level ----------

SKILL_LEVEL_THRESHOLDS = [
    (1, 0, 200),
    (2, 200, 500),
    (3, 500, 1000),
    (4, 1000, 2000),
    (5, 2000, 3500),
    (6, 3500, 5500),
    (7, 5500, 8000),
    (8, 8000, 11000),
    (9, 11000, 15000),
    (10, 15000, 999999),
]


def calculate_skill_level(xp: int) -> int:
    for level, low, high in SKILL_LEVEL_THRESHOLDS:
        if low <= xp < high:
            return level
    return 10


def skill_level_progress(xp: int) -> dict:
    level = calculate_skill_level(xp)
    for lv, low, high in SKILL_LEVEL_THRESHOLDS:
        if lv == level:
            return {
                "level": level,
                "xp_in_level": xp - low,
                "xp_for_next": max(0, high - xp),
                "level_low": low,
                "level_high": high,
            }
    return {"level": 10, "xp_in_level": xp, "xp_for_next": 0, "level_low": 15000, "level_high": 15000}


# ---------- Streak ----------

def get_streak_multiplier(streak_days: int) -> float:
    return 2.0 if streak_days >= 7 else 1.0


def update_streak(db: Session, profile: UserProfile) -> None:
    """Updates profile.current_streak and last_active based on today."""
    today = date.today()
    last = profile.last_active
    if last is None:
        profile.current_streak = 1
    elif last == today:
        # Already counted today
        pass
    elif last == today - timedelta(days=1):
        profile.current_streak = (profile.current_streak or 0) + 1
    else:
        yesterday = today - timedelta(days=1)
        if last < yesterday and profile.streak_shield_active:
            shield = db.query(InventoryItem).filter(InventoryItem.key == "streak_shield").first()
            profile.streak_shield_active = False
            if shield:
                shield.used_at = datetime.now(timezone.utc)
            profile.last_active = today
            db.add(Notification(
                message="Streak Shield protected your streak after a missed day.",
                type="streak",
                read=False,
            ))
            db.commit()
            return
        profile.current_streak = 1
    profile.last_active = today
    if (profile.longest_streak or 0) < (profile.current_streak or 0):
        profile.longest_streak = profile.current_streak
    db.commit()


# ---------- Combo System ----------

COMBO_WINDOW_SECONDS = 3600  # 1 hour

def update_combo(db: Session, profile: UserProfile) -> int:
    """Track combo: submissions within 1 hour of each other get combo multiplier."""
    now = datetime.now(timezone.utc)
    if profile.combo_last_timestamp:
        last_ts = profile.combo_last_timestamp
        if last_ts.tzinfo is None:
            last_ts = last_ts.replace(tzinfo=timezone.utc)
        elapsed = (now - last_ts).total_seconds()
        if elapsed <= COMBO_WINDOW_SECONDS:
            profile.combo_count = (profile.combo_count or 0) + 1
        else:
            profile.combo_count = 1
    else:
        profile.combo_count = 1
    profile.combo_last_timestamp = now

    combo = profile.combo_count or 1
    if combo >= 3:
        db.add(Notification(
            message=f"Combo x{combo}! Submit more missions within 1 hour for bonus XP!",
            type="combo",
            read=False,
        ))
    db.commit()
    return combo


def get_combo_multiplier(combo_count: int) -> float:
    """Bonus multiplier based on combo count."""
    if combo_count >= 5:
        return 1.5
    if combo_count >= 3:
        return 1.25
    return 1.0


# ---------- Skill Milestones ----------

SKILL_MILESTONE_LEVELS = [5, 10, 15]

def check_skill_milestones(db: Session, skill: Skill, old_level: int, new_level: int) -> list[str]:
    """Check and notify for skill level milestones."""
    notifications = []
    for milestone in SKILL_MILESTONE_LEVELS:
        if old_level < milestone <= new_level:
            msg = f"Skill Milestone! {skill.icon} {skill.name} reached Level {milestone}!"
            db.add(Notification(message=msg, type="milestone", read=False))
            notifications.append(msg)

            # Award bonus XP for milestones
            bonus = milestone * 50  # 250, 500, 750 XP
            profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
            if profile:
                profile.total_xp = (profile.total_xp or 0) + bonus
                db.add(Notification(
                    message=f"Milestone Bonus: +{bonus} XP for reaching Level {milestone} in {skill.name}!",
                    type="milestone",
                    read=False,
                ))

            # Award milestone badge
            booster = db.query(InventoryItem).filter(InventoryItem.key == "xp_booster").first()
            if booster and (booster.quantity or 0) < 10:
                booster.quantity = (booster.quantity or 0) + 1

    db.commit()
    return notifications


# ---------- Achievements ----------

def _unlock(db: Session, key: str, message_prefix: str = "Achievement unlocked") -> Optional[Achievement]:
    ach = db.query(Achievement).filter(Achievement.key == key).first()
    if ach and ach.unlocked_at is None:
        ach.unlocked_at = datetime.now(timezone.utc)
        db.add(Notification(
            message=f"{message_prefix}: {ach.name} -- {ach.description}",
            type="achievement",
            read=False,
        ))
        db.commit()
        return ach
    return None


def check_achievements(db: Session, profile: UserProfile) -> list[Achievement]:
    """Check and unlock any achievements. Returns list of newly unlocked ones."""
    unlocked: list[Achievement] = []

    # First Blood
    total_completions = db.query(func.count(Completion.id)).scalar() or 0
    if total_completions >= 1:
        a = _unlock(db, "first_blood")
        if a:
            unlocked.append(a)

    # On Fire (7-day streak)
    if (profile.current_streak or 0) >= 7:
        a = _unlock(db, "on_fire")
        if a:
            unlocked.append(a)

    # Consistent (30-day streak)
    if (profile.current_streak or 0) >= 30:
        a = _unlock(db, "consistent")
        if a:
            unlocked.append(a)

    # Legend
    if (profile.total_xp or 0) >= 25000:
        a = _unlock(db, "legend")
        if a:
            unlocked.append(a)

    # Trader Mind: >=10 graded missions for Trading
    trading = db.query(Skill).filter(Skill.name == "Trading").first()
    if trading:
        trading_completed = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == trading.id)
            .scalar()
            or 0
        )
        if trading_completed >= 10:
            a = _unlock(db, "trader_mind")
            if a:
                unlocked.append(a)

    # Code Ninja: Coding level >= 5
    coding = db.query(Skill).filter(Skill.name == "Coding").first()
    if coding and calculate_skill_level(coding.xp or 0) >= 5:
        a = _unlock(db, "code_ninja")
        if a:
            unlocked.append(a)

    # Galaxy Brain: 3 distinct skills actually leveled up in the past 7 days
    seven_days_ago = date.today() - timedelta(days=7)
    all_skills = db.query(Skill).all()
    leveled_skills = 0
    for skill in all_skills:
        recent_xp = (
            db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.skill_id == skill.id, Mission.date >= seven_days_ago)
            .scalar()
            or 0
        )
        if recent_xp > 0:
            current_level = calculate_skill_level(skill.xp or 0)
            level_before_week = calculate_skill_level(max(0, (skill.xp or 0) - recent_xp))
            if current_level > level_before_week:
                leveled_skills += 1
    if leveled_skills >= 3:
        a = _unlock(db, "galaxy_brain")
        if a:
            unlocked.append(a)

    # Milestone achievements
    if total_completions >= 100:
        a = _unlock(db, "milestone_100_missions")
        if a:
            unlocked.append(a)

    if (profile.total_xp or 0) >= 1000:
        a = _unlock(db, "milestone_1000_xp")
        if a:
            unlocked.append(a)

    if (profile.total_xp or 0) >= 5000:
        a = _unlock(db, "milestone_5000_xp")
        if a:
            unlocked.append(a)

    if (profile.total_xp or 0) >= 10000:
        a = _unlock(db, "milestone_10000_xp")
        if a:
            unlocked.append(a)

    # Combo Master
    if (profile.combo_count or 0) >= 5:
        a = _unlock(db, "combo_master")
        if a:
            unlocked.append(a)

    # Challenge Ace - checked in submit logic
    # Bookworm
    bookmark_count = db.query(func.count(Bookmark.id)).scalar() or 0
    if bookmark_count >= 10:
        a = _unlock(db, "bookworm")
        if a:
            unlocked.append(a)

    # Polyglot - missions completed in 3+ languages
    lang_count = (
        db.query(func.count(func.distinct(Mission.language)))
        .join(Completion, Completion.mission_id == Mission.id)
        .scalar() or 0
    )
    if lang_count >= 3:
        a = _unlock(db, "polyglot")
        if a:
            unlocked.append(a)

    # Skill level milestones
    for skill in all_skills:
        sl = calculate_skill_level(skill.xp or 0)
        if sl >= 5:
            a = _unlock(db, "skill_lvl5")
            if a:
                unlocked.append(a)
        if sl >= 10:
            a = _unlock(db, "skill_lvl10")
            if a:
                unlocked.append(a)

    return unlocked


# ---------- Milestone Notifications ----------

def check_milestone_notifications(db: Session, profile: UserProfile) -> None:
    """Send milestone notifications for total XP and mission count."""
    total_xp = profile.total_xp or 0
    total_missions = db.query(func.count(Completion.id)).scalar() or 0

    xp_milestones = [100, 500, 1000, 2500, 5000, 10000, 15000, 20000, 25000]
    mission_milestones = [10, 25, 50, 100, 200, 500, 1000]

    for ms in xp_milestones:
        if total_xp >= ms and total_xp - 200 < ms:  # Recently crossed
            db.add(Notification(
                message=f"Milestone reached: {ms:,} total XP!",
                type="milestone",
                read=False,
            ))

    for ms in mission_milestones:
        if total_missions == ms:
            db.add(Notification(
                message=f"Milestone reached: {ms} missions completed!",
                type="milestone",
                read=False,
            ))

    db.commit()


# ---------- XP Award ----------

def award_xp(
    db: Session,
    mission: Mission,
    answer: str,
    score: int,
    feedback: str,
) -> dict:
    """
    Apply XP award for a graded mission:
    - Compute xp_earned = xp_reward * score/100 * streak_multiplier * combo_multiplier
    - Create Completion
    - Update skill.xp, skill.level, skill.mission_count
    - Update profile.total_xp, streak, achievements
    """
    profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
    if profile is None:
        profile = UserProfile(id=1)
        db.add(profile)
        db.commit()

    # Update streak first (mission completion counts toward today)
    update_streak(db, profile)

    # Update combo
    combo = update_combo(db, profile)
    combo_mult = get_combo_multiplier(combo)

    mult = get_streak_multiplier(profile.current_streak or 0)
    used_booster = bool(profile.xp_booster_active)
    if used_booster:
        mult *= 2
        profile.xp_booster_active = False
        booster = db.query(InventoryItem).filter(InventoryItem.key == "xp_booster").first()
        if booster:
            booster.used_at = datetime.now(timezone.utc)

    # Challenge bonus
    challenge_mult = 1.5 if mission.is_challenge else 1.0

    xp_earned = int(round((mission.xp_reward or 100) * (score / 100.0) * mult * combo_mult * challenge_mult))

    completion = Completion(
        mission_id=mission.id,
        answer=answer,
        score=score,
        feedback=feedback,
        xp_earned=xp_earned,
    )
    db.add(completion)

    skill = db.query(Skill).filter(Skill.id == mission.skill_id).first()
    old_skill_level = calculate_skill_level(skill.xp or 0) if skill else 0
    if skill:
        skill.xp = (skill.xp or 0) + xp_earned
        skill.level = calculate_skill_level(skill.xp)
        skill.mission_count = (skill.mission_count or 0) + 1

    profile.total_xp = (profile.total_xp or 0) + xp_earned
    if xp_earned >= 120:
        box = db.query(InventoryItem).filter(InventoryItem.key == "xp_booster").first()
        if box and (box.quantity or 0) < 5:
            box.quantity = (box.quantity or 0) + 1

    mission.status = "graded"
    db.commit()

    # Check skill milestones
    new_skill_level = calculate_skill_level(skill.xp) if skill else 0
    if skill and new_skill_level > old_skill_level:
        check_skill_milestones(db, skill, old_skill_level, new_skill_level)

    # Check challenge ace achievement
    if mission.is_challenge and score >= 90:
        _unlock(db, "challenge_ace")

    unlocked = check_achievements(db, profile)

    # Check milestone notifications
    check_milestone_notifications(db, profile)

    db.refresh(profile)
    return {
        "xp_earned": xp_earned,
        "streak_multiplier": mult,
        "combo_count": combo,
        "combo_multiplier": combo_mult,
        "new_total_xp": profile.total_xp,
        "new_rank": calculate_rank(profile.total_xp),
        "new_skill_xp": skill.xp if skill else 0,
        "new_skill_level": skill.level if skill else 0,
        "unlocked_achievements": [
            {"key": a.key, "name": a.name, "description": a.description, "icon": a.icon}
            for a in unlocked
        ],
    }
