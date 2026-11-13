import {batteryAt,dockBattery,spendBattery} from './yaabikBattery';
export function makeYaabikPreview(discPreview){
 const key='yab_yaabik_cloud_preview_v1';let state;try{state=JSON.parse(localStorage.getItem(key));}catch{}
 const slots=()=>discPreview('/discs/shelves','GET')?.shelves.flatMap(s=>s.slots.map(d=>({...d,item:d.item||s.item})))||[];
 const snapshot=()=>{state.battery=batteryAt(state.battery);const owned=slots();state.shelf_ids=state.shelf_ids.filter(id=>owned.some(d=>d.id===id));const counts=state.habits.disc_plays,ids=[...new Set(owned.filter(d=>state.shelf_ids.includes(d.id)).map(d=>d.item.id))].filter(id=>counts[id]);state.favorite_disc=ids.sort((a,b)=>counts[b]-counts[a])[0]||null;localStorage.setItem(key,JSON.stringify(state));return {...state,server_now:Date.now()};};
 return (path,method,body)=>{
  if(!path.startsWith('/yaabik/'))return;
  try{state=JSON.parse(localStorage.getItem(key))||state;}catch{}
  if(path==='/yaabik/open'){
   const first=!state;if(!state){const local=body.legacy||{};state={prefs:{skin:'classic',room:'theme',sounds:true,...local.prefs},battery:batteryAt(local.battery),shelf_ids:local.shelf_ids||[],habits:{visits:0,disc_plays:{}},seen:[],last_seen:null,last_visit:null,revision:0};}
   const away=state.last_seen?Date.now()-state.last_seen:null;if(!state.seen.includes(body.request_id)){if(!state.last_visit||Date.now()-state.last_visit>900000){state.habits.visits++;state.last_visit=Date.now();}state.last_seen=Date.now();state.seen.push(body.request_id);state.revision++;}
   return {...snapshot(),away_ms:away,first_visit:first};
  }
  if(path==='/yaabik/actions'){
   if(!state)throw Error('Сначала открой комнату Яабика');
   const counters={pet:'pets',hello:'greetings',play:'games',song:'songs',stars:'stars',disc:'discs',tap:'taps',grumble:'grumbles',rest:'rests'};
   for(const c of body.commands){if(state.seen.includes(c.id))continue;if(c.kind==='prefs')state.prefs={...state.prefs,...c.value};else if(c.kind==='shelf')state.shelf_ids=c.value;else if(c.kind==='dock')state.battery=dockBattery(state.battery,c.value);else{state.habits[counters[c.kind]]=(state.habits[counters[c.kind]]||0)+1;state.battery=spendBattery(state.battery,{pet:.1,hello:.2,play:1}[c.kind]||0);if(c.kind==='disc'){const disc=slots().find(d=>d.id===c.value);if(disc)state.habits.disc_plays[disc.item.id]=(state.habits.disc_plays[disc.item.id]||0)+1;}}state.seen.push(c.id);state.revision++;state.last_seen=Date.now();}state.seen=state.seen.slice(-128);return snapshot();
  }
 };
}
