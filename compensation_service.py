"""Receipts refer to already-posted compensation, never credit the wallet again."""
import json
from datetime import datetime
from sqlalchemy import select, update
from database import CompensationLetter, RecordReset, User
from score_service import lock_scores


def create_letters(db, reset_id, awards, created_at):
    recipients={row["user_id"] for row in awards if row["credit"]>0}
    for uid in recipients:
        if db.get(User,uid) and not db.get(CompensationLetter,(reset_id,uid)):
            db.add(CompensationLetter(reset_id=reset_id,user_id=uid,created_at=created_at))


def initialize_letters(SessionLocal):
    # A deployment after a completed reset can still deliver its original receipt.
    with SessionLocal.begin() as db:
        lock_scores(db)
        for reset in db.scalars(select(RecordReset)).all():
            data=json.loads(reset.archive_json)
            create_letters(db,reset.id,data.get("awards",[]),reset.applied_at)


def list_letters(db,user_id):
    rows=db.execute(select(CompensationLetter,RecordReset.archive_json)
        .join(RecordReset,RecordReset.id==CompensationLetter.reset_id)
        .where(CompensationLetter.user_id==user_id)
        .order_by(CompensationLetter.created_at.desc()).limit(5)).all()
    letters=[]
    for letter,archive in rows:
        entries=[{key:row[key] for key in ("game","score","place","target","already_paid","credit")}
            for row in json.loads(archive).get("awards",[]) if row["user_id"]==user_id]
        letters.append({"id":letter.reset_id,"created_at":letter.created_at.isoformat()+"Z",
            "read":letter.read_at is not None,"entries":entries,
            "total":sum(row["credit"] for row in entries),
            "target_total":sum(row["target"] for row in entries),
            "previous_total":sum(row["already_paid"] for row in entries)})
    return letters


def mark_read(db,user_id,reset_id):
    letter=db.get(CompensationLetter,(reset_id,user_id))
    if letter is None:return False
    if letter.read_at is None:
        db.execute(update(CompensationLetter).where(CompensationLetter.user_id==user_id,
            CompensationLetter.reset_id==reset_id,CompensationLetter.read_at.is_(None)).values(read_at=datetime.utcnow()))
    return True
