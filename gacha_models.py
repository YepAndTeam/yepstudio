from datetime import datetime
from sqlalchemy import ForeignKey,String,Text,UniqueConstraint
from sqlalchemy.orm import Mapped,mapped_column
from database import Base

class GachaBatch(Base):
 __tablename__='gacha_batches'
 id:Mapped[str]=mapped_column(String(32),primary_key=True)
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
 kind:Mapped[str]=mapped_column(String(12))
 request_id:Mapped[str]=mapped_column(String(64))
 items_json:Mapped[str]=mapped_column(Text)
 status:Mapped[str]=mapped_column(String(12),default='pending')
 created_at:Mapped[datetime]=mapped_column(default=datetime.utcnow)
 __table_args__=(UniqueConstraint('user_id','kind','request_id'),)

class GachaBatchRequest(Base):
 __tablename__='gacha_batch_requests'
 user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
 kind:Mapped[str]=mapped_column(String(12),primary_key=True)
 request_id:Mapped[str]=mapped_column(String(64),primary_key=True)
 batch_id:Mapped[str]=mapped_column(ForeignKey('gacha_batches.id'))
