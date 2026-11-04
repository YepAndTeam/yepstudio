import os
from pathlib import Path

from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL") or os.getenv("RENDER_EXTERNAL_URL")

bot = Bot(BOT_TOKEN)
dp = Dispatcher()


@dp.message(CommandStart())
async def start(message: Message):
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💡 Предложить идею", web_app=WebAppInfo(url=WEBAPP_URL))
    ]])
    await message.answer(
        "Привет! Здесь можно накидать идеи для игры и проголосовать за чужие.",
        reply_markup=kb,
    )