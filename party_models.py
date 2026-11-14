from datetime import datetime
from sqlalchemy import BigInteger,Integer,String,Text,DateTime,Float
from sqlalchemy.orm import Mapped,mapped_column
from database import Base

class PartyRoom(Base):
    __tablename__='party_rooms'
    code:Mapped[str]=mapped_column(String(8),primary_key=True)
    kind:Mapped[str]=mapped_column(String(12),index=True)
    status:Mapped[str]=mapped_column(String(12),default='lobby',index=True)
    public:Mapped[bool]=mapped_column(default=True)
    data_json:Mapped[str]=mapped_column(Text)
    revision:Mapped[int]=mapped_column(Integer,default=0)
    updated_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow,index=True)

class PartyMember(Base):
    __tablename__='party_members'
    room_code:Mapped[str]=mapped_column(String(8),primary_key=True)
    user_id:Mapped[int]=mapped_column(BigInteger,primary_key=True,index=True)

class PartyTiming(Base):
    __tablename__='party_timings'
    kind:Mapped[str]=mapped_column(String(12),primary_key=True)
    discussion_seconds:Mapped[int]=mapped_column(Integer,default=120)
    vote_seconds:Mapped[int]=mapped_column(Integer,default=45)

class PartyLook(Base):
    __tablename__='party_looks'
    room_code:Mapped[str]=mapped_column(String(8),primary_key=True)
    user_id:Mapped[int]=mapped_column(BigInteger,primary_key=True)
    yaw:Mapped[float]=mapped_column(Float,default=0)
    pitch:Mapped[float]=mapped_column(Float,default=-.08)
    updated_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
