import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import create_engine, ForeignKey, UniqueConstraint, String, BigInteger
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


class Idea(Base):
    __tablename__ = "ideas"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(20), default="new")  # new / planned / in_progress / done
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class Vote(Base):
    __tablename__ = "votes"
    id: Mapped[int] = mapped_column(primary_key=True)
    idea_id: Mapped[int] = mapped_column(ForeignKey("ideas.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    __table_args__ = (UniqueConstraint("idea_id", "user_id"),)  # один голос на человека