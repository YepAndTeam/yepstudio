"""Stable weekly task selection with progress from accepted result records."""
from datetime import datetime,timedelta
import hashlib
import json
from sqlalchemy import select,func
from database import WeeklyTaskSet,GameResult
from score_service import lock_scores
from weekly import period_now,EPOCH
from activity_catalog import CATALOG,TASKS

def select_tasks(period):
    return [min((t for t in TASKS if t["category"]==category),
        key=lambda t:hashlib.sha256(f"tasks-v1:{period}:{t['id']}".encode()).hexdigest())
        for category in CATALOG["weekly_categories"]]

def weekly_task_state(db,user_id,now=None):
    lock_scores(db)
    period=period_now(now)
    saved=db.get(WeeklyTaskSet,period)
    if saved is None:
        definitions=select_tasks(period)
        db.add(WeeklyTaskSet(period=period,definitions_json=json.dumps(definitions,ensure_ascii=False)))
        db.flush()
    else:
        definitions=json.loads(saved.definitions_json)
    criteria=[GameResult.user_id==user_id,GameResult.valid.is_(True),GameResult.run_id.is_not(None),GameResult.score>0,GameResult.period==period]
    tasks=[]
    for task in definitions:
        filters=criteria+([GameResult.game==task["game"]] if task.get("game") else [])
        metric={"runs":func.count(),"distinct_games":func.count(func.distinct(GameResult.game)),"best":func.max(GameResult.score),"total":func.sum(GameResult.score)}[task["kind"]]
        value=db.scalar(select(metric).select_from(GameResult).where(*filters)) or 0
        tasks.append({**task,"current":min(value,task["target"])})
    end=datetime.combine(EPOCH+timedelta(days=(period+1)*7),datetime.min.time())
    return {"period":period,"ends_at":end.isoformat()+"Z","tasks":tasks}


def daily_task_state(db,user_id,now=None):
    from datetime import timezone
    from daily_service import KZ
    from database import DailyTaskSet,DailyTaskAward,GameRun,User
    from weekly import grant
    lock_scores(db)
    now=now or datetime.now(timezone.utc)
    if now.tzinfo is None:now=now.replace(tzinfo=timezone.utc)
    local=now.astimezone(KZ)
    day=local.date().isoformat()
    start=datetime.combine(local.date(),datetime.min.time(),tzinfo=KZ).astimezone(timezone.utc).replace(tzinfo=None)
    end=start+timedelta(days=1)
    saved=db.get(DailyTaskSet,day)
    if saved is None:
        rewards=CATALOG["daily_rewards"]
        categories=CATALOG["daily_categories"]
        if len(rewards)!=len(categories) or sum(rewards)>10 or any(r<0 for r in rewards):
            raise ValueError("Daily rewards must total at most 10 Jera")
        definitions=[]
        for category,reward in zip(categories,rewards):
            task=min((t for t in TASKS if t["category"]==category),key=lambda t:hashlib.sha256(f"daily-v1:{day}:{t['id']}".encode()).hexdigest())
            definitions.append({**task,"amount":reward})
        db.add(DailyTaskSet(day=day,definitions_json=json.dumps(definitions,ensure_ascii=False)))
        db.flush()
    else:definitions=json.loads(saved.definitions_json)
    rows=db.execute(select(GameResult,GameRun).join(GameRun,GameRun.id==GameResult.run_id).where(
        GameResult.user_id==user_id,GameResult.valid.is_(True),GameResult.score>0,
        GameResult.submitted_at>=start,GameResult.submitted_at<end)).all()
    results=[result for result,run in rows if run.user_id==user_id and run.game==result.game
        and result.submitted_at>=run.started_at and (result.game!="dino" or result.score<=(result.submitted_at-run.started_at).total_seconds()*10+50)]
    awards={a.task_id:a for a in db.scalars(select(DailyTaskAward).where(DailyTaskAward.user_id==user_id,DailyTaskAward.day==day))}
    credited=sum(a.amount for a in awards.values())
    tasks=[]
    for task in definitions:
        values=[r for r in results if not task.get("game") or r.game==task["game"]]
        value={"runs":lambda:len(values),"distinct_games":lambda:len({r.game for r in values}),"best":lambda:max((r.score for r in values),default=0),"total":lambda:sum(r.score for r in values)}[task["kind"]]()
        earned=task["id"] in awards
        amount=task["amount"]
        if value>=task["target"] and not earned:
            amount=min(amount,max(0,10-credited))
            db.add(DailyTaskAward(user_id=user_id,day=day,task_id=task["id"],amount=amount))
            if amount:grant(db,user_id,amount,f"daily-task:{day}:{task['id']}")
            credited+=amount;earned=True
        tasks.append({**task,"current":min(value,task["target"]),"earned":earned})
    db.flush()
    return {"day":day,"ends_at":end.isoformat()+"Z","server_now":now.astimezone(timezone.utc).isoformat(),"tasks":tasks,"earned_today":credited,"daily_limit":10,
            "balance":db.scalar(select(User.jera).where(User.id==user_id))}
