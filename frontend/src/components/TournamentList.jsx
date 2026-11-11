import { useEffect, useState } from "react";
import { api } from "../api";

const statuses={registration:"Регистрация открыта",active:"Турнир идёт",finished:"Итоги",cancelled:"Отменён"};
export default function TournamentList({onOpen}){
  const [events,setEvents]=useState(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;api("/tournaments").then(data=>{if(active)setEvents(data.events);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
  return <section className="card col" style={{gap:12}}>
    <h3>Турниры</h3>
    {events?.length===0&&<span className="small muted">Скоро здесь откроется регистрация на первый турнир.</span>}
    {!events&&!error&&<span className="small muted">Загружаем турниры…</span>}
    {events?.map(event=><button type="button" className="tour-list-item" key={event.id} onClick={()=>onOpen(event.id)}>
      <b>{event.title}</b><span>{event.game_name} · {event.duration_hours} ч · {statuses[event.status]}</span>
      <span>{event.entry_fee?event.entry_fee+" Йер":"Бесплатно"} · {event.participants} участников →</span>
    </button>)}
    {error&&<span className="small" role="status">{error}</span>}
  </section>;
}
