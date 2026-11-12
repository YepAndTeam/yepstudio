import {useEffect,useState} from 'react';
import {api} from '../api';
import {DiscFace} from './DiscInspector';
export default function DiscShelves(){
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let alive=true;api('/discs/shelves').then(v=>{if(alive)setData(v);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 if(error)return <p className="card" role="alert">{error}</p>;
 if(!data)return <p className="card">Загружаем полки…</p>;
 return <section className="disc-archive"><div className="card"><h3>Запечатанная коллекция</h3><p className="small">Выбери экземпляр в коллекции и нажми «Запечатать на полке». Каждый диск остаётся здесь навсегда.</p><p className="small muted">Полный набор: {data.reward} Йер один раз за каждую игру. Секретный подарок пока закрыт.</p></div>{data.shelves.map(shelf=><article key={shelf.item.id} className={`card disc-archive-shelf ${shelf.rewarded?'complete':''}`}><header><h3>{shelf.item.title}</h3><b>{shelf.slots.length} / {data.rarities.length}</b></header><div className="disc-archive-slots">{data.rarities.map(r=>{const disc=shelf.slots.find(d=>d.rarity===r.id);return <div key={r.id} className={`disc-capsule ${disc?'filled':'empty'} rarity-${r.id}`} style={{'--capsule-color':r.color}}><div className="disc-capsule-window">{disc?<DiscFace item={shelf.item} cracked={disc.cracked}/>:<span>?</span>}</div><b>{r.name}</b><small>{disc?'ЗАПЕЧАТАН':'Пустая ячейка'}</small>{disc&&<code>#{disc.id.slice(0,6).toUpperCase()}</code>}</div>;})}</div><footer><span>{shelf.rewarded?'1000 Йер получены':'Награда за набор: 1000 Йер'}</span><small>Секретный подарок · закрыт</small></footer></article>)}</section>;
}
