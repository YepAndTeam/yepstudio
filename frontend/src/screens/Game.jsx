import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import Leaderboard from "../components/Leaderboard";
import Dino from "./Dino";
import Flappy from "./Flappy";

const GAMES = [
  { id: "dino", title: "Дино", hint: "Прыгай через кактусы и птиц", View: Dino },
  { id: "flappy", title: "Flappy", hint: "Пролетай между труб", View: Flappy },
];

export default function Game() {
  const { me } = useStore();
  const [game, setGame] = useState(null); // null = меню выбора
  const [tops, setTops] = useState({});

  const loadTops = () =>
    Promise.all(
      GAMES.map((g) =>
        api(`/game/top?game=${g.id}`)
          .then((r) => [g.id, r])
          .catch(() => [g.id, null])
      )
    ).then((e) => setTops(Object.fromEntries(e)));

  // обновляем таблицы каждый раз, когда возвращаемся в меню
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
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            className="topic gp"
            onClick={() => setGame(g.id)}
          >
            <div className="title">{g.title}</div>
            <div className="prev">{g.hint}</div>
            <div className="foot">
              <span>Рекорд: {tops[g.id]?.my_best ?? 0}</span>
            </div>
          </button>
        ))}
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