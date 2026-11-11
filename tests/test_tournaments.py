import os,json,unittest,ast
from datetime import datetime,timedelta
from pathlib import Path
from unittest.mock import patch
os.environ["DATABASE_URL"]="sqlite:///:memory:"
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import (Base,User,Meta,Tournament,TournamentEntry,TournamentScore,TournamentAward,
                      TournamentVote,TournamentResult,UserTheme,JeraTx)
from score_service import initialize_score_state,begin_run,submit_result,ScoreError
from tournament_service import (create_event,start_event,register,cancel_event,settle_due,
                                event_state,vote,next_is_free,TournamentError)


class TournamentTest(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.sessions=sessionmaker(bind=self.engine)
        initialize_score_state(self.sessions)
        self.now=datetime.utcnow()
        with self.sessions.begin() as db:db.add_all(User(id=i,first_name=f"Player {i}",jera=500) for i in range(1,8))

    def tearDown(self):self.engine.dispose()

    def event(self):
        with self.sessions.begin() as db:return create_event(db,"Dino Cup",now=self.now).id

    def paid_event(self):
        first=self.event()
        with self.sessions.begin() as db:
            event=db.get(Tournament,first);event.status="finished";event.settled_at=self.now
        with self.sessions.begin() as db:return create_event(db,"Second Cup","snake",24,50,now=self.now).id

    def test_first_free_and_countdown_starts_only_on_start(self):
        with self.sessions.begin() as db:
            event=create_event(db,"First",game="hell",duration_hours=1,entry_fee=999,now=self.now)
            eid=event.id
            self.assertEqual((event.game,event.duration_hours,event.entry_fee),("dino",48,0))
            register(db,eid,1,now=self.now);register(db,eid,1,now=self.now)
            self.assertEqual(db.get(User,1).jera,500)
            self.assertIsNone(event_state(db,event,1)["ends_at"])
        later=self.now+timedelta(days=3)
        with self.sessions.begin() as db:
            event=start_event(db,eid,now=later)
            self.assertEqual(event.ends_at,later+timedelta(hours=48))
            self.assertEqual(start_event(db,eid,now=later+timedelta(hours=1)).starts_at,later)
            self.assertEqual(db.scalar(select(func.count()).select_from(TournamentEntry)),1)

    def test_registration_before_run_is_required(self):
        eid=self.event()
        with self.sessions.begin() as db:
            start_event(db,eid,now=self.now)
            run=begin_run(db,1,"dino",now=self.now+timedelta(seconds=1))
            register(db,eid,1,now=self.now+timedelta(seconds=2))
            submit_result(db,1,"dino",100,now=self.now+timedelta(seconds=20),run_id=run.id)
            self.assertEqual(db.scalar(select(func.count()).select_from(TournamentScore)),0)
            run=begin_run(db,1,"dino",now=self.now+timedelta(seconds=30))
            submit_result(db,1,"dino",200,now=self.now+timedelta(seconds=60),run_id=run.id)
            self.assertEqual(db.scalar(select(TournamentScore.best)),200)

    def test_unregistered_and_legacy_submissions_do_not_enter_tournament(self):
        eid=self.event()
        with self.sessions.begin() as db:
            start_event(db,eid,now=self.now)
            run=begin_run(db,1,"dino",now=self.now)
            submit_result(db,1,"dino",100,now=self.now+timedelta(minutes=1),run_id=run.id)
            register(db,eid,2,now=self.now)
            submit_result(db,2,"dino",100,now=self.now+timedelta(minutes=1))
            self.assertEqual(db.scalar(select(func.count()).select_from(TournamentScore)),0)

    def test_deadline_and_impossible_dino_score(self):
        eid=self.event()
        with self.sessions.begin() as db:
            start_event(db,eid,now=self.now);register(db,eid,1,now=self.now)
            run=begin_run(db,1,"dino",now=self.now+timedelta(seconds=1));rid=run.id
        with self.sessions() as db:
            with self.assertRaises(ScoreError):submit_result(db,1,"dino",1000,now=self.now+timedelta(seconds=2),run_id=rid)
            db.rollback()
        with self.sessions.begin() as db:
            submit_result(db,1,"dino",100,now=self.now+timedelta(hours=48),run_id=rid)
            self.assertEqual(db.scalar(select(func.count()).select_from(TournamentScore)),0)

    def test_paid_registration_and_cancellation_refund_once(self):
        eid=self.paid_event()
        with self.sessions.begin() as db:
            register(db,eid,1);register(db,eid,1)
            self.assertEqual(db.get(User,1).jera,450)
            db.get(User,2).jera=0
        with self.sessions() as db:
            with self.assertRaises(TournamentError):register(db,eid,2)
            db.rollback()
        with self.sessions.begin() as db:cancel_event(db,eid);cancel_event(db,eid)
        with self.sessions() as db:
            self.assertEqual(db.get(User,1).jera,500)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),2)

    def seed_finished_contest(self,duplicate=False):
        eid=self.event()
        with self.sessions.begin() as db:
            event=start_event(db,eid,now=self.now-timedelta(hours=49))
            for uid,best in enumerate([500,500,400,300,200,100],1):
                register(db,eid,uid,now=self.now-timedelta(hours=50))
                db.add(TournamentScore(tournament_id=eid,user_id=uid,best=best,achieved_at=self.now-timedelta(hours=2,minutes=uid)))
            if duplicate:db.add(UserTheme(user_id=2,theme_id="poop",source="box"))
        return eid

    def test_prizes_and_tie_break_are_exactly_once(self):
        eid=self.seed_finished_contest()
        with self.sessions.begin() as db:self.assertTrue(settle_due(db,self.now))
        with self.sessions.begin() as db:
            self.assertFalse(settle_due(db,self.now))
            self.assertIsNotNone(db.get(UserTheme,(2,"poop")))
            self.assertEqual([db.get(User,i).jera for i in range(1,7)],[650,500,600,575,550,500])
            self.assertEqual(db.scalar(select(func.count()).select_from(TournamentAward)),5)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),4)
            self.assertEqual(db.get(Tournament,eid).status,"finished")

    def test_duplicate_winner_theme_is_200_jera(self):
        eid=self.seed_finished_contest(duplicate=True)
        with self.sessions.begin() as db:
            settle_due(db,self.now)
            self.assertEqual(db.get(User,2).jera,700)
            self.assertEqual(db.get(TournamentAward,(eid,2)).amount,200)

    def test_voting_is_one_per_user_and_selects_next_game(self):
        eid=self.seed_finished_contest()
        with self.sessions.begin() as db:
            settle_due(db,self.now)
            vote(db,eid,1,"snake");vote(db,eid,1,"flappy");vote(db,eid,2,"flappy")
            self.assertEqual(db.scalar(select(func.count()).select_from(TournamentVote)),2)
            event=create_event(db,"Next","hell",24,50,now=self.now)
            self.assertEqual(event.game,"flappy")
            self.assertTrue(db.get(Tournament,eid).voting_closed)
        with self.sessions() as db:
            with self.assertRaises(TournamentError):vote(db,eid,3,"snake")

    def test_only_one_open_event_and_future_fee_required(self):
        eid=self.event()
        with self.sessions() as db:
            with self.assertRaises(TournamentError):create_event(db,"overlap")
            db.rollback()
        with self.sessions.begin() as db:
            event=db.get(Tournament,eid);event.status="finished";event.settled_at=self.now
        with self.sessions() as db:
            with self.assertRaises(TournamentError):create_event(db,"Not free","dino",48,0)

    def test_public_share_has_absolute_open_graph_image_and_deep_link(self):
        eid=self.event()
        with self.sessions.begin() as db:db.get(Tournament,eid).title='<Dino & friends>'
        tree=ast.parse(Path('main.py').read_text(encoding='utf-8'))
        fn=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='tournament_share_page')
        fn.decorator_list=[]
        module=ast.fix_missing_locations(ast.Module(body=[fn],type_ignores=[]))
        from html import escape
        from tournament_service import get_event
        class HttpError(Exception):pass
        scope=dict(Depends=lambda x:None,get_db=lambda:None,get_event=get_event,TournamentError=TournamentError,
                   HTTPException=HttpError,WEBAPP_URL='https://example.test',TG_APP_LINK='https://t.me/demo_bot',
                   datetime=datetime,escape=escape)
        exec(compile(module,'share','exec'),scope)
        with self.sessions() as db:html=scope['tournament_share_page'](eid,db)
        self.assertIn('https://example.test/tournament-dino.png',html)
        self.assertIn('og:image:width',html)
        self.assertIn('startapp=tour_'+eid,html)
        self.assertIn('&lt;Dino &amp; friends&gt;',html)
        self.assertNotIn('<Dino & friends>',html)

    def test_existing_tournament_table_migrates_with_valid_prize_defaults(self):
        import database
        with self.engine.begin() as conn:
            conn.exec_driver_sql('DROP TABLE tournaments')
            conn.exec_driver_sql('CREATE TABLE tournaments (id VARCHAR(40) PRIMARY KEY, game VARCHAR(20), title VARCHAR(120), starts_at TIMESTAMP, ends_at TIMESTAMP, cancelled BOOLEAN)')
            conn.exec_driver_sql("INSERT INTO tournaments VALUES ('old','dino','Old Cup','2026-11-10 00:00:00','2026-11-12 00:00:00',0)")
        with patch.object(database,'engine',self.engine):database.migrate()
        with self.sessions() as db:
            event=db.get(Tournament,'old')
            self.assertEqual(json.loads(event.prize_jera),{'2':150,'3':100,'4':75,'5':50})
            self.assertEqual(event.status,'active')
            self.assertEqual(event.created_at,event.starts_at)
            self.assertFalse(event.voting_closed)

    def test_tied_vote_allows_only_a_leading_game(self):
        eid=self.seed_finished_contest()
        with self.sessions.begin() as db:
            settle_due(db,self.now);vote(db,eid,1,'snake');vote(db,eid,2,'flappy')
        with self.sessions() as db:
            with self.assertRaises(TournamentError):create_event(db,'Next','hell',24,50)
            db.rollback()
        with self.sessions.begin() as db:
            self.assertEqual(create_event(db,'Next','snake',24,50).game,'snake')


if __name__=='__main__':unittest.main()
