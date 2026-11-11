"""Local CLI: existing PostgreSQL only, no main import, startup or migrations."""
import argparse,json,sys,os
os.environ.setdefault('PGCONNECT_TIMEOUT','12')
from database import SessionLocal,engine
from accounting_service import readonly_report

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--days',type=int,choices=[0,7,30,90],default=30);parser.add_argument('--include-admins',action='store_true');args=parser.parse_args()
 if engine.dialect.name!='postgresql':
  print('Accounting requires PostgreSQL DATABASE_URL in local .env',file=sys.stderr);return 2
 try:
  report=readonly_report(SessionLocal,args.days,args.include_admins)
  sys.stdout.buffer.write(json.dumps(report,ensure_ascii=False).encode('utf-8'));return 0
 except Exception:
  print('Cannot read economy data. Check local DATABASE_URL, network and deployed schema.',file=sys.stderr);return 1
if __name__=='__main__':raise SystemExit(main())
