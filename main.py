import os
from daily_service import reward_visit
from achievement_service import achievement_state
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional
import re
import json
from html import escape
from fastapi.responses import HTMLResponse
from aiogram.types import MenuButtonWebApp, Update, WebAppInfo
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select, update, and_, or_
import disc_models  # DVD collection tables
import social_models  # friends and shared online status
import widget_models  # registers private-chat widget tables
import race_models  # registers race tables before create_all
import chess_models  # noqa: F401  (регистрирует таблицу до create_all)
import checkers_models  # noqa: F401  (регистрирует таблицу до create_all)
from chess_api import make_router as make_chess_router
from checkers_api import make_router as make_checkers_router
from auth import ADMIN_IDS, validate_init_data
from bot import WEBAPP_URL, bot, dp
from database import (
    Base, Comment, CommentReaction, GameScore, Notification, Post, Project,
    SessionLocal, Topic, User, Vote, engine, migrate, AllTimeScore, Tournament, TournamentScore,
)
from notify import add_notification, notify_game_beaten, short

load_dotenv(Path(__file__).parent / ".env")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "change-me")
TG_APP_LINK = "https://t.me/yab_studio_bot"
CATEGORIES = ["Идеи", "Вопросы", "Баги", "Обсуждение"]
STATUSES = {"new", "planned", "in_progress", "done", "none"}
STATUS_RU = {"new": "Новая", "planned": "В планах", "in_progress": "В работе", "done": "Готово"}
THEMES = {"dark", "light", "retro", "terminal", "nyan", "tetris", "poop", "neon"}
Base.metadata.create_all(engine)
migrate()
from weekly import ensure_period, week_ends_at, period_now
from score_service import initialize_score_state, submit_result, invalidate_scores, lock_scores, begin_run, ScoreError
from reset_records import preview as reset_preview, saved_preview, apply_plan as apply_record_reset, RESET_ID
from database import Meta, RecordReset
initialize_score_state(SessionLocal)
from widget_service import initialize_widget_state
initialize_widget_state(SessionLocal)
from shop_service import (initialize_shop_state, owned_themes, buy_box, unlock_box,
                          shop_state, ShopError, BOX_PRICE)
initialize_shop_state(SessionLocal)
from compensation_service import initialize_letters, list_letters, mark_read
initialize_letters(SessionLocal)
from tournament_service import (list_events, get_event, event_state, create_event,
    start_event, cancel_event, register as register_tournament, settle_due, TournamentError, vote as tournament_vote)

def settle_tournaments_in_background():
    with SessionLocal.begin() as db:
        settle_due(db)


async def tournament_clock():
    while True:
        await asyncio.sleep(30)
        try:
            await asyncio.to_thread(settle_tournaments_in_background)
        except Exception:
            logging.getLogger(__name__).exception("Tournament settlement failed; retrying on next tick")


async def deliver_race_reminders(notices):
    from race_models import RaceReminder
    from aiogram.types import InlineKeyboardMarkup,InlineKeyboardButton,WebAppInfo
    for race_id,user_id,message in notices:
        try:
            markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="Открыть скачки",web_app=WebAppInfo(url=WEBAPP_URL+"?ref=races"))]]) if WEBAPP_URL else None
            await bot.send_message(user_id,message,reply_markup=markup)
            with SessionLocal.begin() as db:
                reminder=db.get(RaceReminder,(race_id,user_id))
                if reminder:reminder.sent_at=datetime.utcnow()
        except Exception:
            logging.getLogger(__name__).warning("Race reminder delivery failed; in-app notice retained")


def race_clock_tick():
    from race_service import tick
    from race_models import Race
    with SessionLocal.begin() as db:
        notices=tick(db)
        pending=[(r.id,r.beacon_round,json.loads(r.proof_json) if r.proof_json else None) for r in db.scalars(select(Race).where(Race.status=="scheduled",Race.starts_at<=datetime.utcnow())).all()]
    return notices,pending


async def race_clock():
    from race_fairness import fetch_beacon
    from race_service import apply_beacon
    while True:
        try:
            notices,pending=await asyncio.to_thread(race_clock_tick)
            await deliver_race_reminders(notices)
            for race_id,number,stored in pending:
                beacon=stored or await asyncio.to_thread(fetch_beacon,number)
                if beacon:
                    def settle(race_id=race_id,beacon=beacon):
                        with SessionLocal.begin() as db:apply_beacon(db,race_id,beacon)
                    await asyncio.to_thread(settle)
        except Exception:
            logging.getLogger(__name__).exception("Race clock failed; retrying")
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if WEBAPP_URL:  # локально без ссылки просто пропускаем
        await bot.set_webhook(f"{WEBAPP_URL}/webhook", secret_token=WEBHOOK_SECRET,
            allowed_updates=list(set(dp.resolve_used_update_types()) | {"widget_query", "my_chat_member"}))
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="Открыть", web_app=WebAppInfo(url=WEBAPP_URL))
        )
    clock = asyncio.create_task(tournament_clock())
    races_clock = asyncio.create_task(race_clock())
    try:
        yield
    finally:
        races_clock.cancel()
        try:
            await races_clock
        except asyncio.CancelledError:
            pass
        clock.cancel()
        try:
            await clock
        except asyncio.CancelledError:
            pass
        await bot.session.close()


app = FastAPI(lifespan=lifespan)
from performance import PerformanceMiddleware,performance_snapshot
from server_cache import cached_read,public_cache
app.add_middleware(PerformanceMiddleware)
@app.middleware("http")
async def isolation_headers(request: Request, call_next):
    response = await call_next(request)
    # нужны для Doom (SharedArrayBuffer) внутри iframe
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "credentialless"
    return response

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


from race_api import make_race_router
app.include_router(make_race_router(get_user,get_admin,get_db,deliver_race_reminders))
from social_api import make_social_router
async def deliver_friend_game(invitation_id):
    from widget_bot import deliver_invitation
    await deliver_invitation(bot,SessionLocal,invitation_id)
app.include_router(make_social_router(get_user,get_db,deliver_friend_game))
from disc_service import launch_gift_state
from theme_gift_service import theme_gifts,update_theme_gift
from disc_api import make_disc_router
app.include_router(make_disc_router(get_user,get_db))
from community_api import make_community_router
from disc_equipment import equipment_state
async def deliver_trade_notice(identity):
    from disc_market import claim_notice
    from disc_models import DiscTradeNotice
    from aiogram.types import InlineKeyboardMarkup,InlineKeyboardButton,WebAppInfo
    def claim():
        with SessionLocal.begin() as db:return claim_notice(db,identity)
    delivery=await asyncio.to_thread(claim)
    if not delivery:return
    uid,text=delivery
    try:
        markup=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text='Посмотреть отклик',web_app=WebAppInfo(url=WEBAPP_URL+'?ref=community_trading'))]]) if WEBAPP_URL else None
        await bot.send_message(uid,text,reply_markup=markup,parse_mode=None)
        status='sent'
    except Exception:
        logging.getLogger(__name__).warning('Trade response notification failed; in-app notice retained')
        status='failed'
    def finish():
        with SessionLocal.begin() as db:
            row=db.get(DiscTradeNotice,identity)
            if row:row.status=status
    await asyncio.to_thread(finish)
app.include_router(make_community_router(get_user,get_db,deliver_trade_notice))
app.include_router(make_chess_router(get_user, get_db))
app.include_router(make_checkers_router(get_user, get_db))


# ---------- профиль ----------
class ThemeIn(BaseModel):
    theme: str


@app.post("/api/me/theme")
def set_theme(body: ThemeIn, user: User = Depends(get_user), db=Depends(get_db)):
    if body.theme not in THEMES:
        raise HTTPException(422, "Неизвестная тема")
    if body.theme not in owned_themes(db, user.id):
        raise HTTPException(403, "Эта тема ещё не получена")
    user.theme = body.theme
    db.commit()
    return {"ok": True}


@app.get("/api/me")
def me(user: User = Depends(get_user), db=Depends(get_db)):
    settle_due(db)
    daily = reward_visit(db, user.id)
    disc_equipment = equipment_state(db,user.id)
    db.commit()
    db.refresh(user)
    def count(*where, model):
        return db.scalar(select(func.count()).select_from(model).where(*where)) or 0

    return {
        "id": user.id, "first_name": user.first_name, "username": user.username, "role": user.role,
        "topics": count(Topic.user_id == user.id, Topic.deleted.is_(False), model=Topic),
        "comments": count(Comment.user_id == user.id, model=Comment),
        "votes": count(Vote.user_id == user.id, model=Vote),
        "rated": count(Topic.user_id == user.id, Topic.rated.is_(True), Topic.deleted.is_(False), model=Topic),
        "theme": user.theme or "dark", "jera": user.jera,
        "unread_notifications": count(Notification.user_id==user.id,Notification.read.is_(False),model=Notification),
        "owned_themes": sorted(owned_themes(db, user.id)), "theme_box_price": BOX_PRICE,
        "compensation_letters": list_letters(db, user.id),
        "disc_equipment": disc_equipment, "disc_gift": launch_gift_state(db,user.id), "theme_gifts": theme_gifts(db,user.id),
        "daily_reward": daily,
    }


@app.get("/api/tasks")
def daily_tasks(user: User = Depends(get_user), db=Depends(get_db)):
    from task_service import daily_task_state
    data=daily_task_state(db,user.id)
    db.commit()
    return data


@app.get("/api/achievements")
def achievements(user: User = Depends(get_user), db=Depends(get_db)):
    from activity_catalog import ACHIEVEMENTS
    return {**achievement_state(db,user.id),"items":[achievement_state(db,user.id,game) for game in ACHIEVEMENTS]}


@app.get("/api/admin/performance")
def admin_performance(admin: User = Depends(get_admin)):
    return {**performance_snapshot(),"cache":public_cache.stats()}


@app.get("/api/admin/accounting")
def accounting(days: int = 30, include_admins: bool = False, admin: User = Depends(get_admin)):
    if days not in (0,7,30,90):
        raise HTTPException(422,"Выбери период: 7, 30, 90 дней или всё время")
    from accounting_service import readonly_report
    return readonly_report(SessionLocal,days,include_admins)


@app.get("/api/hall-of-fame")
def hall_of_fame(user: User = Depends(get_user), db=Depends(get_db)):
    from database import TournamentAward
    rows=db.execute(select(TournamentAward,Tournament,User).join(Tournament,Tournament.id==TournamentAward.tournament_id)
        .join(User,User.id==TournamentAward.user_id).where(Tournament.status=="finished")
        .order_by(Tournament.ends_at.desc(),TournamentAward.place)).all()
    return {"winners":[{"tournament_id":event.id,"title":event.title,"game":event.game,
        "user_id":winner.id,"name":winner.first_name,"place":award.place,"amount":award.amount,
        "theme_id":award.theme_id,"ended_at":event.ends_at.isoformat()+"Z"} for award,event,winner in rows]}


@app.post("/api/me/compensation/{reset_id}/read")
def read_compensation(reset_id: str, user: User = Depends(get_user), db=Depends(get_db)):
    if not mark_read(db, user.id, reset_id):
        raise HTTPException(404, "Письмо не найдено")
    db.commit()
    return {"ok": True}


# ---------- турниры ----------
class TournamentCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    game: str = "dino"
    duration_hours: int = Field(default=48, ge=1, le=168)
    entry_fee: int = Field(default=0, ge=0, le=10000)


def tournament_response(db, event, user_id):
    data = event_state(db, event, user_id)
    data["balance"] = db.scalar(select(User.jera).where(User.id == user_id)) or 0
    if WEBAPP_URL:
        data["share_url"] = WEBAPP_URL.rstrip("/") + data["share_path"]
    return data


@app.get("/api/tournaments")
def tournaments(user: User = Depends(get_user), db=Depends(get_db)):
    data = list_events(db, user.id)
    db.commit()
    return data


@app.get("/api/tournaments/{event_id}")
def tournament_detail(event_id: str, user: User = Depends(get_user), db=Depends(get_db)):
    settle_due(db)
    try:
        data = tournament_response(db, get_event(db, event_id), user.id)
    except TournamentError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return data


@app.post("/api/tournaments/{event_id}/register")
def tournament_register(event_id: str, user: User = Depends(get_user), db=Depends(get_db)):
    try:
        register_tournament(db, event_id, user.id)
        data = tournament_response(db, get_event(db, event_id), user.id)
    except TournamentError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return data


class TournamentVoteIn(BaseModel):
    game: str


@app.post("/api/tournaments/{event_id}/vote")
def vote_next_tournament(event_id: str, body: TournamentVoteIn, user: User = Depends(get_user), db=Depends(get_db)):
    try:
        event = tournament_vote(db, event_id, user.id, body.game)
        data = tournament_response(db, event, user.id)
    except TournamentError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return data


@app.post("/api/admin/tournaments")
def tournament_create(body: TournamentCreateIn, admin: User = Depends(get_admin), db=Depends(get_db)):
    try:
        event = create_event(db, body.title, body.game, body.duration_hours, body.entry_fee)
        data = tournament_response(db, event, admin.id)
    except TournamentError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return data


@app.post("/api/admin/tournaments/{event_id}/start")
def tournament_start(event_id: str, admin: User = Depends(get_admin), db=Depends(get_db)):
    try:
        data = tournament_response(db, start_event(db, event_id), admin.id)
    except TournamentError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return data


@app.post("/api/admin/tournaments/{event_id}/cancel")
def tournament_cancel(event_id: str, admin: User = Depends(get_admin), db=Depends(get_db)):
    try:
        data = tournament_response(db, cancel_event(db, event_id), admin.id)
    except TournamentError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return data


# ---------- магазин ----------
class BuyThemeBoxIn(BaseModel):
    request_id: str = Field(min_length=1, max_length=64)


class UnlockThemeBoxIn(BaseModel):
    box_id: str = Field(min_length=1, max_length=40)
    runes: list[str] = Field(min_length=3, max_length=3)


@app.get("/api/shop")
def get_shop(user: User = Depends(get_user), db=Depends(get_db)):
    return shop_state(db, user.id)


@app.post("/api/shop/theme-box/buy")
def buy_theme_box(body: BuyThemeBoxIn, user: User = Depends(get_user), db=Depends(get_db)):
    try:
        result = buy_box(db, user.id, body.request_id)
        result["owned_themes"] = sorted(owned_themes(db, user.id))
    except ShopError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return result


@app.post("/api/shop/theme-box/unlock")
def unlock_theme_box(body: UnlockThemeBoxIn, user: User = Depends(get_user), db=Depends(get_db)):
    try:
        result = unlock_box(db, user.id, body.box_id, body.runes)
        result["shop"] = shop_state(db, user.id)
        result["owned_themes"] = result["shop"]["owned_themes"]
    except ShopError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return result


@app.post("/api/admin/shop/test-balance")
def admin_test_balance(body: BuyThemeBoxIn, admin: User = Depends(get_admin), db=Depends(get_db)):
    from shop_service import grant_test_balance
    try:
        result = grant_test_balance(db, admin.id, body.request_id)
    except ShopError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return result


# ---------- новости ----------

@app.get("/api/home")
def home(user: User = Depends(get_user), db=Depends(get_db)):
    from studio_service import event_summary
    from public_reads import home_snapshot
    data=cached_read(db,'home','news',30,lambda:home_snapshot(db))
    data['event']=cached_read(db,'studio_event','nearest',15,lambda:event_summary(db))
    if data['event']:
        data['event']['server_now']=datetime.utcnow().isoformat()+'Z'
        if data['event'].get('dino_tournament'):data['event']['dino_tournament']['server_now']=data['event']['server_now']
    return data



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


@app.get("/api/notifications/unread")
def unread_notifications(user: User = Depends(get_user), db=Depends(get_db)):
    return {"unread":db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id==user.id,Notification.read.is_(False))) or 0}


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

# Античит упрощён: бесплатный Render засыпает и перезапускается, а проверка по времени
# забега держалась в памяти процесса, из-за чего честные результаты отклонялись.
# Теперь только верхний потолок очков. Явных читеров удаляем вручную
# (DELETE /api/game/score/{user_id} или прямо в базе).
GAMES = {
    "drive": {"max": 100000},
    "dino": {"max": 20000},
    "flappy": {"max": 500},
    "snake": {"max": 3000},
    "tetris": {"max": 100000},
    "hell": {"max": 5000},
}
GAME_RUNS: dict[tuple[int, str], float] = {}  # оставлено, чтобы /game/start не ломал старый фронт


def check_game(game: str) -> str:
    if game not in GAMES:
        raise HTTPException(422, "Неизвестная игра")
    return game


class StartIn(BaseModel):
    game: str = "dino"


class ScoreIn(BaseModel):
    run_id: Optional[str] = Field(default=None, max_length=40)
    game: str = "dino"
    score: int = Field(ge=0, le=100000)


@app.post("/api/game/start")
def game_start(body: Optional[StartIn] = None, user: User = Depends(get_user), db=Depends(get_db)):
    game = check_game(body.game if body else "dino")
    try:
        run = begin_run(db, user.id, game)
    except ScoreError as error:
        raise HTTPException(error.status, str(error))
    db.commit()
    return {"ok": True, "run_id": run.id}



@app.post("/api/game/score")
def game_score(body: ScoreIn, bg: BackgroundTasks, user: User = Depends(get_user), db=Depends(get_db)):
    game = check_game(body.game)
    ensure_period(db, bg)
    GAME_RUNS.pop((user.id, game), None)  # старт больше не обязателен
    if body.score > GAMES[game]["max"]:
        raise HTTPException(422, "Подозрительный результат")

    earned_before = achievement_state(db,user.id)["total_earned"] if game == "dino" else 0
    try:
        row, old, record = submit_result(db, user.id, game, body.score, run_id=body.run_id)
        from task_service import daily_task_state
        daily_task_state(db,user.id)
    except ScoreError as error:
        raise HTTPException(error.status, str(error))
    if record:
        if old > 0:
            # кого обогнали
            beaten = db.scalars(
                select(GameScore.user_id)
                .where(
                    GameScore.game == game,
                    GameScore.best > old,
                    GameScore.best < body.score,
                    GameScore.user_id != user.id,
                )
                .order_by(GameScore.best.desc())
                .limit(3)
            ).all()
            for uid in beaten:
                notify_game_beaten(db, bg, uid, user.first_name, body.score, user.id)

    rank = 1 + (db.scalar(
        select(func.count()).select_from(GameScore)
        .where(GameScore.game == game, GameScore.best > row.best)
    ) or 0)
    response = {"best": row.best, "record": record, "rank": rank}
    if game == "dino":
        response["achievement_reward"] = achievement_state(db,user.id)["total_earned"]-earned_before
    db.commit()
    return response

@app.delete("/api/game/score/{user_id}")
def delete_score(user_id: int, game: Optional[str] = None,
                 admin: User = Depends(get_admin), db=Depends(get_db)):
    """Удаляет рекорды читера: все игры или одну (?game=dino). Только для админов."""
    invalidate_scores(db, user_id, check_game(game) if game else None)
    db.commit()
    return {"ok": True}


@app.get("/api/game/top")
def game_top(bg: BackgroundTasks, game: str = "dino", scope: Literal["week", "all", "tournament"] = "week",
             tournament_id: Optional[str] = None,
             user: User = Depends(get_user), db=Depends(get_db)):
    game = check_game(game)
    ensure_period(db, bg, fast_if_current=True)
    event = None
    if scope == "tournament":
        event = db.get(Tournament, tournament_id) if tournament_id else None
        if not event or event.game != game or event.cancelled:
            raise HTTPException(404, "Турнир не найден")
        M, condition, order = TournamentScore, TournamentScore.tournament_id == event.id, TournamentScore.achieved_at
    else:
        M = AllTimeScore if scope == "all" else GameScore
        condition = M.game == game
        order = M.achieved_at if scope == "all" else M.updated_at
    from public_reads import leaderboard_snapshot
    key=(scope,game,event.id if event else '',period_now() if scope=='week' else '')
    top=cached_read(db,'leaders',key,15,lambda:leaderboard_snapshot(db,M,condition,order,scope=='tournament'))
    mine = db.scalar(select(M).where(M.user_id == user.id, condition))
    rank = None
    if mine and mine.best > 0:
        higher = M.best > mine.best
        if scope == "tournament":
            higher = or_(higher, and_(M.best == mine.best, or_(
                M.achieved_at < mine.achieved_at,
                and_(M.achieved_at == mine.achieved_at, M.user_id < user.id))))
        rank = 1 + (db.scalar(select(func.count()).select_from(M)
                    .where(condition, higher)) or 0)
    response = {
        "top": top, "my_best": mine.best if mine else 0, "my_rank": rank,
        "ends_at": iso(event.ends_at) if event else iso(week_ends_at()) if scope == "week" else None,
    }
    db.commit()  # includes a possible weekly rollover, in the same transaction
    return response



class RecordsMaintenanceIn(BaseModel):
    enabled: bool


class RecordsResetIn(BaseModel):
    archive_hash: str = Field(min_length=64, max_length=64)


@app.get("/api/admin/records/status")
def records_status(admin: User = Depends(get_admin), db=Depends(get_db)):
    maintenance = db.scalar(select(Meta.value).where(Meta.key == "score_maintenance")) == "1"
    applied = db.get(RecordReset, RESET_ID) is not None
    plan = None
    if maintenance and not applied:
        lock_scores(db)
        plan = saved_preview(db)
        db.commit()
    return {"maintenance": maintenance, "applied": applied, "plan": plan}


@app.post("/api/admin/records/maintenance")
def records_maintenance(body: RecordsMaintenanceIn, admin: User = Depends(get_admin), db=Depends(get_db)):
    lock_scores(db)
    was_closed = db.scalar(select(Meta.value).where(Meta.key == "score_maintenance")) == "1"
    settle_due(db)
    if body.enabled and db.scalar(select(Tournament.id).where(Tournament.cancelled.is_(False), Tournament.status.in_(["registration", "active"])).limit(1)):
        raise HTTPException(409, "Сначала заверши или отмени текущий турнир")
    db.merge(Meta(key="score_maintenance", value="1" if body.enabled else "0"))
    db.flush()
    plan = saved_preview(db, refresh=not was_closed) if body.enabled and not db.get(RecordReset, RESET_ID) else None
    db.commit()
    return {"ok": True, "maintenance": body.enabled, "plan": plan}


@app.get("/api/admin/records/reset-preview")
def records_preview(admin: User = Depends(get_admin), db=Depends(get_db)):
    lock_scores(db)
    if db.get(RecordReset, RESET_ID):
        raise HTTPException(409, "Однократный сброс уже выполнен")
    plan = saved_preview(db, refresh=True)
    db.commit()
    return plan


@app.post("/api/admin/records/reset-apply")
def records_apply(body: RecordsResetIn, admin: User = Depends(get_admin), db=Depends(get_db)):
    lock_scores(db)
    if db.get(RecordReset, RESET_ID):
        return {"already_applied": True, "reset_id": RESET_ID}
    plan = reset_preview(db)
    if plan["archive_hash"] != body.archive_hash:
        raise HTTPException(409, "Данные изменились. Обнови расчёт перед сбросом.")
    try:
        result = apply_record_reset(db, plan)
    except ValueError as error:
        raise HTTPException(409, str(error))
    db.commit()
    return result


# ---------- Telegram ----------

@app.post("/webhook")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != WEBHOOK_SECRET:
        raise HTTPException(403)
    raw=await request.json()
    if "widget_query" in raw:
        from widget_bot import handle_widget_query
        background_tasks.add_task(handle_widget_query,bot,SessionLocal,raw["widget_query"])
        return {"ok": True}
    update = Update.model_validate(raw, context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}


@app.get("/s/{ref}", response_class=HTMLResponse)
def share_page(ref: str, db=Depends(get_db)):
    if not re.fullmatch(r"[tn]\d+|game_[a-z0-9_]+", ref):
        raise HTTPException(404)

    title, desc = "YAB STUDIO", "Открой в мини-приложении"

    if ref[0] == "t":
        t = db.get(Topic, int(ref[1:]))
        if t and not t.deleted:
            author = db.get(User, t.user_id)
            votes = db.scalar(
                select(func.count()).select_from(Vote)
                .where(Vote.idea_id == t.id)
            ) or 0
            replies = db.scalar(
                select(func.count()).select_from(Comment)
                .where(Comment.ref_type == "topic", Comment.ref_id == t.id)
            ) or 0

            title = f"{t.category}: {t.title}"
            head = (
                f"{author.first_name} · ▲ {votes} · ответов {replies}"
                if author else f"▲ {votes} · ответов {replies}"
            )
            body = " ".join((t.text or "").split())
            desc = f"{head}. {body}"[:200]

    elif ref[0] == "n":
        p = db.get(Post, int(ref[1:]))
        if p:
            title = p.title
            desc = " ".join((p.text or "").split())[:200] or "Новость YAB STUDIO"

    elif ref.startswith("game_chess"):
        title = "Сыграем партию в шахматы?"
        desc = "Прими вызов в YAB STUDIO"

    elif ref.startswith("game_checkers"):
        title = "Сыграем партию в шашки?"
        desc = "Прими вызов в YAB STUDIO"

    else:
        names = {
            "dino": "Дино",
            "flappy": "Flappy",
            "snake": "Змейка",
            "tetris": "Тетрис",
            "hell": "Ад",
            "drive": "После полуночи",
        }
        g = names.get(ref[5:], "игре")
        title = f"Сможешь побить мой рекорд в «{g}»?"
        desc = "Заходи в игру в YAB STUDIO"

    target = f"{TG_APP_LINK}?startapp={ref}"
    img = f"{WEBAPP_URL}/og.png"
    e = escape

    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>{e(title)}</title>
<meta property="og:site_name" content="YAB STUDIO">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
</head>
<body>
<script>location.replace({target!r})</script>
<a href="{e(target)}">Открыть</a>
</body>
</html>"""


# Public HTML for Telegram's link preview crawler; no login required.
@app.get("/tournaments/{event_id}", response_class=HTMLResponse)
def tournament_share_page(event_id: str, db=Depends(get_db)):
    try:
        event = get_event(db, event_id)
    except TournamentError:
        raise HTTPException(404, "Турнир не найден")
    names = {"dino":"Дино", "flappy":"Flappy", "snake":"Змейка", "tetris":"Тетрис", "hell":"Ад", "drive":"После полуночи"}
    game_name = names.get(event.game, event.game)
    fee = "Участие бесплатно" if event.entry_fee == 0 else f"Взнос {event.entry_fee} Йер"
    state = "Регистрация открыта" if event.status == "registration" else "Турнир идёт" if event.status == "active" and event.ends_at > datetime.utcnow() else "Турнир отменён" if event.cancelled else "Турнир завершён"
    title = event.title
    description = f"{state} · {game_name} · {event.duration_hours} ч · {fee}. 1 место — мифическая тема «Какашечки», 2–5 — Йера."
    base = (WEBAPP_URL or "").rstrip("/")
    image = base + "/tournament-" + event.game + ".png"
    url = base + "/tournaments/" + event.id
    target = TG_APP_LINK + "?startapp=tour_" + event.id
    e = escape
    return f'''<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)}</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="YAB STUDIO">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{e(url, quote=True)}"><meta property="og:image" content="{e(image, quote=True)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"></head>
<body style="margin:0;background:#101713;color:#f3efd6;font:17px system-ui">
<main style="max-width:700px;margin:40px auto;padding:24px">
<img src="{e(image, quote=True)}" alt="Турнир YAB STUDIO" style="width:100%;border-radius:16px">
<h1>{e(title)}</h1><p>{e(description)}</p>
<p>Засчитывается лучший результат зарегистрированного участника. При равных очках выше тот, кто достиг результата раньше.</p>
<a href="{e(target, quote=True)}" style="display:inline-block;padding:16px 24px;border-radius:12px;background:#edbe63;color:#24170f;text-decoration:none;font-weight:bold">Открыть турнир в Telegram</a>
</main></body></html>'''





@app.post('/api/shop/gift/{gift_id}/{action}')
def theme_usb_action(gift_id:str,action:str,user:User=Depends(get_user),db=Depends(get_db)):
    if action not in ('claim','activate'):raise HTTPException(404,'Неизвестное действие')
    try:
        value=update_theme_gift(db,user.id,gift_id,action=='activate');db.commit();return value
    except ShopError as error:
        db.rollback();raise HTTPException(error.status,str(error))


# статику монтируем последней, иначе она перекроет маршруты выше
app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")
