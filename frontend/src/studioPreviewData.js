import {makeFriendPreview} from "./friendPreviewData";
import {boardPreview} from "./boardPreviewData";
import {makeRacePreview} from "./racePreviewData";
import activityCatalog from "../../activity_catalog.json";
// Imported only by studio-preview.html, never by the production application.
export function installStudioPreview(scene,theme){
  if(!import.meta.env.DEV)throw Error("Preview disabled");
  const nativeFetch=window.fetch.bind(window);
  const now=()=>new Date().toISOString();
  const games={dino:"Дино",flappy:"Flappy",snake:"Змейка",tetris:"Тетрис",hell:"Ад"};
  const receipt={id:"demo-compensation",created_at:now(),read:false,total:255,target_total:295,previous_total:40,entries:[
    {game:"dino",score:1250,place:1,target:100,already_paid:40,credit:60},
    {game:"flappy",score:35,place:3,target:75,already_paid:0,credit:75},
    {game:"snake",score:90,place:5,target:50,already_paid:0,credit:50},
    {game:"tetris",score:15000,place:7,target:50,already_paid:0,credit:50},
    {game:"hell",score:300,place:12,target:20,already_paid:0,credit:20},
  ]};
  const me={id:1,first_name:"Ты · тестовый админ",username:"studio_preview",role:"admin",notify:true,jera:540,theme,
    owned_themes:["dark","light","retro","terminal","nyan","tetris","poop"],theme_box_price:100,topics:0,comments:0,votes:0,rated:0,
    daily_reward:{day:"2026-11-11",streak:scene==="daily7"?7:3,amount:scene==="daily7"?50:25,awarded:scene.startsWith("daily"),preview:scene.startsWith("daily"),server_now:now(),next_at:new Date(Date.now()+3600000).toISOString()},
    compensation_letters:scene==="letter"?[receipt]:[]};
  const friendPreview=makeFriendPreview();
  const racePreview=makeRacePreview(scene,me);
  if(scene.startsWith("race_"))window.Telegram.WebApp.initDataUnsafe.start_param="races";
  const base={id:"preview-first",title:"Первый турнир Dino",game:"dino",game_name:"Дино",status:"registration",entry_fee:0,duration_hours:48,
    starts_at:null,ends_at:null,server_now:now(),registered:false,participants:12,top:[],my_best:0,my_place:null,prize_theme:"poop",duplicate_prize:200,
    prize_jera:{2:150,3:100,4:75,5:50},voting_closed:false,votes:{dino:2,flappy:5,snake:3},my_vote:null,share_path:"/tournaments/preview-first"};
  let events=scene==="empty"?[]:[{...base}];
  if(["active","finished"].includes(scene)){
    Object.assign(events[0],{status:scene==="active"?"active":"finished",registered:true,participants:16,
      starts_at:new Date(Date.now()-7200000).toISOString(),ends_at:new Date(Date.now()+(scene==="active"?172800000:-3600000)).toISOString(),
      top:[{place:1,user_id:2,name:"Бека",best:1250},{place:2,user_id:1,name:me.first_name,best:980},{place:3,user_id:3,name:"Игрок 3",best:840}],my_best:980,my_place:2});
  }
  if(scene==="paid")Object.assign(events[0],{id:"preview-paid",title:"Следующий турнир",entry_fee:50});
  let first=scene==="empty"||scene==="registration"||scene==="letter";
  let achievementBest=640;
  const demoBests={flappy:12,snake:30,tetris:170,hell:0};
  const achievementItem=definition=>{const best=definition.game==="dino"?achievementBest:demoBests[definition.game];return {...definition,best,steps:definition.steps.map(step=>({...step,earned:best>=step.score})),total_earned:definition.steps.filter(step=>best>=step.score).reduce((sum,step)=>sum+step.amount,0)};};
  const achievementSteps=[[100,1],[500,5],[1000,10],[3000,25],[5000,50],[10000,100]];
  let maintenance=false,applied=false,pending=null,history=[];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const eventState=event=>({...event,server_now:now(),balance:me.jera});
  const shopState=()=>({price:100,failure_refund:50,balance:me.jera,owned_themes:me.owned_themes,active_box:pending?{id:pending.id}:null,history,
    rarities:[{key:"common",title:"Обычные",color:"var(--muted)",chance:70,items:[{id:"retro",name:"Ретро",chance:35},{id:"terminal",name:"Терминал",chance:35}]},
      {key:"rare",title:"Редкие",color:"var(--coin)",chance:25,items:[{id:"tetris",name:"Тетрис",chance:12.5},{id:"nyan",name:"Nyan Cat",chance:12.5}]},
      {key:"mythic",title:"Мифические",color:"#e8bc66",chance:5,items:[{id:"poop",name:"Какашечки",chance:5}]}]});
  const fail=message=>{throw Error(message);};
  async function handle(path,method,body){
    const social=friendPreview(path,method,body);if(social!==undefined)return social;
    const boardResult=boardPreview(path,method);if(boardResult!==undefined)return boardResult;
    const raceResult=await racePreview(path,method,body);if(raceResult!==undefined)return raceResult;
    if(path==='/admin/performance')return {window_requests:36,cache:{entries:7,max_entries:128,hits:24,misses:7},routes:[{method:'GET',route:'/api/home',requests:20,p50_ms:85,p95_ms:310,average_sql_ms:38,average_sql_queries:1.5,errors:0},{method:'GET',route:'/api/game/top',requests:16,p50_ms:115,p95_ms:420,average_sql_ms:64,average_sql_queries:3,errors:0}]};
    if(path==="/tasks")return {earned_today:3,daily_limit:10,balance:me.jera,ends_at:new Date(Date.now()+3600000).toISOString(),tasks:["participation","variety","score"].map((category,i)=>{const candidates=activityCatalog.tasks.filter(task=>task.category===category);const task=candidates[(Math.floor(Date.now()/86400000)+i)%candidates.length];return {...task,amount:[3,3,4][i],earned:i===0,current:i===0?task.target:Math.floor(task.target*.4)};})};
    if(path==="/achievements")return {...achievementItem(activityCatalog.achievements[0]),items:activityCatalog.achievements.map(achievementItem)};
    if(path==="/hall-of-fame")return {winners:events.filter(e=>e.status==="finished").flatMap(e=>e.top.slice(0,5).map(row=>({tournament_id:e.id,title:e.title,game:e.game,user_id:row.user_id,name:row.name,place:row.place,amount:e.prize_jera[row.place]||0,theme_id:row.place===1?"poop":null,ended_at:e.ends_at})))};
    if(path==="/me")return me;
    if(path==="/home"){
      const event=events.find(e=>['active','registration'].includes(e.status));
      const featured=scene.startsWith('race_')?{kind:'races',id:'demo-race',title:'Скачки · Предварительный заезд',status:'До начала заезда',label:'До старта',ends_at:new Date(Date.now()+480000).toISOString(),server_now:now()}:event?{kind:'tournament',id:event.id,title:event.title,status:event.status==='active'?'Турнир идёт':'Регистрация открыта',label:event.status==='active'?'До завершения':'48 часов после старта',ends_at:event.status==='active'?event.ends_at:null,server_now:now()}:null;
      return {event:featured,projects:[{id:1,name:'Пиксельные гонки',status:'planned',stage:1}],latest:null,posts:[{id:1,title:'Проверка обновления',text:'Это локальный стенд. Все турниры, письма, покупки и начисления здесь тестовые.',created_at:now(),comments:0},{id:2,title:'В студии появились друзья',text:'Добавляй знакомых, следи за онлайн-статусом и приглашай в шахматы и шашки.',created_at:now(),comments:3},{id:3,title:'Коллекция кассет',text:'Выбирай оформление под настроение. Все особенности темы — в коллекции профиля.',created_at:now(),comments:2},{id:4,title:'Архив новостей',text:'Эта новость доступна через раздел «Все новости».',created_at:now(),comments:1}]};
    }
    if(path==="/topics")return [];
    if(path.startsWith("/notifications"))return {unread:0,items:[]};
    if(path.startsWith("/me/compensation/")){receipt.read=true;return {ok:true};}
    if(path==="/me/theme"){me.theme=body.theme;return {ok:true};}
    if(path==="/me/notify"){me.notify=body.push;return {ok:true};}
    if(path==="/admin/shop/test-balance"){me.jera+=10000;return {balance:me.jera,credited:true,amount:10000};}
    if(path==="/admin/records/status")return {maintenance,applied};
    if(path==="/admin/records/maintenance"){maintenance=body.enabled;return {ok:true};}
    if(path==="/admin/records/reset-preview")return {archive_hash:"preview",awards:receipt.entries.map(e=>({...e,user_id:1})),summary:{jera_to_credit:receipt.total,recipients:1}};
    if(path==="/admin/records/reset-apply"){if(!applied){me.jera+=receipt.total;me.compensation_letters=[receipt];applied=true;}return {ok:true};}
    if(path==="/tournaments")return {events:events.map(eventState),next_free:first,next_game:events.find(e=>e.status==="finished")?"flappy":null};
    if(path==="/admin/tournaments"&&method==="POST"){
      if(events.some(e=>["registration","active"].includes(e.status)))fail("Сначала отмени текущий тестовый турнир");
      const game=first?"dino":body.game;
      const event={...base,id:"preview-"+Date.now(),title:body.title,game,game_name:games[game],duration_hours:first?48:body.duration_hours,entry_fee:first?0:body.entry_fee};
      events.unshift(event);first=false;return eventState(event);
    }
    if(path.startsWith("/tournaments/")||path.startsWith("/admin/tournaments/")){
      const parts=path.split("/");const admin=parts[1]==="admin";const id=parts[admin?3:2],action=parts[admin?4:3];
      const event=events.find(e=>e.id===id);if(!event)fail("Тестовый турнир не найден");
      if(action==="register"&&!event.registered){if(me.jera<event.entry_fee)fail("Не хватает Йеры");me.jera-=event.entry_fee;event.registered=true;event.participants++;}
      if(action==="start"){event.status="active";event.starts_at=now();event.ends_at=new Date(Date.now()+event.duration_hours*3600000).toISOString();}
      if(action==="cancel"){if(event.registered)me.jera+=event.entry_fee;event.status="cancelled";first=!events.some(e=>e.status!=="cancelled");}
      if(action==="vote"){if(event.my_vote)event.votes[event.my_vote]--;event.votes[body.game]=(event.votes[body.game]||0)+1;event.my_vote=body.game;}
      return eventState(event);
    }
    if(path==="/shop")return shopState();
    if(path==="/shop/theme-box/buy"){
      if(!pending){if(me.jera<100)fail("Не хватает Йеры");me.jera-=100;pending={id:"preview-box",runes:["ᚠ","ᚢ","ᚦ"]};}
      return {box_id:pending.id,runes:pending.runes,balance:me.jera,owned_themes:me.owned_themes};
    }
    if(path==="/shop/theme-box/unlock"){
      const ok=body.runes.join("")==="ᚠᚢᚦ",refund=ok?100:50;me.jera+=refund;pending=null;
      history.unshift({id:Date.now(),themeId:ok?"poop":null,success:ok,isDupe:ok,refund});
      return {ok,themeId:ok?"poop":null,isDupe:ok,left:0,refund,balance:me.jera,owned_themes:me.owned_themes,shop:shopState()};
    }
    if(path.startsWith("/game/top"))return {top:[],my_best:0,my_rank:null,ends_at:null};
    if(path==="/game/start")return {ok:true,run_id:"preview-run-"+Date.now()};
    if(path==="/game/score"){
      let reward=0;
      if(body.game==="dino"){reward=achievementSteps.filter(([score])=>score>achievementBest&&score<=body.score).reduce((sum,[,amount])=>sum+amount,0);achievementBest=Math.max(achievementBest,body.score);me.jera+=reward;}
      return {best:body.score,record:true,rank:1,achievement_reward:reward};
    }
    fail("Этот экран не входит в локальный стенд: "+path);
  }
  window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==="string"?input:input.url,location.href);
    if(url.origin===location.origin&&url.pathname==="/__local/accounting"&&(!options.method||options.method==="GET"))return nativeFetch(input,options);
    if(!url.pathname.startsWith("/api/"))return new Response("Preview only",{status:404});
    await new Promise(resolve=>setTimeout(resolve,80));
    try{return new Response(JSON.stringify(clone(await handle(url.pathname.slice(4)+url.search,options.method||"GET",options.body?JSON.parse(options.body):{}))),{status:200,headers:{"Content-Type":"application/json"}});}
    catch(e){return new Response(JSON.stringify({detail:e.message}),{status:409,headers:{"Content-Type":"application/json"}});}
  };
}
