from sqlalchemy import ForeignKey,Text
from sqlalchemy.orm import Mapped,mapped_column
from database import Base

class YaabikState(Base):
    __tablename__='yaabik_states'
    user_id:Mapped[int]=mapped_column(ForeignKey('users.id'),primary_key=True)
    data_json:Mapped[str]=mapped_column(Text,default='{}')
