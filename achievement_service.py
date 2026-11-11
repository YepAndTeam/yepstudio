"""Lifetime milestones. Caller serializes score and wallet writes in one transaction."""
from sqlalchemy import select
from database import AchievementProgress, AchievementAward

from activity_catalog import ACHIEVEMENTS
DINO_STEPS = tuple((step["score"],step["amount"]) for step in ACHIEVEMENTS["dino"]["steps"])

def accept_achievement(db,user_id,game,score,run,now):
    # Old records and client-only submissions never mint milestone currency.
    if game not in ACHIEVEMENTS or not run:
        return []
    elapsed=(now-run.started_at).total_seconds()
    if elapsed < 0 or (game == "dino" and score > elapsed*10+50):
        return []
    progress=db.get(AchievementProgress,(user_id,game))
    if progress is None:
        progress=AchievementProgress(user_id=user_id,game=game,best=score)
        db.add(progress)
    else:
        progress.best=max(progress.best,score)
    from weekly import grant
    awarded=[]
    for step in ACHIEVEMENTS[game]["steps"]:
        threshold,amount=step["score"],step["amount"]
        if score >= threshold and not db.get(AchievementAward,(user_id,game,threshold)):
            db.add(AchievementAward(user_id=user_id,game=game,threshold=threshold,amount=amount))
            if amount: grant(db,user_id,amount,f"achievement:{game}:{threshold}")
            awarded.append({"threshold":threshold,"amount":amount})
    db.flush()
    return awarded

def achievement_state(db,user_id,game="dino"):
    definition=ACHIEVEMENTS[game]
    progress=db.get(AchievementProgress,(user_id,game))
    best=progress.best if progress else 0
    awards={a.threshold:a for a in db.scalars(select(AchievementAward).where(AchievementAward.user_id==user_id,AchievementAward.game==game))}
    return {"game":game,"game_name":definition["game_name"],"title":definition["title"],"best":best,
            "steps":[{"score":score,"amount":amount,"earned":score in awards or (amount == 0 and best >= score)} for score,amount in ((step["score"],step["amount"]) for step in definition["steps"])],
            "total_earned":sum(a.amount for a in awards.values())}
