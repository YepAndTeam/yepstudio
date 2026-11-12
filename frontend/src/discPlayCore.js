export function createDiscBridge(api,now=()=>Date.now()){
let scope=null;
function attachDiscSession(value){scope=value;return()=>{if(scope===value)scope=null;};}
function discTempo(){return scope&&now()<scope.deadline?scope.effects.tempo||1:1;}
async function gameApi(path,method='GET',body){
 const session=scope;if(!session)return api(path,method,body);
 if(path.startsWith('/game/top'))return api(path.replace('/game/top','/disc-play/top'),method,body);
 if(path==='/game/start'&&method==='POST'){
  if(now()>=session.deadline)throw Error('Срок диска истёк');
  const promise=session.first?Promise.resolve(session.first):api('/disc-play/start','POST',body);session.first=null;session.pending=promise;
  const value=await promise;session.run=value.run_id;session.effects=value.effects;return value;
 }
 if(path==='/game/score'&&method==='POST'){
  const value=session.pending?await session.pending:null;
  if(!value?.run_id)throw Error('Забег с диском ещё не начался');
  return api('/disc-play/score','POST',{...body,run_id:value.run_id});
 }
 return api(path,method,body);
}

return {attachDiscSession,discTempo,gameApi};
}
