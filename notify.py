import logging
from typing import Optional

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from fastapi import BackgroundTasks

from bot import WEBAPP_URL, bot
from database import Notification, User

log = logging.getLogger(__name__)


def short(s: str, n: int = 60) -> str:
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[: n - 1] + "…"


async def tg_push(user_id: int, text: str, ref: Optional[str] = None):
    """Пуш в Telegram. Никогда не бросает исключений наружу."""
    kb = None
    if WEBAPP_URL:
        url = WEBAPP_URL + (f"?ref={ref}" if ref else "")
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="Открыть", web_app=WebAppInfo(url=url))
        ]])
    try:
        await bot.send_message(user_id, text, reply_markup=kb)
    except Exception as e:
        log.warning("push %s failed: %r", user_id, e)


def add_notification(
    db,
    bg: BackgroundTasks,
    user_id: int,
    kind: str,
    text: str,
    ref: Optional[str] = None,
    actor_id: Optional[int] = None,
):
    """Кладёт уведомление в ленту и (если не отключено) шлёт пуш.
    Коммит делает вызывающий код. actor_id: себе не уведомляем."""
    if user_id == actor_id:
        return
    u = db.get(User, user_id)
    if not u:
        return
    db.add(Notification(user_id=user_id, kind=kind, text=text[:300], ref=ref))
    if u.notify:
        bg.add_task(tg_push, user_id, text, ref)


def notify_game_beaten(db, bg: BackgroundTasks, beaten_id: int, by_name: str, score: int, by_id: int):
    """Заготовка для игры: вызовем, когда кто-то побьёт чужой рекорд."""
    add_notification(
        db, bg, beaten_id, "game",
        f"{by_name} обогнал тебя в игре: {score}. Вернёшь первое место?",
        ref="game", actor_id=by_id
    )