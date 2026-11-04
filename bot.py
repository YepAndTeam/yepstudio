import os
from pathlib import Path

from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from dotenv import load_dotenv

import os
from pathlib import Path

from aiogram import Bot, Dispatcher
from aiogram.filters import Command, CommandObject, CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
from dotenv import load_dotenv
from sqlalchemy import select

from auth import ADMIN_IDS
from database import Post, Project, SessionLocal, User

load_dotenv(Path(__file__).parent / ".env")
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL") or os.getenv("RENDER_EXTERNAL_URL")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()

PROJECT_STATUSES = ("new", "planned", "in_progress", "done")


def is_admin(user_id: int) -> bool:
    if user_id in ADMIN_IDS:
        return True
    with SessionLocal() as db:
        u = db.get(User, user_id)
        return bool(u and u.role == "admin")


@dp.message(CommandStart())
async def start(message: Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Открыть YAB STUDIO", web_app=WebAppInfo(url=WEBAPP_URL))
    ]])
    await message.answer(
        "Привет! Здесь новости студии, форум с идеями и голосованием.",
        reply_markup=kb,
    )


@dp.message(Command("news"))
async def news(message: Message, command: CommandObject):
    """/news Заголовок | Текст новости. Только для админов."""
    if not message.from_user or not is_admin(message.from_user.id):
        return
    parts = [p.strip() for p in (command.args or "").split("|", 1)]
    if len(parts) != 2 or not parts[0] or not parts[1]:
        await message.answer("Формат: /news Заголовок | Текст новости")
        return
    with SessionLocal() as db:
        db.add(Post(title=parts[0][:200], text=parts[1][:2000]))
        db.commit()
    await message.answer("Новость опубликована.")


@dp.message(Command("project"))
async def project(message: Message, command: CommandObject):
    """/project Название | статус | этап. Создаёт проект или обновляет существующий."""
    if not message.from_user or not is_admin(message.from_user.id):
        return
    parts = [p.strip() for p in (command.args or "").split("|")]
    ok = len(parts) == 3 and parts[0] and parts[1] in PROJECT_STATUSES and parts[2].isdigit() and 0 <= int(parts[2]) <= 4
    if not ok:
        await message.answer(
            "Формат: /project Название | статус | этап\n"
            "Статус: new, planned, in_progress, done\n"
            "Этап: число от 0 до 4\n"
            "Пример: /project Основная игра | in_progress | 3"
        )
        return
    name, status, stage = parts[0][:100], parts[1], int(parts[2])
    with SessionLocal() as db:
        p = db.scalar(select(Project).where(Project.name == name))
        if p:
            p.status, p.stage = status, stage
        else:
            db.add(Project(name=name, status=status, stage=stage))
        db.commit()
    await message.answer("Проект сохранён.")