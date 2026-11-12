import {advanceDino} from '../dinoTiming';
import GameCanvas from '../components/GameCanvas';
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { haptic, notify } from "../tg";
import { sfx } from "../sfx";
import { nyanSfx, isNyan } from "../nyanSfx";
import Leaderboard from "../components/Leaderboard";
import { BackIcon, Sound, SoundOff } from "../components/Icons";
import { drawNyanCat, drawNyanTrail, drawStars, NYAN_H } from "../nyan";
import { shareRecord } from "../share";
import { drawPoop } from "../poop";
import { drawBathroom, drawPlunger, drawPaperRoll } from "../bathroom";
const GAME = "dino";

const W = 360, H = 180, GROUND = 150, DX = 40, DW = 22, DH = 26;

// Высоты нижней точки птицы над землёй: низко, посередине, на уровне головы.
// Все меньше DH (26), поэтому стоящего динозавра птица задевает — надо прыгать.
const BIRD_HEIGHTS = [4, 14, 22];

const fresh = () => ({
  phase: "idle",
  y: GROUND,
  vy: 0,
  t: 0,
  speed: 200,
  obs: [],
  gap: 0.8,
  leg: 0,
  deadAt: 0,
  justDied: false,
  score: 0,
  milestone: 0,
});

function kill(s) {
  s.phase = "dead";
  s.deadAt = performance.now();
  s.justDied = true;
}

function step(s, dt) {
  s.t += dt;
  s.speed = Math.min(200 + s.t * 8, 420);
  s.vy += 1900 * dt;
  s.y += s.vy * dt;
  if (s.y >= GROUND) {
    s.y = GROUND;
    s.vy = 0;
  }
  s.leg += dt * 10;
  s.gap -= dt;

  if (s.gap <= 0) {
    // После 4 секунд иногда появляются птицы (~35%)
    const isFly = s.t > 4 && Math.random() < 0.35;

    if (isFly) {
      s.obs.push({
        type: "fly",
        x: W + 10,
        w: 22,
        h: 12,
        fy: BIRD_HEIGHTS[Math.floor(Math.random() * BIRD_HEIGHTS.length)],
      });
    } else {
      s.obs.push({
        type: "cactus",
        x: W + 10,
        w: 10 + Math.floor(Math.random() * 8),
        h: 20 + Math.floor(Math.random() * 16),
      });
    }
    s.gap = (280 + Math.random() * 280) / s.speed;
  }

  let kept=0;
  for(const o of s.obs){o.x-=s.speed*dt;if(o.x+o.w>-10)s.obs[kept++]=o;}
  s.obs.length=kept;
  s.score = Math.floor(s.t * 10);

  // Звук каждые 100 очков
  if (s.score > 0 && Math.floor(s.score / 100) > s.milestone) {
    s.milestone = Math.floor(s.score / 100);
    sfx.point();
  }

  const dinoTop = s.y - DH;
  const dinoBot = s.y;

  for (const o of s.obs) {
    // Горизонтальное пересечение
    if (DX + 4 >= o.x + o.w || DX + DW - 4 <= o.x) continue;

    if (o.type === "cactus") {
      if (dinoBot - 4 > GROUND - o.h) {
        kill(s);
        break;
      }
    } else {
      // Птица
      const birdBot = GROUND - o.fy;
      const birdTop = birdBot - o.h;
      if (dinoTop + 3 < birdBot && dinoBot - 3 > birdTop) {
        kill(s);
        break;
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
  ctx.fillRect(0, GROUND, W, 2);

  // Земля
  for (let i = 0; !col.poop && i < 8; i++) {
    ctx.fillRect(
      ((i * 53 - s.t * s.speed * 0.5) % W + W) % W,
      GROUND + 8 + (i % 3) * 6,
      6,
      2
    );
  }

  // Динозавр
   const y = s.y - DH;
  const air = s.y < GROUND;
  if (col.poop) {
    drawPoop(ctx, DX, y, DW, DH, air ? 0 : Math.floor(s.leg), false, s.phase === "dead");
    ctx.fillStyle = col.fg;
  } else if (col.nyan) {
    const frame = Math.floor(s.leg);
    drawNyanTrail(ctx, DX - 2, s.y - NYAN_H, frame);
    drawNyanCat(ctx, DX - 2, s.y - NYAN_H, frame, air);
    ctx.fillStyle = col.fg;
  } else {
    ctx.fillRect(DX, y + 8, 14, 12); // тело
    ctx.fillRect(DX + 10, y, 12, 10); // голова
    ctx.fillRect(DX - 4, y + 10, 4, 4); // хвост
    const f = Math.floor(s.leg) % 2;
    ctx.fillRect(DX + 2, y + 20, 4, air || f ? 6 : 3);
    ctx.fillRect(DX + 9, y + 20, 4, air || !f ? 6 : 3);
    ctx.fillStyle = col.bg;
    ctx.fillRect(DX + 17, y + 2, 2, 2); // глаз
    ctx.fillStyle = col.fg;
  }

  // Препятствия
  for (const o of s.obs) {
    const x = Math.round(o.x);

    if (col.poop) {
      if (o.type === "fly") drawPaperRoll(ctx, x, GROUND-o.fy, o.w, o.h, Math.floor(s.t*8)%2);
      else drawPlunger(ctx, x, GROUND, o.w, o.h);
      ctx.fillStyle=col.fg;
      continue;
    }
    if (o.type === "fly") {
      const by = GROUND - o.fy; // нижняя точка птицы
      const flap = Math.floor(s.t * 10 + o.x * 0.1) % 2;

      // тело
      ctx.fillRect(x + 4, by - 8, 11, 6);
      // голова
      ctx.fillRect(x + 13, by - 10, 6, 5);
      // клюв
      ctx.fillRect(x + 18, by - 8, 4, 2);

      // крылья (машут)
      if (flap) {
        ctx.fillRect(x + 1, by - 15, 9, 4); // верх
        ctx.fillRect(x + 5, by - 3, 7, 3); // низ
      } else {
        ctx.fillRect(x - 1, by - 11, 7, 3);
        ctx.fillRect(x + 8, by - 5, 9, 3);
      }
    } else {
      // Кактус
      const cx = x + Math.floor(o.w / 3);
      const tw = Math.ceil(o.w / 3);
      ctx.fillRect(cx, GROUND - o.h, tw, o.h); // ствол
      ctx.fillRect(x, GROUND - Math.round(o.h * 0.65), tw, 4); // левая
      ctx.fillRect(x + o.w - tw, GROUND - Math.round(o.h * 0.5), tw, 4); // правая
    }
  }

  // Счёт
  ctx.font = `bold 14px ${col.font}`;
  ctx.textAlign = "right";
  ctx.fillText(String(s.score).padStart(5, "0"), W - 10, 20);
  ctx.textAlign = "center";
  if (s.phase === "starting") ctx.fillText("Готовим забег…", W / 2, 70);
  if (s.phase === "idle") ctx.fillText("Тапни, чтобы бежать", W / 2, 70);
  if (s.phase === "dead") ctx.fillText("Конец. Тапни ещё раз", W / 2, 70);
}

export default function Dino({ onBack }) {
  const { me,theme } = useStore();
  const cv = useRef(null);
  const starting = useRef(false);
  const alive = useRef(true);
  const g = useRef(fresh());
  const col = useRef({ fg: "#fff", bg: "#000", font: "monospace" });
  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const [top, setTop] = useState(null);
  const [muted, setMuted] = useState(sfx.muted);

  const loadTop = () => api(`/game/top?game=${GAME}`).then(value=>{if(alive.current)setTop(value);}).catch(() => {});
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
      if(!alive.current)return;
      setResult(r);
      loadTop();
      if (r.record) haptic();
    } catch (e) {
      notify("Не удалось сохранить результат: " + e.message);
    }
  };
  const dieRef = useRef(die);
  dieRef.current = die;

  const press = async () => {
    if(isNyan())nyanSfx.unlock();
    if(starting.current)return;
    const s = g.current;
    if (s.phase === "run") {
      if (s.y >= GROUND) {
        s.vy = -520;
        isNyan() ? nyanSfx.nya() : sfx.jump();
        haptic();
      }
    } else if (s.phase === "idle" || performance.now() - s.deadAt > 500) {
      starting.current=true;
      g.current.phase="starting";
      setPhase("starting");
      try {
        await api("/game/start", "POST", { game: GAME });
        if(!alive.current)return;
        g.current = { ...fresh(), phase: "run" };
        setPhase("run");setResult(null);setScore(0);
        if(isNyan()){nyanSfx.start();nyanSfx.nya();}else sfx.jump();
      } catch(e) {
        if(alive.current){g.current=fresh();setPhase("idle");notify("Не удалось начать забег: "+e.message);}
      } finally {starting.current=false;}
    }
  };
  const pressRef = useRef(press);
  pressRef.current = press;

  useEffect(()=>{
    const cs=getComputedStyle(document.documentElement);
    col.current={fg:cs.getPropertyValue('--gfg').trim()||cs.getPropertyValue('--fg').trim()||'#fff',bg:cs.getPropertyValue('--gbg').trim()||cs.getPropertyValue('--card2').trim()||'#000',font:getComputedStyle(document.body).fontFamily,nyan:theme==='nyan',poop:theme==='poop'};
  },[theme]);

  useEffect(() => {
    alive.current=true;
    // Чёткая картинка на экранах с высокой плотностью пикселей
    const dpr = Math.min(window.devicePixelRatio || 1,2);
    cv.current.width = W * dpr;
    cv.current.height = H * dpr;
    const ctx = cv.current.getContext("2d",{alpha:false});
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    let raf=null,last=performance.now(),paintedState=null,paintedPhase=null,paintedColors=null,previousState=null;
    const clock={acc:0};
    const frame = (now) => {
      raf=null;
      if(document.hidden)return;
      const s=g.current,elapsed=Math.max(0,(now-last)/1000);last=now;
      if(previousState!==s){clock.acc=0;previousState=s;}
      else if(s.phase==='run')advanceDino(clock,elapsed,dt=>{step(s,dt);return s.phase==='run';});
      else clock.acc=0;
      if(s.phase==='run'||paintedState!==s||paintedPhase!==s.phase||paintedColors!==col.current){
        draw(ctx,s,col.current);paintedState=s;paintedPhase=s.phase;paintedColors=col.current;
      }
      if(s.justDied){s.justDied=false;void dieRef.current();}
      raf=requestAnimationFrame(frame);
    };
    const visibility=()=>{
      if(raf!==null)cancelAnimationFrame(raf);raf=null;clock.acc=0;last=performance.now();
      if(!document.hidden)raf=requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange',visibility);
    if(!document.hidden)raf=requestAnimationFrame(frame);
    const key = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        pressRef.current();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
     alive.current=false;
     nyanSfx.stop();
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange",visibility);
      window.removeEventListener("keydown", key);
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
              : "Тап или пробел, чтобы прыгнуть"}
          </span>
          <span className="small muted">
            Рекорд:{(result?.best ?? top?.my_best) > 0 && (
  <button type="button" className="send" onClick={() => shareRecord(GAME, "Dino", result?.best ?? top.my_best)}>
    Мой рекорд, сможешь побить?
            </button>)}
          </span>
        </div>
        {result?.achievement_reward>0&&<div className="gm-rec">Новая ступень достижения · +{result.achievement_reward} Йер</div>}
        {result?.record && (
          <div className="gm-rec">Новый рекорд! Ты #{result.rank}</div>
        )}
      </div>

      <Leaderboard title="Дино — рекорды" data={top} meId={me?.id} />
    </>
  );
}