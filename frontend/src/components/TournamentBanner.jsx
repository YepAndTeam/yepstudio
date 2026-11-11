import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { shareLink } from "../share";

const games={dino:"Дино",flappy:"Flappy",snake:"Змейка",tetris:"Тетрис",hell:"Ад",drive:"После полуночи"};
function Countdown({end,serverNow}) {
  const [now,setNow]=useState(Date.now);
  const [offset]=useState(()=>Date.parse(serverNow)-Date.now());
  useEffect(()=>{const id=setInterval(()=>{if(!document.hidden)setNow(Date.now());},1000);return()=>clearInterval(id);},[]);
  const seconds=Math.max(0,Math.ceil((Date.parse(end)-now-offset)/1000));
  const hours=Math.floor(seconds/3600),minutes=Math.floor(seconds/60)%60;
  return <b className="tour-clock">{seconds?`${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`:"Подводим итоги…"}</b>;
}

export default function TournamentBanner({eventId,onPlay,compact=false,onOpen}) {
  const { me,syncEconomy,loadMe }=useStore();
  const [event,setEvent]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const [failed,setFailed]=useState(false);
  const load=useCallback(async()=>{
    if(eventId)return api("/tournaments/"+encodeURIComponent(eventId));
    const data=await api("/tournaments");
    return data.events.find(item=>["active","registration"].includes(item.status)) || data.events.find(item=>item.status==="finished") || null;
  },[eventId]);
  useEffect(()=>{
    let active=true;
    const tick=()=>{if(document.hidden)return;load().then(value=>{if(active){setEvent(value);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});};
    tick();const interval=setInterval(tick,30000);document.addEventListener("visibilitychange",tick);
    return()=>{active=false;clearInterval(interval);document.removeEventListener("visibilitychange",tick);};
  },[load]);
  useEffect(()=>{if(event?.status==="finished")void loadMe();},[event?.id,event?.status,loadMe]);
  async function join(){
    if(busy)return;setBusy(true);setError("");
    try{const value=await api(`/tournaments/${event.id}/register`,"POST");setEvent(value);syncEconomy(value);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function vote(game){
    setBusy(true);setError("");
    try{setEvent(await api(`/tournaments/${event.id}/vote`,"POST",{game}));}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if(!event)return eventId&&failed?<div className="card small muted">Не удалось загрузить турнир. Попробуй обновить страницу.</div>:null;
  const live=event.status==="active",signup=event.status==="registration",finished=event.status==="finished";
  if(compact)return <section className="card tour-banner tour-compact" aria-label="Анонс турнира">
    <div className="tour-eyebrow"><span>ТУРНИР / {event.game_name}</span><span>{signup?"Регистрация":live?"Идёт":finished?"Завершён":"Отменён"}</span></div>
    <h2>{event.title}</h2>
    {live?<><span className="small muted">До конца турнира</span><Countdown key={event.ends_at+event.server_now} end={event.ends_at} serverNow={event.server_now} /></>
      :<span className="small muted">{signup?event.duration_hours+" часов после старта":"Результаты турнира готовы"}</span>}
    <button type="button" className="pub" onClick={()=>onOpen(event.id)}>Перейти в турнир</button>
  </section>;
  return <section className="card tour-banner" aria-label="Турнир">
    <div className="tour-eyebrow"><span>YAB CUP / {event.game_name}</span><span>{signup?"Регистрация":live?"Идёт турнир":finished?"Итоги":"Отменён"}</span></div>
    <h2>{event.title}</h2>
    {live?<><span className="small muted">До завершения</span><Countdown key={event.ends_at+event.server_now} end={event.ends_at} serverNow={event.server_now} /></>
      :signup?<p>Длительность — {event.duration_hours} ч. Отсчёт начнётся после старта администратором.</p>:null}
    <div className="tour-prizes"><b>1 место · «Какашечки»</b><span>{Object.entries(event.prize_jera).map(([place,amount])=>`${place}-е: ${amount} ᛃ`).join(" · ")}</span></div>
    <p className="small muted">{event.entry_fee?`Взнос — ${event.entry_fee} Йер один раз на весь турнир.`:"Первый турнир — участие бесплатно."} Участников: {event.participants}.</p>
    {(signup||live)&&(!event.registered?<button type="button" className="pub" disabled={busy||(event.entry_fee>0&&(me?.jera??0)<event.entry_fee)} onClick={join}>
      {busy?"Регистрируем…":event.entry_fee?`Участвовать · ${event.entry_fee} ᛃ`:"Зарегистрироваться бесплатно"}
    </button>:live?<button type="button" className="pub" onClick={()=>onPlay(event.game)}>Играть в {event.game_name}</button>:<b className="small">Ты зарегистрирован. Ждём старта!</b>)}
    {!event.registered&&event.entry_fee>(me?.jera??0)&&<span className="small muted">На балансе не хватает Йеры для взноса.</span>}
    {event.registered&&<span className="small">Твой результат: {event.my_best || "пока нет"}{event.my_place?` · место ${event.my_place}`:""}</span>}
    {event.top.length>0&&<div className="tour-top">{event.top.slice(0,5).map(row=><div key={row.user_id} className="between small"><span>#{row.place} {row.user_id===me?.id?"Ты":row.name}</span><b>{row.best}</b></div>)}</div>}
    <details className="small muted"><summary>Правила и призы</summary><p>Засчитывается лучший забег, начатый после регистрации и старта, завершённый до конца турнира. Попытки не ограничены. При равных очках выше тот, кто достиг их раньше. Если мифик уже есть, победителю начисляется {event.duplicate_prize} Йер.</p></details>
    {finished&&!event.voting_closed&&<div className="col" style={{gap:8}}><b className="small">В какую игру проведём следующий турнир?</b><div className="tour-votes">{Object.entries(games).map(([id,name])=><button type="button" key={id} className={event.my_vote===id?"on":""} disabled={busy} onClick={()=>vote(id)}>{name} · {event.votes?.[id]||0}</button>)}</div></div>}
    <button type="button" className="tour-share" onClick={()=>shareLink("tour_"+event.id,`Турнир ${event.game_name} в YAB STUDIO · ${event.duration_hours} часов · ${event.entry_fee?event.entry_fee+" Йер":"бесплатно"}`)}>Поделиться турниром</button>
    {error&&<span className="small" role="status">{error}</span>}
  </section>;
}
