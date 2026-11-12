"""Collectible discs are independent of playable games and their scores."""
from datetime import datetime
from typing import Optional
from sqlalchemy import ForeignKey,Index,String
from sqlalchemy.orm import Mapped,mapped_column
from database import Base

class DiscDraw(Base):
 __tablename__='disc_draws'
 id:Mapped[str]=mapped_column(String(32),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'))
 disc_id:Mapped[str]=mapped_column(String(40))
 rarity:Mapped[str]=mapped_column(String(20))
 price:Mapped[int]=mapped_column()
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 revealed_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)
 copy_number:Mapped[int]=mapped_column(default=0)
 __table_args__=(Index('ix_disc_draw_user_revealed','user_id','revealed_at'),)

class DiscRequest(Base):
 __tablename__='disc_requests'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 request_id:Mapped[str]=mapped_column(String(40),primary_key=True)
 draw_id:Mapped[str]=mapped_column(ForeignKey('disc_draws.id'))

class DiscCopy(Base):
 __tablename__='disc_copies'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 disc_id:Mapped[str]=mapped_column(String(40),primary_key=True)
 rarity:Mapped[str]=mapped_column(String(20),primary_key=True)
 quantity:Mapped[int]=mapped_column(default=1)
 first_found_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 last_found_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)

class DiscLaunchGift(Base):
 __tablename__='disc_launch_gifts'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 claimed_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 activated_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)
 remaining:Mapped[int]=mapped_column(default=0)

class ThemeUsbGift(Base):
 __tablename__='theme_usb_gifts'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 theme_id:Mapped[str]=mapped_column(String(20),primary_key=True)
 claimed_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 activated_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)
 remaining:Mapped[int]=mapped_column(default=0)
