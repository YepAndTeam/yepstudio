import StudioLoading from './StudioLoading';
import { useEffect, useState } from "react";
import { api } from "../api";
export default function HallOfFame({onOpen}){
 const [winners,setWinners]=useState(null),[error,setError]=useState("");
 useEffect(()=>{let alive=true;api("/hall-of-fame").then(data=>{if(alive)setWinners(data.winners);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
 return <section className="card col" style={{gap:14}}><h2>Зал славы</h2><p className="small muted">Призёры завершённых турниров YAB STUDIO.</p>{!winners&&!error&&<StudioLoading compact label="Загружаем историю…"/>}{winners?.length===0&&<p className="small muted">Первые имена появятся после завершения первого турнира.</p>}{winners?.map(row=><button className="tour-list-item" key={row.tournament_id+":"+row.user_id} onClick={()=>onOpen(row.tournament_id)}><b>#{row.place} · {row.name}</b><span>{row.title}</span><span>{row.theme_id?"Тема «Какашечки»":`${row.amount} Йер`} · {new Date(row.ended_at).toLocaleDateString("ru-RU")}</span></button>)}{error&&<p role="alert">{error}</p>}</section>;
}
