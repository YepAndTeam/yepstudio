import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { THEMES } from "../constants";
import CassetteSeal from "../components/CassetteSeal";
import CassetteArtwork from "../components/CassetteArtwork";
import "./ThemeCollection.css";
const details={
 neon:["Редкая","Ночной Токио: холодный неон, вывески гаражей и серебристо-синий Skyline R34 и зацикленная пиксельная мелодия в игре «После полуночи»."],
 dark:["Базовая","Тёмная палитра приложения и игровые цвета."],
 light:["Базовая","Светлая палитра приложения и игровые цвета."],
 retro:["Обычная","Окна, кнопки и палитра в духе компьютеров 1998 года."],
 terminal:["Обычная","Зелёный терминал, моноширинный шрифт и тёмные панели."],
 nyan:["Редкая","Nyan Cat, звёзды и радужные детали в Дино, Flappy, Змейке и Тетрисе. Свои игровые звуки и мелодия."],
 tetris:["Редкая","Аркадное оформление приложения. Цветные объёмные блоки и своя мелодия в Тетрисе."],
 poop:["Мифическая","Пиксельная ванная: персонажи в Дино и Flappy, бумажная Змейка, кафель и смыв в Тетрисе, оформление Ада. Фоновый пиксельный фанк «Золотой смыв»."]
};
const features={
 neon:[["Оформление","Ночной город: тёмные панели, бирюзовые линии и розовый неон."],["После полуночи","Skyline R34, ночная трасса, городские вывески и отражения на асфальте."],["Музыка","Пиксельная мелодия в гонке с непрерывным повтором."],["Кассета","Пиксельная машина, дорожная разметка и редкая печать клуба."]],
 dark:[["Оформление","Тёмная палитра приложения и игровые цвета."]],
 light:[["Оформление","Светлая палитра приложения и игровые цвета."]],
 retro:[["Оформление","Окна, кнопки и палитра в духе компьютеров 1998 года."]],
 terminal:[["Оформление","Зелёный терминал, моноширинный шрифт и тёмные панели."]],
 nyan:[["Оформление","Космическая палитра и радужные детали."],["Игры","Nyan Cat и звёзды в Дино, Flappy, Змейке и Тетрисе."],["Звук","Свои игровые звуки и мелодия."]],
 tetris:[["Оформление","Аркадный стиль приложения."],["Тетрис","Цветные объёмные блоки."],["Звук","Своя мелодия в Тетрисе."]],
 poop:[["Оформление","Пиксельная ванная и стиль «Золотого смыва»."],["Дино и Flappy","Свои пиксельные персонажи."],["Змейка","Бумажная змейка и вантузы."],["Тетрис","Кафельные блоки и анимация смыва."],["Ад","Туалетное оформление арены, врагов и оружия."],["Музыка","Фоновый пиксельный фанк «Золотой смыв» по всему приложению."]]
};
function Cassette({item,back=false}){
 return <div className={`collection-tape ${back?"back-side":""} cover-${item.id} ${!back&&["nyan","tetris","poop","neon"].includes(item.id)?"illustrated-cover":""}`} style={{"--tape":item.bg,"--label":item.card,"--ink":item.fg}}><div className="tape-label"><small>YAB / AUDIO LAB</small><strong>{back?item.name+" / B":item.name}</strong>{!back&&<CassetteArtwork theme={item.id}/>}<span>{details[item.id][0]}</span>{back&&<><CassetteSeal id={item.id}/><p className="tape-tracklist">{details[item.id][1]}</p><div className="tape-catalog"><i aria-hidden="true"/>YAB / {item.id.toUpperCase()} / 01</div></>}</div><div className="tape-reels"><i/><span/><i/></div><div className="tape-bottom">{back?"COLLECTION / STUDIO":"SIDE A / THEME"}</div></div>;
}
function CassetteBody({item,turned=false}) {
 return <div className={`cassette-body ${turned?"turned":""}`} style={{"--shell":item.bg}}>
  <div className="body-face body-front"><Cassette item={item}/></div>
  <div className="body-face body-back"><Cassette item={item} back/></div>
  <i className="body-edge edge-left"/><i className="body-edge edge-right"/>
  <i className="body-edge edge-top"/><i className="body-edge edge-bottom"/>
 </div>;
}
function RotatableCassette({item,disabled}) {
 const body=useRef(null),gesture=useRef(null),angle=useRef({x:12,y:-24}),frame=useRef(null);
 const draw=()=>{if(body.current){body.current.style.transform=`rotateX(${angle.current.x}deg) rotateY(${angle.current.y}deg)`;body.current.style.setProperty("--foil-angle",`${angle.current.y+angle.current.x}deg`);}};
 const queue=()=>{if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;draw();});};
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
 const end=e=>{if(gesture.current?.id!==e.pointerId)return;gesture.current=null;e.currentTarget.classList.remove("dragging");};
 return <>
  <div className={`tape-turntable ${disabled?"lifting":""}`} aria-label="Объёмная кассета: вращай пальцем или мышью"
   onPointerDown={e=>{if(disabled||gesture.current||e.button!==0)return;gesture.current={id:e.pointerId,x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add("dragging");}}
   onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;angle.current={x:angle.current.x-(e.clientY-g.y)*.65,y:angle.current.y+(e.clientX-g.x)*.65};g.x=e.clientX;g.y=e.clientY;queue();}}
   onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
   <div ref={body} className="rotation-body"><CassetteBody item={item}/></div>
  </div>
  <p className="small muted rotation-hint">Потяни кассету, чтобы рассмотреть со всех сторон.</p>
  <div className="rotation-actions"><button className="pub alt" disabled={disabled} onClick={()=>{angle.current={x:0,y:angle.current.y+180};draw();}}>Повернуть кассету</button><button className="pub alt" disabled={disabled} onClick={()=>{angle.current={x:12,y:-24};draw();}}>Сбросить угол</button></div>
 </>;
}
export default function ThemeCollection({onBack,backLabel="Профиль"}){
 const {me,theme,setTheme}=useStore();
 const [selected,select]=useState(theme),[phase,setPhase]=useState("idle"),[error,setError]=useState("");
 const locked=useRef(false),alive=useRef(true),waiter=useRef(null),deck=useRef(null);
 const [running,setRunning]=useState(false);
 useEffect(()=>{
  alive.current=true;
  let visible=false;
  const update=()=>setRunning(visible&&document.visibilityState==="visible");
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();});
  if(deck.current)observer.observe(deck.current);
  document.addEventListener("visibilitychange",update);
  return ()=>{alive.current=false;observer.disconnect();document.removeEventListener("visibilitychange",update);if(waiter.current){clearTimeout(waiter.current.id);waiter.current.resolve();}};
 },[]);
 const playing=THEMES.find(t=>t.id===theme)||THEMES[0];
 const item=THEMES.find(t=>t.id===selected)||THEMES[0];
 const owned=me?.owned_themes?.includes(item.id);
 async function insert(){
  if(locked.current||!owned||theme===item.id)return;
  locked.current=true;setError("");setPhase("loading");
  const duration=matchMedia("(prefers-reduced-motion: reduce)").matches?0:1000;
  const motion=new Promise(resolve=>{waiter.current={resolve,id:setTimeout(resolve,duration)};});
  const [ok]=await Promise.all([setTheme(item.id),motion]);
  waiter.current=null;
  if(!alive.current)return;
  setPhase(ok?"loaded":"idle");
  if(!ok)setError("Не удалось установить тему. Попробуй ещё раз.");
  locked.current=false;
 }
 return <div className="collection-page"><button className="back" onClick={onBack}>‹ {backLabel}</button><h2>Коллекция кассет</h2><p className="small muted">Выбери запись на стенде. Каждая кассета меняет атмосферу студии.</p>
 <div className="cassette-wall">{THEMES.map(t=>{const has=me?.owned_themes?.includes(t.id);return <button key={t.id} className={`cassette-stand ${selected===t.id?"selected":""} ${has?"":"unowned"}`} disabled={phase==="loading"} aria-pressed={selected===t.id} onClick={()=>{select(t.id);setPhase("idle");setError("");}}><Cassette item={t}/><span>{t.name}</span><small>{has?(theme===t.id?"В аппарате":details[t.id][0]):"Ещё не получена"}</small></button>;})}</div>
 <section className="card tape-inspector">
 <RotatableCassette key={item.id} item={item} disabled={phase==="loading"}/>
 <div ref={deck} className={`platform-player ${phase==="loading"?"reading":""} ${running?"deck-running":""}`}>
  <div className="player-caption"><small>{phase==="loading"?"Устанавливаем кассету":"Сейчас играет"}</small><strong>{phase==="loading"?item.name:playing.name}</strong></div>
  <div className="platform-scene">
   <div className="platform-top"><div className="platform-seat"/><i className="platform-fastener fastener-left"/><i className="platform-fastener fastener-right"/><div className="platform-guides"/><span>YAB STUDIO / THEME DECK</span></div>
   <div className="platform-cassette" key={phase==="loading"?"insert":"play"}><CassetteBody item={phase==="loading"?item:playing}/></div>
   <div className="platform-front"><div className="deck-meters" aria-hidden="true">{[0,1,2,3,4,5,6].map(i=><i key={i} style={{"--bar":i}}/>)}</div><small role="status">{phase==="loading"?"Загрузка…":"Кассета активна"}</small><div className="platform-vents" aria-hidden="true"/><i className="power-light"/></div>
  </div>
 </div>
 <section className={`cassette-description ${item.id==="poop"?"mythic-description":""}`} aria-label={`Особенности темы ${item.name}`}>
  <div className="description-heading"><span className="description-eyebrow">ПАСПОРТ КАССЕТЫ</span><h3>{item.name}</h3><span className="description-rarity">{details[item.id][0]}</span></div>
  <dl className="cassette-features">{features[item.id].map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
 </section>
 {!owned&&<p className="small muted">Эту кассету можно получить в магазине или в награду.</p>}
 <button className="pub" disabled={!owned||phase==="loading"||theme===item.id} onClick={insert}>{phase==="loading"?"Устанавливаем…":theme===item.id?"Установлена":"Вставить кассету"}</button>{error&&<p role="alert">{error}</p>}
 </section></div>;
}

