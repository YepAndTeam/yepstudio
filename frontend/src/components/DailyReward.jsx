import { useEffect, useState, useRef } from "react";
import { JeraIcon } from "./JeraIcon";
const shown = new Set();
export default function DailyReward({ reward, refresh, userId }) {
  const dialog=useRef(null);
  useEffect(()=>{
    if(!reward?.awarded||!dialog.current)return;
    const key=`daily-reward:${userId}:${reward.day}`;
    let seen=shown.has(key);
    try{seen=seen||sessionStorage.getItem(key)==="1";}catch{}
    if(seen&&!reward.preview)return;
    shown.add(key);
    try{sessionStorage.setItem(key,"1");}catch{}
    dialog.current.showModal();
  },[reward,userId]);
  const [now,setNow]=useState(() => Date.now());
  const retryAt=useRef(0);
  useEffect(()=>{
    if(!reward)return;
    const offset=Date.parse(reward.server_now)-Date.now();
    const tick=()=>{const time=Date.now()+offset;setNow(time);if(time>=Date.parse(reward.next_at)&&Date.now()>=retryAt.current){retryAt.current=Date.now()+30000;void refresh();}};
    tick(); const id=setInterval(()=>{if(document.visibilityState==="visible")tick();},1000);
    return ()=>clearInterval(id);
  },[reward,refresh]);
  if(!reward)return null;
  const seconds=Math.max(0,Math.ceil((Date.parse(reward.next_at)-now)/1000));
  const clock=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,"0")).join(":");
  return <section className="card daily-reward">
    <dialog className="daily-award-dialog" ref={dialog} aria-labelledby="daily-award-title">
      <div className="daily-award-stamp">YAB STUDIO / DAILY REWARD</div>
      <div className="daily-award-coin"><JeraIcon size={56}/></div>
      <h2 id="daily-award-title">С возвращением!</h2>
      <p className="muted small">День {reward.streak} из 7{reward.streak===7?" · Бонус за полную серию":" · Награда за вход"}</p>
      <b className="daily-award-amount">+{reward.amount} Йер</b>
      <p className="small">Уже зачислены на твой баланс.</p>
      <form method="dialog"><button className="pub" autoFocus>Отлично</button></form>
    </dialog><div className="daily-heading"><h3>Заходи каждый день</h3><b>Сегодня +{reward.amount} Йер</b></div>
    <div className="daily-days">{Array.from({length:7},(_,i)=><div key={i} className={i<reward.streak?"collected":""} aria-label={`День ${i+1}: ${i<reward.streak?"получено":"впереди"}`}><small>{i+1}</small><b>+{i===6?50:25}</b></div>)}</div>
    <p className="small muted">Награда за сегодня получена. Следующая через {clock}.</p>
    <p className="small muted">Новый день в 00:00 (UTC+5). Пропуск начинает серию заново. После седьмого дня — новый круг.</p>
  </section>;
}
