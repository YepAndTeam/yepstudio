import os
from contextlib import asynccontextmanager
from pathlib import Path

from aiogram.types import MenuButtonWebApp, Update, WebAppInfo
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from auth import validate_init_data
from bot import WEBAPP_URL, bot, dp
from database import Base, Idea, SessionLocal, User, Vote, engine

load_dotenv(Path(__file__).parent / ".env")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "change-me")

Base.metadata.create_all(engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if WEBAPP_URL:  # локально без ссылки просто пропускаем
        await bot.set_webhook(f"{WEBAPP_URL}/webhook", secret_token=WEBHOOK_SECRET)
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="Идеи", web_app=WebAppInfo(url=WEBAPP_URL))
        )
    yield
    await bot.session.close()


app = FastAPI(lifespan=lifespan)


def get_db():
    with SessionLocal() as db:
        yield db


def get_user(x_init_data: str = Header(), db=Depends(get_db)) -> User:
    data = validate_init_data(x_init_data)
    if not data:
        raise HTTPException(401, "Bad initData")
    tg = data["user"]
    user = db.get(User, tg["id"])
    if not user:
        user = User(id=tg["id"], first_name=tg.get("first_name", "?"), username=tg.get("username"))
        db.add(user)
        db.commit()
    return user


class IdeaIn(BaseModel):
    text: str = Field(min_length=3, max_length=1000)


@app.get("/api/ideas")
def list_ideas(user: User = Depends(get_user), db=Depends(get_db)):
    votes = func.count(Vote.id)
    rows = db.execute(
        select(Idea, User.first_name, votes)
        .join(User, User.id == Idea.user_id)
        .outerjoin(Vote, Vote.idea_id == Idea.id)
        .group_by(Idea.id, User.first_name)
        .order_by(votes.desc(), Idea.created_at.desc())
    ).all()
    my_votes = set(db.scalars(select(Vote.idea_id).where(Vote.user_id == user.id)))
    return [
        {"id": i.id, "text": i.text, "status": i.status, "author": name,
         "votes": v, "voted": i.id in my_votes}
        for i, name, v in rows
    ]


@app.post("/api/ideas")
def add_idea(body: IdeaIn, user: User = Depends(get_user), db=Depends(get_db)):
    db.add(Idea(user_id=user.id, text=body.text.strip()))
    db.commit()
    return {"ok": True}


@app.post("/api/ideas/{idea_id}/vote")
def toggle_vote(idea_id: int, user: User = Depends(get_user), db=Depends(get_db)):
    if not db.get(Idea, idea_id):
        raise HTTPException(404)
    vote = db.scalar(select(Vote).where(Vote.idea_id == idea_id, Vote.user_id == user.id))
    if vote:
        db.delete(vote)
    else:
        db.add(Vote(idea_id=idea_id, user_id=user.id))
    db.commit()
    return {"ok": True}


@app.post("/webhook")
async def webhook(request: Request):
    if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != WEBHOOK_SECRET:
        raise HTTPException(403)
    update = Update.model_validate(await request.json(), context={"bot": bot})
    await dp.feed_update(bot, update)
    return {"ok": True}


# статику монтируем последней, иначе она перекроет маршруты выше
app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")