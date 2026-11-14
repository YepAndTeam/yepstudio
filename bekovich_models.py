"""Additive tables: saved quotes, atomic exchanges and permanent findings."""
from datetime import datetime
from typing import Optional
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from database import Base

class BekovichOffer(Base):
 __tablename__='bekovich_offers'
 id:Mapped[str]=mapped_column(String(32),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 signature:Mapped[str]=mapped_column(String(64))
 assessment_json:Mapped[str]=mapped_column(Text)
 reward_json:Mapped[str]=mapped_column(Text)
 chest:Mapped[str]=mapped_column(String(20))
 refused:Mapped[bool]=mapped_column(default=False)
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 __table_args__=(UniqueConstraint('user_id','signature'),)

class BekovichDeal(Base):
 __tablename__='bekovich_deals'
 id:Mapped[str]=mapped_column(String(32),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 request_id:Mapped[str]=mapped_column(String(32))
 offer_id:Mapped[str]=mapped_column(ForeignKey('bekovich_offers.id'))
 discs_json:Mapped[str]=mapped_column(Text)
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 __table_args__=(UniqueConstraint('user_id','request_id'),)

class BekovichItem(Base):
 __tablename__='bekovich_items'
 id:Mapped[str]=mapped_column(ForeignKey('bekovich_deals.id'),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 kind:Mapped[str]=mapped_column(String(20))
 chest:Mapped[str]=mapped_column(String(20))
 payload_json:Mapped[str]=mapped_column(Text)
 opened_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)
 read_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)
 consumed_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)

class StudioBadge(Base):
 __tablename__='studio_badges'
 id:Mapped[str]=mapped_column(ForeignKey('bekovich_items.id'),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 name_key:Mapped[str]=mapped_column(String(250),unique=True)
 data_json:Mapped[str]=mapped_column(Text)

class BekovichWallet(Base):
 __tablename__='bekovich_wallets'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 dvd_opens:Mapped[int]=mapped_column(default=0)
 theme_opens:Mapped[int]=mapped_column(default=0)
 badge_id:Mapped[Optional[str]]=mapped_column(ForeignKey('studio_badges.id'),nullable=True)
