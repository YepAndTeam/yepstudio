import {useEffect} from 'react';
import {useStore} from '../store';
import {Loading} from '../components/Common';
import {ST} from '../constants';
export default function Activity({onBack,openThread}){
 const {me:m,topics,loadTopics}=useStore();useEffect(()=>{void loadTopics();},[loadTopics]);if(!m)return <Loading/>;const back=onBack,mine=(topics||[]).filter(t=>t.author_id===m.id);
 return <><button className="back" onClick={back}>‹ Сообщество</button><h2>Моя активность</h2><div className="card stats"><div><b>{m.topics}</b><span>Темы</span></div><div><b>{m.comments}</b><span>Комментарии</span></div><div><b>{m.votes}</b><span>Голоса</span></div></div><section className="card"><h3>Мои темы</h3>{!topics?<Loading/>:!mine.length?<p className="small muted">Ты ещё не создавал тем.</p>:mine.map(t=><button className="mine" key={t.id} onClick={()=>openThread('t'+t.id)}><div><b>{t.title}</b><p className="small muted">{t.category} · {ST[t.status]||'Без статуса'}</p></div><span>▲ {t.votes}</span></button>)}</section></>;
}
