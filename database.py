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


def migrate():
    """create_all не добавляет колонки в уже существующие таблицы,
    поэтому дописываем недостающие в `ideas` вручную. Безопасно запускать много раз."""
    cols = {c["name"] for c in inspect(engine).get_columns("ideas")}
    add = {
        "category": "VARCHAR(20) NOT NULL DEFAULT 'Идеи'",
        "title": "VARCHAR(120) NOT NULL DEFAULT ''",
        "pinned": "BOOLEAN NOT NULL DEFAULT FALSE",
        "rated": "BOOLEAN NOT NULL DEFAULT FALSE",
        "rated_at": "TIMESTAMP NULL",
        "deleted": "BOOLEAN NOT NULL DEFAULT FALSE",
    }
    with engine.begin() as conn:
        for name, ddl in add.items():
            if name not in cols:
                conn.execute(sql_text(f"ALTER TABLE ideas ADD COLUMN {name} {ddl}"))
        # у старых идей не было заголовка: берём начало текста
        conn.execute(sql_text("UPDATE ideas SET title = substr(text, 1, 60) WHERE title = ''"))