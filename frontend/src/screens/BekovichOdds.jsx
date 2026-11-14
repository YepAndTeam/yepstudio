import {useState} from 'react';
import AppSelect from '../components/AppSelect';
import {CHESTS,evaluateDiscs} from '../bekovichTrade';
import './BekovichOdds.css';
const rarities={common:'Обычный',rare:'Редкий',epic:'Эпический',mythic:'Мифический',legendary:'Легендарный',secret:'Секретный'};
const percent=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(value)+'%';
export default function BekovichOdds({onBack}){
 const [slots,setSlots]=useState(['rare','common','epic']);
 const discs=slots.flatMap((rarity,i)=>rarity?[{id:String(i),item:{id:'calculator-'+i},rarity}]:[]);
 const assessment=discs.length?evaluateDiscs(discs):null;
 const refused=discs.length===1&&['common','secret'].includes(discs[0].rarity)?95:0;
 return <section className="bek-odds-page"><button className="back" onClick={onBack}>‹ Назад</button><p className="small muted">Настройки</p><h2>Бекович и шансы</h2><p className="small muted">Выбери от одного до трёх дисков. Расчёт показывает шанс получить ящик за весь набор.</p><div className="card bek-odds-slots">{slots.map((value,i)=><label key={i}>Диск {i+1}<AppSelect aria-label={'Редкость диска '+(i+1)} value={value} onChange={e=>setSlots(current=>current.map((slot,index)=>index===i?e.target.value:slot))}><option value="">Без диска</option>{Object.entries(rarities).map(([id,name])=><option value={id} key={id}>{name}</option>)}</AppSelect></label>)}</div>{assessment?<div className="card bek-odds-results" aria-live="polite"><h3>За выбранный набор</h3>{refused>0&&<div className="bek-odds-row"><span>Бекович откажется</span><b>{percent(refused)}</b></div>}{Object.entries(CHESTS).map(([id,name])=>{const chance=assessment.weights[id]/100*(1-refused/100);return <div className="bek-odds-result" key={id}><div className="bek-odds-row"><span>{name}</span><b>{percent(chance)}</b></div><div className="bek-odds-track" aria-hidden="true"><i style={{width:chance+'%'}}/></div></div>;})}{refused>0&&<p className="small muted">Шансы ящиков уже учитывают 95% отказа. При отказе диск остаётся у тебя.</p>}</div>:<div className="card"><p>Выбери хотя бы один диск для расчёта.</p></div>}<p className="small muted">Калькулятор ничего не расходует и не разыгрывает награду. Уже запомненное предложение для того же состава не меняется, даже после обновления шансов.</p></section>;
}
