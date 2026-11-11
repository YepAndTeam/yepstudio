import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
export default function TasksDialog({onClose}){
 const {syncEconomy}=useStore();
 const dialog=useRef(null),[data,setData]=useState(null),[error,setError]=useState("");
 useEffect(()=>{
  dialog.current?.showModal();let alive=true,timer;
  const load=()=>api("/tasks").then(value=>{if(alive){
   setData(value);setError("");syncEconomy(value);clearTimeout(timer);
   const delay=Date.parse(value.ends_at)-(value.server_now?Date.parse(value.server_now):Date.now())+100;
   timer=setTimeout(()=>{if(!document.hidden)void load();},Math.max(1000,delay));
  }}).catch(e=>{if(alive)setError(e.message);});
  const resume=()=>{if(!document.hidden)void load();};
  void load();document.addEventListener("visibilitychange",resume);
  return()=>{alive=false;clearTimeout(timer);document.removeEventListener("visibilitychange",resume);};
 },[syncEconomy]);
 return <dialog className="goals-dialog tasks-dialog" ref={dialog} onClose={onClose} aria-labelledby="goals-title"><div className="between"><h2 id="goals-title">Задания дня</h2><form method="dialog"><button className="back">Закрыть</button></form></div><p className="small muted">Три цели на сегодня · до 10 Йер в день.</p>{data&&<div className="task-budget"><span>Получено сегодня</span><b>{data.earned_today} / {data.daily_limit} Йер</b></div>}{!data&&!error&&<p className="small">Загружаем задания…</p>}{data?.tasks.map(task=><div className={`weekly-task ${task.earned?"complete":""}`} key={task.id}><div className="between"><b>{task.title}</b><span>{task.current}/{task.target}</span></div><progress aria-label={task.title} max={task.target} value={task.current}/><div className="between"><small>{task.earned?"Награда начислена":"В процессе"}</small><b className="task-prize">+{task.amount} Йер</b></div></div>)}{data&&<p className="small muted">Награды приходят автоматически за выполненные задания. Новый набор в 00:00 UTC+5. Награды за вход и достижения считаются отдельно.</p>}{error&&<p role="alert">Не удалось загрузить задания: {error}</p>}</dialog>;
}
