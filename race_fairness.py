"""Pinned drand default chain, BLS verification and reproducible weighted draw."""
import hashlib,json,math
from datetime import datetime
from urllib.request import urlopen
CHAIN={'hash':'8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce','public_key':'868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31','period':30,'genesis_time':1595431050,'scheme':'pedersen-bls-chained'}
ALGORITHM='yab-race-v1'
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def commitment(rules):return hashlib.sha256(canonical(rules).encode()).hexdigest()
def round_at(timestamp):return max(1,math.ceil((timestamp-CHAIN['genesis_time'])/CHAIN['period'])+1)
def round_timestamp(number):return CHAIN['genesis_time']+(number-1)*CHAIN['period']
def verify_beacon(beacon,expected_round):
 from py_ecc.bls import G2Basic
 try:
  if type(beacon['round']) is not int or beacon['round']!=expected_round:return False
  signature=bytes.fromhex(beacon['signature']);previous=bytes.fromhex(beacon['previous_signature'])
  if len(signature)!=96 or len(previous) not in (32,96):return False
  if hashlib.sha256(signature).hexdigest()!=beacon['randomness']:return False
  message=hashlib.sha256(previous+expected_round.to_bytes(8,'big')).digest()
  return G2Basic.Verify(bytes.fromhex(CHAIN['public_key']),message,signature)
 except (ValueError,KeyError,TypeError,OverflowError):return False

def fetch_beacon(number):
 # No arbitrary URLs or latest-round substitution; mirror failures retain the same round.
 for host in ('https://api.drand.sh','https://api2.drand.sh'):
  try:
   with urlopen(f"{host}/{CHAIN['hash']}/public/{number}",timeout=6) as response:beacon=json.loads(response.read(8192))
   if verify_beacon(beacon,number):return beacon
  except Exception:continue
 return None

def draw(rules,randomness):
 seed=hashlib.sha256((ALGORITHM+'|'+commitment(rules)+'|'+randomness).encode()).digest()
 horses=[dict(h) for h in rules['horses']];ranking=[];counter=0
 while horses:
  total=sum(h['weight'] for h in horses);limit=(1<<256)-((1<<256)%total)
  while True:
   value=int.from_bytes(hashlib.sha256(seed+counter.to_bytes(8,'big')).digest(),'big');counter+=1
   if value<limit:break
  pick=value%total
  for i,horse in enumerate(horses):
   if pick<horse['weight']:ranking.append(horse['number']);horses.pop(i);break
   pick-=horse['weight']
 return ranking
