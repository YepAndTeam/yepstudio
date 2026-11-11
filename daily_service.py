"""One visit reward per Kazakhstan calendar day, serialized with wallet writes."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from database import DailyVisit
from score_service import lock_scores
from weekly import grant

KZ = timezone(timedelta(hours=5))

def reward_visit(db, user_id, now=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    local = now.astimezone(KZ)
    today = local.date()
    row = db.get(DailyVisit, (user_id, today.isoformat()))
    if row is None:
        lock_scores(db)
        row = db.get(DailyVisit, (user_id, today.isoformat()), populate_existing=True)
    awarded = row is None
    if awarded:
        previous = db.scalar(select(DailyVisit).where(DailyVisit.user_id == user_id)
                             .order_by(DailyVisit.day.desc()).limit(1))
        if previous and previous.day > today.isoformat():
            raise ValueError("Server clock moved backwards")
        consecutive = previous and previous.day == (today-timedelta(days=1)).isoformat()
        streak = previous.streak % 7 + 1 if consecutive else 1
        amount = 50 if streak == 7 else 25
        row = DailyVisit(user_id=user_id, day=today.isoformat(), streak=streak, amount=amount)
        db.add(row)
        grant(db, user_id, amount, "daily:"+today.isoformat())
        db.flush()
    tomorrow = datetime.combine(today+timedelta(days=1), datetime.min.time(), tzinfo=KZ)
    return {"day": row.day, "streak": row.streak, "amount": row.amount,
            "awarded": awarded, "next_at": tomorrow.astimezone(timezone.utc).isoformat(),
            "server_now": now.astimezone(timezone.utc).isoformat()}
