from datetime import datetime
from sqlalchemy import Column,BigInteger,String,DateTime,Boolean,ForeignKey,CheckConstraint
from database import Base

class Friendship(Base):
 __tablename__='friendships'
 low_id=Column(BigInteger,ForeignKey('users.id'),primary_key=True)
 high_id=Column(BigInteger,ForeignKey('users.id'),primary_key=True)
 requested_by=Column(BigInteger,ForeignKey('users.id'),nullable=False,index=True)
 status=Column(String(12),nullable=False,default='pending')
 created_at=Column(DateTime,nullable=False,default=datetime.utcnow)
 __table_args__=(CheckConstraint('low_id < high_id'),)

class SocialPresence(Base):
 __tablename__='social_presence'
 user_id=Column(BigInteger,ForeignKey('users.id'),primary_key=True)
 last_seen=Column(DateTime,nullable=False,default=datetime.utcnow)
 visible=Column(Boolean,nullable=False,default=True)
 active=Column(Boolean,nullable=False,default=True)
