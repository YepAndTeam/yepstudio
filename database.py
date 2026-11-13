import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import (
    BigInteger, Boolean, ForeignKey, Index, Integer, String, UniqueConstraint,
    create_engine, inspect, Text, text as sql_text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

load_dotenv(Path(__file__).parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///ideas.db")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(bind=engine)
from performance import install_sql_timings
from server_cache import install_invalidation
install_sql_timings(engine)
install_invalidation(SessionLocal)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # telegram id
    first_name: Mapped[str] = mapped_column(String(100))
    username: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="user")  # user / admin
    notify: Mapped[bool] = mapped_column(Boolean, default=True)  # пуши от бота
    theme: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    jera: Mapped[int] = mapped_column(Integer, default=0)  # ← добавить
class Topic(Base):
    """Тема форума. Таблица осталась `ideas`, чтобы не потерять старые идеи."""
    __tablename__ = "ideas"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(String(1000))
    # new / planned / in_progress / done, "none" если у темы нет статуса (не «Идеи»)
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    # добавлено в версии с форумом (см. migrate)
    category: Mapped[str] = mapped_column(String(20), default="Идеи")
    title: Mapped[str] = mapped_column(String(120), default="")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    rated: Mapped[bool] = mapped_column(Boolean, default=False)
    rated_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)


class Vote(Base):
    __tablename__ = "votes"
    id: Mapped[int] = mapped_column(primary_key=True)
    idea_id: Mapped[int] = mapped_column(ForeignKey("ideas.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    __table_args__ = (UniqueConstraint("idea_id", "user_id"),)  # один голос на человека


class Post(Base):
    """Новость на главной."""
    __tablename__ = "posts"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    text: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="new")
    stage: Mapped[int] = mapped_column(Integer, default=0)  # 0..4


class Comment(Base):
    """Комментарий к теме (ref_type='topic') или к новости (ref_type='post')."""
    __tablename__ = "comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref_type: Mapped[str] = mapped_column(String(10))
    ref_id: Mapped[int] = mapped_column(Integer)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("comments.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    __table_args__ = (Index("ix_comments_ref", "ref_type", "ref_id"),)


class CommentReaction(Base):
    __tablename__ = "comment_reactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    value: Mapped[int] = mapped_column(Integer)  # 1 лайк, -1 дизлайк
    __table_args__ = (UniqueConstraint("comment_id", "user_id"),)
class AllTimeScore(Base):
    __tablename__ = "alltime_scores"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    game: Mapped[str] = mapped_column(String(20))
    best: Mapped[int] = mapped_column(Integer, default=0, index=True)
    achieved_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("user_id", "game"),)


class WeeklyResult(Base):
    """История недель. period = -1 это снимок старых рекордов перед первым сбросом."""
    __tablename__ = "weekly_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    period: Mapped[int] = mapped_column(Integer, index=True)
    game: Mapped[str] = mapped_column(String(20))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    best: Mapped[int] = mapped_column(Integer)
    place: Mapped[int] = mapped_column(Integer)


class JeraTx(Base):
    __tablename__ = "jera_tx"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(60))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class Meta(Base):
    __tablename__ = "meta"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[str] = mapped_column(String(100))
class Notification(Base):
    """Лента уведомлений внутри аппа. kind: reply / status / rated / news / game"""
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String(20))
    text: Mapped[str] = mapped_column(String(300))
    ref: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "t12", "n3", "game"
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    __table_args__ = (Index("ix_notif_user", "user_id", "read"),)
class GameScore(Base):
    """Лучший результат игрока в конкретной мини-игре (game: dino / flappy).
    Заменила таблицу `scores`, где рекорд был один на игрока (см. migrate)."""
    __tablename__ = "game_scores"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    game: Mapped[str] = mapped_column(String(20), default="dino")
    best: Mapped[int] = mapped_column(Integer, default=0, index=True)
    plays: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("user_id", "game"),)  # один рекорд на игрока в каждой игре

class Tournament(Base):
    __tablename__ = "tournaments"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    game: Mapped[str] = mapped_column(String(20), index=True)
    title: Mapped[str] = mapped_column(String(120))
    starts_at: Mapped[datetime] = mapped_column(index=True)
    ends_at: Mapped[datetime] = mapped_column(index=True)
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    voting_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    duration_hours: Mapped[int] = mapped_column(Integer, default=48)
    entry_fee: Mapped[int] = mapped_column(Integer, default=0)
    prize_theme: Mapped[str] = mapped_column(String(20), default="poop")
    duplicate_prize: Mapped[int] = mapped_column(Integer, default=200)
    prize_jera: Mapped[str] = mapped_column(Text, default='{"2":150,"3":100,"4":75,"5":50}')
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    settled_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)


class TournamentVote(Base):
    __tablename__ = "tournament_votes"
    tournament_id: Mapped[str] = mapped_column(ForeignKey("tournaments.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    game: Mapped[str] = mapped_column(String(20))


class TournamentEntry(Base):
    __tablename__ = "tournament_entries"
    tournament_id: Mapped[str] = mapped_column(ForeignKey("tournaments.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    joined_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    paid: Mapped[int] = mapped_column(Integer, default=0)


class TournamentAward(Base):
    __tablename__ = "tournament_awards"
    tournament_id: Mapped[str] = mapped_column(ForeignKey("tournaments.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    place: Mapped[int] = mapped_column(Integer)
    amount: Mapped[int] = mapped_column(Integer, default=0)
    theme_id: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class GameRun(Base):
    __tablename__ = "game_runs"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    game: Mapped[str] = mapped_column(String(20))
    epoch: Mapped[str] = mapped_column(String(40))
    started_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class GameResult(Base):
    """One accepted game; immutable score, except moderation invalidation."""
    __tablename__ = "game_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    game: Mapped[str] = mapped_column(String(20), index=True)
    score: Mapped[int] = mapped_column(Integer)
    run_id: Mapped[Optional[str]] = mapped_column(ForeignKey("game_runs.id"), nullable=True, unique=True)
    submitted_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True)
    period: Mapped[int] = mapped_column(Integer, index=True)
    epoch: Mapped[str] = mapped_column(String(40), index=True)
    valid: Mapped[bool] = mapped_column(Boolean, default=True)


class TournamentResult(Base):
    __tablename__ = "tournament_results"
    result_id: Mapped[int] = mapped_column(ForeignKey("game_results.id"), primary_key=True)
    tournament_id: Mapped[str] = mapped_column(ForeignKey("tournaments.id"), primary_key=True)


class TournamentScore(Base):
    __tablename__ = "tournament_scores"
    id: Mapped[int] = mapped_column(primary_key=True)
    tournament_id: Mapped[str] = mapped_column(ForeignKey("tournaments.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    best: Mapped[int] = mapped_column(Integer, default=0)
    achieved_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    __table_args__ = (UniqueConstraint("tournament_id", "user_id"),)


class RecordReset(Base):
    __tablename__ = "record_resets"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    applied_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    archive_hash: Mapped[str] = mapped_column(String(64))
    archive_json: Mapped[str] = mapped_column(Text)


class DailyTaskSet(Base):
    __tablename__ = "daily_task_sets"
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    definitions_json: Mapped[str] = mapped_column(Text)


class DailyTaskAward(Base):
    __tablename__ = "daily_task_awards"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    task_id: Mapped[str] = mapped_column(String(60), primary_key=True)
    amount: Mapped[int] = mapped_column(Integer)


class WeeklyTaskSet(Base):
    __tablename__ = "weekly_task_sets"
    period: Mapped[int] = mapped_column(Integer, primary_key=True)
    definitions_json: Mapped[str] = mapped_column(Text)


class AchievementProgress(Base):
    __tablename__ = "achievement_progress"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    game: Mapped[str] = mapped_column(String(20), primary_key=True)
    best: Mapped[int] = mapped_column(Integer, default=0)


class AchievementAward(Base):
    __tablename__ = "achievement_awards"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    game: Mapped[str] = mapped_column(String(20), primary_key=True)
    threshold: Mapped[int] = mapped_column(Integer, primary_key=True)
    amount: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class DailyVisit(Base):
    __tablename__ = "daily_visits"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    streak: Mapped[int] = mapped_column(Integer)
    amount: Mapped[int] = mapped_column(Integer)


class RecordResetDraft(Base):
    __tablename__ = "record_reset_drafts"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    plan_json: Mapped[str] = mapped_column(Text)


class UserTheme(Base):
    __tablename__ = "user_themes"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    theme_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    source: Mapped[str] = mapped_column(String(40))
    acquired_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class ThemeBoxPurchase(Base):
    __tablename__ = "theme_box_purchases"
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    request_id: Mapped[str] = mapped_column(String(64))
    runes: Mapped[str] = mapped_column(String(12))
    theme_id: Mapped[str] = mapped_column(String(20))
    price: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(12), default="pending")
    is_dupe: Mapped[bool] = mapped_column(Boolean, default=False)
    refund: Mapped[int] = mapped_column(Integer, default=0)
    purchased_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    __table_args__ = (UniqueConstraint("user_id", "request_id"),)


class CompensationLetter(Base):
    __tablename__ = "compensation_letters"
    reset_id: Mapped[str] = mapped_column(ForeignKey("record_resets.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    read_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)


class EconomyWelcome(Base):
    __tablename__ = "economy_welcome_v2"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    kind: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    paid_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)


def migrate():
    """create_all не добавляет колонки в существующие таблицы, дописываем вручную.
    Безопасно запускать много раз."""
    plan = {
        "tournaments": {
            "status": "VARCHAR(20) NOT NULL DEFAULT 'active'",
            "voting_closed": "BOOLEAN NOT NULL DEFAULT FALSE",
            "duration_hours": "INTEGER NOT NULL DEFAULT 48",
            "entry_fee": "INTEGER NOT NULL DEFAULT 0",
            "prize_theme": "VARCHAR(20) NOT NULL DEFAULT 'poop'",
            "duplicate_prize": "INTEGER NOT NULL DEFAULT 200",
            "prize_jera": "TEXT NOT NULL DEFAULT '{\"2\":150,\"3\":100,\"4\":75,\"5\":50}'",
            "created_at": "TIMESTAMP NULL",
            "settled_at": "TIMESTAMP NULL",
        },
        "ideas": {
            "category": "VARCHAR(20) NOT NULL DEFAULT 'Идеи'",
            "title": "VARCHAR(120) NOT NULL DEFAULT ''",
            "pinned": "BOOLEAN NOT NULL DEFAULT FALSE",
            "rated": "BOOLEAN NOT NULL DEFAULT FALSE",
            "rated_at": "TIMESTAMP NULL",
            "deleted": "BOOLEAN NOT NULL DEFAULT FALSE",
        },
        "users": {
            "notify": "BOOLEAN NOT NULL DEFAULT TRUE",
            "theme": "VARCHAR(20) NULL",
            "jera": "INTEGER NOT NULL DEFAULT 0",  # ← добавить
        },
    }
    with engine.begin() as conn:
        insp = inspect(conn)
        for table, add in plan.items():
            cols = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in add.items():
                if name not in cols:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")
        conn.execute(sql_text("UPDATE tournaments SET created_at = starts_at WHERE created_at IS NULL"))
        conn.execute(sql_text("UPDATE ideas SET title = substr(text, 1, 60) WHERE title = ''"))

        # A marker, not an empty table, controls legacy import. An intentional reset
        # must never resurrect the old scores on the next application restart.
        imported = conn.scalar(sql_text("SELECT value FROM meta WHERE key = 'scores_imported_v2'"))
        if imported is None:
            converted = conn.scalar(sql_text("SELECT value FROM meta WHERE key = 'legacy_done'"))
            if "scores" in insp.get_table_names() and not converted:
                if not conn.scalar(sql_text("SELECT COUNT(*) FROM game_scores")):
                    conn.execute(sql_text(
                        "INSERT INTO game_scores (user_id, game, best, plays, updated_at) "
                        "SELECT user_id, 'dino', best, plays, updated_at FROM scores"
                    ))
            conn.execute(sql_text("INSERT INTO meta (key, value) VALUES ('scores_imported_v2', '1') ON CONFLICT (key) DO NOTHING"))
