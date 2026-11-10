import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { shareLink } from "../share";
import { nyanSfx } from "../nyanSfx";
import { tetrisSfx } from "../tetrisSfx";
import Leaderboard from "../components/Leaderboard";
import NyanRunner from "../components/NyanRunner";
import { Chip } from "../components/Common";
import { LinkIcon } from "../components/Icons";
import Dino from "./Dino";
import Flappy from "./Flappy";
import Snake from "./Snake";
import Tetris from "./Tetris";
import { tg } from "../tg";
import Chess from "./Chess";

// Казуальные: играешь один, борешься за рекорд
const CASUAL = [
  { id: "dino", title: "Дино", hint: "Прыгай через кактусы и птиц", View: Dino },
  { id: "flappy", title: "Flappy", hint: "Пролетай между труб", View: Flappy },
  { id: "snake", title: "Змейка", hint: "Ешь и расти, не врезайся", View: Snake },
  { id: "tetris", title: "Тетрис", hint: "Собирай линии", View: Tetris },
];

// Состязания: партия против другого участника. View: null = пока заглушка "Скоро"
const VERSUS = [
  { id: "chess", title: "Шахматы", hint: "Партия с другом", View: Chess },
  { id: "checkers", title: "Шашки", hint: "Партия с другом", View: null },
];

const ALL = [...CASUAL, ...VERSUS];

export default function Game({ initial }) {
  const { me, theme } = useStore();
 const [initGame, initArg] = (initial || "").split(/_(.+)/); // "chess_12" -> "chess", "12"
const [arg, setArg] = useState(initArg || null);
const [game, setGame] = useState(ALL.some((g) => g.id === initGame && g.View) ? initGame : null);
const [section, setSection] = useState(VERSUS.some((g) => g.id === initGame) ? "versus" : "casual");
  const [board, setBoard] = useState(CASUAL[0].id);
  const [tops, setTops] = useState({});

  const loadTops = () =>
    Promise.all(
      CASUAL.map((g) =>
        api(`/game/top?game=${g.id}`)
          .then((r) => [g.id, r])
          .catch(() => [g.id, null])
      )
    ).then((e) => setTops(Object.fromEntries(e)));

   useEffect(() => {
    if (!game) loadTops();
  }, [game]);

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
    return () => { try { tg.enableVerticalSwipes?.(); } catch {} };
  }, [game]);

  const current = ALL.find((g) => g.id === game);
  if (current?.View) {
    const View = current.View;
    return (
      <>
        <View onBack={() => { setGame(null); setArg(null); }} arg={arg} />
        {theme === "nyan" && <NyanRunner />}
      </>
    );
  }

  const shown = CASUAL.find((g) => g.id === board);

  const tile = (g, withBest) => {
    const soon = !g.View;
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
            {soon ? <span className="badge">Скоро</span> : withBest && <span>Рекорд: {best}</span>}
          </div>
        </button>
        {!soon && (
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

  return (
    <>
      <div className="fhead">
        <h2>Игры</h2>
      </div>

      <div className="filters">
        <div className="seg">
          <button type="button" className={section === "casual" ? "on" : ""} onClick={() => setSection("casual")}>
            Казуальные
          </button>
          <button type="button" className={section === "versus" ? "on" : ""} onClick={() => setSection("versus")}>
            Состязания
          </button>
        </div>
      </div>

      {section === "casual" ? (
        <>
          <div className="ggrid">{CASUAL.map((g) => tile(g, true))}</div>

          <div className="filters">
            <div className="chips scroll">
              {CASUAL.map((g) => (
                <Chip key={g.id} label={g.title} on={board === g.id} onClick={() => setBoard(g.id)} />
              ))}
            </div>
          </div>
          <Leaderboard title={`${shown.title} — рекорды`} data={tops[shown.id]} meId={me?.id} />
        </>
      ) : (
        <>
          <div className="ggrid">{VERSUS.map((g) => tile(g, false))}</div>

          <div className="gtile soon wide">
            <button type="button" className="topic gp" disabled>
              <div className="title">Турниры</div>
              <div className="prev">Сетки, призы и звание чемпиона</div>
              <div className="foot">
                <span className="badge">В будущих обновлениях</span>
              </div>
            </button>
          </div>
        </>
      )}
    </>
  );
}