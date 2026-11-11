import random
from datetime import datetime
from typing import Optional

import chess
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select

import presence
from chess_models import ChessGame
from database import User
from notify import add_notification

KIND = "chess"


def iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() + "Z" if dt else None


class CreateIn(BaseModel):
    color: str = "random"  # white / black / random


class MoveIn(BaseModel):
    uci: str  # например "e2e4" или "e7e8q" для превращения


def make_router(get_user, get_db):
    r = APIRouter(prefix="/api/chess")

    def get_game(db, game_id: int) -> ChessGame:
        g = db.get(ChessGame, game_id)
        if not g or g.status == "cancelled":
            raise HTTPException(404, "Партия не найдена")
        return g

    def replay(g):
        """Собирает доску из списка ходов (так учитываются повторы позиции и правило 50 ходов)."""
        board = chess.Board()
        san = []
        for u in g.moves.split():
            m = chess.Move.from_uci(u)
            san.append(board.san(m))
            board.push(m)
        return board, san

    def name_of(db, uid):
        if not uid:
            return None
        return db.scalar(select(User.first_name).where(User.id == uid))

    def my_color(g, user):
        if g.white_id == user.id:
            return "w"
        if g.black_id == user.id:
            return "b"
        return None

    def full(db, g, user):
        board, san = replay(g)
        my = my_color(g, user)
        turn = "w" if board.turn else "b"
        if my:
            presence.touch(KIND, g.id, user.id)  # игрок сейчас в партии
        opp_id = g.black_id if my == "w" else g.white_id if my == "b" else None
        opp_away = bool(g.status == "active" and opp_id and presence.is_away(KIND, g.id, opp_id))
        legal = []
        if g.status == "active" and my == turn:
            legal = [m.uci() for m in board.legal_moves]
        moves = g.moves.split()
        return {
            "id": g.id, "status": g.status, "result": g.result, "reason": g.reason,
            "fen": board.fen(), "turn": turn, "my": my, "check": board.is_check(),
            "white": {"id": g.white_id, "name": name_of(db, g.white_id)},
            "black": {"id": g.black_id, "name": name_of(db, g.black_id)},
            "creator_id": g.creator_id,
            "moves": san, "last": moves[-1] if moves else None,
            "legal": legal, "updated_at": iso(g.updated_at),
            "opp_away": opp_away,
        }

    def brief(db, g, user):
        my = my_color(g, user)
        n = len(g.moves.split())
        opp_id = g.black_id if my == "w" else g.white_id if my == "b" else (g.white_id or g.black_id)
        return {
            "id": g.id, "status": g.status, "result": g.result, "my": my,
            "turn": "w" if n % 2 == 0 else "b", "moves": n,
            "opponent": name_of(db, opp_id), "creator_id": g.creator_id,
            "creator": name_of(db, g.creator_id),
            "white_name": name_of(db,g.white_id), "black_name": name_of(db,g.black_id),
            "updated_at": iso(g.updated_at),
        }

    @r.get("")
    def list_games(user: User = Depends(get_user), db=Depends(get_db)):
        mine = db.scalars(
            select(ChessGame)
            .where(or_(ChessGame.white_id == user.id, ChessGame.black_id == user.id),
                   ChessGame.status != "cancelled")
            .order_by(ChessGame.updated_at.desc()).limit(30)
        ).all()
        lobby = db.scalars(
            select(ChessGame)
            .where(ChessGame.status == "open", ChessGame.creator_id != user.id)
            .order_by(ChessGame.id.desc()).limit(20)
        ).all()
        live=db.scalars(select(ChessGame).where(ChessGame.status=="active",ChessGame.white_id!=user.id,ChessGame.black_id!=user.id).order_by(ChessGame.updated_at.desc()).limit(20)).all()
        return {"mine": [brief(db, g, user) for g in mine],
                "lobby": [brief(db, g, user) for g in lobby], "live":[brief(db,g,user) for g in live]}

    @r.post("")
    def create(body: CreateIn, user: User = Depends(get_user), db=Depends(get_db)):
        if body.color not in ("white", "black", "random"):
            raise HTTPException(422, "Неизвестный цвет")
        opened = db.scalars(select(ChessGame).where(
            ChessGame.creator_id == user.id, ChessGame.status == "open")).all()
        if len(opened) >= 3:
            raise HTTPException(422, "Уже есть 3 открытых вызова. Отмени лишние.")
        color = body.color if body.color != "random" else random.choice(["white", "black"])
        g = ChessGame(creator_id=user.id, status="open")
        if color == "white":
            g.white_id = user.id
        else:
            g.black_id = user.id
        db.add(g)
        db.commit()
        return {"id": g.id}

    @r.get("/{game_id}")
    def state(game_id: int, user: User = Depends(get_user), db=Depends(get_db)):
        return full(db, get_game(db, game_id), user)

    @r.post("/{game_id}/join")
    def join(game_id: int, user: User = Depends(get_user), db=Depends(get_db)):
        g = get_game(db, game_id)
        if g.status != "open":
            raise HTTPException(409, "Партия уже началась или закрыта")
        if g.creator_id == user.id:
            raise HTTPException(422, "Нельзя играть с самим собой")
        if g.white_id is None:
            g.white_id = user.id
        else:
            g.black_id = user.id
        g.status = "active"
        g.updated_at = datetime.utcnow()
        db.commit()
        return full(db, g, user)

    @r.post("/{game_id}/cancel")
    def cancel(game_id: int, user: User = Depends(get_user), db=Depends(get_db)):
        g = get_game(db, game_id)
        if g.creator_id != user.id or g.status != "open":
            raise HTTPException(403, "Отменить можно только свой открытый вызов")
        g.status = "cancelled"
        db.commit()
        return {"ok": True}

    @r.post("/{game_id}/move")
    def move(game_id: int, body: MoveIn, user: User = Depends(get_user), db=Depends(get_db)):
        g = get_game(db, game_id)
        if g.status != "active":
            raise HTTPException(409, "Партия не идёт")
        board, _ = replay(g)
        my = my_color(g, user)
        if my is None:
            raise HTTPException(403, "Ты не участник этой партии")
        if (my == "w") != board.turn:
            raise HTTPException(409, "Сейчас не твой ход")
        try:
            m = chess.Move.from_uci(body.uci.strip().lower())
        except ValueError:
            raise HTTPException(422, "Неверный формат хода")
        if m not in board.legal_moves:
            raise HTTPException(422, "Недопустимый ход")
        board.push(m)
        g.moves = (g.moves + " " + m.uci()).strip()
        g.updated_at = datetime.utcnow()
        outcome = board.outcome(claim_draw=True)
        if outcome:
            g.status = "finished"
            g.result = outcome.result()
            g.reason = outcome.termination.name.lower()
        db.commit()
        return full(db, g, user)

    @r.post("/{game_id}/resign")
    def resign(game_id: int, user: User = Depends(get_user), db=Depends(get_db)):
        g = get_game(db, game_id)
        my = my_color(g, user)
        if g.status != "active" or my is None:
            raise HTTPException(409, "Сдаться нельзя")
        g.status = "finished"
        g.result = "0-1" if my == "w" else "1-0"
        g.reason = "resign"
        g.updated_at = datetime.utcnow()
        db.commit()
        return full(db, g, user)

    @r.post("/{game_id}/call")
    def call(game_id: int, bg: BackgroundTasks, user: User = Depends(get_user), db=Depends(get_db)):
        """Позвать соперника, который ушёл: уведомление в ленту + пуш в Telegram."""
        g = get_game(db, game_id)
        my = my_color(g, user)
        if g.status != "active" or my is None:
            raise HTTPException(409, "Позвать нельзя")
        board, _ = replay(g)
        if my == ("w" if board.turn else "b"):
            raise HTTPException(409, "Сейчас твой ход")
        opp_id = g.black_id if my == "w" else g.white_id
        if not presence.is_away(KIND, g.id, opp_id):
            raise HTTPException(409, "Соперник сейчас в партии")
        wait = presence.call_wait(KIND, g.id)
        if wait:
            raise HTTPException(429, f"Уже звал. Повтори через {wait} с")
        add_notification(
            db, bg, opp_id, "game",
            f"{user.first_name} ждёт твой ход в шахматах",
            ref=f"game_chess_{g.id}", actor_id=user.id,
        )
        presence.mark_called(KIND, g.id)
        db.commit()
        return {"ok": True}

    return r