"""APScheduler background jobs for SkillForge OS."""
from __future__ import annotations

from datetime import date, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func

from models import SessionLocal, Mission, Completion, UserProfile, Notification
from agent import generate_missions_for_today
from grader import update_streak, check_achievements, calculate_rank
from notifier import send_desktop_notification, create_in_app_notification


def job_morning_generate() -> None:
    """08:00 — generate today's missions + notify."""
    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
        if profile and profile.morning_enabled is False:
            return
        generate_missions_for_today(db)
        send_desktop_notification(
            "SkillForge OS",
            "3 new missions ready. Time to level up.",
        )
        create_in_app_notification(db, "3 new missions are ready for today.", "mission")
    except Exception as e:
        print(f"[scheduler] morning job failed: {e}")
    finally:
        db.close()


def job_midday_reminder() -> None:
    """13:00 — reminder if no missions graded today."""
    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
        if profile and profile.midday_enabled is False:
            return
        today = date.today()
        graded_today = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date == today)
            .scalar()
            or 0
        )
        if graded_today == 0:
            send_desktop_notification(
                "Reminder",
                "You haven't completed any missions today. Don't break your streak!",
            )
            create_in_app_notification(
                db, "Midday reminder: complete a mission to protect your streak.", "streak"
            )
    except Exception as e:
        print(f"[scheduler] midday job failed: {e}")
    finally:
        db.close()


def job_evening_review() -> None:
    """20:00 — streak update + achievements + day summary."""
    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
        if profile is None or profile.evening_enabled is False:
            return

        profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
        if profile and profile.weekly_enabled is False:
            return
        today = date.today()
        xp_today = (
            db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date == today)
            .scalar()
            or 0
        )
        missions_done = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date == today)
            .scalar()
            or 0
        )

        # Only update streak if at least one mission was completed today
        if missions_done > 0:
            update_streak(db, profile)
        check_achievements(db, profile)

        msg = (
            f"Day summary: {missions_done} missions, {xp_today} XP earned. "
            f"Streak: {profile.current_streak} day(s). Rank: {calculate_rank(profile.total_xp or 0)}."
        )
        send_desktop_notification("SkillForge — Evening Review", msg)
        create_in_app_notification(db, msg, "report")
    except Exception as e:
        print(f"[scheduler] evening job failed: {e}")
    finally:
        db.close()


def job_weekly_summary() -> None:
    """Sunday 09:00 — weekly summary."""
    db = SessionLocal()
    try:
        today = date.today()
        seven_days_ago = today - timedelta(days=7)
        week_xp = (
            db.query(func.coalesce(func.sum(Completion.xp_earned), 0))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date >= seven_days_ago)
            .scalar()
            or 0
        )
        week_missions = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date >= seven_days_ago)
            .scalar()
            or 0
        )
        profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
        streak = profile.current_streak if profile else 0
        msg = (
            f"Weekly Report: {week_missions} missions completed, {week_xp} XP earned this week. "
            f"Current streak: {streak} days. Keep forging!"
        )
        send_desktop_notification("SkillForge — Weekly Report", msg)
        create_in_app_notification(db, msg, "report")
    except Exception as e:
        print(f"[scheduler] weekly job failed: {e}")
    finally:
        db.close()


def job_midnight_streak_check() -> None:
    """00:01 — Reset streak if yesterday had no completions."""
    db = SessionLocal()
    try:
        yesterday = date.today() - timedelta(days=1)
        profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
        if profile is None:
            return
        yesterday_completions = (
            db.query(func.count(Completion.id))
            .join(Mission, Completion.mission_id == Mission.id)
            .filter(Mission.date == yesterday)
            .scalar()
            or 0
        )
        if yesterday_completions == 0 and profile.last_active and profile.last_active < yesterday:
            if profile.streak_shield_active:
                profile.streak_shield_active = False
                db.commit()
                create_in_app_notification(db, "Streak Shield protected your streak after a missed day.", "streak")
                return
            profile.current_streak = 0
            db.commit()
            create_in_app_notification(db, "Your streak was reset. Complete a mission today to start a new one!", "streak")
    except Exception as e:
        print(f"[scheduler] midnight job failed: {e}")
    finally:
        db.close()


_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> BackgroundScheduler:
    """Start the background scheduler with all 4 jobs."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    db = SessionLocal()
    try:
        profile = db.query(UserProfile).filter(UserProfile.id == 1).first()
        morning_hour = profile.morning_hour if profile and profile.morning_hour is not None else 8
        midday_hour = profile.midday_hour if profile and profile.midday_hour is not None else 13
        evening_hour = profile.evening_hour if profile and profile.evening_hour is not None else 20
    finally:
        db.close()

    sched = BackgroundScheduler(daemon=True)
    sched.add_job(job_morning_generate, CronTrigger(hour=morning_hour, minute=0), id="morning_generate", replace_existing=True)
    sched.add_job(job_midday_reminder, CronTrigger(hour=midday_hour, minute=0), id="midday_reminder", replace_existing=True)
    sched.add_job(job_evening_review, CronTrigger(hour=evening_hour, minute=0), id="evening_review", replace_existing=True)
    sched.add_job(
        job_weekly_summary,
        CronTrigger(day_of_week="sun", hour=9, minute=0),
        id="weekly_summary",
        replace_existing=True,
    )
    sched.add_job(
        job_midnight_streak_check,
        CronTrigger(hour=0, minute=1),
        id="midnight_streak",
        replace_existing=True,
    )
    sched.start()
    _scheduler = sched
    print("[scheduler] Background scheduler started with 5 jobs.")
    return sched


def reschedule_jobs(morning_hour: int, midday_hour: int, evening_hour: int) -> None:
    """Update the scheduled times for the 3 daily jobs."""
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.reschedule_job("morning_generate", trigger=CronTrigger(hour=morning_hour, minute=0))
        _scheduler.reschedule_job("midday_reminder", trigger=CronTrigger(hour=midday_hour, minute=0))
        _scheduler.reschedule_job("evening_review", trigger=CronTrigger(hour=evening_hour, minute=0))
        print(f"[scheduler] Rescheduled: morning={morning_hour}, midday={midday_hour}, evening={evening_hour}")
    except Exception as e:
        print(f"[scheduler] reschedule failed: {e}")


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
