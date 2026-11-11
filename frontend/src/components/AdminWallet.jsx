import { useRef, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

export default function AdminWallet() {
  const { syncEconomy } = useStore();
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const request = useRef(null);
  const inFlight = useRef(false);
  async function topUp() {
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setMessage("");
    try {
      if(!request.current) request.current=crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");
      const result=await api("/admin/shop/test-balance","POST",{request_id:request.current});
      syncEconomy(result);request.current=null;
      setMessage(result.credited ? "Начислено 10 000 Йер для тестирования." : "Начисление уже учтено. Баланс обновлён.");
    } catch(e) {setMessage(e.message);}
    finally {inFlight.current=false;setBusy(false);}
  }
  return <div className="card col" style={{gap:10}}>
    <h3>Тестовый баланс · админ</h3>
    <div className="small muted">Пополнение твоего баланса для проверки магазина. Доступно только администраторам.</div>
    <button type="button" className="pub" disabled={busy} onClick={topUp}>{busy ? "Начисляем…" : "+10 000 Йер"}</button>
    {message && <div className="small" role="status">{message}</div>}
  </div>;
}
