"""Registration, fees, deadlines and rewards share the score transaction lock."""
import json
from datetime import datetime,timedelta
from uuid import uuid4
from sqlalchemy import select,update,func
from database import (Tournament,TournamentEntry,TournamentAward,TournamentScore,
                      User,UserTheme,JeraTx,Notification,Meta,TournamentVote)
from score_service import lock_scores
from shop_service import owned_themes,RARITY
from weekly import grant,NAMES

PRIZES={"2":150,"3":100,"4":75,"5":50}


class TournamentError(Exception):
    def __init__(self,status,message):
        super().__init__(message)
        self.status=status


def available(db):
    if db.scalar(select(Meta.value).where(Meta.key=="score_maintenance"))=="1":
        raise TournamentError(503,"Идёт обновление рекордов. Турниры скоро снова будут доступны.")


def next_is_free(db):
    return db.scalar(select(Tournament.id).where(Tournament.cancelled.is_(False)).limit(1)) is None


def ranked(db,event):
    return db.execute(select(TournamentScore,User.first_name)
        .join(User,User.id==TournamentScore.user_id)
        .join(TournamentEntry,(TournamentEntry.tournament_id==TournamentScore.tournament_id)&(TournamentEntry.user_id==TournamentScore.user_id))
        .where(TournamentScore.tournament_id==event.id,TournamentScore.best>0)
        .order_by(TournamentScore.best.desc(),TournamentScore.achieved_at,TournamentScore.user_id)).all()


def settle_due(db,now=None):
    now=now or datetime.utcnow()
    condition=(Tournament.status=="active",Tournament.cancelled.is_(False),Tournament.ends_at<=now)
    if db.scalar(select(Tournament.id).where(*condition).limit(1)) is None:return False
    lock_scores(db)
    changed=False
    for event in db.scalars(select(Tournament).where(*condition)).all():
        if event.settled_at is not None:
            event.status="finished";changed=True;continue
        prizes=json.loads(event.prize_jera)
        for place,(score,name) in enumerate(ranked(db,event)[:5],1):
            if db.get(TournamentAward,(event.id,score.user_id)):continue
            amount=int(prizes.get(str(place),0)) if place>1 else 0
            theme=None
            if place==1:
                if event.prize_theme in owned_themes(db,score.user_id):amount=event.duplicate_prize
                else:
                    theme=event.prize_theme
                    db.add(UserTheme(user_id=score.user_id,theme_id=theme,source="tour:"+event.id))
            if amount:grant(db,score.user_id,amount,f"tour:prize:{event.id}:{place}")
            db.add(TournamentAward(tournament_id=event.id,user_id=score.user_id,place=place,amount=amount,theme_id=theme))
            reward="тема «Какашечки»" if theme=="poop" else "тема "+theme if theme else f"{amount} Йер"
            db.add(Notification(user_id=score.user_id,kind="game",text=f"Турнир «{event.title}»: {place} место. Твой приз: {reward}.",ref="game"))
        event.status="finished";event.settled_at=now;changed=True
    db.flush()
    return changed


def create_event(db,title,game="dino",duration_hours=48,entry_fee=0,now=None):
    lock_scores(db);available(db)
    now=now or datetime.utcnow()
    settle_due(db,now)
    if db.scalar(select(Tournament.id).where(Tournament.cancelled.is_(False),Tournament.status.in_(["registration","active"])).limit(1)):
        raise TournamentError(409,"Сначала заверши или отмени текущий турнир")
    if game not in NAMES:raise TournamentError(422,"Неизвестная игра")
    if not 1<=duration_hours<=168 or not 0<=entry_fee<=10000:raise TournamentError(422,"Проверь длительность и взнос")
    title=title.strip()
    if not title or len(title)>120:raise TournamentError(422,"Укажи название до 120 символов")
    first=next_is_free(db)
    previous=db.scalar(select(Tournament).where(Tournament.status=="finished").order_by(Tournament.ends_at.desc()).limit(1))
    if not first and previous:
        winner=vote_winner(db,previous.id)
        if winner:game=winner
        else:
            counts=vote_counts(db,previous.id)
            if counts and counts.get(game,0)!=max(counts.values()):
                raise TournamentError(422,"При ничьей выбери одну из игр-лидеров голосования")
        previous.voting_closed=True
    if first:
        game,duration_hours,entry_fee="dino",48,0
    elif entry_fee<1:raise TournamentError(422,"Для следующих турниров укажи взнос от 1 Йеры")
    row=Tournament(id=uuid4().hex,title=title,game=game,starts_at=now,ends_at=now+timedelta(hours=duration_hours),
        status="registration",duration_hours=duration_hours,entry_fee=entry_fee,prize_theme="poop",duplicate_prize=200,
        prize_jera=json.dumps(PRIZES),created_at=now,cancelled=False)
    db.add(row);db.flush();return row


def get_event(db,event_id):
    event=db.get(Tournament,event_id)
    if event is None:raise TournamentError(404,"Турнир не найден")
    return event


def start_event(db,event_id,now=None):
    lock_scores(db);available(db)
    event=get_event(db,event_id)
    if event.status=="active" and not event.cancelled:return event
    if event.status!="registration" or event.cancelled:raise TournamentError(409,"Этот турнир нельзя запустить")
    now=now or datetime.utcnow()
    event.starts_at=now;event.ends_at=now+timedelta(hours=event.duration_hours);event.status="active"
    db.flush();return event


def register(db,event_id,user_id,now=None):
    lock_scores(db);available(db)
    now=now or datetime.utcnow();event=get_event(db,event_id)
    entry=db.get(TournamentEntry,(event.id,user_id))
    if event.cancelled or event.status not in ("registration","active") or (event.status=="active" and event.ends_at<=now):
        raise TournamentError(409,"Регистрация на этот турнир закрыта")
    if entry is not None:return entry
    if event.entry_fee:
        changed=db.execute(update(User).where(User.id==user_id,User.jera>=event.entry_fee).values(jera=User.jera-event.entry_fee))
        if changed.rowcount!=1:raise TournamentError(409,"Не хватает Йеры для участия")
        db.add(JeraTx(user_id=user_id,amount=-event.entry_fee,reason="tour:entry:"+event.id))
    entry=TournamentEntry(tournament_id=event.id,user_id=user_id,paid=event.entry_fee,joined_at=now)
    db.add(entry);db.flush();return entry


def cancel_event(db,event_id):
    lock_scores(db);available(db)
    event=get_event(db,event_id)
    if event.cancelled:return event
    if event.status not in ("registration","active") or (event.status=="active" and event.ends_at<=datetime.utcnow()):
        raise TournamentError(409,"Завершённый турнир нельзя отменить")
    for entry in db.scalars(select(TournamentEntry).where(TournamentEntry.tournament_id==event.id)).all():
        if entry.paid:
            grant(db,entry.user_id,entry.paid,"tour:refund:"+event.id)
            db.add(Notification(user_id=entry.user_id,kind="game",text=f"Турнир «{event.title}» отменён. Возвращено {entry.paid} Йер.",ref="game"))
    event.cancelled=True;event.status="cancelled";db.flush();return event


def event_state(db,event,user_id=None,now=None):
    now=now or datetime.utcnow()
    entry=db.get(TournamentEntry,(event.id,user_id)) if user_id is not None else None
    scores=ranked(db,event)
    top=[{"place":i,"user_id":score.user_id,"name":name,"best":score.best} for i,(score,name) in enumerate(scores,1)]
    mine=next((row for row in top if row["user_id"]==user_id),None)
    return {"id":event.id,"title":event.title,"game":event.game,"game_name":NAMES.get(event.game,event.game),
        "status":event.status,"entry_fee":event.entry_fee,"duration_hours":event.duration_hours,
        "starts_at":event.starts_at.isoformat()+"Z" if event.status!="registration" else None,
        "ends_at":event.ends_at.isoformat()+"Z" if event.status!="registration" else None,
        "server_now":now.isoformat()+"Z","registered":entry is not None,
        "participants":db.scalar(select(func.count()).select_from(TournamentEntry).where(TournamentEntry.tournament_id==event.id)) or 0,
        "top":top[:10],"my_best":mine["best"] if mine else 0,"my_place":mine["place"] if mine else None,
        "prize_theme":event.prize_theme,"duplicate_prize":event.duplicate_prize,"prize_jera":json.loads(event.prize_jera),
        "share_path":"/tournaments/"+event.id,"voting_closed":event.voting_closed,
        "votes":vote_counts(db,event.id),"my_vote":db.scalar(select(TournamentVote.game).where(TournamentVote.tournament_id==event.id,TournamentVote.user_id==user_id)) if user_id is not None else None}


def list_events(db,user_id=None):
    settle_due(db)
    rows=db.scalars(select(Tournament).order_by(Tournament.created_at.desc(),Tournament.starts_at.desc()).limit(12)).all()
    latest=next((event for event in rows if event.status=="finished"),None)
    return {"events":[event_state(db,row,user_id) for row in rows],"next_free":next_is_free(db),"next_game":vote_winner(db,latest.id) if latest else None}


def vote_counts(db,event_id):
    return dict(db.execute(select(TournamentVote.game,func.count()).where(TournamentVote.tournament_id==event_id).group_by(TournamentVote.game)).all())


def vote_winner(db,event_id):
    counts=vote_counts(db,event_id)
    if not counts:return None
    leaders=[game for game in NAMES if counts.get(game,0)==max(counts.values())]
    return leaders[0] if len(leaders)==1 else None


def vote(db,event_id,user_id,game):
    lock_scores(db)
    available(db)
    event=get_event(db,event_id)
    if event.status!="finished" or event.voting_closed:
        raise TournamentError(409,"Голосование сейчас закрыто")
    if game not in NAMES:raise TournamentError(422,"Неизвестная игра")
    existing=db.get(TournamentVote,(event_id,user_id))
    if existing:existing.game=game
    else:db.add(TournamentVote(tournament_id=event_id,user_id=user_id,game=game))
    db.flush()
    return event
