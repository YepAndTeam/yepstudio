import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv } from "vite";
const run=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
export default function localAccounting(){return {name:'local-readonly-accounting',apply:'serve',configureServer(server){
 server.middlewares.use('/__local/accounting',async(req,res)=>{
  const host=(req.headers.host||'').split(':')[0],address=req.socket.remoteAddress;
  const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)&&['localhost','127.0.0.1','['].includes(host);
  const origin=req.headers.origin;
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
  if(!local||(origin&&origin!==`http://${req.headers.host}`)){res.statusCode=403;res.end(JSON.stringify({detail:'Local access only'}));return;}
  if(req.method!=='GET'){res.statusCode=405;res.end('{}');return;}
  const url=new URL(req.url,'http://localhost'),days=Number(url.searchParams.get('days')||30),admins=url.searchParams.get('include_admins')==='true';
  if(![0,7,30,90].includes(days)){res.statusCode=422;res.end('{}');return;}
  const config=loadEnv('accounting',root,'ACCOUNTING_');
  const python=process.env.ACCOUNTING_PYTHON||config.ACCOUNTING_PYTHON||(process.platform==='win'?'python':'python3');
  const env={...process.env};if(config.ACCOUNTING_PYTHONPATH)env.PYTHONPATH=config.ACCOUNTING_PYTHONPATH;
  const args=[path.join(root,'accounting_local.py'),'--days',String(days)];if(admins)args.push('--include-admins');
  try{const {stdout}=await run(python,args,{cwd:root,env,timeout:45000,maxBuffer:4*1024*1024,windowsHide:true,encoding:'utf8'});JSON.parse(stdout);res.end(stdout);}
  catch{res.statusCode=503;res.end(JSON.stringify({detail:'Не удалось прочитать Neon. Проверь подключение, зависимости Python и .env.accounting.local. Изменений в базе не выполнялось.'}));}
 });
}};}
