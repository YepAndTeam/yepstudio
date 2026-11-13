import StudioLoading from './StudioLoading';
import {useEffect,useState} from 'react';
import {api} from '../api';
import SealedDiscCase from './SealedDiscCase';
import SealedDiscViewer from './SealedDiscViewer';
export default function DiscShelves(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(null);
 useEffect(()=>{let alive=true;api('/discs/shelves').then(v=>{if(alive)setData(v);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 if(error)return <p className="card" role="alert">{error}</p>;
 if(!data)return <StudioLoading compact label="Загружаем полки…"/>;
 return <section className="disc-archive">{selected&&<SealedDiscViewer instance={selected.disc} edition={selected.edition} onClose={()=>setSelected(null)}/>}<div className="card"><h3>Запечатанная коллекция</h3><p className="small">Выбери экземпляр в коллекции и нажми «Запечатать на полке». Каждый диск остаётся здесь навсегда.</p><p className="small muted">Полный набор: {data.reward} Йер один раз за каждую игру. Секретный подарок пока закрыт.</p></div>{data.shelves.map(shelf=><article key={shelf.item.id} className={`card disc-archive-shelf ${shelf.rewarded?'complete':''}`}><header><h3>{shelf.item.title}</h3><b>{shelf.slots.length} / {data.rarities.length}</b></header><div className="disc-archive-slots">{data.rarities.map(r=>{const disc=shelf.slots.find(d=>d.rarity===r.id);const content=<><div className="disc-capsule-window">{disc?<div className="disc-capsule-mini"><SealedDiscCase instance={disc} edition={r}/></div>:<span>?</span>}</div><b>{r.name}</b><small>{disc?'ЗАПЕЧАТАН · СМОТРЕТЬ':'Пустая ячейка'}</small>{disc&&<code>#{disc.id.slice(0,6).toUpperCase()}</code>}</>;return disc?<button type="button" key={r.id} className={`disc-capsule filled rarity-${r.id}`} style={{'--capsule-color':r.color}} aria-label={`Рассмотреть ${shelf.item.title}, ${r.name}, запечатанный диск`} onClick={()=>setSelected({disc,edition:r})}>{content}</button>:<div key={r.id} className={`disc-capsule empty rarity-${r.id}`} style={{'--capsule-color':r.color}}>{content}</div>;})}</div><footer><span>{shelf.rewarded?'1000 Йер получены':'Награда за набор: 1000 Йер'}</span><small>Секретный подарок · закрыт</small></footer></article>)}</section>;
}
