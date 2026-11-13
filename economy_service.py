"""One deployment cohort, one atomic welcome payment per player."""
from datetime import datetime
from sqlalchemy import select
from database import EconomyWelcome, EconomyRecordAdjustment, Meta, User
from score_service import lock_scores

CAMPAIGN = "economy-rebalance-v2"
ENTRIES = [
    {"label": "Компенсация за трудности с балансом", "credit": 2500},
    {"label": "Обновление ежедневных заданий", "credit": 500},
    {"label": "Обновление наград достижений", "credit": 1000},
    {"label": "Обновление недельных призов и рекордов", "credit": 1000},
]


def initialize_economy(SessionLocal):
    with SessionLocal.begin() as db:
        lock_scores(db)
        if db.get(Meta, CAMPAIGN):
            return
        now = datetime.utcnow()
        # Snapshot existing players once. Later registrations receive only starter currency.
        for uid in db.scalars(select(User.id)):
            db.add(EconomyWelcome(user_id=uid, kind="compensation", created_at=now))
        db.add(Meta(key=CAMPAIGN, value=now.isoformat()))


def reward_economy_welcome(db, uid):
    row = db.get(EconomyWelcome, uid)
    if row and row.paid_at:
        reward_record_adjustment(db, row)
        return
    lock_scores(db)
    row = db.get(EconomyWelcome, uid, populate_existing=True)
    if row and row.paid_at:
        reward_record_adjustment(db, row)
        return
    if not db.get(Meta, CAMPAIGN):
        raise RuntimeError("Economy cohort must be initialized before granting rewards")
    if row is None:
        row = EconomyWelcome(user_id=uid, kind="starter")
        db.add(row)
    now = datetime.utcnow()
    amount = 4000 if row.kind == "compensation" else 2000
    from weekly import grant
    grant(db, uid, amount, "economy:" + row.kind + ":v2", now)
    row.paid_at = now
    db.flush()
    reward_record_adjustment(db, row)


def reward_record_adjustment(db, row):
    if row.kind != "compensation" or db.get(EconomyRecordAdjustment, row.user_id):
        return
    lock_scores(db)
    if db.get(EconomyRecordAdjustment, row.user_id, populate_existing=True):
        return
    from weekly import grant
    grant(db, row.user_id, 1000, "economy:compensation:records-v2")
    db.add(EconomyRecordAdjustment(user_id=row.user_id))
    row.read_at = None
    db.flush()


def welcome_letter(db, uid):
    row = db.get(EconomyWelcome, uid)
    if not row or not row.paid_at:
        return None
    compensation = row.kind == "compensation"
    entries = ENTRIES if compensation else [{"label": "Стартовый баланс нового игрока", "credit": 2000}]
    total = sum(item["credit"] for item in entries)
    return {"id": CAMPAIGN, "created_at": row.created_at.isoformat()+"Z",
            "read": row.read_at is not None, "title": "Обновление экономики" if compensation else "Добро пожаловать в YAB Studio",
            "description": "Компенсация за изменение баланса и наград" if compensation else "Стартовые Йеры для первых покупок",
            "entries": entries, "total": total, "target_total": total, "previous_total": 0}


def read_welcome(db, uid):
    row = db.get(EconomyWelcome, uid)
    if not row or not row.paid_at:
        return False
    if row.read_at is None:
        row.read_at = datetime.utcnow()
    return True
