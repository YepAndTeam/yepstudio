from datetime import date, datetime, timedelta

from sqlalchemy import delete, select, update
from database import AllTimeScore, GameScore, JeraTx, Meta, User, WeeklyResult
from score_service import lock_scores, promote_alltime

EPOCH = date(2026, 11, 9)
NAMES = {"dino": "Дино", "flappy": "Flappy", "snake": "Змейка", "tetris": "Тетрис", "hell": "Ад"}


def period_now(now=None):
    return ((now or datetime.utcnow()).date() - EPOCH).days // 7


def week_ends_at():
    start = EPOCH + timedelta(days=(period_now() + 1) * 7)
    return datetime(start.year, start.month, start.day)


def prize_for(place):
    if place == 1: return 100
    if place <= 3: return 50
    if place <= 10: return 20
    return 0


def grant(db, user_id, amount, reason):
    db.execute(update(User).where(User.id == user_id).values(jera=User.jera + amount))
    db.add(JeraTx(user_id=user_id, amount=amount, reason=reason))


def ensure_period(db, bg=None, fast_if_current=False):
    """No internal commit: closure and the next game stay in one transaction."""
    if fast_if_current:
        current=db.scalar(select(Meta.value).where(Meta.key=='period'))
        if current is not None and int(current)==period_now():return
    lock_scores(db)
    if db.scalar(select(Meta.value).where(Meta.key == "score_maintenance")) == "1":
        return
    cur = period_now()
    old = db.scalar(select(Meta.value).where(Meta.key == "period"))
    if old is None:
        db.add(Meta(key="period", value=str(cur)))
        db.flush()
        return
    if int(old) == cur:
        return
    if int(old) > cur:
        raise RuntimeError("Server clock moved before the current score period")
    for game in NAMES:
        rows = db.scalars(select(GameScore).where(GameScore.game == game, GameScore.best > 0)
            .order_by(GameScore.best.desc(), GameScore.updated_at, GameScore.user_id)).all()
        place, last = 0, None
        for index, row in enumerate(rows, 1):
            if row.best != last:
                place, last = index, row.best
            db.add(WeeklyResult(period=int(old), game=game, user_id=row.user_id, best=row.best, place=place))
            promote_alltime(db, row.user_id, game, row.best, row.updated_at)
            amount = prize_for(place)
            if amount:
                grant(db, row.user_id, amount, f"week{old}:{game}:{place}")
                # Preserve the existing, explicitly configured notification path.
                if bg is not None:
                    from notify import add_notification
                    add_notification(db, bg, row.user_id, "game",
                        f"Неделя закрыта: {place} место в «{NAMES[game]}», +{amount} ᛃ",
                        ref="game", actor_id=None)
    db.execute(delete(GameScore))
    db.execute(update(Meta).where(Meta.key == "period").values(value=str(cur)))
    db.flush()
