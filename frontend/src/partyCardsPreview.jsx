import {THEMES} from './constants';
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import PartyPlayScreen from './components/PartyPlayScreen';
import {makeCardDemo} from './partyCardDemo';
import './styles.css';
if(!import.meta.env.DEV)throw Error('Local card preview only');
const PHASES={last_words:'Последнее слово',discussion:'Обсуждение',night:'Ночь',vote:'Голосование',reveal:'Раскрытие карточек'};
export default function CardsPreview(){
 const [theme,setTheme]=useState('dark');
 const [kind,setKind]=useState('mafia'),[role,setRole]=useState('civilian'),[room,setRoom]=useState(()=>makeCardDemo()),[picked,setPicked]=useState(null),[chat,setChat]=useState(''),[now,setNow]=useState(()=>Date.now());
 useEffect(()=>{document.documentElement.dataset.theme=theme;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[theme]);
 const reset=(nextKind,nextRole,nextPhase)=>{setNow(Date.now());setKind(nextKind);setRole(nextRole);setPicked(null);setRoom({...makeCardDemo(nextKind,nextRole,nextPhase),reveal_trait:nextKind==='bunker'&&nextPhase==='reveal'?'phobia':null});};
 const action=(type,value)=>setRoom(s=>({...s,my_action:type!=='vote',my_action_kind:type==='night_kill'||role==='mafia'?'shoot':role==='doctor'?'heal':role==='detective'?'check':null,my_vote:type==='vote'?value:s.my_vote,players:type==='reveal'?s.players.map(p=>p.id===1?{...p,revealed:[...new Set([...p.revealed,value])]}:p):s.players}));
 const send=e=>{e.preventDefault();if(!chat.trim())return;const at=Date.now()/1000;setRoom(s=>({...s,server_now:at,can_send_last_words:s.phase==='last_words'?false:s.can_send_last_words,messages:[...s.messages,{id:s.messages.length+1,uid:1,name:'Ты',text:chat.trim(),at,last_words:s.phase==='last_words'}].slice(-30)}));setChat('');};
 const time=Math.max(0,Math.ceil(room.deadline-now/1000));
 const toolbar=<><select aria-label="Оформление сцены" value={theme} onChange={e=>setTheme(e.target.value)}>{THEMES.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><select aria-label="Образец игры" value={kind} onChange={e=>reset(e.target.value,role,e.target.value==='bunker'?'reveal':'discussion')}><option value="mafia">Карты мафии</option><option value="bunker">Карты бункера</option></select>{kind==='mafia'&&<select aria-label="Образец роли" value={role} onChange={e=>reset(kind,e.target.value,room.phase)}><option value="civilian">Мирный житель</option><option value="mafia">Мафия</option><option value="detective">Комиссар</option><option value="doctor">Доктор</option></select>}<select aria-label="Образец этапа" value={room.phase} onChange={e=>reset(kind,role,e.target.value)}>{Object.entries(PHASES).filter(([id])=>kind==='mafia'?id!=='reveal':!['night','last_words'].includes(id)).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><button onClick={()=>{location.href='/party-story.html';}}>▶ Партия</button>{kind==='mafia'&&<button onClick={()=>setRoom(s=>({...s,players:s.players.map(p=>p.id===5?{...p,alive:!p.alive,role:p.alive?'mafia':null}:p)}))} aria-label="Показать выбывшего Яабика" aria-pressed={!room.players.find(p=>p.id===5).alive}>Выбывший</button>}</>;
 return <PartyPlayScreen room={room} viewerId={1} picked={picked} onPick={setPicked} onAction={action} busy={false} chat={chat} setChat={setChat} onSend={send} onClose={()=>{location.href='/party-preview.html';}} phaseLabel={PHASES[room.phase]} timeLabel={`${Math.floor(time/60)}:${String(time%60).padStart(2,'0')}`} demo toolbar={toolbar}/>;
}
createRoot(document.getElementById('app')).render(<CardsPreview/>);
