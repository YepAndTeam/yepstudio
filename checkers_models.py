from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, Integer, String, Text

from database import Base


class CheckersGame(Base):
    __tablename__ = "checkers_games"

    id = Column(Integer, primary_key=True)
    creator_id = Column(BigInteger, nullable=False, index=True)
    white_id = Column(BigInteger, nullable=True, index=True)
    black_id = Column(BigInteger, nullable=True, index=True)
    moves = Column(Text, nullable=False, default="")  # ходы через пробел: "c3-d4 f6:d4" (":" = взятие)
    status = Column(String(12), nullable=False, default="open")  # open / active / finished / cancelled
    result = Column(String(8), nullable=True)  # "1-0", "0-1", "1/2-1/2"
    reason = Column(String(20), nullable=True)  # no_moves, no_pieces, repetition, king_moves, resign
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)