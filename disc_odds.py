"""Boost non-common chances by 10%, round up to tenths, charge the common pool."""
from decimal import Decimal,ROUND_CEILING

def boosted_chances(groups,percent=0):
 result={g['id'] if 'id' in g else g['key']:Decimal(str(g['chance'])) for g in groups}
 if percent<=0:return {k:float(v) for k,v in result.items()}
 multiplier=Decimal(100+percent)/100
 for key in result:
  if key!='common':result[key]=(result[key]*multiplier).quantize(Decimal('.1'),rounding=ROUND_CEILING)
 result['common']=Decimal(100)-sum(v for k,v in result.items() if k!='common')
 if result['common']<0:raise ValueError('Luck must leave a non-negative common pool')
 return {k:float(v) for k,v in result.items()}
