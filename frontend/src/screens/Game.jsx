import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { shareLink } from "../share";
import { nyanSfx } from "../nyanSfx";
import { tetrisSfx } from "../tetrisSfx";
import TournamentBanner from "../components/TournamentBanner";
import TournamentList from "../components/TournamentList";
import Leaderboard from "../components/Leaderboard";
import NyanRunner from "../components/NyanRunner";
import { Chip } from "../components/Common";
import { LinkIcon, KeyIcon } from "../components/Icons";
import Dino from "./Dino";
import Flappy from "./Flappy";
import Snake from "./Snake";
import Tetris from "./Tetris";
import { tg } from "../tg";
import Chess from "./Chess";
import Checkers from "./Checkers";
import Hell from "./Hell";
import Doom from "./Doom";

// Казуальные: играешь один, борешься за рекорд
const CASUAL = [
  { id: "dino", title: "Дино", hint: "Прыгай через кактусы и птиц", View: Dino },
  { id: "flappy", title: "Flappy", hint: "Пролетай между труб", View: Flappy },
  { id: "snake", title: "Змейка", hint: "Ешь и расти, не врезайся", View: Snake },
  { id: "tetris", title: "Тетрис", hint: "Собирай линии", View: Tetris },
  { id: "hell", title: "Ад", hint: "Стреляй в демонов 3D", View: Hell },
];

// Состязания: партия против другого участника. View: null = пока заглушка "Скоро"
const VERSUS = [
  { id: "chess", title: "Шахматы", hint: "Партия с другом", View: Chess },
  { id: "checkers", title: "Шашки", hint: "Партия с другом", View: Checkers },
];

// Секретные: без рекордов и без кнопки "поделиться"
const SECRET = [
  { id: "doom", title: "Doom", hint: "Ты нашёл секрет", View: Doom },
];

const ALL = [...CASUAL, ...VERSUS, ...SECRET];

const SECRET_KEY = "secret_unlocked";
const SECRET_CODE = "10719";
const readUnlocked = () => {
  try {
    return localStorage.getItem(SECRET_KEY) === "1";
  } catch {
    return false;
  }
};

// Сколько осталось до конца недели: "3 д 5 ч" / "5 ч" / "скоро"
function timeLeft(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return "скоро";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000) % 24;
  return d > 0 ? `${d} д ${h} ч` : `${h} ч`;
}

export default function Game({ initial, tournamentId, onTournamentChange }) {
  const { me, theme } = useStore();
  const [initGame, initArg] = (initial || "").split(/_(.+)/); // "chess_12" -> "chess", "12"
  const inSecret = SECRET.some((g) => g.id === initGame);

  const [arg, setArg] = useState(initArg || null);
  const [game, setGame] = useState(
    ALL.some((g) => g.id === initGame && g.View) ? initGame : null
  );
  const [section, setSection] = useState(
    tournamentId ? "versus" : inSecret ? "secret" : VERSUS.some((g) => g.id === initGame) ? "versus" : "casual"
  );
  const [tournament,setTournament]=useState(tournamentId || null);
  const openTournament=id=>{setTournament(id);setGame(null);setArg(null);setSection("versus");onTournamentChange?.(id);};
  const closeTournament=()=>{setTournament(null);onTournamentChange?.(null);};
  const [unlocked, setUnlocked] = useState(() => inSecret || readUnlocked());
  const [board, setBoard] = useState(CASUAL[0].id);
  const [scope, setScope] = useState("week"); // "week" | "all"
  const [tops, setTops] = useState({});

  // ввод секретного кода
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");

  const tryCode = (v) => {
    setCode(v);
    // "?10719?" и "10719" считаются одним и тем же кодом
    const clean = v.replace(/[^0-9]/g, "");
    if (clean === SECRET_CODE) {
      try { localStorage.setItem(SECRET_KEY, "1"); } catch {}
      try { tg.HapticFeedback?.notificationOccurred?.("success"); } catch {}
      setCode("");
      setShowCode(false);
      setUnlocked(true);
      setSection("secret");
    }
  };

  const onKey = () => {
    if (unlocked) setSection("secret");
    else setShowCode((v) => !v);
  };

  const loadTops = () =>
    Promise.all(
      CASUAL.map((g) =>
        api(`/game/top?game=${g.id}&scope=${scope}`)
          .then((r) => [g.id, r])
          .catch(() => [g.id, null])
      )
    ).then((e) => setTops(Object.fromEntries(e)));

  useEffect(() => {
    if (!game) loadTops();
  }, [game, scope]);

  useEffect(() => {
    if (!game) {
      nyanSfx.stop();
      tetrisSfx.stop();
    }
    return () => {
      nyanSfx.stop();
      tetrisSfx.stop();
    };
  }, [game]);

  // отключаем свайп-закрытие Telegram, пока открыта игра
  useEffect(() => {
    if (!game) return;
    try { tg.disableVerticalSwipes?.(); } catch {}
    return () => {
      try { tg.enableVerticalSwipes?.(); } catch {}
    };
  }, [game]);

  const current = ALL.find((g) => g.id === game);
  if (current?.View) {
    const View = current.View;
    return (
      <>
        <View
          onBack={() => {
            setGame(null);
            setArg(null);
          }}
          arg={arg}
        />
        {theme === "nyan" && <NyanRunner />}
      </>
    );
  }

  const shown = CASUAL.find((g) => g.id === board);
  const shownTop = tops[shown.id];

  const tile = (g, withBest, canShare = true) => {
    const soon = !g.View;
    // The displayed record follows the selected leaderboard scope.
    const best = withBest ? tops[g.id]?.my_best ?? 0 : 0;
    const text =
      best > 0
        ? `Мой рекорд в «${g.title}»: ${best}. Сможешь побить?`
        : `Сыграем в «${g.title}»?`;
    return (
      <div key={g.id} className={`gtile ${soon ? "soon" : ""}`}>
        <button
          type="button"
          className="topic gp"
          disabled={soon}
          onClick={() => setGame(g.id)}
        >
          <div className="title">{g.title}</div>
          <div className="prev">{g.hint}</div>
          <div className="foot">
            {soon ? (
              <span className="badge">Скоро</span>
            ) : (
              withBest && <span>Рекорд: {best}</span>
            )}
          </div>
        </button>
        {!soon && canShare && (
          <button
            type="button"
            className="snd"
            aria-label="Поделиться ссылкой"
            onClick={() => shareLink(`game_${g.id}`, text)}
          >
            <LinkIcon />
          </button>
        )}
      </div>
    );
  };

  // кнопка-ключ в стиле чипов
  const keyChip = (
    <button
      type="button"
      className={`chip key ${section === "secret" || showCode ? "on" : ""}`}
      aria-label="Секретное"
      onClick={onKey}
    >
      <span>
        <KeyIcon />
      </span>
    </button>
  );

  const codeInput = showCode && !unlocked && (
    <input
      type="text"
      inputMode="numeric"
      autoFocus
      value={code}
      onChange={(e) => tryCode(e.target.value)}
      placeholder="Введите код"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
    />
  );

  return (
    <>
      <div className="fhead">
        <h2>Игры</h2>
      </div>

      <div className="filters">
        <div className="seg">
          <button
            type="button"
            className={section === "casual" ? "on" : ""}
            onClick={() => setSection("casual")}
          >
            Казуальные
          </button>
          <button
            type="button"
            className={section === "versus" ? "on" : ""}
            onClick={() => setSection("versus")}
          >
            Состязания
          </button>
        </div>
      </div>

      {section === "casual" && (
        <>
          <div className="ggrid">{CASUAL.map((g) => tile(g, true))}</div>

          <div className="filters">
            <div className="seg">
              <button
                type="button"
                className={scope === "week" ? "on" : ""}
                onClick={() => setScope("week")}
              >
                Неделя
              </button>
              <button
                type="button"
                className={scope === "all" ? "on" : ""}
                onClick={() => setScope("all")}
              >
                За всё время
              </button>
            </div>
          </div>

          <div className="filters">
            <div className="chips scroll">
              {CASUAL.map((g) => (
                <Chip
                  key={g.id}
                  label={g.title}
                  on={board === g.id}
                  onClick={() => setBoard(g.id)}
                />
              ))}
              {keyChip}
            </div>
            {codeInput}
          </div>

          {scope === "week" && shownTop?.ends_at && (
            <div className="small muted" style={{ padding: "0 4px 8px" }}>
              До сброса: {timeLeft(shownTop.ends_at)}
            </div>
          )}

          <Leaderboard
            title={`${shown.title} — ${scope === "all" ? "за всё время" : "рекорды недели"}`}
            data={shownTop}
            meId={me?.id}
          />
        </>
      )}

      {section === "versus" && (tournament ? <>
        <button type="button" className="back" onClick={closeTournament}>‹ Все состязания</button>
        <TournamentBanner eventId={tournament} onPlay={id=>setGame(id)} />
      </> : <>
        <TournamentList onOpen={openTournament} />
        <div className="ggrid">{VERSUS.map((g) => tile(g, false))}</div>
      </>)}

      {section === "secret" && unlocked && (
        <>
          <div className="ggrid">{SECRET.map((g) => tile(g, false, false))}</div>

          <div className="filters">
            <div className="chips scroll">{keyChip}</div>
          </div>
        </>
      )}
    </>
  );
}