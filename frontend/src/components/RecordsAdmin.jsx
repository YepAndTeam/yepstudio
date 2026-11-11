import { useEffect, useState } from "react";
import { api } from "../api";

const games = { dino: "Дино", flappy: "Flappy", snake: "Змейка", tetris: "Тетрис", hell: "Ад" };

export default function RecordsAdmin({ onUpdated }) {
  const [state, setState] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    api("/admin/records/status").then(value => { if (alive) { setState(value); setPlan(value.plan || null); } })
      .catch(error => { if (alive) setMessage(error.message); });
    return () => { alive = false; };
  }, []);
  async function run(action) {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function prepare() {
    if (plan) {
      setPlan(await api("/admin/records/reset-preview"));
      return;
    }
    const result = await api("/admin/records/maintenance", "POST", { enabled: true });
    setState(value => ({ ...value, maintenance: true }));
    setPlan(result.plan || null);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "records-v2-archive.json";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function apply() {
    await api("/admin/records/reset-apply", "POST", { archive_hash: plan.archive_hash });
    setState(value => ({ ...value, applied: true })); setPlan(null);
    setMessage("Старые рекорды сохранены, компенсация начислена. Можно открыть игры.");
    onUpdated?.();
  }
  return <div className="card col" style={{ gap: 12 }}>
    <h3>Обновление рекордов · админ</h3>
    <p className="small muted" style={{ margin: 0 }}>
      {state?.applied ? "Однократный сброс уже выполнен. Повторной компенсации не будет."
        : "Обнулит недельные и общие рекорды. Старые результаты останутся в архиве. Компенсация: 100 / 75 / 50 / 20 Йер по месту в каждой игре, за вычетом старой выплаты."}
    </p>
    {state && <span className="small">Приём результатов: {state.maintenance ? "закрыт" : "открыт"}</span>}
    {state && !state.applied && <button type="button" className="pub" disabled={busy} onClick={() => run(prepare)}>
      {busy ? "Обрабатываем…" : plan ? "Обновить расчёт" : "Закрыть приём и рассчитать"}
    </button>}
    {plan && <>
      <b>Доплата: {plan.summary.jera_to_credit} Йер · игроков: {plan.summary.recipients}</b>
      <div className="small muted">Ранее выданные Йеры сохраняются. Равный рекорд — равное место.</div>
      <div style={{ maxHeight: 200, overflow: "auto" }}>
        <table style={{ width: "100%", fontSize: 12 }}>
          <thead><tr><th>Игрок ID</th><th>Игра</th><th>Место</th><th>Доплата</th></tr></thead>
          <tbody>{plan.awards.map(row => <tr key={row.user_id + ":" + row.game}>
            <td>{row.user_id}</td><td>{games[row.game]}</td><td>{row.place}</td><td>{row.credit}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <button type="button" className="pub alt" onClick={download}>Скачать архив и расчёт</button>
      <button type="button" className="pub" disabled={busy} onClick={() => run(apply)}>Сбросить рекорды с компенсацией</button>
    </>}
    {state?.maintenance && <button type="button" className="pub alt" disabled={busy} onClick={() => run(async () => {
      await api("/admin/records/maintenance", "POST", { enabled: false });
      setState(value => ({ ...value, maintenance: false })); setPlan(null);
    })}>Открыть приём результатов</button>}
    {message && <div className="small" role="status">{message}</div>}
  </div>;
}
