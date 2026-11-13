import StudioLoading from '../components/StudioLoading';
import {lazy,Suspense,useState} from 'react';
const StudioChat=lazy(()=>import('../components/StudioChat'));
const DiscMarket=lazy(()=>import('../components/DiscMarket'));
import {useStore} from '../store';
import Forum from './Forum';
import Friends from './Friends';
import Mail from './Mail';
import Activity from './Activity';
export default function Community({initialSection,targetId,onOpenLetter,onOpenGift,...forumProps}){
 const [section,setSection]=useState(initialSection||'hub'),[future,setFuture]=useState(initialSection==='trading'?'trading':'chat');const {me}=useStore();
 const back=()=>setSection('hub'),gifts=[...(me?.disc_gift?[me.disc_gift]:[]),...(me?.theme_gifts||[])],unread=gifts.filter(g=>!g.claimed).length+(me?.compensation_letters||[]).filter(l=>!l.read).length;
 if(section==='friends')return <Friends onBack={back} targetId={targetId}/>;
 if(section==='letters')return <Mail onBack={back} onOpenLetter={onOpenLetter} onOpenGift={onOpenGift}/>;
 if(section==='activity')return <Activity onBack={back} openThread={forumProps.openThread}/>;
 if(section==='forum')return <><button className="back" onClick={back}>‹ Сообщество</button><h2>Архив форума</h2><Forum {...forumProps}/></>;
 return <section className="community-hub"><div className="community-heading"><small>YAB / TOGETHER</small><h2>Сообщество</h2><p className="muted small">Друзья, общий чат, обмены и письма студии.</p></div><div className="community-links">{[['friends','Друзья','Кто в сети и совместные игры'],['letters','Почта',unread?'Новых писем: '+unread:'Подарки и письма от студии'],['activity','Моя активность','Темы, ответы и голоса']].map(([id,title,description])=><button className="card community-link" key={id} onClick={()=>setSection(id)}><span><b>{title}</b><small>{description}</small></span><span aria-hidden="true">›</span></button>)}</div><section className="card community-future"><div className="community-future-heading"><h3>Место встречи</h3><span className="badge">Чат и обмены</span></div><div className="seg" aria-label="Разделы общения"><button className={future==='chat'?'on':''} onClick={()=>setFuture('chat')}>Общий чат</button><button className={future==='trading'?'on':''} onClick={()=>setFuture('trading')}>Трейдинг</button></div><Suspense fallback={<StudioLoading compact label="Подключаемся…"/>}>{future==='chat'?<StudioChat/>:<DiscMarket/>}</Suspense></section><details className="community-archive"><summary>Ещё</summary><button className="card community-link" onClick={()=>setSection('forum')}><span><b>Архив форума</b><small>Старые обсуждения, идеи и сообщения об ошибках</small></span><span>›</span></button></details></section>;
}
