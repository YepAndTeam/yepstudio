import os
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional
import re
from html import escape
from fastapi.responses import HTMLResponse
from aiogram.types import MenuButtonWebApp, Update, WebAppInfo
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update

from auth import ADMIN_IDS, validate_init_data
from bot import WEBAPP_URL, bot, dp
from database import (
    Base, Comment, CommentReaction, GameScore, Notification, Post, Project,
    SessionLocal, Topic, User, Vote, engine, migrate,
)
from notify import add_notification, notify_game_beaten, short

load_dotenv(Path(__file__).parent / ".env")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "change-me")
TG_APP_LINK = "https://t.me/yab_studio_bot"
CATEGORIES = ["Идеи", "Вопросы", "Баги", "Обсуждение"]
STATUSES = {"new", "planned", "in_progress", "done", "none"}
STATUS_RU = {"new": "Новая", "planned": "В планах", "in_progress": "В работе", "done": "Готово"}
THEMES = {"dark", "light", "retro", "terminal", "nyan"}
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
class ThemeIn(BaseModel):
    theme: str


@app.post("/api/me/theme")
def set_theme(body: ThemeIn, user: User = Depends(get_user), db=Depends(get_db)):
    if body.theme not in THEMES:
        raise HTTPException(422, "Неизвестная тема")
    # сюда позже добавим проверку разблокировки
    user.theme = body.theme
    db.commit()
    return {"ok": True}
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
        "theme": user.theme,
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
def patch_topic(topic_id: int, body: TopicPatch, bg: BackgroundTasks,
                admin: User = Depends(get_admin), db=Depends(get_db)):
    t = get_topic_or_404(db, topic_id)
    if body.pinned is not None:
        t.pinned = body.pinned
    if body.rated is not None and body.rated != t.rated:
        t.rated = body.rated
        t.rated_at = datetime.utcnow() if body.rated else None
        if body.rated:
            add_notification(db, bg, t.user_id, "rated",
                             f"Твоя тема «{short(t.title)}» получила «Оценено» 🎉",
                             ref=f"t{t.id}", actor_id=admin.id)
    if body.status is not None:
        if body.status not in STATUSES:
            raise HTTPException(422, "Неизвестный статус")
        if body.status != t.status and body.status in STATUS_RU:
            add_notification(db, bg, t.user_id, "status",
                             f"Статус твоей темы «{short(t.title)}»: {STATUS_RU[body.status]}",
                             ref=f"t{t.id}", actor_id=admin.id)
        t.status = body.status
    db.commit()
    return {"ok": True}

@app.get("/api/notifications")
def list_notifications(user: User = Depends(get_user), db=Depends(get_db)):
    rows = db.scalars(
        select(Notification).where(Notification.user_id == user.id)
        .order_by(Notification.id.desc()).limit(50)
    ).all()
    unread = db.scalar(
        select(func.count()).select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read.is_(False))
    ) or 0
    return {
        "unread": unread,
        "items": [{"id": n.id, "kind": n.kind, "text": n.text, "ref": n.ref,
                   "read": n.read, "created_at": iso(n.created_at)} for n in rows],
    }


@app.post("/api/notifications/read")
def read_notifications(user: User = Depends(get_user), db=Depends(get_db)):
    db.execute(update(Notification)
               .where(Notification.user_id == user.id, Notification.read.is_(False))
               .values(read=True))
    db.commit()
    return {"ok": True}


class NotifySettings(BaseModel):
    push: bool


@app.post("/api/me/notify")
def set_notify(body: NotifySettings, user: User = Depends(get_user), db=Depends(get_db)):
    user.notify = body.push
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
def add_comment(body: CommentIn, bg: BackgroundTasks, user: User = Depends(get_user), db=Depends(get_db)):
    kind, ref_id = parse_ref(db, body.ref)
    text = body.text.strip()
    if len(text) < 2:
        raise HTTPException(422, "Слишком короткий комментарий")
    parent = None
    parent_id = None
    if body.parent_id is not None:
        parent = db.get(Comment, body.parent_id)
        if not parent or parent.ref_type != kind or parent.ref_id != ref_id:
            raise HTTPException(422, "Bad parent")
        parent_id = parent.parent_id or parent.id  # ответы только в один уровень
    c = Comment(ref_type=kind, ref_id=ref_id, parent_id=parent_id, user_id=user.id, text=text)
    db.add(c)

    # кого уведомить: автора темы и автора комментария, на который ответили
    targets = {}
    if kind == "topic":
        topic = db.get(Topic, ref_id)
        targets[topic.user_id] = f"{user.first_name} ответил(а) в твоей теме «{short(topic.title)}»"
    if parent:
        targets[parent.user_id] = f"{user.first_name} ответил(а) тебе: «{short(text, 80)}»"
    for uid, msg in targets.items():
        add_notification(db, bg, uid, "reply", msg, ref=body.ref, actor_id=user.id)

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


# ---------- игры ----------

# rate  — максимум очков в секунду, slack — запас на задержку сети и округления.
# dino:   10 очков/сек (score = t * 10)
# flappy: труба каждые ~1.5 сек (140 px при скорости 95 px/с), то есть не больше ~0.7 очка/сек.
#         Если поменяешь SPEED или SPACING во flappy.js, поправь rate здесь.
GAMES = {
    "dino": {"rate": 11, "slack": 10},
    "flappy": {"rate": 0.8, "slack": 3},
}
GAME_RUNS: dict[
    tuple[int, str], float] = {}  # (user_id, game) -> время старта забега (при нескольких воркерах нужен Redis)


def check_game(game: str) -> str:
    if game not in GAMES:
        raise HTTPException(422, "Неизвестная игра")
    return game


class StartIn(BaseModel):
    game: str = "dino"


class ScoreIn(BaseModel):
    game: str = "dino"
    score: int = Field(ge=0, le=100000)


@app.post("/api/game/start")
def game_start(body: Optional[StartIn] = None, user: User = Depends(get_user)):
    # body необязателен, чтобы старая версия фронта (без game) не падала с 422
    game = check_game(body.game if body else "dino")
    GAME_RUNS[(user.id, game)] = time.monotonic()
    return {"ok": True}


@app.post("/api/game/score")
def game_score(body: ScoreIn, bg: BackgroundTasks, user: User = Depends(get_user), db=Depends(get_db)):
    game = check_game(body.game)
    started = GAME_RUNS.pop((user.id, game), None)
    if started is None:
        raise HTTPException(422, "Забег не начат")
    elapsed = time.monotonic() - started
    limits = GAMES[game]
    if body.score > elapsed * limits["rate"] + limits["slack"]:
        raise HTTPException(422, "Подозрительный результат")

    row = db.scalar(select(GameScore).where(GameScore.user_id == user.id, GameScore.game == game))
    old = row.best if row else 0
    if not row:
        row = GameScore(user_id=user.id, game=game, best=0, plays=0)
        db.add(row)
    row.plays += 1

    record = body.score > old
    if record:
        row.best = body.score
        row.updated_at = datetime.utcnow()
        if old > 0:
            # кого обогнали в этой игре: были выше твоего старого рекорда, теперь ниже нового
            beaten = db.scalars(
                select(GameScore.user_id)
                .where(GameScore.game == game, GameScore.best > old,
                       GameScore.best < body.score, GameScore.user_id != user.id)
                .order_by(GameScore.best.desc()).limit(3)
            ).all()
            for uid in beaten:
                notify_game_beaten(db, bg, uid, user.first_name, body.score, user.id)
    db.commit()

    rank = 1 + (db.scalar(
        select(func.count()).select_from(GameScore)
        .where(GameScore.game == game, GameScore.best > row.best)
    ) or 0)
    return {"best": row.best, "record": record, "rank": rank}


@app.get("/api/game/top")
def game_top(game: str = "dino", user: User = Depends(get_user), db=Depends(get_db)):
    game = check_game(game)
    rows = db.execute(
        select(GameScore.user_id, User.first_name, GameScore.best)
        .join(User, User.id == GameScore.user_id)
        .where(GameScore.game == game, GameScore.best > 0)
        .order_by(GameScore.best.desc(), GameScore.updated_at)
        .limit(20)
    ).all()
    mine = db.scalar(select(GameScore).where(GameScore.user_id == user.id, GameScore.game == game))
    rank = None
    if mine and mine.best > 0:
        rank = 1 + (db.scalar(
            select(func.count()).select_from(GameScore)
            .where(GameScore.game == game, GameScore.best > mine.best)
        ) or 0)
    return {
        "top": [{"user_id": uid, "name": name, "best": best} for uid, name, best in rows],
        "my_best": mine.best if mine else 0,
        "my_rank": rank,
    }
# ---------- Telegram ----------

@app.post("/webhook")
async def webhook(request: Request):
    if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != WEBHOOK_SECRET:
        raise HTTPException(403)
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}
@app.get("/s/{ref}", response_class=HTMLResponse)
def share_page(ref: str, db=Depends(get_db)):
    if not re.fullmatch(r"[tn]\d+|game_[a-z]+", ref):
        raise HTTPException(404)

    title, desc = "YAB STUDIO", "Открой в мини-приложении"
    if ref[0] == "t":
        t = db.get(Topic, int(ref[1:]))
        if t and not t.deleted:
            title = t.title
            desc = (t.text or t.category)[:160]
    elif ref[0] == "n":
        p = db.get(Post, int(ref[1:]))
        if p:
            title = p.title
            desc = (p.text or "")[:160]
    else:
        title, desc = "Сможешь побить мой рекорд?", "Заходи в игру в YAB STUDIO"

    target = f"{TG_APP_LINK}?startapp={ref}"
    img = f"{WEBAPP_URL}/og.png"
    e = escape
    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>{e(title)}</title>
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{img}">
<meta property="og:type" content="website">
<meta http-equiv="refresh" content="0;url={e(target)}">
</head><body><script>location.replace({target!r})</script>
<a href="{e(target)}">Открыть</a></body></html>"""

# статику монтируем последней, иначе она перекроет маршруты выше
app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")