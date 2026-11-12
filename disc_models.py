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

class DiscInstance(Base):
 __tablename__='disc_instances'
 id:Mapped[str]=mapped_column(String(32),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 disc_id:Mapped[str]=mapped_column(String(40))
 rarity:Mapped[str]=mapped_column(String(20))
 status:Mapped[str]=mapped_column(String(20),default='ready')
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 activated_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)
 expires_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)
 effects_json:Mapped[str]=mapped_column(String(500),default='{}')
 wear_roll:Mapped[int]=mapped_column()
 lost_effect:Mapped[Optional[str]]=mapped_column(String(30),nullable=True)

class DiscInventoryVersion(Base):
 __tablename__='disc_inventory_versions'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)

class DiscEquipment(Base):
 __tablename__='disc_equipment'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 instance_id:Mapped[Optional[str]]=mapped_column(ForeignKey('disc_instances.id'),nullable=True)

class DiscRun(Base):
 __tablename__='disc_runs'
 id:Mapped[str]=mapped_column(ForeignKey('game_runs.id'),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 instance_id:Mapped[str]=mapped_column(ForeignKey('disc_instances.id'))
 effects_json:Mapped[str]=mapped_column(String(500))
 expires_at:Mapped[datetime]=mapped_column()
 score:Mapped[Optional[int]]=mapped_column(nullable=True)
 raw_score:Mapped[Optional[int]]=mapped_column(nullable=True)
 completed_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)

class DiscBonusWallet(Base):
 __tablename__='disc_bonus_wallets'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 hundredths:Mapped[int]=mapped_column(default=0)

class DiscBonusReceipt(Base):
 __tablename__='disc_bonus_receipts'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 reason:Mapped[str]=mapped_column(String(200),primary_key=True)
 amount:Mapped[int]=mapped_column()

class StudioChatMessage(Base):
 __tablename__='studio_chat_messages'
 id:Mapped[int]=mapped_column(primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 body:Mapped[str]=mapped_column(String(800))
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow,index=True)
 deleted:Mapped[bool]=mapped_column(default=False)

class DiscTrade(Base):
 __tablename__='disc_trades'
 id:Mapped[str]=mapped_column(String(32),primary_key=True)
 sender_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 recipient_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 request_id:Mapped[str]=mapped_column(String(40))
 status:Mapped[str]=mapped_column(String(20),default='pending')
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 expires_at:Mapped[datetime]=mapped_column()
 resolved_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)
 __table_args__=(Index('ix_disc_trade_request','sender_id','request_id',unique=True),)

class DiscTradeItem(Base):
 __tablename__='disc_trade_items'
 trade_id:Mapped[str]=mapped_column(ForeignKey('disc_trades.id'),primary_key=True)
 instance_id:Mapped[str]=mapped_column(ForeignKey('disc_instances.id'),primary_key=True)
 offered_by:Mapped[int]=mapped_column(ForeignKey('users.id'))

class DiscWearEvent(Base):
 __tablename__='disc_wear_events'
 instance_id:Mapped[str]=mapped_column(ForeignKey('disc_instances.id'),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 outcome:Mapped[str]=mapped_column(String(20))
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 seen_at:Mapped[Optional[datetime]]=mapped_column(nullable=True)

class DiscListing(Base):
 __tablename__='disc_listings'
 id:Mapped[str]=mapped_column(String(32),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 request_id:Mapped[str]=mapped_column(String(40))
 offered_json:Mapped[str]=mapped_column(String(500))
 wanted_json:Mapped[str]=mapped_column(String(500))
 status:Mapped[str]=mapped_column(String(20),default='open')
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 expires_at:Mapped[datetime]=mapped_column()
 __table_args__=(Index('ix_disc_listing_request','user_id','request_id',unique=True),)

class DiscListingReply(Base):
 __tablename__='disc_listing_replies'
 trade_id:Mapped[str]=mapped_column(ForeignKey('disc_trades.id'),primary_key=True)
 listing_id:Mapped[str]=mapped_column(ForeignKey('disc_listings.id'),index=True)
 responder_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)

class DiscTradeNotice(Base):
 __tablename__='disc_trade_notices'
 trade_id:Mapped[str]=mapped_column(ForeignKey('disc_trades.id'),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'))
 status:Mapped[str]=mapped_column(String(20),default='queued')
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
