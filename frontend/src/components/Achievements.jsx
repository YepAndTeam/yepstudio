import StudioLoading from './StudioLoading';
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import AchievementIcon from "./AchievementIcon";
function AchievementDetails({data,onClose}){
 const dialog=useRef(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 const level=data.steps.filter(step=>step.earned).length,next=data.steps.find(step=>!step.earned);
 return <dialog className="goals-dialog achievement-details" ref={dialog} onClose={onClose} aria-labelledby="achievement-title"><div className="between"><span className="achievement-level">УРОВЕНЬ {level} / {data.steps.length}</span><form method="dialog"><button className="back">Закрыть</button></form></div><h2 id="achievement-title">{data.title}</h2><p className="small muted">Лучший подтверждённый забег: {data.best.toLocaleString("ru-RU")} очков</p>
 {next?<section className="achievement-next"><small>СЛЕДУЮЩЕЕ УЛУЧШЕНИЕ · УРОВЕНЬ {level+1}</small><h3>Набери {next.score.toLocaleString("ru-RU")} очков</h3><p className="small">За один забег в игре «{data.game_name || "Дино"}»{next.amount>0?` · награда +${next.amount} Йер`:" · новый уровень значка"}</p><progress aria-label="Прогресс следующего уровня" max={next.score} value={Math.min(data.best,next.score)}/><span className="small muted">Осталось улучшить рекорд на {Math.max(0,next.score-data.best).toLocaleString("ru-RU")} очков</span></section>:<section className="achievement-next"><b>Максимальный уровень достигнут</b><p className="small">Все награды этого достижения получены.</p></section>}
 <h3>Все уровни</h3><ol className="achievement-steps">{data.steps.map((step,i)=><li key={step.score} className={step.earned?"earned":""}><span>Ур. {i+1} · {step.score.toLocaleString("ru-RU")} очков</span><b>{step.amount>0?`+${step.amount} Йер`:"Значок"}</b><small>{step.earned?"Получено":step===next?"Следующее улучшение":"Впереди"}</small></li>)}</ol><p className="small muted">Награды приходят автоматически один раз за каждый уровень. Учитываются новые завершённые забеги. Прогресс сохраняется после сброса рекордов.</p><b className="small">Получено всего: {data.total_earned} Йер</b></dialog>;
}
export default function Achievements(){
 const [data,setData]=useState(null),[error,setError]=useState(""),[details,setDetails]=useState(false);
 useEffect(()=>{let alive=true;api("/achievements").then(value=>{if(alive)setData(value);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 if(error)return <div className="card" role="alert">Не удалось загрузить достижения: {error}</div>;
 if(!data)return <StudioLoading compact label="Загружаем достижения…"/>;
 const items=data.items || [data];
 return <><p className="card achievement-guide">Нажми на карточку, чтобы посмотреть награды и следующее улучшение.</p><div className="achievement-grid">{items.map(item=>{const level=item.steps.filter(step=>step.earned).length,next=item.steps.find(step=>!step.earned);return <button key={item.game} className={`achievement-tile ${level>0?"unlocked":""}`} onClick={()=>setDetails(item)} aria-label={`${item.title}, уровень ${level}. Открыть подробности`}><span className="achievement-level">УРОВЕНЬ {level} / {item.steps.length}</span><div className="achievement-medal" aria-hidden="true"><AchievementIcon game={item.game}/><b>{level}</b></div><strong>{item.title}</strong><span className="achievement-tile-status">{level===0?"Ещё не получено":next?"Получено · можно улучшить":"Все уровни пройдены"}</span><span className="small muted">{next?`Следующий уровень: ${next.score.toLocaleString("ru-RU")}`:"Максимальный уровень"}</span></button>;})}</div>{details&&<AchievementDetails data={details} onClose={()=>setDetails(false)}/>}</>;
}
