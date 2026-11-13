import os
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from database import (Base, User, GameScore, AllTimeScore, GameResult, GameRun, Meta,
                      Tournament, TournamentScore, TournamentResult, TournamentEntry, RecordReset, JeraTx, WeeklyResult)
from score_service import initialize_score_state, submit_result, begin_run, invalidate_scores, ScoreError
from weekly import ensure_period, period_now
from reset_records import preview, saved_preview, apply_plan, calculate


class RecordsTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine)
        initialize_score_state(self.sessions)
        with self.sessions.begin() as db:
            db.add_all([User(id=i, first_name=str(i), jera=0) for i in range(1, 5)])

    def tearDown(self):
        self.engine.dispose()

    def test_saved_calculation_survives_sessions_and_explicit_refresh(self):
        with self.sessions.begin() as db:
            db.add(GameScore(user_id=1, game="dino", best=123, plays=1))
        with self.sessions.begin() as db:
            original = saved_preview(db)
        with self.sessions.begin() as db:
            self.assertEqual(saved_preview(db), original)
            self.assertEqual(preview(db)["archive_hash"], original["archive_hash"])
            db.add(GameScore(user_id=2, game="dino", best=456, plays=1))
        with self.sessions.begin() as db:
            self.assertEqual(saved_preview(db), original)
            updated = saved_preview(db, refresh=True)
            self.assertNotEqual(updated["archive_hash"], original["archive_hash"])
        with self.sessions.begin() as db:
            self.assertEqual(saved_preview(db), updated)

    def test_drive_run_saves_both_boards_and_retry_is_idempotent(self):
        now=datetime.utcnow()
        with self.sessions.begin() as db:
            run=begin_run(db,1,"drive",now=now-timedelta(seconds=30))
            row,old,record=submit_result(db,1,"drive",240,now=now,run_id=run.id)
            self.assertEqual((row.best,old,record),(240,0,True))
            row,old,record=submit_result(db,1,"drive",240,now=now,run_id=run.id)
            self.assertFalse(record)
            self.assertEqual(row.plays,1)
            self.assertEqual(db.scalar(select(AllTimeScore.best).where(AllTimeScore.game=="drive")),240)
            self.assertEqual(db.scalar(select(func.count()).select_from(GameResult)),1)
            self.assertEqual(db.get(User,1).jera,0)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),0)

    def test_alltime_repairs_without_weekly_record(self):
        with self.sessions.begin() as db:
            db.add(GameScore(user_id=1, game="dino", best=700, plays=1))
        with self.sessions.begin() as db:
            row, old, record = submit_result(db, 1, "dino", 500)
            self.assertFalse(record)
            self.assertEqual(row.best, 700)
            self.assertEqual(db.scalar(select(AllTimeScore.best)), 700)
            self.assertEqual(db.scalar(select(func.count()).select_from(GameResult)), 1)

    def test_one_result_updates_week_alltime_and_active_tournaments(self):
        now = datetime.utcnow()
        with self.sessions.begin() as db:
            db.add_all([
                Tournament(id="active", title="Dino", game="dino", starts_at=now-timedelta(hours=1), ends_at=now+timedelta(hours=1)),
                Tournament(id="ended", title="Old", game="dino", starts_at=now-timedelta(hours=2), ends_at=now),
                Tournament(id="other", title="Snake", game="snake", starts_at=now-timedelta(hours=1), ends_at=now+timedelta(hours=1)),
            ])
        with self.sessions.begin() as db:
            db.add(TournamentEntry(tournament_id="active",user_id=1,joined_at=now-timedelta(minutes=3)))
            db.flush()
            run = begin_run(db, 1, "dino", now=now-timedelta(minutes=2))
            submit_result(db, 1, "dino", 700, now=now, run_id=run.id)
            self.assertEqual(db.scalar(select(TournamentScore.best)), 700)
            self.assertEqual(db.scalar(select(func.count()).select_from(TournamentResult)), 1)
            self.assertEqual(db.scalar(select(AllTimeScore.best)), 700)
        with self.sessions.begin() as db:
            submit_result(db, 1, "dino", 500, now=now)
            self.assertEqual(db.scalar(select(TournamentScore.best)), 700)
            self.assertEqual(db.scalar(select(GameScore.best)), 700)

    def test_run_retry_is_idempotent_and_owned(self):
        with self.sessions.begin() as db:
            run = begin_run(db, 1, "dino")
            rid = run.id
            submit_result(db, 1, "dino", 500, run_id=rid)
        with self.sessions.begin() as db:
            submit_result(db, 1, "dino", 500, run_id=rid)
            self.assertEqual(db.scalar(select(GameScore.plays)), 1)
            self.assertEqual(db.scalar(select(func.count()).select_from(GameResult)), 1)
        with self.sessions() as db:
            with self.assertRaises(ScoreError): submit_result(db, 2, "dino", 500, run_id=rid)
            db.rollback()

    def test_rollover_pays_once_preserves_alltime_and_ties(self):
        with self.sessions.begin() as db:
            db.merge(Meta(key="period", value=str(period_now()-1)))
            db.add_all([GameScore(user_id=i, game="dino", best=500, plays=1) for i in (1, 2)])
        with self.sessions.begin() as db:
            ensure_period(db)
            self.assertEqual(db.scalar(select(func.count()).select_from(GameScore)), 0)
        with self.sessions.begin() as db:
            ensure_period(db)
            self.assertEqual(list(db.scalars(select(User.jera).where(User.id.in_([1,2])).order_by(User.id))), [1000,1000])
            self.assertEqual(list(db.scalars(select(WeeklyResult.place))), [1,1])
            self.assertEqual(db.scalar(select(func.count()).select_from(AllTimeScore)), 2)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)), 2)

    def test_reset_snapshot_credit_epoch_and_retry(self):
        with self.sessions.begin() as db:
            db.add_all([GameScore(user_id=1,game="dino",best=500,plays=1), AllTimeScore(user_id=2,game="dino",best=500), AllTimeScore(user_id=3,game="dino",best=300)])
            db.add(JeraTx(user_id=1,amount=40,reason="legacy:dino"))
            db.get(User,1).jera=40
            old_run=begin_run(db,1,"dino").id
            db.merge(Meta(key="score_maintenance",value="1"))
        with self.sessions() as db:
            plan=preview(db)
            self.assertEqual([a["credit"] for a in plan["awards"]], [60,100,75])
            self.assertEqual(db.scalar(select(func.count()).select_from(GameScore)),1)
        with self.sessions.begin() as db:
            result=apply_plan(db,plan)
            self.assertFalse(result["already_applied"])
        with self.sessions.begin() as db:
            self.assertTrue(apply_plan(db,plan)["already_applied"])
            self.assertEqual([db.get(User,i).jera for i in (1,2,3)],[100,100,75])
            self.assertEqual(db.scalar(select(func.count()).select_from(AllTimeScore)),0)
            self.assertIsNotNone(db.get(RecordReset,plan["reset_id"]))
            db.merge(Meta(key="score_maintenance",value="0"))
        with self.sessions() as db:
            with self.assertRaises(ScoreError): submit_result(db,1,"dino",600,run_id=old_run)
            db.rollback()
            with self.assertRaises(ScoreError): submit_result(db,1,"dino",600)
            db.rollback()
        with self.sessions.begin() as db:
            run=begin_run(db,1,"dino")
            submit_result(db,1,"dino",50,run_id=run.id)
            self.assertEqual(db.scalar(select(AllTimeScore.best)),50)

    def test_reset_rejects_drift_and_maintenance_blocks_scores(self):
        with self.sessions.begin() as db:
            db.add(GameScore(user_id=1,game="dino",best=500,plays=1))
            db.merge(Meta(key="score_maintenance",value="1"))
        with self.sessions() as db: plan=preview(db)
        with self.sessions.begin() as db: db.get(User,1).jera=10
        with self.sessions() as db:
            with self.assertRaises(ValueError): apply_plan(db,plan)
            db.rollback()
            with self.assertRaises(ScoreError): begin_run(db,1,"dino")
            db.rollback()
            self.assertEqual(db.scalar(select(GameScore.best)),500)

    def test_moderation_invalidates_all_rankings(self):
        now=datetime.utcnow()
        with self.sessions.begin() as db:
            db.add(Tournament(id="event",title="Dino",game="dino",starts_at=now-timedelta(hours=1),ends_at=now+timedelta(hours=1)))
        with self.sessions.begin() as db: submit_result(db,1,"dino",500)
        with self.sessions.begin() as db:
            invalidate_scores(db,1,"dino")
            self.assertEqual(db.scalar(select(func.count()).select_from(GameScore)),0)
            self.assertEqual(db.scalar(select(func.count()).select_from(AllTimeScore)),0)
            self.assertEqual(db.scalar(select(func.count()).select_from(TournamentScore)),0)
            self.assertFalse(db.scalar(select(GameResult.valid)))

    def test_old_scores_do_not_return_after_reset_or_restart(self):
        import database
        from sqlalchemy import text
        with self.engine.begin() as conn:
            conn.execute(text("CREATE TABLE scores (user_id BIGINT, best INTEGER, plays INTEGER, updated_at TIMESTAMP)"))
            conn.execute(text("INSERT INTO scores VALUES (1,500,1,'2026-11-10 00:00:00')"))
        with patch.object(database, "engine", self.engine):
            database.migrate()
            with self.sessions.begin() as db:
                self.assertEqual(db.scalar(select(GameScore.best)),500)
                db.execute(__import__('sqlalchemy').delete(GameScore))
            database.migrate()
            with self.sessions() as db:
                self.assertEqual(db.scalar(select(func.count()).select_from(GameScore)),0)

    def test_parallel_submissions_keep_highest_score(self):
        from concurrent.futures import ThreadPoolExecutor
        with tempfile.TemporaryDirectory() as directory:
            engine=create_engine("sqlite:///"+str(Path(directory)/"scores.db"),connect_args={"check_same_thread":False,"timeout":10})
            try:
                Base.metadata.create_all(engine)
                sessions=sessionmaker(bind=engine)
                initialize_score_state(sessions)
                with sessions.begin() as db: db.add(User(id=1,first_name="A",jera=0))
                def send(score):
                    with sessions.begin() as db: submit_result(db,1,"dino",score)
                with ThreadPoolExecutor(max_workers=4) as pool: list(pool.map(send,[100,500,300,900,200,700,400,800]))
                with sessions() as db:
                    self.assertEqual(db.scalar(select(GameScore.best)),900)
                    self.assertEqual(db.scalar(select(AllTimeScore.best)),900)
                    self.assertEqual(db.scalar(select(GameScore.plays)),8)
                    self.assertEqual(db.scalar(select(func.count()).select_from(GameResult)),8)
            finally: engine.dispose()

    def test_reset_failure_rolls_back_archive_payments_and_deletion(self):
        with self.sessions.begin() as db:
            db.add(GameScore(user_id=1,game="dino",best=500,plays=1))
            db.merge(Meta(key="score_maintenance",value="1"))
        with self.sessions() as db: plan=preview(db)
        with self.assertRaises(RuntimeError):
            with self.sessions.begin() as db:
                with patch("reset_records.grant",side_effect=RuntimeError("simulated failure")):
                    apply_plan(db,plan)
        with self.sessions() as db:
            self.assertEqual(db.get(User,1).jera,0)
            self.assertEqual(db.scalar(select(GameScore.best)),500)
            self.assertEqual(db.scalar(select(func.count()).select_from(RecordReset)),0)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),0)

    def test_removed_record_is_not_resurrected_from_weekly_archive(self):
        archive={"users":[{"id":1,"jera":0}],"weekly_results":[{"user_id":1,"game":"dino","best":500}],"game_scores":[],"alltime_scores":[],"jera_tx":[]}
        self.assertEqual(calculate(archive),[])


if __name__ == "__main__":
    unittest.main()
