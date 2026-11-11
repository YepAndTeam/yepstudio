import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

os.environ["DATABASE_URL"]="sqlite:///:memory:"
from sqlalchemy import create_engine,select,func
from sqlalchemy.orm import sessionmaker
from database import Base,User,UserTheme,ThemeBoxPurchase,JeraTx,Meta
from score_service import initialize_score_state
from shop_service import (initialize_shop_state,owned_themes,buy_box,unlock_box,
                          shop_state,choose_theme,ShopError,BASE_THEMES,LEGACY_THEMES)


class ShopTest(unittest.TestCase):
    def setUp(self):
        self.engine=create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.sessions=sessionmaker(bind=self.engine)
        initialize_score_state(self.sessions)
        with self.sessions.begin() as db:
            db.add_all([User(id=1,first_name="Old",jera=500),User(id=2,first_name="Old preview",jera=500,theme="poop")])
        initialize_shop_state(self.sessions)
        with self.sessions.begin() as db:db.add(User(id=3,first_name="New",jera=500))

    def tearDown(self):self.engine.dispose()

    def test_old_users_keep_four_themes_new_users_only_base(self):
        initialize_shop_state(self.sessions)
        with self.sessions() as db:
            self.assertEqual(owned_themes(db,1),BASE_THEMES|LEGACY_THEMES)
            self.assertEqual(owned_themes(db,3),BASE_THEMES)
            self.assertNotIn("poop",owned_themes(db,2))
            self.assertEqual(db.get(User,2).theme,"dark")
            self.assertEqual(db.scalar(select(func.count()).select_from(UserTheme)),8)

    def test_exact_chance_distribution(self):
        counts={}
        for draw in range(3000):
            with patch("shop_service.secrets.randbelow",return_value=draw):
                theme=choose_theme();counts[theme]=counts.get(theme,0)+1
        self.assertEqual(counts,{"retro":1050,"terminal":1050,"tetris":250,"nyan":250,"neon":250,"poop":150})

    def test_buy_replay_and_recovery_do_not_charge_twice(self):
        with self.sessions.begin() as db:first=buy_box(db,3,"one")
        with self.sessions.begin() as db:
            retry=buy_box(db,3,"one")
            recovered=buy_box(db,3,"after-reload")
            self.assertEqual(first["box_id"],retry["box_id"])
            self.assertEqual(first["box_id"],recovered["box_id"])
            self.assertEqual(first["runes"],recovered["runes"])
            self.assertEqual(db.get(User,3).jera,400)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),1)
            state=shop_state(db,3)
            self.assertEqual(state["active_box"]["id"],first["box_id"])
            self.assertEqual(state["history"],[])
            self.assertNotIn("theme_id",state["active_box"])

    def test_new_theme_and_duplicate_refunds_are_persistent_and_idempotent(self):
        with patch("shop_service.choose_theme",return_value="poop"):
            with self.sessions.begin() as db:box=buy_box(db,3,"mythic-new")
            with self.sessions.begin() as db:
                answer=unlock_box(db,3,box["box_id"],box["runes"])
                self.assertTrue(answer["ok"]);self.assertFalse(answer["isDupe"])
                self.assertEqual(answer["refund"],0);self.assertIn("poop",owned_themes(db,3))
            with self.sessions.begin() as db:second=buy_box(db,3,"mythic-dupe")
            with self.sessions.begin() as db:
                answer=unlock_box(db,3,second["box_id"],second["runes"])
                self.assertTrue(answer["isDupe"]);self.assertEqual(answer["refund"],100)
            with self.sessions.begin() as db:
                replay=unlock_box(db,3,second["box_id"],second["runes"])
                self.assertEqual(replay["balance"],400)
                self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),3)
                self.assertEqual(shop_state(db,3)["history"][0]["refund"],100)

    def test_neon_box_awards_theme_once_and_refunds_duplicate(self):
        with patch("shop_service.choose_theme",return_value="neon"):
            with self.sessions.begin() as db:first=buy_box(db,3,"neon-first")
            with self.sessions.begin() as db:
                answer=unlock_box(db,3,first["box_id"],first["runes"])
                self.assertTrue(answer["ok"]);self.assertFalse(answer["isDupe"])
                self.assertEqual(answer["refund"],0);self.assertIn("neon",owned_themes(db,3))
            with self.sessions.begin() as db:
                replay=unlock_box(db,3,first["box_id"],first["runes"])
                self.assertEqual(replay["balance"],400)
                self.assertEqual(db.scalar(select(func.count()).select_from(UserTheme).where(UserTheme.user_id==3,UserTheme.theme_id=="neon")),1)
            with self.sessions.begin() as db:second=buy_box(db,3,"neon-second")
            with self.sessions.begin() as db:
                duplicate=unlock_box(db,3,second["box_id"],second["runes"])
                self.assertTrue(duplicate["isDupe"]);self.assertEqual(duplicate["refund"],50)
                self.assertEqual(duplicate["balance"],350)

    def test_ordinary_rare_duplicate_refunds(self):
        with self.sessions.begin() as db:db.add(UserTheme(user_id=1,theme_id="neon",source="test"))
        for theme,refund in (("retro",25),("tetris",50),("neon",50)):
            with patch("shop_service.choose_theme",return_value=theme):
                with self.sessions.begin() as db:box=buy_box(db,1,theme)
                with self.sessions.begin() as db:
                    before=db.get(User,1).jera
                    answer=unlock_box(db,1,box["box_id"],box["runes"])
                    self.assertTrue(answer["isDupe"]);self.assertEqual(answer["refund"],refund)
                    self.assertEqual(answer["balance"],before+refund)

    def test_wrong_code_refunds_half_once(self):
        with self.sessions.begin() as db:box=buy_box(db,3,"lost")
        wrong=list(reversed(box["runes"]))
        with self.sessions.begin() as db:
            answer=unlock_box(db,3,box["box_id"],wrong)
            self.assertFalse(answer["ok"]);self.assertEqual(answer["refund"],50)
        with self.sessions.begin() as db:
            unlock_box(db,3,box["box_id"],box["runes"])
            self.assertEqual(db.get(User,3).jera,450)
            self.assertEqual(owned_themes(db,3),BASE_THEMES)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),2)

    def test_other_user_cannot_open_purchase(self):
        with self.sessions.begin() as db:box=buy_box(db,3,"private")
        with self.sessions() as db:
            with self.assertRaises(ShopError) as error:unlock_box(db,2,box["box_id"],box["runes"])
            self.assertEqual(error.exception.status,404)

    def test_insufficient_balance_and_maintenance(self):
        with self.sessions.begin() as db:db.get(User,3).jera=0
        with self.sessions() as db:
            with self.assertRaises(ShopError):buy_box(db,3,"poor")
            db.rollback()
            self.assertEqual(db.scalar(select(func.count()).select_from(ThemeBoxPurchase)),0)
        with self.sessions.begin() as db:db.merge(Meta(key="score_maintenance",value="1"))
        with self.sessions() as db:
            with self.assertRaises(ShopError) as error:buy_box(db,1,"maintenance")
            self.assertEqual(error.exception.status,503)

    def test_failed_purchase_rolls_back_charge(self):
        with self.assertRaises(RuntimeError):
            with self.sessions.begin() as db:
                with patch("shop_service.choose_theme",side_effect=RuntimeError("failure")):buy_box(db,3,"failed")
        with self.sessions() as db:
            self.assertEqual(db.get(User,3).jera,500)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),0)

    def test_parallel_buy_requests_share_one_paid_pending_box(self):
        with tempfile.TemporaryDirectory() as directory:
            engine=create_engine("sqlite:///"+str(Path(directory)/"shop.db"),connect_args={"check_same_thread":False,"timeout":10})
            try:
                Base.metadata.create_all(engine);sessions=sessionmaker(bind=engine);initialize_score_state(sessions)
                with sessions.begin() as db:db.add(User(id=1,first_name="A",jera=100))
                def send(key):
                    with sessions.begin() as db:return buy_box(db,1,key)["box_id"]
                with ThreadPoolExecutor(max_workers=4) as pool:ids=list(pool.map(send,["a","b","c","d"]))
                self.assertEqual(len(set(ids)),1)
                with sessions() as db:
                    self.assertEqual(db.get(User,1).jera,0)
                    self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),1)
            finally:engine.dispose()


    def test_admin_test_balance_is_self_only_and_retry_safe(self):
        from shop_service import grant_test_balance
        token="12345678-1234-1234-1234-123456789012"
        with self.sessions() as db:
            with self.assertRaises(ShopError) as error:grant_test_balance(db,3,token)
            self.assertEqual(error.exception.status,403)
            db.rollback()
        with self.sessions.begin() as db:db.get(User,1).role="admin"
        with self.sessions.begin() as db:
            response=grant_test_balance(db,1,token)
            self.assertTrue(response["credited"])
            self.assertEqual(response["balance"],10500)
        with self.sessions.begin() as db:
            response=grant_test_balance(db,1,token)
            self.assertFalse(response["credited"])
            self.assertEqual(db.get(User,1).jera,10500)
            self.assertEqual(db.get(User,3).jera,500)
            self.assertEqual(db.scalar(select(func.count()).select_from(JeraTx)),1)
if __name__=="__main__":unittest.main()
