import unittest,json
from sqlalchemy import event
from test_bekovich import BekovichTest
from bekovich_models import StudioBadge,BekovichWallet
from bekovich_service import public_badges,BekovichError
class PublicBadgeTest(BekovichTest):
 def test_public_lookup_equipped_only_and_one_query(self):
  with self.sessions.begin() as db:
   db.add_all([StudioBadge(id='a',user_id=1,name_key='a',data_json=json.dumps({'title':'One'})),StudioBadge(id='b',user_id=2,name_key='b',data_json=json.dumps({'title':'Two'}))]);db.flush()
   db.add_all([BekovichWallet(user_id=1,badge_id='a'),BekovichWallet(user_id=2,badge_id=None)]);db.flush()
   queries=[]
   def record(*args):queries.append(args[2])
   event.listen(self.engine,'before_cursor_execute',record)
   try:result=public_badges(db,[1,2,3,1])
   finally:event.remove(self.engine,'before_cursor_execute',record)
   self.assertEqual(len(queries),1);self.assertEqual(result,{'badges':{'1':{'title':'One','item_id':'a'},'2':None,'3':None}})
   db.get(BekovichWallet,1).badge_id='b';db.flush()
   self.assertIsNone(public_badges(db,[1])['badges']['1'])
 def test_invalid_lookup(self):
  with self.sessions() as db:
   self.assertEqual(public_badges(db,[]),{'badges':{}})
   for ids in [[0],[-1],list(range(1,102))]:
    with self.assertRaises(BekovichError):public_badges(db,ids)
