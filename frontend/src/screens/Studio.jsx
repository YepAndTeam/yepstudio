import {useEffect,useState} from 'react';
import {useStore} from '../store';
import News from './News';
import TournamentList from '../components/TournamentList';
import TournamentBanner from '../components/TournamentBanner';
import HallOfFame from '../components/HallOfFame';
import Races from './Races';
function EventClock({event}){
 const [now,setNow]=useState(Date.now);
 const [offset]=useState(()=>Date.parse(event.server_now)-Date.now());
 useEffect(()=>{const timer=setInterval(()=>{if(!document.hidden)setNow(Date.now());},1000);return()=>clearInterval(timer);},[]);
 const seconds=Math.max(0,Math.ceil((Date.parse(event.ends_at)-now-offset)/1000));
 return <b className="studio-event-clock">{seconds?`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:'Обновляем событие…'}</b>;
}
export default function Studio({openThread,tournamentId,onTournamentChange,onPlay,initialSection}){
 const {home,loadHome}=useStore();const [section,setSection]=useState(initialSection||(tournamentId?'tournaments':'news'));
 const open=id=>{onTournamentChange(id);setSection('tournaments');};
 const navigate=id=>{setSection(id);onTournamentChange(null);};
 useEffect(()=>{if(section!=='news')return;void loadHome();const timer=setInterval(()=>{if(!document.hidden)void loadHome(true);},30000);return()=>clearInterval(timer);},[section,loadHome]);
 if(section!=='news')return <section className="studio-detail"><button className="back studio-back" onClick={()=>{if(section==='tournaments'&&tournamentId)onTournamentChange(null);else navigate('news');}}>‹ {section==='tournaments'&&tournamentId?'Турниры':'Студия'}</button>{section==='tournaments'&&(tournamentId?<TournamentBanner key={tournamentId} eventId={tournamentId} onPlay={onPlay}/>:<TournamentList onOpen={open}/>)}{section==='races'&&<Races/>}{section==='hall'&&<HallOfFame onOpen={open}/>} {section==='all-news'&&<><h2>Новости студии</h2><News openThread={openThread} compact={false}/></>}</section>;
 const event=home?.event;const events=event?[event,...(event.dino_tournament?[event.dino_tournament]:[])]:[];
 return <section className="studio-overview"><div className="studio-title"><div><small>YAB / STUDIO</small><h2>Студия</h2></div><span className="small muted">Играй. Общайся. Создавай.</span></div>{events.length>0&&<div className={`studio-events ${events.length>1?'studio-events-pair':''}`}>{events.map(event=><section key={event.kind+event.id} className="card studio-event" aria-label="Ближайшее событие"><div className="studio-event-top"><span>{event.kind==='races'?'PIXEL DERBY':'YAB CUP'}</span><span><i/>{event.status}</span></div><h3>{event.title}</h3><div className="studio-event-footer"><div><small>{event.label}</small>{event.ends_at&&<EventClock key={event.ends_at+event.server_now} event={event}/>}</div><button className="pub" onClick={()=>event.kind==='races'?navigate('races'):open(event.id)}>Перейти <span aria-hidden="true">↗</span></button></div></section>)}</div>}<div className="studio-shortcuts">{[['tournaments','Турниры','Соревнуйся','01'],['races','Скачки','Следи за заездами','02'],['hall','Зал славы','Лучшие игроки','03']].map(([id,title,description,number])=><button className="card studio-shortcut" key={id} onClick={()=>navigate(id)}><small>{number}</small><b>{title}</b><span>{description}</span></button>)}</div><div className="between studio-news-heading"><h3>Последние новости</h3><button className="back" onClick={()=>navigate('all-news')}>Все новости ›</button></div><News openThread={openThread}/></section>;
}
