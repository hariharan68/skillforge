"""SQLAlchemy models + DB initialization + seed data for SkillForge OS."""
from __future__ import annotations

import os
from datetime import datetime, date, timezone
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Boolean,
    Date, DateTime, ForeignKey, Float
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "skillforge.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class Skill(Base):
    __tablename__ = "skills"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    icon = Column(String, default="⭐")
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    mission_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    missions = relationship("Mission", back_populates="skill", cascade="all, delete-orphan")


class Mission(Base):
    __tablename__ = "missions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    skill_id = Column(Integer, ForeignKey("skills.id"))
    text = Column(Text, nullable=False)
    xp_reward = Column(Integer, default=100)
    date = Column(Date, nullable=False)
    status = Column(String, default="pending")  # pending | submitted | graded
    difficulty = Column(String, default="medium")
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # New fields
    bookmarked = Column(Boolean, default=False)
    is_custom = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    language = Column(String, default="english")
    is_challenge = Column(Boolean, default=False)
    challenge_time_limit = Column(Integer, default=0)  # seconds, 0 = no limit
    # v2 features
    tags = Column(String, default="")  # comma-separated: "real-world,speed-drill,advanced"
    next_review_date = Column(Date, nullable=True)  # spaced repetition
    review_count = Column(Integer, default=0)  # times reviewed via spaced repetition
    hint_used = Column(Boolean, default=False)  # AI hint system
    challenge_started_at = Column(DateTime, nullable=True)  # countdown timer start
    prerequisite_id = Column(Integer, ForeignKey("missions.id"), nullable=True)  # #56 mission dependencies

    skill = relationship("Skill", back_populates="missions")
    prerequisite = relationship("Mission", remote_side="Mission.id", foreign_keys=[prerequisite_id])
    completion = relationship("Completion", back_populates="mission", uselist=False, cascade="all, delete-orphan")


class Completion(Base):
    __tablename__ = "completions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    mission_id = Column(Integer, ForeignKey("missions.id"))
    answer = Column(Text)
    score = Column(Integer)
    feedback = Column(Text)
    xp_earned = Column(Integer)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    mission = relationship("Mission", back_populates="completion")


class Achievement(Base):
    __tablename__ = "achievements"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    icon = Column(String, default="🏆")
    unlocked_at = Column(DateTime, nullable=True)
    secret = Column(Boolean, default=False)  # #25 secret achievements
    rarity = Column(String, default="common")  # common | rare | epic | legendary


class UserProfile(Base):
    __tablename__ = "user_profile"
    id = Column(Integer, primary_key=True, default=1)
    total_xp = Column(Integer, default=0)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_active = Column(Date, nullable=True)
    openai_api_key = Column(Text, nullable=True)
    gemini_api_key = Column(Text, nullable=True)
    claude_api_key = Column(Text, nullable=True)
    groq_api_key = Column(Text, nullable=True)
    api_provider = Column(String, default="openai")  # "openai", "gemini", "claude", or "groq"
    morning_hour = Column(Integer, default=8)
    midday_hour = Column(Integer, default=13)
    evening_hour = Column(Integer, default=20)
    morning_enabled = Column(Boolean, default=True)
    midday_enabled = Column(Boolean, default=True)
    evening_enabled = Column(Boolean, default=True)
    weekly_enabled = Column(Boolean, default=True)
    xp_booster_active = Column(Boolean, default=False)
    streak_shield_active = Column(Boolean, default=False)
    last_login_reward = Column(Date, nullable=True)
    weekly_xp_goal = Column(Integer, default=0)
    theme = Column(String, default="light")
    # New fields
    display_name = Column(String, default="Hari")
    bio = Column(Text, default="")
    avatar = Column(String, default="⚡")
    preferred_language = Column(String, default="english")
    combo_count = Column(Integer, default=0)
    combo_last_timestamp = Column(DateTime, nullable=True)
    auto_backup_enabled = Column(Boolean, default=False)
    last_backup_at = Column(DateTime, nullable=True)
    # v2 features
    streak_freezes = Column(Integer, default=1)  # #15 streak freeze tokens
    adaptive_difficulty = Column(String, default="medium")  # #11 auto-adjusted difficulty
    hints_remaining = Column(Integer, default=3)  # #12 daily hint budget
    weekly_challenge_id = Column(Integer, nullable=True)  # #23 current weekly challenge
    goal_streak = Column(Integer, default=0)  # #37 consecutive weeks hitting goal
    onboarding_done = Column(Boolean, default=False)  # #20 onboarding tutorial
    # #58 Email notifications
    email_address = Column(Text, nullable=True)
    email_app_password = Column(Text, nullable=True)
    email_notifications_enabled = Column(Boolean, default=False)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    message = Column(Text, nullable=False)
    type = Column(String, default="info")  # mission | streak | achievement | report | info | milestone | combo | challenge
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, default="powerup")
    quantity = Column(Integer, default=0)
    metadata_json = Column(Text, default="{}")
    earned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    used_at = Column(DateTime, nullable=True)


class Bookmark(Base):
    __tablename__ = "bookmarks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    mission_id = Column(Integer, ForeignKey("missions.id"), unique=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    mission = relationship("Mission")


class WeeklyChallenge(Base):
    """#23 Weekly Challenges — recurring engagement loop."""
    __tablename__ = "weekly_challenges"
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    target_type = Column(String, default="missions")  # missions | xp | score
    target_value = Column(Integer, default=10)
    skill_filter = Column(String, nullable=True)  # optional: "Coding", etc.
    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    reward_xp = Column(Integer, default=200)
    reward_badge = Column(String, nullable=True)
    progress = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class StudyResource(Base):
    """#18 Study resource links — attach videos/articles to missions."""
    __tablename__ = "study_resources"
    id = Column(Integer, primary_key=True, autoincrement=True)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=True)
    title = Column(String, nullable=False)
    url = Column(String, nullable=False)
    resource_type = Column(String, default="article")  # article | video | tutorial
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    mission_id = Column(Integer, ForeignKey("missions.id"))
    text = Column(Text, nullable=False)
    author = Column(String, default="Hari")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    mission = relationship("Mission")


class Season(Base):
    """#24 Seasonal rank resets — monthly seasons with soft XP reset."""
    __tablename__ = "seasons"
    id = Column(Integer, primary_key=True, autoincrement=True)
    number = Column(Integer, nullable=False, unique=True)
    name = Column(String, nullable=False)
    icon = Column(String, default="🏆")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    starting_xp = Column(Integer, default=0)       # XP at season start (after reset)
    peak_xp = Column(Integer, default=0)            # highest XP reached during season
    peak_rank = Column(String, default="Rookie")    # highest rank reached
    ending_xp = Column(Integer, default=0)          # XP when season ended
    ending_rank = Column(String, default="Rookie")
    missions_completed = Column(Integer, default=0)
    badge_awarded = Column(String, nullable=True)   # badge key given at season end
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SeasonalEvent(Base):
    __tablename__ = "seasonal_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    icon = Column(String, default="🎉")
    event_type = Column(String, default="weekly")  # weekly | monthly
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    bonus_xp_pct = Column(Integer, default=25)
    badge_key = Column(String, nullable=True)
    active = Column(Boolean, default=True)


# ---------- Seed ----------

DEFAULT_SKILLS = [
    {"name": "Trading", "icon": "💹"},
    {"name": "Coding", "icon": "💻"},
    {"name": "Aptitude", "icon": "🧩"},
    {"name": "General IQ", "icon": "🧠"},
]

DEFAULT_ACHIEVEMENTS = [
    {"key": "first_blood", "name": "First Blood", "description": "Complete your first mission", "icon": "🩸"},
    {"key": "on_fire", "name": "On Fire", "description": "Maintain a 7-day streak", "icon": "🔥"},
    {"key": "galaxy_brain", "name": "Galaxy Brain", "description": "Level up 3 skills in one week", "icon": "🌌"},
    {"key": "trader_mind", "name": "Trader Mind", "description": "Complete 10 trading missions", "icon": "📈"},
    {"key": "code_ninja", "name": "Code Ninja", "description": "Reach Level 5 in Coding", "icon": "🥷"},
    {"key": "consistent", "name": "Consistent", "description": "Maintain a 30-day streak", "icon": "⚡"},
    {"key": "legend", "name": "Legend", "description": "Reach 25,000 total XP", "icon": "👑"},
    # Milestone achievements
    {"key": "milestone_100_missions", "name": "Century", "description": "Complete 100 missions", "icon": "💯"},
    {"key": "milestone_1000_xp", "name": "XP Hunter", "description": "Earn 1,000 total XP", "icon": "🎯"},
    {"key": "milestone_5000_xp", "name": "XP Master", "description": "Earn 5,000 total XP", "icon": "🏅"},
    {"key": "milestone_10000_xp", "name": "XP Legend", "description": "Earn 10,000 total XP", "icon": "🌟"},
    {"key": "combo_master", "name": "Combo Master", "description": "Achieve a 5x combo", "icon": "🔗"},
    {"key": "challenge_ace", "name": "Challenge Ace", "description": "Score 90+ on a challenge mission", "icon": "⏱️"},
    {"key": "bookworm", "name": "Bookworm", "description": "Bookmark 10 missions", "icon": "📚"},
    {"key": "polyglot", "name": "Polyglot", "description": "Complete missions in 3 languages", "icon": "🌍"},
    {"key": "skill_lvl5", "name": "Specialist", "description": "Reach Level 5 in any skill", "icon": "⭐"},
    {"key": "skill_lvl10", "name": "Grandmaster", "description": "Reach Level 10 in any skill", "icon": "💎"},
    {"key": "skill_lvl15", "name": "Transcendent", "description": "Reach Level 15 in any skill", "icon": "🔱"},
    # v2 Secret achievements (#25)
    {"key": "night_owl", "name": "Night Owl", "description": "Complete a mission between midnight and 5 AM", "icon": "🦉", "secret": True, "rarity": "rare"},
    {"key": "perfect_week", "name": "Perfect Week", "description": "Score 90+ on every mission in a week", "icon": "💫", "secret": True, "rarity": "epic"},
    {"key": "speed_demon", "name": "Speed Demon", "description": "Complete a challenge in under 2 minutes", "icon": "🏎️", "secret": True, "rarity": "rare"},
    {"key": "streak_30", "name": "Unstoppable", "description": "Maintain a 30-day streak", "icon": "🔥", "secret": False, "rarity": "epic"},
    {"key": "streak_100", "name": "Centurion", "description": "Maintain a 100-day streak", "icon": "🏛️", "secret": True, "rarity": "legendary"},
    {"key": "mastery_badge", "name": "Mastery", "description": "Reach Level 10 in any skill", "icon": "🎖️", "secret": False, "rarity": "epic"},
    {"key": "weekly_warrior", "name": "Weekly Warrior", "description": "Complete 3 weekly challenges", "icon": "⚔️", "secret": False, "rarity": "rare"},
    {"key": "hint_free", "name": "No Hints Needed", "description": "Complete 20 missions without using hints", "icon": "🧠", "secret": True, "rarity": "rare"},
    {"key": "loot_lucky", "name": "Lucky Roll", "description": "Get a legendary item from loot box", "icon": "🎰", "secret": True, "rarity": "legendary"},
]

DEFAULT_INVENTORY = [
    {"key": "xp_booster", "name": "XP Booster", "type": "powerup", "quantity": 2, "metadata_json": '{"effect":"double_next_mission_xp"}'},
    {"key": "streak_shield", "name": "Streak Shield", "type": "powerup", "quantity": 1, "metadata_json": '{"effect":"protect_one_missed_day"}'},
    {"key": "weekly_report", "name": "Weekly Report", "type": "report", "quantity": 1, "metadata_json": '{"period":"latest_week"}'},
    {"key": "badge_on_fire", "name": "Badge: On Fire", "type": "badge", "quantity": 1, "metadata_json": '{"achievement":"on_fire"}'},
    {"key": "monthly_report", "name": "Monthly Report", "type": "report", "quantity": 1, "metadata_json": '{"period":"latest_month"}'},
]

DEFAULT_SEASONAL_EVENTS = [
    {
        "key": "speed_week",
        "name": "Speed Week",
        "description": "Complete challenge missions for 50% bonus XP!",
        "icon": "⚡",
        "event_type": "weekly",
        "bonus_xp_pct": 50,
        "badge_key": "speed_demon",
    },
    {
        "key": "grind_month",
        "name": "Grind Month",
        "description": "Complete 50 missions this month for a special badge!",
        "icon": "💪",
        "event_type": "monthly",
        "bonus_xp_pct": 25,
        "badge_key": "iron_will",
    },
]


def _migrate_columns(conn) -> None:
    """Add new columns to existing tables if they don't exist (lightweight migration)."""
    from sqlalchemy import text
    migrations = [
        ("missions", "retry_count", "INTEGER DEFAULT 0"),
        ("user_profile", "morning_hour", "INTEGER DEFAULT 8"),
        ("user_profile", "midday_hour", "INTEGER DEFAULT 13"),
        ("user_profile", "evening_hour", "INTEGER DEFAULT 20"),
        ("user_profile", "morning_enabled", "BOOLEAN DEFAULT 1"),
        ("user_profile", "midday_enabled", "BOOLEAN DEFAULT 1"),
        ("user_profile", "evening_enabled", "BOOLEAN DEFAULT 1"),
        ("user_profile", "weekly_enabled", "BOOLEAN DEFAULT 1"),
        ("user_profile", "xp_booster_active", "BOOLEAN DEFAULT 0"),
        ("user_profile", "streak_shield_active", "BOOLEAN DEFAULT 0"),
        ("user_profile", "last_login_reward", "DATE"),
        ("user_profile", "weekly_xp_goal", "INTEGER DEFAULT 0"),
        ("user_profile", "theme", "TEXT DEFAULT 'light'"),
        # New migrations
        ("missions", "bookmarked", "BOOLEAN DEFAULT 0"),
        ("missions", "is_custom", "BOOLEAN DEFAULT 0"),
        ("missions", "sort_order", "INTEGER DEFAULT 0"),
        ("missions", "language", "TEXT DEFAULT 'english'"),
        ("missions", "is_challenge", "BOOLEAN DEFAULT 0"),
        ("missions", "challenge_time_limit", "INTEGER DEFAULT 0"),
        ("user_profile", "display_name", "TEXT DEFAULT 'Hari'"),
        ("user_profile", "bio", "TEXT DEFAULT ''"),
        ("user_profile", "avatar", "TEXT DEFAULT '⚡'"),
        ("user_profile", "preferred_language", "TEXT DEFAULT 'english'"),
        ("user_profile", "combo_count", "INTEGER DEFAULT 0"),
        ("user_profile", "combo_last_timestamp", "DATETIME"),
        ("user_profile", "auto_backup_enabled", "BOOLEAN DEFAULT 0"),
        ("user_profile", "last_backup_at", "DATETIME"),
        # v2 migrations
        ("missions", "tags", "TEXT DEFAULT ''"),
        ("missions", "next_review_date", "DATE"),
        ("missions", "review_count", "INTEGER DEFAULT 0"),
        ("missions", "hint_used", "BOOLEAN DEFAULT 0"),
        ("missions", "challenge_started_at", "DATETIME"),
        ("user_profile", "streak_freezes", "INTEGER DEFAULT 1"),
        ("user_profile", "adaptive_difficulty", "TEXT DEFAULT 'medium'"),
        ("user_profile", "hints_remaining", "INTEGER DEFAULT 3"),
        ("user_profile", "weekly_challenge_id", "INTEGER"),
        ("user_profile", "goal_streak", "INTEGER DEFAULT 0"),
        ("user_profile", "onboarding_done", "BOOLEAN DEFAULT 0"),
        ("missions", "prerequisite_id", "INTEGER"),
        ("achievements", "secret", "BOOLEAN DEFAULT 0"),
        ("achievements", "rarity", "TEXT DEFAULT 'common'"),
        ("user_profile", "gemini_api_key", "TEXT"),
        ("user_profile", "api_provider", "TEXT DEFAULT 'openai'"),
        # #58 Email notifications
        ("user_profile", "email_address", "TEXT"),
        ("user_profile", "email_app_password", "TEXT"),
        ("user_profile", "email_notifications_enabled", "BOOLEAN DEFAULT 0"),
    ]
    for table, col, col_type in migrations:
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
        except Exception:
            pass  # Column already exists


def init_db() -> None:
    """Create tables, run migrations, and seed defaults if empty."""
    Base.metadata.create_all(bind=engine)

    # Run lightweight migrations for new columns on existing DBs
    with engine.connect() as conn:
        _migrate_columns(conn)
        # #47: Database indexes for performance
        from sqlalchemy import text
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_missions_date ON missions(date)",
            "CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status)",
            "CREATE INDEX IF NOT EXISTS idx_missions_skill_id ON missions(skill_id)",
            "CREATE INDEX IF NOT EXISTS idx_completions_mission_id ON completions(mission_id)",
            "CREATE INDEX IF NOT EXISTS idx_completions_submitted_at ON completions(submitted_at)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)",
            "CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)",
            "CREATE INDEX IF NOT EXISTS idx_bookmarks_mission_id ON bookmarks(mission_id)",
            "CREATE INDEX IF NOT EXISTS idx_missions_review ON missions(next_review_date)",
        ]
        for idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
            except Exception:
                pass
        conn.commit()

    db: Session = SessionLocal()
    try:
        # Seed skills
        if db.query(Skill).count() == 0:
            for s in DEFAULT_SKILLS:
                db.add(Skill(name=s["name"], icon=s["icon"]))
        # Seed achievements (add new ones if missing)
        for a in DEFAULT_ACHIEVEMENTS:
            if not db.query(Achievement).filter(Achievement.key == a["key"]).first():
                db.add(Achievement(
                    key=a["key"], name=a["name"],
                    description=a["description"], icon=a["icon"],
                    secret=a.get("secret", False),
                    rarity=a.get("rarity", "common"),
                ))
        # Seed user profile
        if db.query(UserProfile).count() == 0:
            db.add(UserProfile(id=1, total_xp=0, current_streak=0, longest_streak=0))
        # Seed inventory
        for item in DEFAULT_INVENTORY:
            if not db.query(InventoryItem).filter(InventoryItem.key == item["key"]).first():
                db.add(InventoryItem(**item))
        db.commit()
    finally:
        db.close()


def get_db() -> Session:
    """FastAPI dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
