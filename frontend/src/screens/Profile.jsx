import { useState } from "react";
import { useStore } from "../store";
import { Loading } from "../components/Common";
import { JeraIcon } from "../components/JeraIcon";
import TournamentAdmin from "../components/TournamentAdmin";
import AdminWallet from "../components/AdminWallet";
import RecordsAdmin from "../components/RecordsAdmin";
import DailyReward from "../components/DailyReward";
import Achievements from "../components/Achievements";
import ThemeCollection from "./ThemeCollection";
import { ST, THEMES } from "../constants";
import Shop from "./Shop";

export default function Profile({ openThread, onOpenLetter }) {
  const { me: m, topics, mod, toggleMod, theme, setPush, loadMe } = useStore();
  const [tab, setTab] = useState("profile"); // "profile" | "shop"


  const cur = THEMES.find((t) => t.id === theme) || THEMES[0];
  if (!m) return <Loading />;
  if (tab === "achievements") return <><button className="back" onClick={()=>setTab("profile")}>‹ Профиль</button><h2>Достижения</h2><Achievements/></>;
  if (tab === "collection") return <ThemeCollection onBack={() => setTab("profile")} />;

  const mine = (topics || []).filter((t) => t.author_id === m.id);
  const rated = mine.filter((t) => t.rated).length || m.rated;

  return (
    <>
      <div className="filters">
        <div className="seg">
          <button
            type="button"
            className={tab === "profile" ? "on" : ""}
            onClick={() => setTab("profile")}
          >
            Профиль
          </button>
          <button
            type="button"
            className={tab === "shop" ? "on" : ""}
            onClick={() => setTab("shop")}
          >
            Магазин
          </button>
        </div>
      </div>

      {tab === "shop" && <Shop jera={m.jera ?? 0} />}

      {tab === "profile" && (
        <>
          <div className="card me">
            <div className="ava">
              {(m.first_name || "?").trim().charAt(0).toUpperCase()}
            </div>
            <div className="col" style={{ minWidth: 0, gap: 2 }}>
              <div className="nm">{m.first_name}</div>
              {m.username && (
                <div className="muted" style={{ fontSize: 14 }}>
                  @{m.username}
                </div>
              )}
              <div className="me-tags">
                <button
                  type="button"
                  className="jera-chip"
                  aria-label="Открыть магазин"
                  onClick={() => setTab("shop")}
                >
                  <JeraIcon size={16} />
                  <span>{m.jera ?? 0}</span>
                </button>
                {rated > 0 && <span className="badge">Оценено идей: {rated}</span>}
              </div>
            </div>
          </div>

          <DailyReward userId={m.id} reward={m.daily_reward} refresh={loadMe} />

          <div className="card stats">
            <div>
              <b>{m.topics}</b>
              <span>Темы</span>
            </div>
            <div>
              <b>{m.comments}</b>
              <span>Комментарии</span>
            </div>
            <div>
              <b>{m.votes}</b>
              <span>Голоса</span>
            </div>
          </div>

          <div className="card tail">
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>
              Мои темы
            </h3>
            {!mine.length && (
              <div className="noc" style={{ padding: "4px 0 18px" }}>
                Ты ещё не создавал тем.
              </div>
            )}
            {mine.map((t) => (
              <button
                type="button"
                className="mine"
                key={t.id}
                onClick={() => openThread("t" + t.id)}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="tt">{t.title}</div>
                  <div className="mm">
                    {t.category}
                    {t.status ? " · " + ST[t.status] : ""}
                  </div>
                </div>
                <div className="rt">
                  {t.rated && <span className="badge">Оценено</span>}
                  <span>▲ {t.votes}</span>
                </div>
              </button>
            ))}
          </div>

          <button className="card achievement-entry" onClick={()=>setTab("achievements")}><span>Достижения</span><small className="muted">Прогресс, цели и награды →</small></button>

          {/* Тема оформления */}
          <button
            type="button"
            className="card themerow"
            onClick={() => setTab("collection")}
          >
            <span className="pv" style={{ background: cur.bg }}>
              <i style={{ background: cur.card }}>
                <b style={{ background: cur.fg }} />
              </i>
            </span>
            <span className="col" style={{ minWidth: 0, gap: 2, flex: 1 }}>
              <span className="muted small">Коллекция кассет</span>
              <span style={{ fontWeight: 600 }}>{cur.name}</span>
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" className="chev">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          <div className="card" style={{ padding: "6px 16px 14px" }}>
            <button
              type="button"
              className="modrow"
              aria-pressed={m.notify}
              onClick={() => setPush(!m.notify)}
            >
              <span>Уведомления от бота</span>
              <span className={`sw ${m.notify ? "on" : ""}`}>
                <i />
              </span>
            </button>
            <div className="small muted">
              Ответы и статусы приходят в Telegram. В колокольчике они остаются
              всегда.
            </div>
          </div>

          {m.compensation_letters?.length>0 && <div className="card col" style={{gap:10}}>
            <h3>Письма от студии</h3>
            {m.compensation_letters.map(letter=><button type="button" className="pub alt" key={letter.id} onClick={()=>onOpenLetter?.(letter.id)}>
              Чек компенсации · +{letter.total} Йер
            </button>)}
          </div>}
          {m.role === "admin" && <TournamentAdmin />}
          {m.role === "admin" && <AdminWallet />}
          {m.role === "admin" && <RecordsAdmin onUpdated={loadMe} />}
          {m.role === "admin" && (
            <div className="card" style={{ padding: "6px 16px 14px" }}>
              <button
                type="button"
                className="modrow"
                aria-pressed={mod}
                onClick={toggleMod}
              >
                <span>Режим модератора</span>
                <span className={`sw ${mod ? "on" : ""}`}>
                  <i />
                </span>
              </button>
              <div className="small muted">
                Показывает кнопки управления в темах. Видно только тебе.
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}