// Isolated local fixtures; no production funds or messages.
import packet from './raceDemoProofV2.json';
export function makeRacePreview(scene,me){
 const origin=Date.now(),now=()=>new Date().toISOString();
 const names=['Сакура','Турбо','Пломбир','Комета','Ветер','Искра','Тень','Пиксель','Молния','Бублик'],colors=['#ec85a0','#65b7d0','#d8d2b1','#a88ad6','#83bc80','#dc9a53','#818ba4','#b6cc5b','#d5c66b','#a17c60'];
 const all=names.map((name,i)=>({number:i+1,name,color:colors[i]}));
 const specs=[['PRE','Предварительный заезд',0,[1,2,3,4,5,6,7,8,9,10]],['Q1','Четвертьфинал 1',1,[1,2]],['Q2','Четвертьфинал 2',1,[3,4]],['Q3','Четвертьфинал 3',1,[5,6]],['Q4','Четвертьфинал 4',1,[7,8]],['S1','Полуфинал 1',2,[1,3]],['S2','Полуфинал 2',2,[5,7]],['F','Финал',3,[1,5]]];
 const quarter=scene==='race_quarter',finished=scene==='race_finished',running=scene==='race_running';
 let isEnabled=true,balance=1400,schedule=['12:00','20:00'];const receipts=new Map();
 const matches=specs.filter(([, ,stage])=>finished||stage===0||(quarter&&stage===1)).map(([node,title,stage,numbers])=>{
  const status=finished||quarter&&stage===0?'finished':running?'running':'betting';
  return {id:'demo-v2-'+node,meeting_id:'demo-meeting',node_id:node,title,stage,status,attempt:0,opens_at:new Date(origin-120000).toISOString(),closes_at:new Date(origin+480000).toISOString(),starts_at:new Date(origin+(status==='running'?-15000:status==='finished'?-90000:480000)).toISOString(),chat_until:new Date(origin+3000000).toISOString(),server_now:now(),horses:numbers.map((n,i)=>({...all[n-1],weight:node==='PRE'?1000:i===0?7500:2500,odds_bps:node==='PRE'?10000:i===0?12000:36000})),commitment:packet.commitment,beacon_round:1,rules:{...packet.rules,format:'knockout-v2',duration_seconds:60,winners_count:node==='PRE'?8:1},proof:null,ranking:status==='betting'?[]:numbers.slice(),chat_open:true,chat:[],my_bets:[],pool:0};
 });
 if(quarter){for(const node of ['Q1','Q3']){const race=matches.find(r=>r.node_id===node);const amount=node==='Q1'?10:5;race.my_bets=[{id:'demo-bet-'+node,horse:race.horses[0].number,amount,payout:Math.floor(amount*1.2),status:'pending'}];race.pool=amount;me.jera-=amount;balance+=amount;}}
 const proofRace={...matches[0],id:'demo-proof',node_id:'ARCHIVE',status:'finished',horses:packet.rules.horses,ranking:packet.ranking,proof:packet.beacon,rules:packet.rules,chat_open:false};
 const bracket=()=>specs.map(([node,title,stage])=>{const race=matches.find(r=>r.node_id===node);return {node,title,stage,id:race?.id||null,status:race?.status||'unknown',horses:race?.horses||[],starts_at:race?.starts_at||null,winner:race?.status==='finished'?race.ranking[0]:null,my_bet:race?.my_bets[0]||null};});
 const meetingBets=()=>matches.flatMap(r=>r.my_bets.map(b=>({...b,race_id:r.id,node_id:r.node_id,name:r.horses.find(h=>h.number===b.horse).name,starts_at:r.starts_at})));
 const response=race=>({...race,server_now:now(),bracket:bracket(),meeting_bets:meetingBets()});
 return async(path,method,body)=>{
  if(path==='/races')return {schedule,enabled:isEnabled,can_bet:true,fund:{balance,reserved:0,available:balance},current:response(quarter?matches.find(r=>r.node_id==='Q1'):matches[0]),bracket:bracket(),history:[{id:'demo-proof',status:'finished',starts_at:packet.rules.starts_at,winner:packet.ranking[0],attempt:0,node_id:'ARCHIVE'}]};
  if(path.startsWith('/admin/races/')){if(path.endsWith('schedule'))schedule=body.times;if(path.endsWith('enabled'))isEnabled=body.enabled;if(path.endsWith('fund-shop'))balance+=100;return {added:100,enabled:isEnabled,fund:{balance,reserved:0,available:balance}};}
  if(!path.startsWith('/races/'))return undefined;
  const [,,id,action]=path.split('/'),race=id==='demo-proof'?proofRace:matches.find(r=>r.id===id);if(!race)throw Error('Тестовая пара не найдена');
  if(action==='proof')return packet;
  if(action==='bet'){
   if(!receipts.has(body.request_id)){
    if(race.status!=='betting')throw Error('Ставки закрыты');const previous=race.my_bets[0];
    if(previous&&previous.id!==body.replaces_id)throw Error('Ставка уже изменена. Открой её заново.');
    if(body.replaces_id&&!previous)throw Error('Ставка не найдена');
    const delta=body.amount-(previous?.amount||0);if(me.jera<delta)throw Error('Не хватает Йер');
    const horse=race.horses.find(h=>h.number===body.horse);if(!horse)throw Error('Выбери лошадь этого заезда');
    me.jera-=delta;balance+=delta;race.pool+=delta;race.my_bets=[{id:body.request_id,horse:body.horse,amount:body.amount,payout:Math.floor(body.amount*horse.odds_bps/10000),status:'pending'}];receipts.set(body.request_id,true);
   }
   return {race:response(race),balance:me.jera};
  }
  if(action==='chat'){const message={id:Date.now(),name:me.first_name,text:body.text,created_at:now()};for(const r of matches)r.chat.push(message);return response(race);}
  return response(race);
 };
}
