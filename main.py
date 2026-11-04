import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from aiogram.types import MenuButtonWebApp, Update, WebAppInfo
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from auth import ADMIN_IDS, validate_init_data
from bot import WEBAPP_URL, bot, dp
from database import (
    Base, Comment, CommentReaction, Post, Project, SessionLocal, Topic, User, Vote, engine, migrate,
)

load_dotenv(Path(__file__).parent / ".env")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "change-me")

CATEGORIES = ["Идеи", "Вопросы", "Баги", "Обсуждение"]
STATUSES = {"new", "planned", "in_progress", "done", "none"}

Base.metadata.create_all(engine)
migrate()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if WEBAPP_URL:  # локально без ссылки просто пропускаем
        await bot.set_webhook(f"{WEBAPP_URL}/webhook", secret_token=WEBHOOK_SECRET)
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="Открыть", web_app=WebAppInfo(url=WEBAPP_URL))
        )
    yield
    await bot.session.close()


app = FastAPI(lifespan=lifespan)


def iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() + "Z" if dt else None  # в базе хранится UTC


def get_db():
    with SessionLocal() as db:
        yield db


def get_user(x_init_data: str = Header(), db=Depends(get_db)) -> User:
    data = validate_init_data(x_init_data)
    if not data:
        raise HTTPException(401, "Bad initData")
    tg = data["user"]
    first_name = tg.get("first_name", "?")
    username = tg.get("username")
    user = db.get(User, tg["id"])
    changed = False
    if not user:
        user = User(id=tg["id"], first_name=first_name, username=username, role="user")
        db.add(user)
        changed = True
    elif user.first_name != first_name or user.username != username:
        user.first_name, user.username = first_name, username
        changed = True
    # ADMIN_IDS только повышает; админов, назначенных в базе, не понижаем
    if tg["id"] in ADMIN_IDS and user.role != "admin":
        user.role = "admin"
        changed = True
    if changed:
        db.commit()
    return user


def get_admin(user: User = Depends(get_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Только для модераторов")
    return user


# ---------- профиль ----------

@app.get("/api/me")
def me(user: User = Depends(get_user), db=Depends(get_db)):
    def count(*where, model):
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    return {
        "id": user.id, "first_name": user.first_name, "username": user.username, "role": user.role,
        "topics": count(Topic.user_id == user.id, Topic.deleted.is_(False), model=Topic),
        "comments": count(Comment.user_id == user.id, model=Comment),
        "votes": count(Vote.user_id == user.id, model=Vote),
        "rated": count(Topic.user_id == user.id, Topic.rated.is_(True), Topic.deleted.is_(False), model=Topic),
    }


# ---------- новости ----------

@app.get("/api/home")
def home(user: User = Depends(get_user), db=Depends(get_db)):
    projects = db.scalars(select(Project).order_by(Project.id)).all()

    cm = (select(Comment.ref_id.label("pid"), func.count().label("n"))
          .where(Comment.ref_type == "post").group_by(Comment.ref_id).subquery())
    posts = db.execute(
        select(Post, func.coalesce(cm.c.n, 0))
        .outerjoin(cm, cm.c.pid == Post.id)
        .order_by(Post.created_at.desc(), Post.id.desc())
        .limit(30)
    ).all()

    latest = db.execute(
        select(Topic, User.first_name)
        .join(User, User.id == Topic.user_id)
        .where(Topic.rated.is_(True), Topic.deleted.is_(False), Topic.rated_at.is_not(None))
        .order_by(Topic.rated_at.desc())
        .limit(1)
    ).first()

    return {
        "projects": [{"id": p.id, "name": p.name, "status": p.status, "stage": p.stage} for p in projects],
        "posts": [
            {"id": p.id, "title": p.title, "text": p.text, "created_at": iso(p.created_at), "comments": n}
            for p, n in posts
        ],
        "latest": {"title": latest[0].title, "author": latest[1]} if latest else None,
    }


# ---------- темы форума ----------

class TopicIn(BaseModel):
    category: str
    title: str = Field(min_length=3, max_length=120)
    text: str = Field(default="", max_length=1000)


class TopicPatch(BaseModel):
    pinned: Optional[bool] = None
    rated: Optional[bool] = None
    status: Optional[str] = None  # "none" снимает статус


def serialize_topics(db, user: User, topic_id: Optional[int] = None):
    votes = (select(Vote.idea_id.label("tid"), func.count().label("n"))
             .group_by(Vote.idea_id).subquery())
    replies = (select(Comment.ref_id.label("tid"), func.count().label("n"))
               .where(Comment.ref_type == "topic").group_by(Comment.ref_id).subquery())
    q = (
        select(Topic, User.first_name, func.coalesce(votes.c.n, 0), func.coalesce(replies.c.n, 0))
        .join(User, User.id == Topic.user_id)
        .outerjoin(votes, votes.c.tid == Topic.id)
        .outerjoin(replies, replies.c.tid == Topic.id)
        .where(Topic.deleted.is_(False))
    )
    if topic_id is not None:
        q = q.where(Topic.id == topic_id)
    my_votes = set(db.scalars(select(Vote.idea_id).where(Vote.user_id == user.id)))
    return [
        {
            "id": t.id, "category": t.category, "title": t.title, "text": t.text,
            "author": name, "author_id": t.user_id,
            "status": None if t.status == "none" else t.status,
            "pinned": t.pinned, "rated": t.rated,
            "votes": v, "voted": t.id in my_votes, "replies": r,
            "created_at": iso(t.created_at),
        }
        for t, name, v, r in db.execute(q).all()
    ]


def get_topic_or_404(db, topic_id: int) -> Topic:
    t = db.get(Topic, topic_id)
    if not t or t.deleted:
        raise HTTPException(404)
    return t


@app.get("/api/topics")
def list_topics(user: User = Depends(get_user), db=Depends(get_db)):
    return serialize_topics(db, user)


@app.post("/api/topics")
def add_topic(body: TopicIn, user: User = Depends(get_user), db=Depends(get_db)):
    title = body.title.strip()
    if len(title) < 3:
        raise HTTPException(422, "Название слишком короткое")
    if body.category not in CATEGORIES:
        raise HTTPException(422, "Неизвестная категория")
    topic = Topic(
        user_id=user.id, category=body.category, title=title, text=body.text.strip(),
        status="new" if body.category == "Идеи" else "none",
    )
    db.add(topic)
    db.commit()
    return {"id": topic.id}


@app.post("/api/topics/{topic_id}/vote")
def toggle_vote(topic_id: int, user: User = Depends(get_user), db=Depends(get_db)):
    get_topic_or_404(db, topic_id)
    vote = db.scalar(select(Vote).where(Vote.idea_id == topic_id, Vote.user_id == user.id))
    if vote:
        db.delete(vote)
    else:
        db.add(Vote(idea_id=topic_id, user_id=user.id))
    db.commit()
    return {"ok": True}


@app.patch("/api/topics/{topic_id}")
def patch_topic(topic_id: int, body: TopicPatch, admin: User = Depends(get_admin), db=Depends(get_db)):
    t = get_topic_or_404(db, topic_id)
    if body.pinned is not None:
        t.pinned = body.pinned
    if body.rated is not None and body.rated != t.rated:
        t.rated = body.rated
        t.rated_at = datetime.utcnow() if body.rated else None
    if body.status is not None:
        if body.status not in STATUSES:
            raise HTTPException(422, "Неизвестный статус")
        t.status = body.status
    db.commit()
    return {"ok": True}


@app.delete("/api/topics/{topic_id}")
def delete_topic(topic_id: int, admin: User = Depends(get_admin), db=Depends(get_db)):
    t = get_topic_or_404(db, topic_id)
    t.deleted = True  # мягкое удаление, данные остаются в базе
    db.commit()
    return {"ok": True}


# ---------- комментарии ----------

class CommentIn(BaseModel):
    ref: str  # "t12" тема, "n3" новость
    text: str = Field(min_length=2, max_length=1000)
    parent_id: Optional[int] = None


class ReactIn(BaseModel):
    value: str  # like / dislike


def parse_ref(db, ref: str):
    kind = {"t": "topic", "n": "post"}.get(ref[:1])
    if not kind or not ref[1:].isdigit():
        raise HTTPException(422, "Bad ref")
    ref_id = int(ref[1:])
    exists = get_topic_or_404(db, ref_id) if kind == "topic" else db.get(Post, ref_id)
    if not exists:
        raise HTTPException(404)
    return kind, ref_id


@app.get("/api/comments")
def list_comments(ref: str, user: User = Depends(get_user), db=Depends(get_db)):
    kind, ref_id = parse_ref(db, ref)
    rows = db.execute(
        select(Comment, User.first_name, User.role)
        .join(User, User.id == Comment.user_id)
        .where(Comment.ref_type == kind, Comment.ref_id == ref_id)
        .order_by(Comment.created_at, Comment.id)
    ).all()
    ids = [c.id for c, _, _ in rows]
    likes, dislikes, mine = {}, {}, {}
    if ids:
        for cid, uid, value in db.execute(
            select(CommentReaction.comment_id, CommentReaction.user_id, CommentReaction.value)
            .where(CommentReaction.comment_id.in_(ids))
        ):
            bucket = likes if value == 1 else dislikes
            bucket[cid] = bucket.get(cid, 0) + 1
            if uid == user.id:
                mine[cid] = "like" if value == 1 else "dislike"
    return [
        {
            "id": c.id, "parent_id": c.parent_id, "author": name, "author_id": c.user_id,
            "staff": role == "admin", "text": c.text,
            "likes": likes.get(c.id, 0), "dislikes": dislikes.get(c.id, 0), "my": mine.get(c.id),
            "created_at": iso(c.created_at),
        }
        for c, name, role in rows
    ]


@app.post("/api/comments")
def add_comment(body: CommentIn, user: User = Depends(get_user), db=Depends(get_db)):
    kind, ref_id = parse_ref(db, body.ref)
    text = body.text.strip()
    if len(text) < 2:
        raise HTTPException(422, "Слишком короткий комментарий")
    parent_id = None
    if body.parent_id is not None:
        parent = db.get(Comment, body.parent_id)
        if not parent or parent.ref_type != kind or parent.ref_id != ref_id:
            raise HTTPException(422, "Bad parent")
        parent_id = parent.parent_id or parent.id  # ответы только в один уровень
    c = Comment(ref_type=kind, ref_id=ref_id, parent_id=parent_id, user_id=user.id, text=text)
    db.add(c)
    db.commit()
    return {"id": c.id}


@app.post("/api/comments/{comment_id}/react")
def react(comment_id: int, body: ReactIn, user: User = Depends(get_user), db=Depends(get_db)):
    if body.value not in ("like", "dislike"):
        raise HTTPException(422, "Bad value")
    if not db.get(Comment, comment_id):
        raise HTTPException(404)
    value = 1 if body.value == "like" else -1
    r = db.scalar(select(CommentReaction).where(
        CommentReaction.comment_id == comment_id, CommentReaction.user_id == user.id))
    if r and r.value == value:
        db.delete(r)  # повторное нажатие снимает реакцию
    elif r:
        r.value = value
    else:
        db.add(CommentReaction(comment_id=comment_id, user_id=user.id, value=value))
    db.commit()
    return {"ok": True}


# ---------- Telegram ----------

@app.post("/webhook")
async def webhook(request: Request):
    if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != WEBHOOK_SECRET:
        raise HTTPException(403)
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}


# статику монтируем последней, иначе она перекроет маршруты выше
app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")