import AppSelect from './AppSelect';
import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import { appLink, copyLink, shareLink } from "../share";

const games={dino:"Дино",flappy:"Flappy",snake:"Змейка",tetris:"Тетрис",hell:"Ад"};
function CreateForm({first,winner,onClose,onCreated}){
  const dialog=useRef(null);
  const [title,setTitle]=useState(first?"Первый турнир Dino":"Турнир YAB STUDIO");
  const [game,setGame]=useState(first?"dino":winner||"dino");
  const [hours,setHours]=useState(48),[fee,setFee]=useState(first?0:50),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{const d=dialog.current;d.showModal();return()=>{if(d.open)d.close();};},[]);
  async function submit(e){
    e.preventDefault();if(busy)return;setBusy(true);setError("");
    try{await api("/admin/tournaments","POST",{title,game,duration_hours:Number(hours),entry_fee:Number(fee)});await onCreated();onClose();}
    catch(err){setError(err.message);setBusy(false);}
  }
  return <dialog ref={dialog} className="tour-modal" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <form onSubmit={submit} className="col" style={{gap:14}}>
      <h3>Создать турнир</h3>
      <label>Название<input type="text" maxLength={120} required value={title} onChange={e=>setTitle(e.target.value)} /></label>
      <label>Игра<AppSelect value={game} disabled={first||Boolean(winner)} onChange={e=>setGame(e.target.value)}>{Object.entries(games).map(([id,name])=><option key={id} value={id}>{name}</option>)}</AppSelect></label>
      {winner&&!first&&<span className="small muted">Игра выбрана голосованием игроков.</span>}
      <label>Длительность, часов<input type="number" min={1} max={168} required disabled={first} value={hours} onChange={e=>setHours(e.target.value)} /></label>
      <label>Взнос, Йер<input type="number" min={first?0:1} max={10000} required disabled={first} value={fee} onChange={e=>setFee(e.target.value)} /></label>
      <span className="small muted">1-е — «Какашечки» (или 200 Йер за повторку). 2–5-е — 150 / 100 / 75 / 50 Йер. Первый турнир: Dino, 48 часов, бесплатно.</span>
      <button type="submit" className="pub" disabled={busy}>{busy?"Создаём…":"Создать и открыть регистрацию"}</button>
      <button type="button" className="pub alt" disabled={busy} onClick={onClose}>Назад</button>
      {error&&<span className="small" role="status">{error}</span>}
    </form>
  </dialog>;
}

export default function TournamentAdmin(){
  const [data,setData]=useState(null),[create,setCreate]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const load=useCallback(async()=>{setData(await api("/tournaments"));},[]);
  useEffect(()=>{let active=true;api("/tournaments").then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  async function action(id,kind){
    if(busy)return;setBusy(true);setError("");
    try{await api(`/admin/tournaments/${id}/${kind}`,"POST");await load();}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const pending=data?.events.some(event=>["registration","active"].includes(event.status));
  return <section className="card col" style={{gap:12}}>
    <h3>Турниры · админ</h3>
    <span className="small muted">Создай регистрацию, опубликуй ссылку, затем запусти отсчёт. Призы выдаются автоматически после завершения.</span>
    <button type="button" className="pub" disabled={!data||pending||busy} onClick={()=>load().then(()=>setCreate(true)).catch(e=>setError(e.message))}>Создать турнир</button>
    <button type="button" className="pub alt" disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}>Обновить турниры</button>
    {data?.events.slice(0,5).map(event=><div className="tour-admin-event" key={event.id}>
      <b>{event.title}</b><span className="small muted">{event.game_name} · {event.duration_hours} ч · {event.entry_fee?event.entry_fee+" Йер":"бесплатно"} · участников {event.participants}</span>
      <span className="small">{({registration:"Регистрация открыта",active:"Турнир идёт",finished:"Завершён",cancelled:"Отменён"})[event.status]}</span>
      <input type="text" readOnly aria-label="Ссылка турнира для Telegram" value={appLink("tour_"+event.id)} onFocus={e=>e.target.select()} />
      <div className="tour-admin-actions">
        {event.status==="registration"&&<button type="button" className="pub" disabled={busy} onClick={()=>action(event.id,"start")}>Запустить на {event.duration_hours} ч</button>}
        {["registration","active"].includes(event.status)&&<button type="button" className="pub alt" disabled={busy} onClick={()=>action(event.id,"cancel")}>Отменить и вернуть взносы</button>}
        <button type="button" className="pub alt" onClick={()=>copyLink("tour_"+event.id)}>Скопировать ссылку</button>
        <button type="button" className="pub alt" onClick={()=>shareLink("tour_"+event.id,`${event.title}\n${event.duration_hours} часов · ${event.entry_fee?event.entry_fee+" Йер":"участие бесплатно"}\n1-е место — «Какашечки», 2–5-е — Йера.\nРегистрируйся в YAB STUDIO!`)}>Подготовить пост в Telegram</button>
      </div>
    </div>)}
    {create&&<CreateForm first={data.next_free} winner={data.next_game} onClose={()=>setCreate(false)} onCreated={load} />}
    {error&&<span className="small" role="status">{error}</span>}
  </section>;
}
