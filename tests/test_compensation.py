import json
import os
import unittest
from datetime import datetime
os.environ["DATABASE_URL"]="sqlite:///:memory:"
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,RecordReset,CompensationLetter,JeraTx
from score_service import initialize_score_state
from compensation_service import initialize_letters,list_letters,mark_read


class CompensationMailTest(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.sessions=sessionmaker(bind=self.engine)
        initialize_score_state(self.sessions)
        awards=[
            dict(user_id=1,game="dino",score=500,place=1,target=100,already_paid=40,credit=60),
            dict(user_id=1,game="snake",score=10,place=2,target=75,already_paid=0,credit=75),
            dict(user_id=2,game="dino",score=400,place=2,target=75,already_paid=75,credit=0),
            dict(user_id=3,game="dino",score=300,place=3,target=75,already_paid=0,credit=75),
        ]
        with self.sessions.begin() as db:
            db.add_all([User(id=i,first_name=str(i),jera=1000) for i in (1,2,3)])
            db.add(RecordReset(id="campaign",archive_hash="0"*64,archive_json=json.dumps({"awards":awards}),applied_at=datetime.utcnow()))

    def tearDown(self):self.engine.dispose()

    def test_backfill_is_once_and_receipt_contains_only_own_awards(self):
        initialize_letters(self.sessions);initialize_letters(self.sessions)
        with self.sessions() as db:
            letters=list_letters(db,1)
            self.assertEqual(len(letters),1)
            self.assertEqual(letters[0]["total"],135)
            self.assertEqual(letters[0]["previous_total"],40)
            self.assertEqual(letters[0]["target_total"],175)
            self.assertEqual([row["game"] for row in letters[0]["entries"]],["dino","snake"])
            self.assertFalse(letters[0]["read"])
            self.assertEqual(list_letters(db,2),[])
            self.assertEqual(db.scalar(select(func.count()).select_from(CompensationLetter)),2)

    def test_acknowledge_survives_restart_and_never_changes_balance(self):
        initialize_letters(self.sessions)
        with self.sessions.begin() as db:
            self.assertTrue(mark_read(db,1,"campaign"))
            self.assertTrue(mark_read(db,1,"campaign"))
            self.assertFalse(mark_read(db,2,"campaign"))
            self.assertFalse(mark_read(db,1,"someone-elses-campaign"))
        initialize_letters(self.sessions)
        with self.sessions() as db:
            self.assertTrue(list_letters(db,1)[0]["read"])
            self.assertFalse(list_letters(db,3)[0]["read"])
            self.assertEqual(db.get(User,1).jera,1000)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),0)


if __name__=="__main__":unittest.main()
