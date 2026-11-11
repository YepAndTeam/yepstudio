"""Persistent race events, liabilities, outbox and bounded chat."""
from datetime import datetime
from sqlalchemy import Column,Integer,BigInteger,String,Text,DateTime,Boolean,ForeignKey,UniqueConstraint
from database import Base
class RaceMeeting(Base):
 __tablename__='race_meetings'
 id=Column(String(40),primary_key=True)
 root_slot=Column(DateTime,nullable=False,index=True)
 attempt=Column(Integer,nullable=False,default=0)
 opens_at=Column(DateTime,nullable=False)
 status=Column(String(20),nullable=False,default='scheduled')
 chat_until=Column(DateTime,nullable=False)
 __table_args__=(UniqueConstraint('root_slot','attempt'),)
class Race(Base):
 __tablename__='races'
 id=Column(String(40),primary_key=True)
 root_slot=Column(DateTime,nullable=False,index=True)
 attempt=Column(Integer,nullable=False,default=0)
 meeting_id=Column(String(40),ForeignKey('race_meetings.id'),nullable=True,index=True)
 node_id=Column(String(8),nullable=True)
 opens_at=Column(DateTime,nullable=False,index=True)
 closes_at=Column(DateTime,nullable=False)
 starts_at=Column(DateTime,nullable=False)
 chat_until=Column(DateTime,nullable=False)
 status=Column(String(20),nullable=False,default='scheduled')
 rules_json=Column(Text,nullable=False)
 commitment=Column(String(64),nullable=False)
 beacon_round=Column(BigInteger,nullable=False)
 proof_json=Column(Text,nullable=True)
 result_json=Column(Text,nullable=True)
 reserved=Column(Integer,nullable=False,default=0)
 settled_at=Column(DateTime,nullable=True)
 __table_args__=(UniqueConstraint('meeting_id','node_id'),)
class RaceBet(Base):
 __tablename__='race_bets'
 id=Column(String(40),primary_key=True)
 race_id=Column(String(40),ForeignKey('races.id'),nullable=False,index=True)
 user_id=Column(BigInteger,ForeignKey('users.id'),nullable=False,index=True)
 horse=Column(Integer,nullable=False)
 amount=Column(Integer,nullable=False)
 payout=Column(Integer,nullable=False)
 status=Column(String(20),nullable=False,default='pending')
 request_id=Column(String(64),nullable=False)
 commitment=Column(String(64),nullable=False)
 created_at=Column(DateTime,nullable=False,default=datetime.utcnow)
 __table_args__=(UniqueConstraint('user_id','request_id'),)
class RaceFund(Base):
 __tablename__='race_fund'
 id=Column(Integer,primary_key=True)
 balance=Column(Integer,nullable=False,default=0)
class RaceFundTx(Base):
 __tablename__='race_fund_tx'
 id=Column(Integer,primary_key=True)
 amount=Column(Integer,nullable=False)
 reason=Column(String(100),nullable=False,unique=True)
 created_at=Column(DateTime,nullable=False,default=datetime.utcnow)
class RaceFundTopUp(Base):
 __tablename__='race_fund_topups'
 id=Column(String(40),primary_key=True)
 admin_id=Column(BigInteger,ForeignKey('users.id'),nullable=False)
 amount=Column(Integer,nullable=False)
 note=Column(String(120),nullable=False)
 request_id=Column(String(64),nullable=False)
 created_at=Column(DateTime,nullable=False,default=datetime.utcnow)
 __table_args__=(UniqueConstraint('admin_id','request_id'),)
class RaceShopFunding(Base):
 __tablename__='race_shop_funding'
 box_id=Column(String(40),ForeignKey('theme_box_purchases.id'),primary_key=True)
 amount=Column(Integer,nullable=False)
class RaceTournamentFunding(Base):
 __tablename__='race_tournament_funding'
 tournament_id=Column(String(40),ForeignKey('tournaments.id'),primary_key=True)
 reserved=Column(Integer,nullable=False)
 closed=Column(Boolean,nullable=False,default=False)
class RaceChat(Base):
 __tablename__='race_chat'
 id=Column(Integer,primary_key=True)
 race_id=Column(String(40),ForeignKey('races.id'),nullable=False,index=True)
 user_id=Column(BigInteger,ForeignKey('users.id'),nullable=False)
 text=Column(String(240),nullable=False)
 created_at=Column(DateTime,nullable=False,default=datetime.utcnow,index=True)
class RaceReminder(Base):
 __tablename__='race_reminders'
 race_id=Column(String(40),ForeignKey('races.id'),primary_key=True)
 user_id=Column(BigInteger,ForeignKey('users.id'),primary_key=True)
 claimed_at=Column(DateTime,nullable=False,default=datetime.utcnow)
 sent_at=Column(DateTime,nullable=True)
