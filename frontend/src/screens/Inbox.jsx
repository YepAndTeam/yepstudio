import { useEffect } from "react";
import { dayLabel } from "../constants";
import { useStore } from "../store";
import { BackIcon } from "../components/Icons";

export default function Inbox({ openThread, openGame, openRaces, openFriends, onBack }) {
  const { notifs, loadNotifs, readNotifs } = useStore();

  // при выходе из ленты (в том числе при переходе в тему) помечаем прочитанным
  useEffect(() => { loadNotifs(); return () => { readNotifs(); }; }, []); // eslint-disable-line

   const open = (n) => {
    if (n.ref === "friends") openFriends?.();
    else if (n.ref === "races") openRaces?.();
    else if (n.ref === "game") openGame();
    else if (n.ref && /^[tn]\d+$/.test(n.ref)) openThread(n.ref);
  };

  return (
    <>
      <div className="bar">
        <button type="button" className="back" onClick={onBack}><BackIcon /><span>Назад</span></button>
      </div>
      <div className="card tail">
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>Уведомления</h3>
        {!notifs.items.length && <div className="noc">Пока тихо. Здесь появятся ответы и новости по твоим темам.</div>}
        {notifs.items.map((n) => (
          <button type="button" key={n.id} className={`ntf ${n.read ? "" : "new"}`} onClick={() => open(n)}>
            <span className="pt" />
            <div>
              <div className="tt">{n.text}</div>
              <div className="mm">{dayLabel(n.created_at)}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
