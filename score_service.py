"""One transaction updates the accepted-game ledger and every matching ranking."""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select, update, delete
from database import (AllTimeScore, GameScore, GameResult, GameRun, Meta, Tournament,
                      TournamentResult, TournamentScore, TournamentEntry)


def initialize_score_state(SessionLocal):
    from weekly import period_now
    with SessionLocal.begin() as db:
        for key, value in (("score_write_lock", "1"), ("score_epoch", "initial"),
                           ("period", str(period_now())), ("score_storage_version", "2"),
                           ("score_maintenance", "0")):
            # Both supported databases implement ON CONFLICT; safe across workers.
            dialect = db.bind.dialect.name
            if dialect == "postgresql":
                from sqlalchemy.dialects.postgresql import insert
            elif dialect == "sqlite":
                from sqlalchemy.dialects.sqlite import insert
            else:
                raise RuntimeError("Score storage requires PostgreSQL or SQLite")
            db.execute(insert(Meta).values(key=key, value=value).on_conflict_do_nothing(index_elements=["key"]))


def lock_scores(db):
    """Serialize score writes, period rollover, moderation and reset across workers."""
    result = db.execute(update(Meta).where(Meta.key == "score_write_lock").values(value=Meta.value))
    if result.rowcount != 1:
        raise RuntimeError("Score state is not initialized")


def promote_alltime(db, user_id, game, score, achieved_at):
    row = db.scalar(select(AllTimeScore).where(AllTimeScore.user_id == user_id, AllTimeScore.game == game))
    if row is None:
        row = AllTimeScore(user_id=user_id, game=game, best=score, achieved_at=achieved_at)
        db.add(row)
    elif score > row.best:
        row.best, row.achieved_at = score, achieved_at
    return row


class ScoreError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def check_available(db):
    if db.scalar(select(Meta.value).where(Meta.key == "score_maintenance")) == "1":
        raise ScoreError(503, "Рекорды обновляются. Попробуй начать игру немного позже.")


def begin_run(db, user_id, game, now=None):
    lock_scores(db)
    check_available(db)
    epoch = db.scalar(select(Meta.value).where(Meta.key == "score_epoch")) or "initial"
    row = GameRun(id=uuid4().hex, user_id=user_id, game=game, epoch=epoch, started_at=now or datetime.utcnow())
    db.add(row)
    db.flush()
    return row


def submit_result(db, user_id, game, score, now=None, run_id=None):
    from weekly import period_now
    lock_scores(db)
    check_available(db)
    now = now or datetime.utcnow()
    epoch = db.scalar(select(Meta.value).where(Meta.key == "score_epoch")) or "initial"
    from disc_models import DiscRun
    if run_id and db.get(DiscRun,run_id):raise ScoreError(409,'Забег с диском нельзя отправить в общую таблицу')
    run = db.get(GameRun, run_id) if run_id else None
    if run_id and (not run or run.user_id != user_id or run.game != game):
        raise ScoreError(409, "Забег не найден. Начни новую игру.")
    if (run and run.epoch != epoch) or (not run and epoch != "initial"):
        raise ScoreError(409, "Таблица рекордов обновлена. Начни новую игру.")
    if run:
        previous = db.scalar(select(GameResult).where(GameResult.run_id == run.id))
        if previous:
            if not previous.valid or previous.score != score or previous.period != period_now(now):
                raise ScoreError(409, "Этот забег уже завершён.")
            weekly = db.scalar(select(GameScore).where(GameScore.user_id == user_id, GameScore.game == game))
            if weekly is None:
                raise ScoreError(409, "Начни новую игру.")
            return weekly, weekly.best, False
    row = db.scalar(select(GameScore).where(GameScore.user_id == user_id, GameScore.game == game))
    old = row.best if row else 0
    if row is None:
        row = GameScore(user_id=user_id, game=game, best=0, plays=0, updated_at=now)
        db.add(row)
    row.plays += 1
    record = score > old
    if record:
        row.best, row.updated_at = score, now
    # Independent of a weekly record. Also repairs a missing all-time cache from
    # a higher existing weekly best, without lowering any historical record.
    promote_alltime(db, user_id, game, row.best, row.updated_at)
    result = GameResult(user_id=user_id, game=game, score=score, submitted_at=now,
                        period=period_now(now), epoch=epoch, valid=True, run_id=run_id)
    db.add(result)
    db.flush()
    events = db.scalars(select(Tournament).where(
        Tournament.game == game, Tournament.cancelled.is_(False), Tournament.status == "active",
        Tournament.starts_at <= (run.started_at if run else now), Tournament.ends_at > now,
    )).all()
    for event in events:
        # Registration must precede the server-issued run, not just its score.
        entry = db.get(TournamentEntry, (event.id, user_id))
        if not run or not entry or entry.joined_at > run.started_at:
            continue
        if game == "dino" and score > max(0, (now-run.started_at).total_seconds())*10+50:
            raise ScoreError(422, "Результат Dino не соответствует длительности забега")
        db.add(TournamentResult(result_id=result.id, tournament_id=event.id))
        best = db.scalar(select(TournamentScore).where(
            TournamentScore.tournament_id == event.id, TournamentScore.user_id == user_id))
        if best is None:
            db.add(TournamentScore(tournament_id=event.id, user_id=user_id, best=score, achieved_at=now))
        elif score > best.best:
            best.best, best.achieved_at = score, now
    from achievement_service import accept_achievement
    accept_achievement(db,user_id,game,score,run,now)
    db.flush()
    return row, old, record


def invalidate_scores(db, user_id, game=None):
    lock_scores(db)
    for model in (GameScore, AllTimeScore):
        stmt = delete(model).where(model.user_id == user_id)
        if game:
            stmt = stmt.where(model.game == game)
        db.execute(stmt)
    stmt = update(GameResult).where(GameResult.user_id == user_id).values(valid=False)
    if game:
        stmt = stmt.where(GameResult.game == game)
    db.execute(stmt)
    stmt = delete(TournamentScore).where(TournamentScore.user_id == user_id)
    if game:
        stmt = stmt.where(TournamentScore.tournament_id.in_(select(Tournament.id).where(Tournament.game == game)))
    db.execute(stmt)
