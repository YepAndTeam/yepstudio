"""Called under the score write lock; ordinary server-issued runs only."""
from sqlalchemy import select, func
from database import AllTimeScore, GameScore, GlobalRecordAward
RECORD_REWARD = 1000


def global_record_before(db, game):
    return max(db.scalar(select(func.max(model.best)).where(model.game == game)) or 0
               for model in (AllTimeScore, GameScore))


def owns_global_record(db, uid, game, best):
    return best > 0 and any((db.scalar(select(func.max(model.best)).where(model.game == game, model.user_id == uid)) or 0) == best
                            for model in (AllTimeScore, GameScore))


def record_reward_for_run(db, uid, run_id):
    if not run_id:
        return 0
    from database import GameResult
    return db.scalar(select(GlobalRecordAward.amount).join(GameResult, GameResult.id == GlobalRecordAward.result_id)
                     .where(GameResult.run_id == run_id, GlobalRecordAward.user_id == uid)) or 0


def reward_global_record(db, result, run, previous_best, now, was_owner=False):
    if not run or previous_best <= 0 or result.score <= previous_best:
        return 0
    if was_owner and result.score * 10 < previous_best * 11:
        return 0
    if now < run.started_at:
        return 0
    from disc_equipment import valid_dino_score
    if result.game == "dino" and not valid_dino_score(db, run, result.score, now):
        return 0
    if db.get(GlobalRecordAward, result.id):
        return 0
    from weekly import grant
    db.add(GlobalRecordAward(result_id=result.id, user_id=result.user_id, game=result.game,
                             score=result.score, previous_best=previous_best, amount=RECORD_REWARD, created_at=now))
    grant(db, result.user_id, RECORD_REWARD, f"record:alltime:{result.game}:{result.id}", now)
    db.flush()
    return RECORD_REWARD
