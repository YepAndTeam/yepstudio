"""Read-only economy reporting; never grants rewards or migrates schema."""
from datetime import datetime,timedelta
from sqlalchemy import select,func,case,text,inspect
from database import User,JeraTx,ThemeBoxPurchase
CATEGORIES=(('admin:test:','admin_test','Тестовый баланс админа'),('daily-task:','tasks','Задания дня'),('daily:','visits','Ежедневный вход'),('achievement:','achievements','Достижения'),('shop:buy:','boxes','Покупка кассет'),('shop:refund:','box_refunds','Возвраты кассет'),('tour:entry:','tournament_entries','Взносы турниров'),('tour:refund:','tournament_refunds','Возвраты взносов'),('tour:prize:','tournament_prizes','Призы турниров'),('reset:','compensation','Компенсация рекордов'),('legacy:','legacy','Старая компенсация'),('week','weekly','Недельные призы'))
CATEGORIES=(('race:bet:','race_bets','Ставки на скачки'),('race:win:','race_wins','Выигрыши скачек'),('race:refund:','race_refunds','Возвраты ставок'))+CATEGORIES
LABELS={key:label for _,key,label in CATEGORIES};LABELS['other']='Другие операции'
def category_for(reason):return next((key for prefix,key,_ in CATEGORIES if reason.startswith(prefix)),'other')
def economy_report(db,days=30,include_admins=False,now=None):
 if days not in (0,7,30,90):raise ValueError('Unsupported period')
 now=now or datetime.utcnow();local_day=(now+timedelta(hours=5)).date()
 start=datetime.combine(local_day-timedelta(days=days-1),datetime.min.time())-timedelta(hours=5) if days else None
 users=[] if include_admins else [User.role!='admin'];period=[JeraTx.created_at>=start] if start else []
 money_in=func.coalesce(func.sum(case((JeraTx.amount>0,JeraTx.amount),else_=0)),0)
 money_out=func.coalesce(func.sum(case((JeraTx.amount<0,-JeraTx.amount),else_=0)),0)
 wallets=db.execute(select(func.count(),func.coalesce(func.sum(User.jera),0),func.coalesce(func.max(User.jera),0),func.coalesce(func.sum(case((User.jera<0,1),else_=0)),0)).select_from(User).where(*users)).one()
 ledger_all=db.scalar(select(func.coalesce(func.sum(JeraTx.amount),0)).join(User,User.id==JeraTx.user_id).where(*users)) or 0
 category=case(*[(JeraTx.reason.startswith(prefix),key) for prefix,key,_ in CATEGORIES],else_='other')
 rows=db.execute(select(category.label('category'),func.count(),money_in,money_out).join(User,User.id==JeraTx.user_id).where(*users,*period).group_by(category)).all()
 categories=[dict(id=key,title=LABELS[key],count=n,inflow=int(a),outflow=int(b),net=int(a-b)) for key,n,a,b in rows];categories.sort(key=lambda r:r['inflow']+r['outflow'],reverse=True)
 incoming=sum(r['inflow'] for r in categories);outgoing=sum(r['outflow'] for r in categories);refunds=sum(r['inflow'] for r in categories if r['id'] in ('box_refunds','tournament_refunds','race_refunds'))
 chart_start=datetime.combine(local_day-timedelta(days=(days or 90)-1),datetime.min.time())-timedelta(hours=5)
 day_expr=func.date(JeraTx.created_at+text("INTERVAL '5 hours'")) if db.bind.dialect.name=='postgresql' else func.date(JeraTx.created_at,'+5 hours')
 daily_rows=db.execute(select(day_expr,money_in,money_out).join(User,User.id==JeraTx.user_id).where(*users,JeraTx.created_at>=chart_start).group_by(day_expr).order_by(day_expr)).all()
 daily_map={str(d):(int(a),int(b)) for d,a,b in daily_rows};daily=[]
 for i in range(days or 90):
  day=str((chart_start+timedelta(hours=5,days=i)).date());a,b=daily_map.get(day,(0,0));daily.append(dict(day=day,inflow=a,outflow=b,net=a-b))
 purchases=[ThemeBoxPurchase.purchased_at>=start] if start else []
 box_rows=db.execute(select(ThemeBoxPurchase.status,ThemeBoxPurchase.is_dupe,func.count(),func.sum(ThemeBoxPurchase.price),func.sum(ThemeBoxPurchase.refund)).join(User,User.id==ThemeBoxPurchase.user_id).where(*users,*purchases).group_by(ThemeBoxPurchase.status,ThemeBoxPurchase.is_dupe)).all()
 boxes=dict(bought=0,opened=0,pending=0,duplicates=0,new_themes=0,failed=0,paid=0,refunded=0)
 for status,dupe,n,paid,refund in box_rows:
  boxes['bought']+=n;boxes['paid']+=int(paid or 0);boxes['refunded']+=int(refund or 0)
  boxes['pending' if status=='pending' else 'opened']+=n
  if status=='lost':boxes['failed']+=n
  if status=='won':boxes['duplicates' if dupe else 'new_themes']+=n
 boxes['net_sink']=boxes['paid']-boxes['refunded']
 top=db.execute(select(User.id,User.first_name,User.jera).where(*users).order_by(User.jera.desc(),User.id).limit(20)).all()
 recent=db.execute(select(JeraTx.id,User.id,User.first_name,JeraTx.amount,JeraTx.reason,JeraTx.created_at).join(User,User.id==JeraTx.user_id).where(*users,*period).order_by(JeraTx.created_at.desc(),JeraTx.id.desc()).limit(50)).all()
 admin_test=db.scalar(select(func.coalesce(func.sum(JeraTx.amount),0)).where(JeraTx.reason.startswith('admin:test:'),JeraTx.amount>0,*period)) or 0
 active=db.scalar(select(func.count(func.distinct(JeraTx.user_id))).join(User,User.id==JeraTx.user_id).where(*users,*period)) or 0
 race_fund=None
 if inspect(db.connection()).has_table('race_fund'):
  from race_models import RaceFund,Race,RaceTournamentFunding
  cash=db.scalar(select(RaceFund.balance).where(RaceFund.id==1)) or 0
  reserved=db.scalar(select(func.coalesce(func.sum(Race.reserved),0)).where(Race.status=='scheduled')) or 0
  tournament_held=db.scalar(select(func.coalesce(func.sum(RaceTournamentFunding.reserved),0)).where(RaceTournamentFunding.closed.is_(False))) or 0
  race_fund=dict(balance=int(cash),reserved=int(reserved),available=int(cash-reserved),tournament_held=int(tournament_held))
 return dict(generated_at=now.isoformat()+'Z',days=days,include_admins=include_admins,timezone='UTC+5',starts_at=start.isoformat()+'Z' if start else None,
  wallets=dict(players=wallets[0],total=int(wallets[1]),maximum=int(wallets[2]),negative=int(wallets[3]),ledger_net=int(ledger_all),unexplained_difference=int(wallets[1]-ledger_all)),
  flow=dict(inflow=incoming,outflow=outgoing,net=incoming-outgoing,refunds=refunds,issued_excluding_refunds=incoming-refunds,transactions=sum(r['count'] for r in categories),active_players=active,admin_test_issued=int(admin_test)),categories=categories,daily=daily,boxes=boxes,race_fund=race_fund,
  top_wallets=[dict(user_id=uid,name=name,balance=balance) for uid,name,balance in top],recent=[dict(id=tid,user_id=uid,name=name,amount=amount,category=LABELS[category_for(reason)],created_at=created.isoformat()+'Z') for tid,uid,name,amount,reason,created in recent])
def readonly_report(sessions,days=30,include_admins=False):
 with sessions() as db:
  if db.bind.dialect.name=='postgresql':
   db.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'))
   db.execute(text("SET LOCAL statement_timeout = '20000'"))
  return economy_report(db,days,include_admins)
