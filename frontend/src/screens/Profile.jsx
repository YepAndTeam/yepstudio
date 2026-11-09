import { useStore } from "../store";
import { Loading } from "../components/Common";
import { ST, THEMES } from "../constants";
import { haptic } from "../tg";

export default function Profile({ openThread }) {
  const { me: m, topics, mod, toggleMod, theme, setTheme, setPush } = useStore();
  if (!m) return <Loading />;

  const mine = (topics || []).filter((t) => t.author_id === m.id);
  const rated = mine.filter((t) => t.rated).length || m.rated;

  return (
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
          {rated > 0 && (
            <div style={{ marginTop: 6 }}>
              <span className="badge">Оценено идей: {rated}</span>
            </div>
          )}
        </div>
      </div>

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

      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>
          Тема оформления
        </h3>
        <div className="themes">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.id}
              className={`th ${theme === t.id ? "on" : ""}`}
              aria-pressed={theme === t.id}
              onClick={() => {
                haptic();
                setTheme(t.id);
              }}
            >
              <span className="pv" style={{ background: t.bg }}>
                <i style={{ background: t.card }}>
                  <b style={{ background: t.fg }} />
                </i>
              </span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      </div>

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
  );
}