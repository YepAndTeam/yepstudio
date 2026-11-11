from datetime import datetime
from sqlalchemy import Column,String,BigInteger,Integer,DateTime,Boolean,ForeignKey,UniqueConstraint
from database import Base

class BotContact(Base):
 __tablename__='bot_contacts'
 user_id=Column(BigInteger,ForeignKey('users.id'),primary_key=True)
 available=Column(Boolean,nullable=False,default=True)
 started_at=Column(DateTime,nullable=False,default=datetime.utcnow)

class BoardInvitation(Base):
 __tablename__='board_invitations'
 id=Column(String(40),primary_key=True)
 sender_id=Column(BigInteger,ForeignKey('users.id'),nullable=False,index=True)
 recipient_id=Column(BigInteger,ForeignKey('users.id'),nullable=False,index=True)
 kind=Column(String(10),nullable=False)
 status=Column(String(20),nullable=False,default='pending')
 delivery=Column(String(16),nullable=False,default='queued')
 delivery_started_at=Column(DateTime,nullable=True)
 game_id=Column(Integer,nullable=True)
 created_at=Column(DateTime,nullable=False,default=datetime.utcnow)
 expires_at=Column(DateTime,nullable=False)

class BoardWidgetSession(Base):
 __tablename__='board_widget_sessions'
 id=Column(String(40),primary_key=True)
 user_id=Column(BigInteger,ForeignKey('users.id'),nullable=False)
 chat_id=Column(BigInteger,nullable=False)
 message_id=Column(BigInteger,nullable=True)
 kind=Column(String(10),nullable=True)
 page=Column(Integer,nullable=False,default=0)
 invitation_id=Column(String(40),ForeignKey('board_invitations.id'),nullable=True)
 created_at=Column(DateTime,nullable=False,default=datetime.utcnow)
 __table_args__=(UniqueConstraint('chat_id','message_id'),)

class BoardWidgetQuery(Base):
 __tablename__='board_widget_queries'
 id=Column(String(100),primary_key=True)
 user_id=Column(BigInteger,nullable=False)
 data=Column(String(64),nullable=False)
 session_id=Column(String(40),nullable=False)
 created_at=Column(DateTime,nullable=False,default=datetime.utcnow)
