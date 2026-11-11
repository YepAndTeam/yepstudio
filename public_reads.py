"""Public-only snapshots; no wallet, ownership, notification or viewer fields."""
from sqlalchemy import select,func
from database import Project,Comment,Post,Topic,User

def home_snapshot(db):
 projects=db.scalars(select(Project).order_by(Project.id)).all()
 cm=select(Comment.ref_id.label('pid'),func.count().label('n')).where(Comment.ref_type=='post').group_by(Comment.ref_id).subquery()
 posts=db.execute(select(Post,func.coalesce(cm.c.n,0)).outerjoin(cm,cm.c.pid==Post.id).order_by(Post.created_at.desc(),Post.id.desc()).limit(30)).all()
 latest=db.execute(select(Topic.title,User.first_name).join(User,User.id==Topic.user_id).where(Topic.rated.is_(True),Topic.deleted.is_(False),Topic.rated_at.is_not(None)).order_by(Topic.rated_at.desc()).limit(1)).first()
 return {'projects':[{'id':p.id,'name':p.name,'status':p.status,'stage':p.stage} for p in projects],
 'posts':[{'id':p.id,'title':p.title,'text':p.text,'created_at':p.created_at.isoformat()+'Z','comments':n} for p,n in posts],
 'latest':{'title':latest[0],'author':latest[1]} if latest else None}

def leaderboard_snapshot(db,model,condition,order,competition=False):
 rows=db.execute(select(model.user_id,User.first_name,model.best).join(User,User.id==model.user_id).where(condition,model.best>0).order_by(model.best.desc(),order,model.user_id).limit(20)).all()
 result=[];last_best=None;place=0
 for index,(uid,name,best) in enumerate(rows,1):
  if competition or best!=last_best:place,last_best=index,best
  result.append({'user_id':uid,'name':name,'best':best,'place':place})
 return result
