import {useEffect,useRef,useState} from 'react';
import {api} from '../api';
import {attachDiscSession} from '../discPlaySession';
import {useStore} from '../store';
function Session({game,run,onBack}){
 const [ready,setReady]=useState(false),[left,setLeft]=useState(1);const session=useRef(null),View=game.View;
 useEffect(()=>{const duration=Date.parse(run.expires_at)-Date.parse(run.server_now);const value={first:run,effects:run.effects,deadline:Date.now()+duration};session.current=value;const detach=attachDiscSession(value);setReady(true);const tick=()=>setLeft(Math.max(0,Math.ceil((value.deadline-Date.now())/1000)));tick();const timer=setInterval(tick,1000);return()=>{detach();clearInterval(timer);};},[run]);
 return <section className="disc-play-session"><div className="card disc-mode-banner"><b>Режим с диском</b><span>Осталось {Math.floor(left/3600)} ч {Math.floor(left%3600/60)} мин</span><small>Отдельный рейтинг · без обычных рекордов и турниров</small></div>{left===0?<section className="card"><h3>Срок диска истёк</h3><p className="small muted">Текущий забег завершён без сохранения. Проверь состояние диска в инвентаре.</p><button className="pub" onClick={onBack}>К выбору игры</button></section>:ready&&<View onBack={onBack}/>}</section>;
}
export default function DiscPlay({games,onBack}){
 const {loadMe}=useStore(),[data,setData]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false);const alive=useRef(true),working=useRef(false);
 useEffect(()=>{alive.current=true;api('/discs/equipment').then(value=>{if(alive.current)setData(value);}).catch(e=>{if(alive.current)setError(e.message);});return()=>{alive.current=false;};},[selected]);
 const choose=async game=>{if(working.current)return;working.current=true;setBusy(true);setError('');try{const run=await api('/disc-play/start','POST',{game:game.id});if(alive.current)setSelected({game,run});}catch(e){if(alive.current)setError(e.message);}finally{working.current=false;if(alive.current)setBusy(false);}};
 if(selected)return <Session key={selected.run.run_id} game={selected.game} run={selected.run} onBack={()=>{setSelected(null);void loadMe();}}/>;
 return <section className="disc-play-launcher"><button className="back" onClick={onBack}>‹ Игры</button><h2>Игры с дисками</h2><p className="small muted">Изменение темпа и очков работает только здесь. Общие таблицы и турниры используют обычные правила.</p>{error&&<p className="card" role="alert">{error}</p>}<section className="card"><h3>{data?.active?data.active.item.title:'Нужен активный диск'}</h3><p className="small muted">{data?.active?'Диск уже установлен. Выбери игру ниже. Срок не останавливается при выходе.':'Активируй рабочий экземпляр в «Профиль → Инвентарь → DVD-диски».'}</p></section><div className="ggrid">{games.map(game=><button className="card disc-game-entry" key={game.id} disabled={busy||!data?.active} onClick={()=>choose(game)}><b>{game.title}</b><small>{game.hint}</small><span>{busy?'Подключаем…':'Играть с диском ›'}</span></button>)}</div></section>;
}
