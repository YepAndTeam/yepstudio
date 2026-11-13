import GameTimers from '../components/GameTimers';
import {useEffect,useRef,useState} from 'react';
import {useStore} from '../store';
import {gameApi as api,discTempo} from '../discPlaySession';
import {haptic} from '../tg';
import {sfx} from '../sfx';
import {driveMusic} from '../driveMusic';
import {usePreferences} from '../preferences';
import GameCanvas from '../components/GameCanvas';
import Leaderboard from '../components/Leaderboard';
import {newDrive,stepDrive,steerDrive,clamp,ROAD} from '../driveEngine';
import {drawDrive} from '../driveArt';
import './Drive.css';

export default function Drive({onBack}){
 const {musicEnabled}=usePreferences();
 const {me,theme}=useStore(),canvas=useRef(null),state=useRef(newDrive()),keys=useRef(new Set()),held=useRef(0),drag=useRef(null),alive=useRef(true),starting=useRef(false),run=useRef(null),savingLock=useRef(false);
 const [phase,setPhase]=useState('idle'),[hud,setHud]=useState({score:0,coins:0,near:0,speed:0}),[top,setTop]=useState(null),[result,setResult]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[muted,setMuted]=useState(sfx.muted);
 useEffect(()=>{driveMusic.setEnabled(theme==='neon'&&musicEnabled&&!muted&&phase==='running'&&!document.hidden);},[theme,musicEnabled,muted,phase]);
 useEffect(()=>()=>driveMusic.release(),[]);
 const loadTop=()=>api('/game/top?game=drive').then(value=>{if(alive.current)setTop(value);}).catch(()=>{});
 useEffect(()=>{alive.current=true;void loadTop();return()=>{alive.current=false;};},[]);
 const updateHud=()=>{const s=state.current;setHud({score:s.score,coins:s.coins,near:s.near,speed:Math.round(s.speed*.9)});};
 const clearInput=()=>{keys.current.clear();held.current=0;drag.current=null;state.current.target=state.current.x;};
 const pause=()=>{if(state.current.phase!=='running')return;driveMusic.setEnabled(false);clearInput();state.current.phase='paused';setPhase('paused');};
 const save=async()=>{
  if(savingLock.current||!run.current)return;
  savingLock.current=true;setSaving(true);setError('');
  try{const value=await api('/game/score','POST',{game:'drive',score:state.current.score,run_id:run.current});if(alive.current){setResult(value);void loadTop();}}
  catch(e){if(alive.current)setError('Не удалось сохранить результат: '+e.message);}
  finally{savingLock.current=false;if(alive.current)setSaving(false);}
 };
 const finish=()=>{driveMusic.setEnabled(false);clearInput();setPhase('crashed');updateHud();haptic();sfx.die();void save();};
 const finishRef=useRef(null);useEffect(()=>{finishRef.current=finish;});
 const start=async()=>{
  if(starting.current||savingLock.current)return;
  driveMusic.restart();
  if(theme==='neon'&&musicEnabled&&!muted)driveMusic.unlock();
  sfx.jump(); // Unlock Web Audio inside the user gesture on iOS.
  starting.current=true;setError('');setPhase('starting');
  try{const value=await api('/game/start','POST',{game:'drive'});if(!value.run_id)throw Error('Сервер не выдал номер заезда');if(!alive.current)return;run.current=value.run_id;state.current={...newDrive(),phase:document.hidden?'paused':'running'};clearInput();setResult(null);updateHud();setPhase(state.current.phase);}
  catch(e){if(alive.current){setError('Не удалось начать заезд: '+e.message);setPhase('idle');}}
  finally{starting.current=false;}
 };
 useEffect(()=>{
  const down=e=>{if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)){e.preventDefault();keys.current.add(e.code);}if(e.code==='Space'&&!e.repeat){e.preventDefault();if(state.current.phase==='running')pause();else if(state.current.phase==='paused'){if(theme==='neon')driveMusic.unlock();clearInput();state.current.phase='running';setPhase('running');}}};
  const up=e=>keys.current.delete(e.code),hide=()=>{if(document.hidden)pause();};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',hide);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',hide);};
 },[theme]);
 useEffect(()=>{
  const node=canvas.current,ctx=node.getContext('2d'),dpr=Math.min(window.devicePixelRatio||1,2);
  node.width=ROAD.width*dpr;node.height=ROAD.height*dpr;ctx.scale(dpr,dpr);ctx.imageSmoothingEnabled=false;
  const style=getComputedStyle(document.documentElement),palette={neon:theme==='neon',bg:style.getPropertyValue('--gbg').trim()||'#152329',fg:theme==='neon'?'#c4edff':'#eef7ff'};
  let raf,last=performance.now(),drawAt=0,hudAt=0;
  const paint=now=>{
   const s=state.current,dt=Math.min((now-last)/1000,1/30);last=now;
   if(s.phase==='running'){
    const direction=held.current||Number(keys.current.has('ArrowRight')||keys.current.has('KeyD'))-Number(keys.current.has('ArrowLeft')||keys.current.has('KeyA'));
    if(direction)steerDrive(s,direction,dt);
    const coins=s.coins,tempo=discTempo(),scaled=dt*tempo;if(tempo===1)stepDrive(s,dt);else for(let elapsed=0;elapsed<scaled;elapsed+=1/60)stepDrive(s,Math.min(1/60,scaled-elapsed));if(s.coins>coins)sfx.point();
   }
   if(now-drawAt>=1000/30||s.phase!=='running'){drawDrive(ctx,s,palette);drawAt=now;}
   if(s.phase==='crashed'&&phase==='running'){finishRef.current();return;}
   if(now-hudAt>150&&s.phase==='running'){updateHud();hudAt=now;}
   if(s.phase==='running')raf=requestAnimationFrame(paint);
  };
  paint(last);return()=>cancelAnimationFrame(raf);
 },[phase,theme]);
 const resume=()=>{if(theme==='neon'&&musicEnabled&&!muted)driveMusic.unlock();clearInput();state.current.phase='running';setPhase('running');};
 const pointerDown=e=>{if(state.current.phase!=='running'||drag.current)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,start:state.current.x};};
 const pointerMove=e=>{if(drag.current?.id!==e.pointerId)return;const rect=e.currentTarget.getBoundingClientRect();state.current.target=clamp(drag.current.start+(e.clientX-drag.current.x)*ROAD.width/rect.width,ROAD.left+14,ROAD.right-14);};
 const release=e=>{if(drag.current?.id===e.pointerId)drag.current=null;};
 const control=direction=>({onPointerDown:e=>{if(state.current.phase!=='running')return;e.currentTarget.setPointerCapture(e.pointerId);held.current=direction;},onPointerUp:()=>{held.current=0;},onPointerCancel:()=>{held.current=0;},onLostPointerCapture:()=>{held.current=0;}});
 return <section className="drive-page"><div className="between"><button className="back" onClick={onBack}>‹ Игры</button><button className="back" onClick={()=>{const next=sfx.toggle();setMuted(next);if(!next&&theme==='neon'&&musicEnabled)driveMusic.unlock();}}>{muted?'Звук: выкл':'Звук: вкл'}</button></div><div className="drive-heading"><div><small>YAB / TRAFFIC ARCADE</small><h2>После полуночи</h2></div><span className="drive-edition">{theme==='neon'?'NEON / R34':'HIGHWAY / 01'}</span></div><GameTimers stateRef={state}/><section className="card drive-game"><div className="drive-hud" aria-live="off"><div><small>Очки</small><b>{hud.score.toLocaleString('ru-RU')}</b></div><div><small>Монетки</small><b>{hud.coins}</b></div><div><small>км/ч</small><b>{hud.speed||119}</b></div><button className="back" disabled={phase!=='running'} onClick={pause} aria-label="Пауза">Ⅱ</button></div><div className="drive-stage"><GameCanvas ref={canvas} aria-label="Игровое поле: обгоняй машины и собирай монетки" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} style={{display:'block',width:'100%',maxWidth:'min(320px, max(160px, calc((100dvh - 420px) * 2 / 3)))',aspectRatio:'2 / 3',touchAction:'none'}}/>{phase!=='running'&&<div className="drive-overlay"><div className="drive-overlay-card"><small>{phase==='crashed'?'RUN COMPLETE':'MIDNIGHT CLUB'}</small><h3>{phase==='paused'?'Пит-стоп':phase==='crashed'?`${hud.score} очков`:phase==='starting'?'Готовим заезд…':'Город не спит'}</h3><p>{phase==='crashed'?`Монетки: ${hud.coins} · близкие обгоны: ${hud.near}`:phase==='paused'?'Заезд на паузе. Продолжим, когда будешь готов.':'Обгоняй поток. Собирай монетки. Держись подальше от бамперов.'}</p>{phase==='paused'?<button className="pub" onClick={resume}>Продолжить</button>:phase!=='starting'&&<button className="pub" disabled={saving||Boolean(error&&phase==='crashed')} onClick={start}>{saving?'Сохраняем…':phase==='crashed'?'Ещё заезд':'На трассу'}</button>}</div></div>}</div><div className="drive-controls"><button className="pub alt" aria-label="Рулить влево" {...control(-1)}>←</button><p>Веди пальцем по трассе<br/>или удерживай ← →</p><button className="pub alt" aria-label="Рулить вправо" {...control(1)}>→</button></div><p className="small muted drive-rules">Монетка +15 · обгон +5 · близкий обгон ещё +10. Монетки дают очки заезда. Каждые 5 000 очков: +20 км/ч.</p>{result&&<p className="drive-result" role="status">{result.record?'Новый рекорд!':'Результат сохранён'} · Лучший: {result.best}</p>}{error&&<div className="drive-error" role="alert"><p>{error}</p>{phase==='crashed'&&<button className="pub alt" disabled={saving} onClick={save}>Повторить сохранение</button>}</div>}</section><Leaderboard title="После полуночи — рекорды" data={top} meId={me?.id}/></section>;
}

