"""Explicit one-time reset. Preview is read-only; never runs at application startup."""
import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path

from sqlalchemy import MetaData, Table, delete, inspect, select
from sqlalchemy.orm import Session
from database import (engine, SessionLocal, AllTimeScore, GameScore, JeraTx, Meta,
                      Notification, RecordReset, RecordResetDraft, Tournament)
from score_service import lock_scores
from weekly import NAMES, grant, period_now

RESET_ID = "records-v2-2026-11"
TABLES = ("game_scores", "alltime_scores", "weekly_results", "jera_tx", "users",
          "meta", "game_results", "game_runs", "tournaments", "tournament_scores", "tournament_results", "user_themes", "theme_box_purchases", "tournament_entries", "tournament_awards", "tournament_votes", "achievement_progress", "achievement_awards", "daily_visits", "weekly_task_sets", "daily_task_sets", "daily_task_awards", "bot_contacts", "board_invitations", "board_widget_sessions", "board_widget_queries", "race_meetings", "races", "race_bets", "race_fund", "race_fund_tx", "race_fund_topups", "race_shop_funding", "race_tournament_funding")


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def capture(db):
    """A consistent logical archive of score, reward and balance data; no credentials."""
    existing = set(inspect(db.connection()).get_table_names())
    archive = {}
    for name in TABLES:
        if name not in existing:
            continue
        table = Table(name, MetaData(), autoload_with=db.connection())
        stmt = select(table.c.id, table.c.jera) if name == "users" else select(table)
        rows = [json.loads(canonical(dict(row))) for row in db.execute(stmt).mappings()]
        if name == "meta":
            rows = [row for row in rows if row["key"] not in ("score_maintenance", "score_write_lock")]
        archive[name] = sorted(rows, key=canonical)
    return archive


def compensation_for(place):
    if place == 1: return 100
    if place <= 3: return 75
    if place <= 10: return 50
    return 20


def calculate(archive):
    users = {row["id"] for row in archive.get("users", [])}
    best = {}
    # Take each player's strongest old result, never sum scores across games.
    for name in ("game_scores", "alltime_scores"):
        for row in archive.get(name, []):
            if row["user_id"] in users and row["game"] in NAMES and row["best"] > 0:
                key = (row["game"], row["user_id"])
                best[key] = max(best.get(key, 0), row["best"])
    previous = {}
    for row in archive.get("jera_tx", []):
        if row["reason"].startswith("legacy:") and row["amount"] > 0:
            key = (row["reason"].split(":", 1)[1], row["user_id"])
            previous[key] = previous.get(key, 0) + row["amount"]
    awards = []
    for game in NAMES:
        rows = sorted(((uid, score) for (g, uid), score in best.items() if g == game), key=lambda r: (-r[1], r[0]))
        last, place = None, 0
        for index, (uid, score) in enumerate(rows, 1):
            if score != last:
                last, place = score, index
            target = compensation_for(place)
            paid = previous.get((game, uid), 0)
            awards.append(dict(user_id=uid, game=game, score=score, place=place,
                               target=target, already_paid=paid, credit=max(0, target-paid)))
    return awards


def preview(db):
    archive = capture(db)
    return {"version": 2, "reset_id": RESET_ID, "created_at": datetime.utcnow().isoformat()+"Z",
            "archive": archive, "archive_hash": digest(archive), "awards": calculate(archive)}


def saved_preview(db, refresh=False):
    """Persist the reviewed calculation across devices; caller holds score lock."""
    draft = db.get(RecordResetDraft, RESET_ID)
    if draft is not None and not refresh:
        return json.loads(draft.plan_json)
    plan = preview(db)
    plan["summary"] = summary(plan)
    db.merge(RecordResetDraft(id=RESET_ID, plan_json=canonical(plan)))
    db.flush()
    return plan


def summary(plan):
    awards = plan["awards"]
    return {"reset_id": RESET_ID, "records_per_game": {game: sum(r["game"] == game for r in awards) for game in NAMES},
            "recipients": len({r["user_id"] for r in awards if r["credit"] > 0}),
            "jera_to_credit": sum(r["credit"] for r in awards),
            "legacy_already_paid": sum(r["already_paid"] for r in awards),
            "archive_hash": plan["archive_hash"]}


def apply_plan(db, plan):
    if plan.get("version") != 2 or plan.get("reset_id") != RESET_ID:
        raise ValueError("Unsupported reset plan")
    lock_scores(db)
    previous = db.get(RecordReset, RESET_ID)
    if previous:
        return {"already_applied": True, "reset_id": RESET_ID}
    if db.scalar(select(Meta.value).where(Meta.key == "score_storage_version")) != "2":
        raise ValueError("Deploy the new score service before resetting records")
    if db.scalar(select(Meta.value).where(Meta.key == "score_maintenance")) != "1":
        raise ValueError("Enable score maintenance before applying the reset")
    if db.scalar(select(Meta.value).where(Meta.key == "legacy_reset_v2_done")):
        raise ValueError("This compensation campaign was already completed")
    current = capture(db)
    if digest(plan["archive"]) != plan["archive_hash"] or digest(current) != plan["archive_hash"]:
        raise ValueError("Records changed: export a new preview before applying")
    awards = calculate(current)
    if awards != plan["awards"]:
        raise ValueError("Compensation plan differs from its archived records")
    now = datetime.utcnow()
    if db.scalar(select(Tournament.id).where(Tournament.cancelled.is_(False), Tournament.status.in_(["registration", "active"])).limit(1)):
        raise ValueError("Finish/cancel scheduled and active tournaments before the one-time reset")
    db.add(RecordReset(id=RESET_ID, archive_hash=plan["archive_hash"], archive_json=canonical(plan)))
    totals = {}
    for award in awards:
        if award["credit"]:
            grant(db, award["user_id"], award["credit"], f"reset:v2:{award['game']}")
            totals[award["user_id"]] = totals.get(award["user_id"], 0) + award["credit"]
    for uid, amount in totals.items():
        # In-app only: applying the reset does not send Telegram messages.
        db.add(Notification(user_id=uid, kind="game", text=f"Компенсация за старые рекорды: +{amount} Йер. Результаты сохранены в архиве.", ref="game"))
    from compensation_service import create_letters
    create_letters(db, RESET_ID, awards, now)
    db.execute(delete(GameScore))
    db.execute(delete(AllTimeScore))
    for key, value in (("score_epoch", RESET_ID), ("period", str(period_now())),
                       ("legacy_done", "1"), ("scores_imported_v2", "1"), ("legacy_reset_v2_done", RESET_ID)):
        db.merge(Meta(key=key, value=value))
    db.flush()
    return {"already_applied": False, **summary(plan)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--preview", type=Path, help="Save archive + compensation preview without changing the database")
    group.add_argument("--apply", type=Path, help="Apply an unchanged preview, only after deploying v2")
    group.add_argument("--maintenance", choices=("on", "off"))
    args = parser.parse_args()
    if args.preview:
        with engine.connect() as conn:
            if engine.dialect.name == "postgresql":
                conn = conn.execution_options(isolation_level="REPEATABLE READ")
                conn.exec_driver_sql("SET TRANSACTION READ ONLY")
            with Session(bind=conn) as db:
                plan = preview(db)
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        # A snapshot is never silently overwritten.
        with args.preview.open("x", encoding="utf-8") as file:
            json.dump(plan, file, ensure_ascii=False, indent=2)
        print(json.dumps(summary(plan), ensure_ascii=False, indent=2))
    elif args.apply:
        plan = json.loads(args.apply.read_text(encoding="utf-8"))
        with SessionLocal.begin() as db:
            result = apply_plan(db, plan)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        with SessionLocal.begin() as db:
            lock_scores(db)
            if db.scalar(select(Meta.value).where(Meta.key == "score_storage_version")) != "2":
                raise ValueError("Deploy v2 before enabling/disabling maintenance")
            if args.maintenance == "on":
                from tournament_service import settle_due
                settle_due(db)
                if db.scalar(select(Tournament.id).where(Tournament.cancelled.is_(False), Tournament.status.in_(["registration", "active"])).limit(1)):
                    raise ValueError("Finish or cancel the current tournament before maintenance")
            db.merge(Meta(key="score_maintenance", value="1" if args.maintenance == "on" else "0"))
        print("Score maintenance:", args.maintenance)


if __name__ == "__main__":
    main()
