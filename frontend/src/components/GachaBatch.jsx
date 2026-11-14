import {THEMES} from '../constants';
import DiscArtwork from './DiscArtwork';
import './GachaBatch.css';
export function GachaMode({value,onChange,disabled=false,price=0,free=0,pending=false}){
 const cost=Math.max(0,value-free)*price;
 return <div className="gacha-mode"><div className="gacha-count" role="group" aria-label="Количество открытий">{[1,5].map(count=><button type="button" key={count} aria-pressed={value===count} disabled={disabled} onClick={()=>onChange(count)}>×{count}</button>)}</div><p>{pending?'Набор уже оплачен · повторного списания нет':cost?`${value} ${value===1?'открытие':'открытий'} · ${cost} Йер`:`${value} ${value===1?'открытие':'открытий'} · бесплатно`}{!pending&&free>0&&cost>0?` · бесплатных: ${Math.min(value,free)}`:''}</p></div>;
}
export function GachaResults({items,kind='themes',rarities=[],onInspect,onApply,activeTheme}){
 if(!items?.length)return null;
 const totalRefund=items.reduce((sum,item)=>sum+(item.refund||0),0);
 return <section className="gacha-results" aria-label="Результаты пяти открытий"><h3>Результаты ×5</h3>{items.map((entry,index)=>{const dvd=kind==='dvd',theme=!dvd&&THEMES.find(t=>t.id===entry.themeId),rarity=dvd?rarities.find(r=>r.id===entry.rarity):null;return <article className="gacha-result-row" key={entry.id||index}><span className="gacha-result-art" style={{'--gacha-color':rarity?.color||theme?.bg||'var(--muted)'}}>{dvd?<DiscArtwork item={entry.item}/>:<span className="gacha-mini-tape"><i/><i/></span>}</span><div><b>{dvd?entry.item.title:theme?.name||'Код не принят'}</b><small>{dvd?`${rarity?.name||entry.rarity} · ${entry.is_dupe?'Повторка №'+entry.copy_number:'Новый экземпляр'}`:!entry.ok?'Возврат: '+entry.refund+' Йер':entry.isDupe?'Повторка · возврат '+entry.refund+' Йер':'Новая тема в коллекции'}</small></div>{dvd?<button type="button" onClick={()=>onInspect(entry)}>Смотреть</button>:entry.ok&&<button type="button" disabled={activeTheme===entry.themeId} onClick={()=>onApply(entry.themeId)}>{activeTheme===entry.themeId?'Выбрана':'Применить'}</button>}</article>;})}<p>{kind==='dvd'?'Все пять дисков сохранены в коллекции.':`Возвращено всего: ${totalRefund} Йер. Все новые темы сохранены.`}</p></section>;
}
