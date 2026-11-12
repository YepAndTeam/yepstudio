import GameCanvas from '../components/GameCanvas';
import { useEffect, useRef, useState } from "react";
import { gameApi as api,discTempo } from "../discPlaySession";
import { useStore } from "../store";
import { haptic, notify } from "../tg";
import { sfx } from "../sfx";
import { nyanSfx, isNyan } from "../nyanSfx";
import { drawNyanHead, drawStars } from "../nyan";
import Leaderboard from "../components/Leaderboard";
import { BackIcon, Sound, SoundOff } from "../components/Icons";
import { usePreferences } from "../preferences";
import Pad from "../components/Pad";
import { drawWcFloor, drawRollSegment } from "../wcGames";
import { drawPlunger } from "../bathroom";
const GAME = "snake";

const COLS = 24, ROWS = 16, C = 15;
const W = COLS * C, H = ROWS * C;
const START_STEP = 0.14; // секунд на один шаг
const MIN_STEP = 0.07;

const RAINBOW = ["#FF0000", "#FF9900", "#FFFF00", "#33FF00", "#0099FF", "#6633FF"];

const fresh = () => ({
  phase: "idle",
  snake: [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }],
  dir: { x: 1, y: 0 },
  queue: [],
  food: { x: 17, y: 8 },
  acc: 0,
  interval: START_STEP,
  t: 0,
  score: 0,
  ate: false,
  deadAt: 0,
  justDied: false,
});

function kill(s) {
  s.phase = "dead";
  s.deadAt = performance.now();
  s.justDied = true;
}

function placeFood(s) {
  for (let i = 0; i < 500; i++) {
    const f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!s.snake.some((p) => p.x === f.x && p.y === f.y)) {
      s.food = f;
      return;
    }
  }
}

function turn(s, dx, dy) {
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  if ((dx === last.x && dy === last.y) || (dx === -last.x && dy === -last.y)) return;
  if (s.queue.length < 2) s.queue.push({ x: dx, y: dy });
}

function tick(s) {
  if (s.queue.length) s.dir = s.queue.shift();
  const h = s.snake[0];
  const n = { x: h.x + s.dir.x, y: h.y + s.dir.y };
  if (n.x < 0 || n.y < 0 || n.x >= COLS || n.y >= ROWS) return kill(s);
  const eat = n.x === s.food.x && n.y === s.food.y;
  // хвост освободится в этот шаг, если не едим
  const body = eat ? s.snake : s.snake.slice(0, -1);
  if (body.some((p) => p.x === n.x && p.y === n.y)) return kill(s);
  s.snake.unshift(n);
  if (eat) {
    s.score += 1;
    s.ate = true;
    s.interval = Math.max(MIN_STEP, START_STEP - s.score * 0.003);
    placeFood(s);
  } else {
    s.snake.pop();
  }
}

function step(s, dt) {
  s.t += dt;
  s.acc += dt;
  while (s.acc >= s.interval && s.phase === "run") {
    s.acc -= s.interval;
    tick(s);
  }
}

function draw(ctx, s, col) {
  ctx.fillStyle = col.bg;
  ctx.fillRect(0, 0, W, H);
  if (col.nyan) drawStars(ctx, W, H, s.t);
  if (col.poop) drawWcFloor(ctx,W,H,C);

  ctx.fillStyle = col.fg;
  ctx.fillRect(0, 0, W, 2);
  ctx.fillRect(0, H - 2, W, 2);
  ctx.fillRect(0, 0, 2, H);
  ctx.fillRect(W - 2, 0, 2, H);

  // еда
  const f = s.food;
  if (col.poop) {
    drawPlunger(ctx,f.x*C+2,f.y*C+C-1,C-4,C-2);
  } else if (col.nyan) {
    ctx.fillStyle = "#FFCC99";
    ctx.fillRect(f.x * C + 3, f.y * C + 3, C - 6, C - 6);
    ctx.fillStyle = "#FF3399";
    ctx.fillRect(f.x * C + 6, f.y * C + 6, C - 12, C - 12);
  } else {
    ctx.fillStyle = col.fg;
    ctx.fillRect(f.x * C + 4, f.y * C + 4, C - 8, C - 8);
  }

  // тело (с конца к голове)
  for (let i = s.snake.length - 1; i >= 1; i--) {
    const p = s.snake[i];
    if(col.poop){drawRollSegment(ctx,p.x*C,p.y*C,C);continue;}
    ctx.fillStyle = col.nyan ? RAINBOW[(i - 1) % RAINBOW.length] : col.fg;
    ctx.fillRect(p.x * C + 1, p.y * C + 1, C - 2, C - 2);
  }


    // голова
  const h = s.snake[0];
  if (col.poop) {
    drawRollSegment(ctx,h.x*C,h.y*C,C,true,s.dir);
  } else if (col.nyan) {
    drawNyanHead(ctx, h.x * C + C / 2, h.y * C + C / 2);
  } else {
    ctx.fillStyle = col.fg;
    ctx.fillRect(h.x * C, h.y * C, C, C);
    ctx.fillStyle = col.bg;
    ctx.fillRect(h.x * C + 3 + (s.dir.x > 0 ? 5 : 0), h.y * C + 3 + (s.dir.y > 0 ? 5 : 0), 3, 3);
  }
  ctx.fillStyle = col.fg;

  ctx.font = `bold 14px ${col.font}`;
  ctx.textAlign = "right";
  ctx.fillText(String(s.score).padStart(3, "0"), W - 10, 22);
  ctx.textAlign = "center";
  if (s.phase === "idle") ctx.fillText("Тапни, чтобы начать", W / 2, H / 2 - 20);
  if (s.phase === "dead") ctx.fillText("Конец. Тапни ещё раз", W / 2, H / 2 - 20);
}

export default function Snake({ onBack }) {
  const { me } = useStore();
  const {snakeController}=usePreferences();
  const cv = useRef(null);
  const g = useRef(fresh());
  const col = useRef({ fg: "#fff", bg: "#000", font: "monospace", nyan: false });
  const swipe = useRef(null);
  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const [top, setTop] = useState(null);
  const [muted, setMuted] = useState(sfx.muted);

  const loadTop = () => api(`/game/top?game=${GAME}`).then(setTop).catch(() => {});
  useEffect(() => {
    loadTop();
  }, []);

  const die = async () => {
    nyanSfx.stop();
    sfx.die();
    const sc = g.current.score;
    setPhase("dead");
    setScore(sc);
    if (sc < 1) return;
    try {
      const r = await api("/game/score", "POST", { game: GAME, score: sc });
      setResult(r);
      loadTop();
      if (r.record) haptic();
    } catch (e) {
      notify("Не удалось сохранить результат: " + e.message);
    }
  };
  const dieRef = useRef(die);
  dieRef.current = die;

  const start = () => {
    const s = g.current;
    if (s.phase === "run") return;
    if (s.phase === "dead" && performance.now() - s.deadAt < 500) return;
    g.current = { ...fresh(), phase: "run" };
    setPhase("run");
    setResult(null);
    setScore(0);
    if (isNyan()) {
      nyanSfx.start();
      nyanSfx.nya();
    } else {
      sfx.jump();
    }
    api("/game/start", "POST", { game: GAME }).catch(() => {});
  };
  const press = (dx, dy) => {
  const s = g.current;
  if (s.phase === "run") turn(s, dx, dy);
  else start();
};
  const startRef = useRef(start);
  startRef.current = start;

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    cv.current.width = W * dpr;
    cv.current.height = H * dpr;
    const ctx = cv.current.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    let raf,
      last = performance.now(),
      lastCol = 0;
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)*discTempo();
      last = now;
      if (now - lastCol > 500) {
        const cs = getComputedStyle(document.documentElement);
        col.current = {
          fg: cs.getPropertyValue("--gfg").trim() || cs.getPropertyValue("--fg").trim() || "#fff",
          bg: cs.getPropertyValue("--gbg").trim() || cs.getPropertyValue("--card2").trim() || "#000",
          font: getComputedStyle(document.body).fontFamily,
          nyan: document.documentElement.dataset.theme === "nyan",
          poop: document.documentElement.dataset.theme === "poop",
        };
        lastCol = now;
      }
      const s = g.current;
      if (s.phase === "run") step(s, dt);
      if (s.ate) {
        s.ate = false;
        isNyan() ? nyanSfx.nya() : sfx.point();
        haptic();
      }
      draw(ctx, s, col.current);
      if (s.justDied) {
        s.justDied = false;
        dieRef.current();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const key = (e) => {
      const map = {
        ArrowUp: [0, -1], KeyW: [0, -1],
        ArrowDown: [0, 1], KeyS: [0, 1],
        ArrowLeft: [-1, 0], KeyA: [-1, 0],
        ArrowRight: [1, 0], KeyD: [1, 0],
      };
      if (map[e.code]) {
        e.preventDefault();
        const s = g.current;
        if (s.phase === "run") turn(s, ...map[e.code]);
        else startRef.current();
      } else if (e.code === "Space") {
        e.preventDefault();
        startRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      nyanSfx.stop();
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key);
    };
  }, []);

  // свайпы по полю
  const onDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    if (g.current.phase !== "run") start();
  };
  const onMove = (e) => {
    const p = swipe.current;
    const s = g.current;
    if (!p || s.phase !== "run") return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(s, dx > 0 ? 1 : -1, 0);
    else turn(s, 0, dy > 0 ? 1 : -1);
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => {
    swipe.current = null;
  };

  return (
    <>
      <div className="fhead">
        <button type="button" className="back" onClick={onBack}>
          <BackIcon /> Игры
        </button>
       <button
  type="button"
  className="snd"
  onClick={() => setMuted(sfx.toggle())}
  aria-label={muted ? "Включить звук" : "Выключить звук"}
>
  {muted ? <SoundOff /> : <Sound />}
</button>
      </div>

      <div className="card gm">
        <GameCanvas
          ref={cv}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            width: "100%",
            aspectRatio: `${W} / ${H}`,
            display: "block",
            touchAction: "none",
          }}
        />
        {snakeController&&<Pad always keys={[
  { label: "▲", pos: "1 / 2", on: () => press(0, -1) },
  { label: "◀", pos: "2 / 1", on: () => press(-1, 0) },
  { label: "▼", pos: "2 / 2", on: () => press(0, 1) },
  { label: "▶", pos: "2 / 3", on: () => press(1, 0) },
]} />}
        <div className="between" style={{ paddingTop: 12 }}>
          <span className="small muted">
            {phase === "dead" ? `Результат: ${score}` : "Свайпай или стрелки / WASD"}
          </span>
          <span className="small muted">
            Рекорд: {result?.best ?? top?.my_best ?? 0}
          </span>
        </div>
        {result?.record && (
          <div className="gm-rec">Новый рекорд! Ты #{result.rank}</div>
        )}
      </div>

      <Leaderboard title="Змейка — рекорды" data={top} meId={me?.id} />
    </>
  );
}