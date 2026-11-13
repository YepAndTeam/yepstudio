import { useEffect, useRef, useState } from "react";
import { JeraIcon } from "./JeraIcon";

const games={dino:"Дино",flappy:"Flappy",snake:"Змейка",tetris:"Тетрис",hell:"Ад",drive:"После полуночи"};
const number=value=>new Intl.NumberFormat("ru-RU").format(value);

export default function CompensationMail({letter,onLater,onRead}) {
  const dialog=useRef(null);
  const [opened,setOpened]=useState(letter.read);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    const element=dialog.current;
    element.showModal();
    return ()=>{if(element.open)element.close();};
  },[]);
  async function acknowledge(){
    if(busy)return;
    setBusy(true);setError("");
    try {await onRead();}catch(e){setError(e.message);setBusy(false);}
  }
  return <dialog ref={dialog} className={"comp-mail"+(opened?" mail-open":"")} aria-labelledby="comp-mail-title"
    onCancel={e=>{e.preventDefault();if(!busy)onLater();}}>
    <button type="button" className="comp-mail-later" disabled={busy} onClick={onLater} aria-label="Открыть письмо позже">✕</button>
    <div className="comp-envelope" aria-hidden="true">
      <div className="comp-envelope-note"><span>YAB STUDIO</span><b>ЧЕК</b></div>
      <div className="comp-envelope-front" />
      <div className="comp-envelope-flap" />
      <span className="comp-envelope-seal">Y</span>
    </div>
    <h2 id="comp-mail-title">{opened?(letter.title||"Твои рекорды не пропали"):"Тебе письмо от студии"}</h2>
    {!opened ? <>
      <p className="small muted">{letter.description||"Спасибо за твои рекорды, труды и слёзы. Внутри — компенсация и подробный чек."}</p>
      <button type="button" className="pub" onClick={()=>setOpened(true)}>Открыть письмо</button>
      <button type="button" className="comp-mail-text" onClick={onLater}>Посмотреть позже</button>
    </> : <>
      <section className="comp-check" aria-label="Чек компенсации">
        <div className="comp-check-head"><b>YAB / КОМПЕНСАЦИЯ</b><span>{new Date(letter.created_at).toLocaleDateString("ru-RU")}</span></div>
        <p>{letter.description||"За твои результаты до обновления таблиц"}</p>
        {letter.entries.map(row=><div className="comp-check-row" key={row.label||row.game}>
          <div><b>{row.label||`${games[row.game] || row.game} · #${row.place}`}</b>{row.score!=null&&<span>Рекорд: {number(row.score)}</span>}</div>
          <strong>+{number(row.credit)} ᛃ</strong>
          {row.target!=null&&<small>Положено {number(row.target)} · выдано раньше {number(row.already_paid)}</small>}
        </div>)}
        <div className="comp-check-total"><span>Начислено на баланс</span><b><JeraIcon size={24} /> {number(letter.total)}</b></div>
        <small>{letter.title?"Разовое начисление уже учтено. Спасибо, что играешь с нами!":"Доплата рассчитана отдельно для каждой игры. Спасибо, что играешь с нами!"}</small>
      </section>
      {error && <div className="small" role="status">{error}</div>}
      <button type="button" className="pub" disabled={busy} onClick={acknowledge}>{busy?"Сохраняем…":letter.read?"Закрыть чек":"Спасибо, получил!"}</button>
      <span className="small muted">Чек останется в почте сообщества.</span>
    </>}
  </dialog>;
}
