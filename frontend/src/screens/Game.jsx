import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { shareLink } from "../share";
import { LinkIcon } from "../components/Icons";
import Leaderboard from "../components/Leaderboard";
import Dino from "./Dino";
import Flappy from "./Flappy";

const GAMES = [
  { id: "dino", title: "Дино", hint: "Прыгай через кактусы и птиц", View: Dino },
  { id: "flappy", title: "Flappy", hint: "Пролетай между труб", View: Flappy },
];

export default function Game({ initial }) {
  const { me } = useStore();
  // если пришли по ссылке game_dino, сразу открываем эту игру
  const [game, setGame] = useState(GAMES.some((g) => g.id === initial) ? initial : null);
  const [tops, setTops] = useState({});

  const loadTops = () =>
    Promise.all(
      GAMES.map((g) =>
        api(`/game/top?game=${g.id}`)
          .then((r) => [g.id, r])
          .catch(() => [g.id, null])
      )
    ).then((e) => setTops(Object.fromEntries(e)));

  useEffect(() => {
    if (!game) loadTops();
  }, [game]);

  const current = GAMES.find((g) => g.id === game);
  if (current) {
    const View = current.View;
    return <View onBack={() => setGame(null)} />;
  }

  return (
    <>
      <div className="fhead">
        <h2>Игры</h2>
      </div>

      <div className="gpick">
  {GAMES.map((g) => {
    const best = tops[g.id]?.my_best ?? 0;
    const text = best > 0
      ? `Мой рекорд в «${g.title}»: ${best}. Сможешь побить?`
      : `Сыграем в «${g.title}»?`;
    return (
      <div key={g.id} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <button
          type="button"
          className="topic gp"
          style={{ flex: 1, minWidth: 0 }}
          onClick={() => setGame(g.id)}
        >
          <div className="title">{g.title}</div>
          <div className="prev">{g.hint}</div>
          <div className="foot">
            <span>Рекорд: {best}</span>
          </div>
        </button>
        <button
          type="button"
          className="snd"
          style={{ height: "auto" }}
          aria-label="Поделиться ссылкой"
          onClick={() => shareLink(`game_${g.id}`, text)}
        >
          <LinkIcon />
        </button>
      </div>
    );
  })}
</div>

      {GAMES.map((g) => (
        <Leaderboard
          key={g.id}
          title={`${g.title} — рекорды`}
          data={tops[g.id]}
          meId={me?.id}
        />
      ))}
    </>
  );
}