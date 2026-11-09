import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import (
    BigInteger, Boolean, ForeignKey, Index, Integer, String, UniqueConstraint,
    create_engine, inspect, text as sql_text,
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
def migrate():
    """create_all не добавляет колонки в существующие таблицы, дописываем вручную.
    Безопасно запускать много раз."""
    plan = {
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
        },
    }
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, add in plan.items():
            cols = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in add.items():
                if name not in cols:
                    conn.execute(sql_text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
        conn.execute(sql_text("UPDATE ideas SET title = substr(text, 1, 60) WHERE title = ''"))

        # старые рекорды из `scores` переезжают в game_scores как рекорды динозаврика.
        # Копируем один раз: только пока новая таблица пустая. Старую таблицу не трогаем.
        if "scores" in insp.get_table_names():
            if not conn.scalar(sql_text("SELECT COUNT(*) FROM game_scores")):
                conn.execute(sql_text(
                    "INSERT INTO game_scores (user_id, game, best, plays, updated_at) "
                    "SELECT user_id, 'dino', best, plays, updated_at FROM scores"
                ))