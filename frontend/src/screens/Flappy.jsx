import {recordNyanTrail} from '../nyanTrailCore';
import GameTimers from '../components/GameTimers';
import GameCanvas from '../components/GameCanvas';
import { useEffect, useRef, useState } from "react";
import { gameApi as api,discTempo } from "../discPlaySession";
import { useStore } from "../store";
import { haptic, notify } from "../tg";
import { sfx } from "../sfx";
import { flappySfx as fx } from "../flappySfx";
import Leaderboard from "../components/Leaderboard";
import { BackIcon, Sound, SoundOff } from "../components/Icons";
import { drawNyanCat, drawNyanTrail, drawStars } from "../nyan";
import { nyanSfx, isNyan } from "../nyanSfx";
import { shareRecord } from "../share";
import { drawPoop } from "../poop";
import { drawBathroom, drawDrainPipe } from "../bathroom";
const GAME = "flappy";

const W = 360, H = 240, GROUND = 216;
const BX = 80, R = 9; // позиция и "радиус" птицы

// ВАЖНО: античит на бэке (GAMES["flappy"]["rate"] = 0.8 очка/сек) посчитан под
// SPEED = 95 и SPACING = 140 (труба каждые ~1.47 сек).
// Если меняешь эти две константы, поправь rate в main.py.
const SPEED = 95;
const SPACING = 140;

const PW = 38; // ширина трубы
const GAP = 76; // просвет между трубами
const GRAV = 1100;
const FLAP = -300;
const MIN_C = GAP / 2 + 16; // границы для центра просвета
const MAX_C = GROUND - GAP / 2 - 16;
const MAX_STEP = 55; // макс. смещение центра относительно прошлой трубы, чтобы всегда можно было пролететь

const fresh = () => ({
  phase: "idle",
  y: H / 2,
  vy: 0,
  t: 0,
  pipes: [],
  lastC: (MIN_C + MAX_C) / 2,
  deadAt: 0,
  justDied: false,
  score: 0,
});

function kill(s) {
  s.phase = "dead";
  s.deadAt = performance.now();
  s.justDied = true;
}

function spawn(s) {
  const lo = Math.max(MIN_C, s.lastC - MAX_STEP);
  const hi = Math.min(MAX_C, s.lastC + MAX_STEP);
  const c = lo + Math.random() * (hi - lo);
  s.lastC = c;
  s.pipes.push({ x: W + 10, c, passed: false });
}

function step(s, dt) {
  s.t += dt;
  s.vy += GRAV * dt;
  s.y += s.vy * dt;
  recordNyanTrail(s,s.y-12,s.t);

  // потолок: не умираем, просто упираемся
  if (s.y < R) {
    s.y = R;
    s.vy = 0;
  }
  // земля
  if (s.y >= GROUND - R) {
    s.y = GROUND - R;
    kill(s);
    return;
  }

  const last = s.pipes[s.pipes.length - 1];
  if (!last || last.x <= W + 10 - SPACING) spawn(s);

  for (const p of s.pipes) p.x -= SPEED * dt;
  s.pipes = s.pipes.filter((p) => p.x + PW > -10);

  for (const p of s.pipes) {
    // очко, когда птица полностью миновала трубу
    if (!p.passed && p.x + PW < BX - R) {
      p.passed = true;
      s.score += 1;
      fx.point();
    }
    // горизонтальное пересечение (с небольшой поблажкой)
    if (BX + R - 2 > p.x && BX - R + 2 < p.x + PW) {
      const top = p.c - GAP / 2;
      const bot = p.c + GAP / 2;
      if (s.y - R + 2 < top || s.y + R - 2 > bot) {
        kill(s);
        return;
      }
    }
  }
}

function draw(ctx, s, col) {
  ctx.fillStyle = col.bg;
  ctx.fillRect(0, 0, W, H);
  if (col.nyan) drawStars(ctx, W, GROUND, s.t);
  if (col.poop) drawBathroom(ctx, W, GROUND, H);
  ctx.fillStyle = col.fg;

  // Трубы
  for (const p of s.pipes) {
    const x = Math.round(p.x);
    const top = Math.round(p.c - GAP / 2);
    const bot = Math.round(p.c + GAP / 2);
    if (col.poop) {
      drawDrainPipe(ctx,x,0,PW,top,true);
      drawDrainPipe(ctx,x,bot,PW,GROUND-bot,false);
      ctx.fillStyle=col.fg;
      continue;
    }
    ctx.fillRect(x, 0, PW, top);
    ctx.fillRect(x - 3, top - 8, PW + 6, 8); // шапка сверху
    ctx.fillRect(x, bot, PW, GROUND - bot);
    ctx.fillRect(x - 3, bot, PW + 6, 8); // шапка снизу
  }

  // Земля
  ctx.fillRect(0, GROUND, W, 2);
  const shift = s.phase === "run" || s.phase === "dead" ? s.t * SPEED : 0;
  for (let i = 0; !col.poop && i < 10; i++) {
    ctx.fillRect(((i * 41 - shift) % W + W) % W, GROUND + 8 + (i % 3) * 6, 6, 2);
  }

 // Птица / Nyan Cat
  const bob = s.phase === "idle" ? Math.sin(performance.now() / 250) * 4 : 0;
  const by = s.y + bob;
  const flap = s.vy < 0 || s.phase === "idle" ? Math.floor(performance.now() / 120) % 2 : 0;
  if (col.poop) {
    ctx.save();
    ctx.translate(BX, by);
    ctx.rotate(Math.max(-0.3, Math.min(0.65, s.vy / 800)));
    drawPoop(ctx, -11, -12, 22, 24, flap, true, s.phase === "dead");
    ctx.restore();
    ctx.fillStyle = col.fg;
  } else if (col.nyan) {
    const frame = Math.floor(performance.now() / 120);
    drawNyanTrail(ctx, BX - 13, by - 12, frame,2,s.nyanTrail,s.t,SPEED);
    ctx.save();
    ctx.translate(BX, by);
    ctx.rotate(Math.max(-0.25, Math.min(0.5, s.vy / 900))); // кот почти не крутится
    drawNyanCat(ctx, -13, -12, frame, true);
    ctx.restore();
    ctx.fillStyle = col.fg;
  } else {
    ctx.save();
    ctx.translate(BX, by);
    ctx.rotate(Math.max(-0.4, Math.min(0.9, s.vy / 600)));
    ctx.fillRect(-R, -R + 1, R * 2, R * 2 - 2); // тело
    ctx.fillRect(R, -2, 5, 3); // клюв
    ctx.fillRect(-R - 3, flap ? -R + 2 : 0, 7, 4); // крыло
    ctx.fillStyle = col.bg;
    ctx.fillRect(R - 6, -R + 3, 3, 3); // глаз
    ctx.restore();
    ctx.fillStyle = col.fg;
  }

  // Счёт и подсказки
  ctx.font = `bold 14px ${col.font}`;
  ctx.textAlign = "right";
  ctx.fillText(String(s.score).padStart(3, "0"), W - 10, 20);
  ctx.textAlign = "center";
  if (s.phase === "idle") ctx.fillText("Тапни, чтобы лететь", W / 2, 70);
  if (s.phase === "dead") ctx.fillText("Конец. Тапни ещё раз", W / 2, 70);
}

export default function Flappy({ onBack }) {
  const { me } = useStore();
  const cv = useRef(null);
  const g = useRef(fresh());
  const col = useRef({ fg: "#fff", bg: "#000", font: "monospace" });
  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const [top, setTop] = useState(null);
  const [muted, setMuted] = useState(sfx.muted);

  const loadTop = () => api(`/game/top?game=${GAME}`).then(setTop).catch(() => {});
  useEffect(() => {
    loadTop();
    nyanSfx.stop();
  }, []);

  const die = async () => {
    fx.hit();
    fx.die();
    nyanSfx.stop();
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

  const press = () => {
    if(isNyan())nyanSfx.unlock();
    const s = g.current;
     if (s.phase === "run") {
      s.vy = FLAP;
      isNyan() ? null : fx.flap();
      haptic();
    } else if (s.phase === "idle" || performance.now() - s.deadAt > 500) {
      g.current = { ...fresh(), phase: "run", vy: FLAP };
      setPhase("run");
      setResult(null);
      setScore(0);
      isNyan() ? (nyanSfx.start(), nyanSfx.nya()) : fx.flap();
      api("/game/start", "POST", { game: GAME }).catch(() => {});
    }
  };
  const pressRef = useRef(press);
  pressRef.current = press;

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
      draw(ctx, s, col.current);
      if (s.justDied) {
        s.justDied = false;
        dieRef.current();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const key = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        pressRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", key);
      nyanSfx.stop();
    };
  }, []);

  return (
    <>
      <div className="fhead">
        <button type="button" className="back" onClick={onBack}>
          <BackIcon /> Игры
        </button>
        <button
  type="button"
  className="snd"
  onClick={() => {setMuted(sfx.toggle());nyanSfx.muteChanged();}}
  aria-label={muted ? "Включить звук" : "Выключить звук"}
>
  {muted ? <SoundOff /> : <Sound />}
</button>
      </div>

      <GameTimers stateRef={g}/>
      <div className="card gm">
        <GameCanvas
          ref={cv}
          onPointerDown={press}
          style={{
            width: "100%",
            aspectRatio: `${W} / ${H}`,
            display: "block",
            touchAction: "manipulation",
          }}
        />
        <div className="between" style={{ paddingTop: 12 }}>
          <span className="small muted">
            {phase === "dead"
              ? `Результат: ${score}`
              : "Тап или пробел, чтобы взмахнуть"}
          </span>
          <span className="small muted">
            Рекорд:{top?.mode!=='disc'&&result?.mode!=='disc'&&(result?.best ?? top?.my_best) > 0 && (
  <button type="button" className="send" onClick={() => shareRecord(GAME, "Dino", result?.best ?? top.my_best)}>
    Мой рекорд, сможешь побить?
            </button>)}
          </span>
        </div>
        {result?.record && (
          <div className="gm-rec">Новый рекорд! Ты #{result.rank}</div>
        )}
      </div>

      <Leaderboard title="Flappy — рекорды" data={top} meId={me?.id} />
    </>
  );
}