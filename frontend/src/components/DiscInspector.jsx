import {useEffect,useRef,useId} from 'react';
import DiscArtwork from './DiscArtwork';
import {discBackVisible,secretDiscOpacity} from '../discRotation';
const coverTitles={minecraft:['BUILD / EXPLORE / SURVIVE','MINECRAFT'],terraria:['A WORLD OF ADVENTURE','TERRARIA'],stardew:['COUNTRYSIDE / FIELD NOTES','STARDEW VALLEY'],undertale:['A SMALL WORLD BELOW','UNDERTALE'],doom:['INFERNAL / ARCHIVE','DOOM'],halflife:['RESEARCH / INCIDENT FILE','HALF-LIFE'],portal:['APERTURE / TEST RECORD','PORTAL'],underground:['NEED FOR SPEED','UNDERGROUND'],sanandreas:['GRAND THEFT AUTO','SAN ANDREAS'],counterstrike:['TACTICAL / ORIGINAL','COUNTER-STRIKE'],hollowknight:['BENEATH THE KINGDOM','HOLLOW KNIGHT'],skyrim:['THE ELDER SCROLLS V','SKYRIM']};
export function DiscFace({item,rarity,revealed=false,serial='',cracked=false}){
 const cover=coverTitles[item.id]||['OPTICAL ARCHIVE',item.title.toUpperCase()];
 return <div className={`dvd-disc-object cover-${item.id} ${revealed?'disc-is-revealed':''}`} data-rarity={revealed?rarity:undefined} style={{'--disc-art-color':item.color}}><i className="dvd-disc-edge"/><div className="dvd-disc-face dvd-disc-front"><small>YAB / OPTICAL ARCHIVE</small><DiscArtwork item={item}/>{cracked&&<i className="dvd-print-crack" aria-label="Трещина на обложке"/>}<strong><small>{cover[0]}</small><span>{cover[1]}</span></strong><span className="dvd-disc-code">{item.code}</span><i className="dvd-disc-hub"/></div><div className="dvd-disc-face dvd-disc-back"><span className="dvd-back-etch">OPTICAL ARCHIVE / {serial||item.code}</span>{rarity==='secret'?<strong className="dvd-secret-word" aria-hidden="true">SECRET</strong>:<span className="dvd-back-edition">{revealed?{common:'STUDIO PRESS',rare:'BLUE EDITION',epic:'PURPLE EDITION',mythic:'CRIMSON EDITION',legendary:'SPECTRUM EDITION'}[rarity]:'READING SURFACE'}</span>}<i className="dvd-disc-hub"/></div></div>;
}
export default function DiscInspector({draw,onReveal,onSecret,initialYaw=0}){
 const surface=useRef(null),rotation=useRef({yaw:initialYaw,pitch:12}),drag=useRef(null),frame=useRef(null),paintRef=useRef(null),latest=useRef({draw,onReveal,onSecret}),requested=useRef(false),secretSeen=useRef(false),hint=useId();
 useEffect(()=>{latest.current={draw,onReveal,onSecret};paintRef.current?.();},[draw,onReveal,onSecret]);
 useEffect(()=>{
  const paint=()=>{
   const node=surface.current;if(!node)return;
   const {yaw,pitch}=rotation.current,secret=secretDiscOpacity(yaw);
   node.style.setProperty('--disc-yaw',yaw+'deg');node.style.setProperty('--disc-pitch',pitch+'deg');node.style.setProperty('--disc-shine',(yaw+pitch*1.6)+'deg');node.style.setProperty('--disc-secret',String(secret));
   const current=latest.current;
   if(discBackVisible(yaw)&&!current.draw.revealed&&!requested.current){requested.current=true;Promise.resolve(current.onReveal?.()).then(ok=>{if(ok===false)requested.current=false;}).catch(()=>{requested.current=false;});}
   if(current.draw.rarity==='secret'&&current.draw.revealed&&secret>.5&&!secretSeen.current){secretSeen.current=true;current.onSecret?.();}
  };
  paintRef.current=paint;paint();return()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);paintRef.current=null;};
 },[]);
 const queue=()=>{if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;paintRef.current?.();});};
 const turn=(yaw,pitch=rotation.current.pitch)=>{rotation.current={yaw,pitch};queue();};
 const down=e=>{if(drag.current)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,...rotation.current};surface.current.classList.add('dragging');};
 const move=e=>{const start=drag.current;if(start?.id!==e.pointerId)return;turn(start.yaw+(e.clientX-start.x)*.85,Math.max(-65,Math.min(65,start.pitch-(e.clientY-start.y)*.55)));};
 const end=e=>{if(drag.current?.id===e.pointerId){drag.current=null;surface.current.classList.remove('dragging');}};
 const key=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home')turn(0,12);else turn(rotation.current.yaw+(e.key==='ArrowLeft'?-15:e.key==='ArrowRight'?15:0),Math.max(-65,Math.min(65,rotation.current.pitch+(e.key==='ArrowUp'?10:e.key==='ArrowDown'?-10:0))));};
 return <div className="dvd-inspector"><div ref={surface} className="dvd-turntable" tabIndex={0} role="img" aria-label={'Вращаемый диск '+draw.item.title} aria-describedby={hint} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={key}><i className="dvd-floor-shadow"/><DiscFace item={draw.item} rarity={draw.rarity} revealed={draw.revealed} serial={draw.serial} cracked={draw.cracked}/></div><p id={hint} className="dvd-rotation-hint">Потяни диск пальцем. Редкость — на обороте.</p><div className="dvd-rotation-controls"><button className="pub alt" onClick={()=>turn(rotation.current.yaw+180)}>Перевернуть диск</button><button className="back" onClick={()=>turn(rotation.current.yaw+24,22)}>Поймать блик ↗</button><button className="back" onClick={()=>turn(0,12)}>Обложка</button></div></div>;
}
