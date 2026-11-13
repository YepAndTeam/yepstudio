import StudioLoading from '../components/StudioLoading';
import {useEffect,useRef,useState} from 'react';
import {useStore} from '../store';
import {createYaabikMusic,danceBeat} from '../yaabikMusic';
import {useYaabikCloud} from '../useYaabikCloud';
import {companionGreeting,companionIdle} from '../yaabikPersonality';
import {createYaabikSounds} from '../yaabikSounds';
import {usePreferences,setPreference} from '../preferences';
import {backgroundMusic} from '../backgroundMusic';
import {api} from '../api';
import DiscArtwork from '../components/DiscArtwork';
import {haptic} from '../tg';
import YaabikConstellation from '../components/YaabikConstellation';
import YaabikRobot from '../components/YaabikRobot';
import YaabikHands from '../components/YaabikHands';
import './Yaabik.css';
import {batteryAt,dockBattery,spendBattery,YAABIK_CHARGE_PER_MINUTE} from '../yaabikBattery';
const skins=[['classic','Студийный','Детали под текущую тему'],['mint','Мятный акцент','Нежная отделка'],['sunset','Медный акцент','Тёплая отделка']];
const rooms=[['theme','В ритме темы','Под текущее оформление'],['studio','Студийный свет','Палитра остаётся под тему'],['night','Приглушённый свет','Твоя тема в ночном освещении']];
const messages={pet:['Спасибо… Очень приятно!','Мур-бип. Вот тут ещё погладь!','Ты у меня самый заботливый.'],hello:['Привет! Я уже ждал тебя.','Контакт установлен. Рад тебя видеть!','Бип! Как прошёл твой день?'],play:['Рекорды подождут. Смотри, как я умею!','Бип-бип! Ещё раз?','Мой процессор сейчас очень счастлив.'],rest:['Можно просто посидеть вместе.','Тихий режим. Я рядом.','Никуда не спешим.']};
export default function Yaabik({onOpenGarden}){
 const {me,theme}=useStore(),key='yab_yaabik_v1:'+String(me?.id||'guest');
 const [prefs,setPrefs]=useState(()=>{try{const v=JSON.parse(localStorage.getItem(key));return {skin:skins.some(s=>s[0]===v?.skin)?v.skin:'classic',room:rooms.some(s=>s[0]===v?.room)?v.room:'theme'};}catch{return {skin:'classic',room:'theme'};}});
 const {musicEnabled,yaabikSounds}=usePreferences(),music=useRef(null),voice=useRef(null),lastPetSound=useRef(0),lastTouch=useRef(null),tapBurst=useRef({count:0,last:0,voice:0});
 const unlockVoice=()=>{if(!yaabikSounds)return;voice.current??=createYaabikSounds();voice.current.setEnabled(true);void voice.current.unlock();};
 const sound=kind=>{if(!yaabikSounds)return;voice.current??=createYaabikSounds();voice.current.setEnabled(true);void voice.current.play(kind);};
 useEffect(()=>{voice.current?.setEnabled(yaabikSounds);},[yaabikSounds]);
 useEffect(()=>()=>voice.current?.dispose(),[]);
 const stopMusic=()=>{music.current?.stop();backgroundMusic.setDucked(false);};
 const [shelfIds,setShelfIds]=useState(()=>{try{return [...new Set(JSON.parse(localStorage.getItem(key+':shelf')||'[]'))].filter(id=>typeof id==='string').slice(0,5);}catch{return [];}}),[shelfOpen,setShelfOpen]=useState(false);
 const shelfDialog=useRef(null);
 useEffect(()=>{if(!shelfOpen)return;const node=shelfDialog.current;node.showModal();return()=>node.close();},[shelfOpen]);
 const [shelfData,setShelfData]=useState(null),[shelfError,setShelfError]=useState(false),[shownDisc,setShownDisc]=useState(null);
 useEffect(()=>{let alive=true;api('/discs/shelves').then(v=>{if(alive)setShelfData(v);}).catch(()=>{if(alive)setShelfError(true);});return()=>{alive=false;};},[me?.id]);
 const availableDiscs=(shelfData?.shelves||[]).flatMap(s=>s.slots.map(d=>({...d,item:d.item||s.item})));
 const shelfDiscs=availableDiscs.filter(d=>shelfIds.includes(d.id));
 const toggleShelf=disc=>{const selected=shelfIds.includes(disc.id);if(!selected&&shelfDiscs.length>=5)return;const next=selected?shelfIds.filter(id=>id!==disc.id):[...shelfDiscs.map(d=>d.id),disc.id];setShelfIds(next);cloud.send('shelf',next);try{localStorage.setItem(key+':shelf',JSON.stringify(next));}catch{}sound(selected?'click':disc.rarity);setMessage(selected?'Бережно убрал на большую полку.':`Спасибо! «${disc.item.title}» теперь на моей полочке!`);if(!docked&&!walking){setEmotion('happy');setReaction(n=>n+1);}};
 useEffect(()=>{if(!musicEnabled){music.current?.stop();backgroundMusic.setDucked(false);}},[musicEnabled]);
 const [objectActivity,setObjectActivity]=useState(null),[lightPattern,setLightPattern]=useState(0),[walking,setWalking]=useState(false),[docking,setDocking]=useState(false),[inHands,setInHands]=useState(false),[panel,setPanel]=useState(null),[emotion,setEmotion]=useState('calm'),[message,setMessage]=useState('Бип. Это моё новое место. Осмотримся вместе?'),[reaction,setReaction]=useState(0),[action,setAction]=useState('idle'),[hidden,setHidden]=useState(document.hidden);
 useEffect(()=>{const pause=()=>{if(document.hidden){music.current?.stop();voice.current?.stop();backgroundMusic.setDucked(false);setObjectActivity(null);setAction('idle');}};document.addEventListener('visibilitychange',pause);return()=>{document.removeEventListener('visibilitychange',pause);music.current?.dispose();backgroundMusic.setDucked(false);};},[]);
 const timer=useRef(null),dockingTimer=useRef(null),roomNode=useRef(null),petNode=useRef(null);
 const paintRoomLook=point=>{const box=petNode.current?.getBoundingClientRect(),room=roomNode.current;if(!box||!room||!point)return;const x=Math.max(-4,Math.min(4,(point.x-box.left-box.width*.45)/(box.width*.5)*4)),y=Math.max(-3,Math.min(3,(point.y-box.top-box.height*.52)/(box.height*.5)*3));room.style.setProperty('--room-look-x',x+'px');room.style.setProperty('--room-look-y',y+'px');room.classList.add('has-touch-gaze');};
 const lookRoom=e=>{lastTouch.current={x:e.clientX,y:e.clientY};paintRoomLook(lastTouch.current);};
 useEffect(()=>{if(!walking||hidden||!yaabikSounds)return;let right=false;const step=()=>{void voice.current?.play(right?'stepRight':'stepLeft');right=!right;};const id=setInterval(step,300);return()=>{clearInterval(id);voice.current?.stopSteps();};},[walking,hidden,yaabikSounds]);
 const batteryKey=key+':battery';
 const [battery,setBattery]=useState(()=>{try{return batteryAt(JSON.parse(localStorage.getItem(batteryKey)));}catch{return batteryAt(null);}}),[now,setNow]=useState(Date.now);
 const charge=batteryAt(battery,now),docked=charge.docked;
 const lastFull=useRef(charge.level>=100);
 useEffect(()=>{const full=charge.level>=100;if(full&&!lastFull.current&&docked&&!hidden&&yaabikSounds)void voice.current?.play('full');lastFull.current=full;},[charge.level,docked,hidden,yaabikSounds]);
 const [place,setPlace]=useState(()=>({x:docked?76:50,bottom:docked?40:46,duration:0}));
 const cloud=useYaabikCloud({storageKey:key,legacy:()=>({prefs:{...prefs,sounds:yaabikSounds},battery,shelf_ids:shelfIds}),onState:(value,initial)=>{
  setPrefs({skin:value.prefs.skin,room:value.prefs.room});setPreference('yaabikSounds',value.prefs.sounds);setShelfIds(value.shelf_ids);setBattery({...value.battery,updatedAt:Date.now()});setNow(Date.now());
  if(initial){setPlace({x:value.battery.docked?76:50,bottom:value.battery.docked?40:46,duration:0});setMessage(companionGreeting(value));}else if(value.away_ms>=900000&&!inHands&&!walking)setMessage(companionGreeting(value));
 }});
 const favoriteTitle=availableDiscs.find(d=>d.item.id===cloud.data?.favorite_disc)?.item.title;
 useEffect(()=>{try{localStorage.setItem(batteryKey,JSON.stringify(battery));}catch{}},[battery,batteryKey]);
 const saveBattery=next=>{setBattery(next);setNow(Date.now());try{localStorage.setItem(batteryKey,JSON.stringify(next));}catch{}};
 useEffect(()=>{if(!docked||hidden)return;const tick=()=>setNow(Date.now());const id=setInterval(tick,1000);const resume=()=>{if(!document.hidden)tick();};document.addEventListener('visibilitychange',resume);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',resume);};},[docked,hidden]);
 const walkTo=(target,toDock=false,arrive=null)=>{
  stopMusic();setObjectActivity(null);
  clearTimeout(timer.current);clearTimeout(dockingTimer.current);
  const room=roomNode.current?.getBoundingClientRect(),pet=petNode.current?.getBoundingClientRect();
  const dx=room&&pet?room.left+room.width*target.x/100-(pet.left+pet.width/2):0,dy=room&&pet?room.bottom-target.bottom-pet.bottom:0;
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.max(.6,Math.min(3.5,Math.hypot(dx,dy)/75));
  setPlace({...target,duration});setWalking(true);setAction(toDock?'docking':'walking');setEmotion('calm');
  dockingTimer.current=setTimeout(()=>{setWalking(false);setDocking(false);paintRoomLook(lastTouch.current);if(toDock)sound('dock');setAction('idle');setEmotion(toDock?'sleepy':'calm');setMessage(toDock?'Готово, контакт есть. Отдыхаю и набираюсь сил.':'Я здесь! Хорошо немного пройтись.');if(arrive)arrive();},duration*1000+40);
 };
 const visitObject=id=>{
  if(docked||docking){setMessage('Сначала отключи меня от дока — и я с радостью подойду!');return;}
  if(inHands)return;
  unlockVoice();
  if(id==='player'&&objectActivity==='player'){stopMusic();clearTimeout(timer.current);setObjectActivity(null);setAction('idle');setEmotion('calm');setMessage('Музыкальная пауза. Бип!');return;}
  if(id==='player'&&musicEnabled){music.current=music.current||createYaabikMusic();music.current.unlock();}
  const targets={player:{x:28,bottom:86},discs:{x:73,bottom:86},lights:{x:50,bottom:86}};
  const labels={player:'Пойду включу любимую кассету!',discs:'Сейчас выберу красивую обложку.',lights:lightPattern?'Сейчас выключу наше звёздное небо.':'Сейчас зажгу для нас маленькую галактику!'};
  if(id==='discs'&&!shelfData){setMessage(shelfError?'Не получилось заглянуть в коллекцию. Попробуем позже.':'Подожди, я ещё рассматриваю твою коллекцию…');return;}
  const favorite=shelfDiscs.filter(d=>d.item.id===cloud.data?.favorite_disc);
  const choices=favorite.length&&Math.random()<.6?favorite:shelfDiscs;
  const picked=id==='discs'&&choices.length?choices[Math.floor(Math.random()*choices.length)]:null;
  haptic();setShownDisc(picked);setMessage(labels[id]);
  walkTo(targets[id],false,()=>{
   if(document.hidden)return;
   setObjectActivity(id==='discs'&&!picked?'empty-shelf':id);setAction(id==='discs'&&!picked?'empty-shelf':'object-'+id);setEmotion(id==='discs'&&!picked?'sad':'happy');setReaction(n=>n+1);
   if(id==='lights'){cloud.send('stars');setLightPattern(old=>old?0:1);sound(lightPattern?'projectorOff':'projectorOn');}else if(id==='discs'){if(picked)cloud.send('disc',picked.id);sound(picked?picked.rarity:'empty');}else {cloud.send('song');sound('click');}
   setMessage(id==='player'?'Вот мой любимый ритм. Бип-бип!':id==='discs'?(picked?({common:'Хорошая обложка! Люблю такие простые находки.',rare:'О, редкое издание! Можно я рассмотрю поближе?',epic:'Ух ты, эпический диск! Какая красота!',mythic:'Мифический?! Даже держу осторожнее. Вот это находка!',legendary:'Легендарный! Смотри, как переливается! Я в восторге!',secret:'Тсс… Секретный диск. Интересно, что он скрывает?'}[picked.rarity]||'Какой интересный диск!')+(picked.item.id===cloud.data?.favorite_disc?' Это мой любимый!':'')+' «'+picked.item.title+'»':'Полочка пока пустая… Немного грустно. Буду ждать наш первый диск.'):(lightPattern?'Звёзды отдыхают. Захочешь — снова включим!':'Смотри, звёздочка! Почти достал… Это наше созвездие.'));
   if(id==='player'){const finish=()=>{setObjectActivity(null);setAction('idle');setEmotion('calm');backgroundMusic.setDucked(false);setMessage('Уф! Вот это потанцевали!');};if(musicEnabled&&music.current?.play(finish)){backgroundMusic.setDucked(true);return;}setMessage('Танцую даже без звука! Музыку можно включить в настройках.');}
   timer.current=setTimeout(()=>{setObjectActivity(null);setAction('idle');setEmotion('calm');setMessage('Мне нравится наш маленький уголок.');},id==='player'?12000:4200);
  });
 };
 const routeRoomClick=e=>{
  if(e.detail===0)return;
  const controls=roomNode.current?.querySelectorAll('[data-room-control]')||[];
  for(const control of controls){const box=control.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)continue;if(control.contains(e.target))return;e.preventDefault();e.stopPropagation();const id=control.dataset.roomControl;if(id==='dock')toggleDock();else if(id==='garden')onOpenGarden?.();else visitObject(id);return;}
 };
 const beginDock=current=>{cloud.send('dock',true);setInHands(false);saveBattery(dockBattery(current,true));setDocking(true);setMessage('Иду на свою станцию. Сейчас подключусь!');walkTo({x:76,bottom:40},true);};
 const walkRoom=e=>{if(docked||docking||inHands)return;const box=roomNode.current.getBoundingClientRect();const x=e.detail===0?50:Math.max(24,Math.min(76,(e.clientX-box.left)/box.width*100)),bottom=e.detail===0?46:Math.max(24,Math.min(86,box.bottom-e.clientY-12));setMessage('Уже иду к тебе!');walkTo({x,bottom});};

 const toggleDock=()=>{if(docking)return;haptic();if(!docked){beginDock(battery);return;}clearTimeout(timer.current);const next=dockBattery(battery,false);saveBattery(next);setAction('idle');setEmotion('calm');setMessage(next.docked?'Нужно совсем немного заряда. Я пока останусь на станции.':'Возвращаюсь в комнату!');if(!next.docked){cloud.send('dock',false);sound('undock');walkTo({x:50,bottom:46});}};

 useEffect(()=>()=>{clearTimeout(timer.current);clearTimeout(dockingTimer.current);},[]);
 useEffect(()=>{const update=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
 useEffect(()=>{if(hidden||docked||walking||inHands||shelfOpen||action!=='idle')return;const id=setTimeout(()=>{setAction('mutter');setMessage(companionIdle(cloud.data?.habits,favoriteTitle));if(yaabikSounds)void voice.current?.play('idle');timer.current=setTimeout(()=>{setAction('idle');},2600);},45000+Math.random()*30000);return()=>clearTimeout(id);},[hidden,docked,walking,inHands,shelfOpen,action,yaabikSounds,cloud.data,favoriteTitle]);
 const customize=(field,value)=>{const next={...prefs,[field]:value};setPrefs(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}cloud.send('prefs',{[field]:value});};
 const tapRobot=()=>{
  if(walking||docking)return;
  const at=performance.now(),burst=tapBurst.current;burst.count=at-burst.last>2500?1:burst.count+1;burst.last=at;
  const annoyed=burst.count>=4;cloud.send(annoyed?'grumble':'tap');stopMusic();clearTimeout(timer.current);setObjectActivity(null);setAction(annoyed?'annoyed':'tap');setEmotion(annoyed?'annoyed':'calm');setReaction(n=>n+1);
  setMessage(annoyed?(burst.count>=7?'Ну всё, хватит тыкать! Кто теперь будет оттирать отпечатки?':'Эй! Хватит, ты мне весь экран ляпаешь!'):burst.count===3?'Осторожнее, это мой экран.':burst.count===2?'Да-да, я здесь.':'Бип? Я тебя вижу.');
  if(at-burst.voice>600){sound(annoyed?'grumble':'tap');burst.voice=at;}
  timer.current=setTimeout(()=>{setAction('idle');setEmotion('calm');if(annoyed)setMessage('Ладно, я уже не сержусь. Только аккуратнее с экраном.');},annoyed?4200:1800);
 };
 const interact=kind=>{
  stopMusic();setObjectActivity(null);
  if(walking){setMessage('Сейчас дойду — и я весь твой!');return;}
  clearTimeout(timer.current);
  if(kind==='rest'&&action==='rest'){setAction('idle');setEmotion('calm');sound('wake');setMessage('Хорошо посидели. Я снова весь во внимании!');return;}
  if(docked){if(kind==='rest'){setAction('rest');setMessage('Побудем вместе, пока я подзаряжаюсь. Тихо-тихо.');}else setMessage('Я пока на зарядке. Спасибо, что заглянул!');return;}
  if(charge.level<=0){saveBattery(dockBattery(battery,true));setInHands(false);setMessage('Сам устроился на доке. Скоро снова смогу играть!');return;}
  cloud.send(kind);
  const next=spendBattery(battery,kind==='play'?1:kind==='hello'?.2:kind==='pet'?.1:0);saveBattery(next);
  if(next.level===0){beginDock(next);return false;}
  if(kind==='pet'){const repeated=performance.now()-lastPetSound.current<1800;lastPetSound.current=performance.now();sound(repeated?'purr':'pet');}else sound(kind==='rest'?'sleep':kind);
  haptic();setAction(kind);setEmotion(kind==='rest'?'yawn':'happy');setMessage(kind==='pet'&&(cloud.data?.habits?.pets||0)>=10?'Ты уже знаешь, как мне нравится. Мур-бип…':kind==='rest'?'Побудем вместе. Я немного подремлю — разбуди, когда захочешь поиграть.':messages[kind][Math.floor(Math.random()*messages[kind].length)]);setReaction(n=>n+1);
  if(kind==='rest')timer.current=setTimeout(()=>setEmotion('sleepy'),1600);
  else timer.current=setTimeout(()=>{setEmotion('calm');setAction('idle');},kind==='play'?3300:3000);
 };

 const room={neon:'neon',nyan:'space',poop:'bathroom',tetris:'arcade',terminal:'terminal',retro:'retro'}[theme]||'studio';
 const takeInHands=()=>{if(docked||docking||walking){setMessage('Я пока подключён к доку. Сначала сними меня с зарядки.');return;}const current=batteryAt(battery);if(current.level<=0){saveBattery(dockBattery(current,true));setMessage('Пока совсем нет заряда. Я немного подзаряжусь и буду готов.');return;}stopMusic();clearTimeout(timer.current);setObjectActivity(null);setAction('idle');setEmotion('calm');sound('pickup');setInHands(true);};
 if(!cloud.ready)return <section><StudioLoading label="Подключаем память Яабика…"/>{cloud.error&&<div className="card small" role="alert">Не удалось подключить память. <button className="back" onClick={cloud.retry}>Повторить</button></div>}</section>;
 return <section onPointerDownCapture={unlockVoice} onKeyDownCapture={unlockVoice} className={`yaabik-page ${hidden?'yaabik-paused':''}`}>{inHands&&<YaabikHands theme={theme} skin={prefs.skin} emotion={emotion} onPet={()=>interact('pet')} onClose={()=>{setInHands(false);sound('putdown');}}/>} <div className="yaabik-sync" role="status"><span>{cloud.error?'Сохранение ждёт подключения. Изменения на этом устройстве сохранены.':!cloud.ready?<StudioLoading compact label="Подключаем память…"/>:cloud.busy?'Запоминаю…':'Память Яабика · синхронизировано'}</span>{cloud.error&&<button className="back" onClick={cloud.retry}>Повторить</button>}</div><fieldset className="yaabik-controls" disabled={!cloud.ready}><header className="yaabik-heading"><div><small>YAB / PERSONAL COMPANION</small><h2>Ваш личный Яабик</h2></div><span className="yaabik-online"><i/>Дома</span></header><section className="yaabik-power"><div><span className={`yaabik-battery-icon ${charge.level<20?'low':''} ${docked?'charging':''}`} aria-hidden="true"><i style={{width:Math.max(3,charge.level)+'%'}}/></span><b>{Math.floor(charge.level)}%</b><small>{docking?'Идёт к доку':docked?(charge.level>=100?'Заряжен':'На зарядке'):'Заряд Яабика'}</small></div><button className="pub alt" disabled={docking} onClick={toggleDock}>{docking?'Подключается…':docked?'Снять с зарядки':'На зарядку'}</button></section><div ref={roomNode} onClickCapture={routeRoomClick} onPointerDownCapture={lookRoom} onPointerMove={e=>{if(e.buttons)lookRoom(e);}} style={{'--dance-beat':danceBeat+'s','--dance-bar':danceBeat*4+'s','--pet-x':place.x+'%','--pet-bottom':place.bottom+'px','--walk-time':place.duration+'s'}} className={`yaabik-room ${walking?'is-walking':''} ${objectActivity?'yaabik-object-'+objectActivity:''} ${objectActivity==='discs'?'yaabik-disc-'+shownDisc?.rarity:''} ${lightPattern?'projector-on':''} room-${room} ambience-${prefs.room} ${action==='rest'?'yaabik-resting':''} ${docking?'is-docking':docked?'is-docked':''}`}><div className="yaabik-room-wall"/><YaabikConstellation/><div className="yaabik-station-label"><b>YAB / PERSONAL STATION</b><span>{docked?'POWER CONNECTED':'WELCOME HOME'}</span></div><button data-room-control="player" className="yaabik-room-player yaabik-wall-object" aria-label="Кассетный плеер: включить музыку с Яабиком" aria-disabled={docked||docking} onClick={()=>visitObject('player')}><span className="yaabik-cassette"><i/><i/></span><b/><small>{objectActivity==='player'?'PLAYING / STOP':'CASSETTE / PLAY'}</small></button><button data-room-control="discs" className="yaabik-room-shelf yaabik-wall-object" aria-label="Полка с дисками: выбрать обложку с Яабиком" aria-disabled={docked||docking} onClick={()=>visitObject('discs')}>{shelfDiscs.slice(0,5).map(d=><i key={d.id} style={{background:d.item.color||'var(--room-trim)'}}/>)}<span>{shelfDiscs.length?'DISC / ARCHIVE':'EMPTY / ARCHIVE'}</span></button><button data-room-control="lights" className={`yaabik-station-lights yaabik-wall-object pattern-${lightPattern}`} aria-label="Звёздный проектор" aria-pressed={Boolean(lightPattern)} aria-disabled={docked||docking} onClick={()=>visitObject('lights')}><span className="yaabik-projector-lens"><i/></span><b className="yaabik-projector-switch"/><small>{lightPattern?'STARS / ON':'STAR / PROJECTOR'}</small></button><button type="button" data-room-control="garden" className="yaabik-garden-door" aria-label="Открыть сад Яабика" onClick={onOpenGarden}><span/><i/><small>GARDEN</small></button><div className="yaabik-room-plant"><i/><b/></div><div className="yaabik-room-floor"/><button className="yaabik-walk-floor" aria-label="Позвать Яабика в это место комнаты" disabled={docked||docking} onClick={walkRoom}/><button type="button" data-room-control="dock" className="yaabik-desk" aria-label="Док-станция Яабика" aria-pressed={docked} disabled={docking} onClick={toggleDock}><i/><span>{docking?'CONNECTING…':docked?'POWER / CONNECTED':'YAABIK / DOCK 01'}</span><b className="yaabik-dock-contact"/></button><button ref={petNode} className="yaabik-pet" aria-label="Коснуться Яабика" onClick={tapRobot}><div key={reaction} className={'yaabik-motion yaabik-motion-'+action}><YaabikRobot skin={prefs.skin} theme={theme} emotion={emotion==='annoyed'?'annoyed':docking?'calm':docked||charge.level<=0?'sleepy':emotion} action={docking?'docking':docked?'charging':action}/><span className={`yaabik-held-disc rarity-${shownDisc?.rarity||'common'}`} role="img" aria-label={shownDisc?`Контейнер: ${shownDisc.item.title}`:undefined}>{shownDisc&&<><DiscArtwork item={shownDisc.item}/><i/><small>Y / SEALED</small></>}</span></div></button><span className="yaabik-room-id">Y-01 · {skins.find(s=>s[0]===prefs.skin)[1]}</span></div><p className="yaabik-room-tip">Пол — прогулка. На стене — плеер, любимые диски и звёздный проектор.</p><button className="pub alt yaabik-shelf-edit" onClick={()=>setShelfOpen(true)}>Полка Яабика <span>{shelfDiscs.length} / 5 · выбрать диски</span></button>{shelfOpen&&<dialog ref={shelfDialog} className="yaabik-shelf-dialog" aria-label="Наполнить полку Яабика" onCancel={e=>{e.preventDefault();setShelfOpen(false);}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setShelfOpen(false);}}}><div className="between"><h3>Полка Яабика · {shelfDiscs.length} / 5</h3><button className="back" aria-label="Закрыть полку" onClick={()=>setShelfOpen(false)}>×</button></div><p>Выбери до пяти запечатанных дисков. Контейнеры остаются в коллекции — здесь ты выбираешь, что поставить в комнате.</p>{!shelfData?<p>{shelfError?'Не получилось загрузить коллекцию. Зайди сюда ещё раз позже.':'Загружаем коллекцию…'}</p>:!availableDiscs.length?<p>Пока нет запечатанных дисков. Сначала запечатай диск в инвентаре.</p>:<div className="yaabik-shelf-options">{availableDiscs.map(d=>{const selected=shelfIds.includes(d.id),edition=shelfData.rarities.find(r=>r.id===d.rarity);return <button key={d.id} aria-pressed={selected} disabled={!selected&&shelfDiscs.length>=5} onClick={()=>toggleShelf(d)} style={{'--edition':edition?.color||'#9daabb'}}><span className="yaabik-shelf-cover"><DiscArtwork item={d.item}/></span><span><b>{d.item.title}</b><small>{edition?.name} · #{d.id.slice(0,6).toUpperCase()}</small></span><strong>{selected?'✓':'+'}</strong></button>;})}</div>}</dialog>}<div className="yaabik-speech" role="status"><span className="yaabik-speech-name">Яабик-01</span><p>{message}</p></div><button className="pub yaabik-take" disabled={docked||docking||walking} onClick={takeInHands}>Взять в руки <span>{docking?'Идёт на док…':docked?'Сначала сними с зарядки':'Осмотреть и погладить ↗'}</span></button><div className="yaabik-interactions"><button onClick={()=>interact('hello')}>Поздороваться</button><button disabled={docked||walking||charge.level<=0} onClick={()=>interact('play')}>Поиграть</button><button onClick={()=>interact('rest')}>{action==='rest'?'Разбудить Яабика':'Посидеть рядом'}</button></div>{action==='rest'&&<p className="yaabik-rest-hint">Тихий отдых: Яабик дремлет рядом и не тратит заряд. Разбудить можно этой же кнопкой или другим действием.</p>}<div className="yaabik-tools" role="group" aria-label="Уголок Яабика">{[['skin','Облик'],['room','Комната'],['collection','Коллекция']].map(([id,title])=><button key={id} aria-expanded={panel===id} onClick={()=>setPanel(old=>old===id?null:id)}><span>{id==='skin'?'01':id==='room'?'02':'03'}</span>{title}</button>)}</div>{panel&&<section className="card yaabik-panel"><div className="between"><h3>{panel==='skin'?'Детали корпуса':panel==='room'?'Его маленький мир':'Твои Яабики'}</h3><button className="back" onClick={()=>setPanel(null)} aria-label="Закрыть настройки Яабика">×</button></div>{panel==='collection'?<><div className="yaabik-collection"><div className="yaabik-owned"><YaabikRobot skin={prefs.skin} theme={theme}/><b>Яабик-01</b><small>Первый друг · уже с тобой</small></div><div className="yaabik-unknown"><span>?</span><b>Следующий сигнал</b><small>Новые модели появятся позже</small></div></div><p className="small muted">Стартовый Яабик остаётся с тобой. Его не нужно покупать заново.</p></>:<div className="yaabik-options">{(panel==='skin'?skins:rooms).map(([id,title,hint])=><button key={id} aria-pressed={prefs[panel]===id} onClick={()=>customize(panel,id)}>{panel==='skin'&&<i className={'yaabik-swatch swatch-'+id}/>}<b>{title}</b><small>{hint}</small>{prefs[panel]===id&&<span>Выбрано</span>}</button>)}</div>}</section>}<p className="yaabik-footnote">Док заряжает +{YAABIK_CHARGE_PER_MINUTE}% в минуту, даже когда ты ушёл. Игра расходует 1%, приветствие — 0,2%, поглаживание — 0,1%. При нуле сам идёт на зарядку. Пока тебя нет, заряд не тратится.</p><button className="pub alt yaabik-garden-link" onClick={onOpenGarden}><span>В сад Яабика</span><small>Твоя маленькая теплица ↗</small></button></fieldset></section>;
}
