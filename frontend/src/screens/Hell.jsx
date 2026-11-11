import GameCanvas from '../components/GameCanvas';
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";
import { haptic, notify } from "../tg";
import { sfx } from "../sfx";
import Leaderboard from "../components/Leaderboard";
import { BackIcon, Sound, SoundOff } from "../components/Icons";
import { shareRecord } from "../share";

import ArcadeStick from "../components/ArcadeStick";
import { mergeControls } from "../arcadeInput";
import { wcWall, drawWcRoom, drawWcEnemyColumn, drawPlungerWeapon } from "../hellWc";
const GAME = "hell";
const W = 320, H = 200, COLS = 160;
const FOV = 0.66;

const MAP = [
  "################",
  "#..............#",
  "#..##......##..#",
  "#..#........#..#",
  "#..............#",
  "#.......##.....#",
  "#.......##.....#",
  "#..............#",
  "#..............#",
  "#.....#..#.....#",
  "#.....#..#.....#",
  "#..............#",
  "#..#........#..#",
  "#..##......##..#",
  "#..............#",
  "################",
];
const MH = MAP.length, MW = MAP[0].length;
const isWall = (x, y) => {
  const cx = Math.floor(x), cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return true;
  return MAP[cy][cx] === "#";
};

const KEYS = () => ({ up: 0, down: 0, left: 0, right: 0, fire: 0 });
const fresh = () => ({
  phase: "idle", px: 2.5, py: 2.5, a: 0.6, hp: 100,
  t: 0, kills: 0, score: 0, enemies: [], spawn: 1,
  cd: 0, flash: 0, hurt: 0, deadAt: 0, justDied: false,
});

// DDA: расстояние до стены по лучу
function ray(px, py, dx, dy) {
  let mx = Math.floor(px), my = Math.floor(py);
  const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
  let sx, sy, sdx, sdy;
  if (dx < 0) { sx = -1; sdx = (px - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - px) * ddx; }
  if (dy < 0) { sy = -1; sdy = (py - my) * ddy; } else { sy = 1; sdy = (my + 1 - py) * ddy; }
  let side = 0;
  for (let i = 0; i < 40; i++) {
    if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
    if (isWall(mx, my)) break;
  }
  const dist = side === 0 ? sdx - ddx : sdy - ddy;
  const wallX=side===0?py+dist*dy:px+dist*dx;
  return { dist: Math.max(dist, 0.01), side, wallX:wallX-Math.floor(wallX) };
}

function spawnEnemy(s) {
  for (let i = 0; i < 40; i++) {
    const x = 1 + Math.random() * (MW - 2), y = 1 + Math.random() * (MH - 2);
    if (isWall(x, y) || Math.hypot(x - s.px, y - s.py) < 5) continue;
    s.enemies.push({ x, y, hp: s.t > 30 ? 3 : 2, cd: 0.4, hit: 0 });
    return;
  }
}

function shoot(s) {
  s.cd = 0.4;
  s.flash = 0.1;
  haptic();
  const wall = ray(s.px, s.py, Math.cos(s.a), Math.sin(s.a)).dist;
  let best = null, bd = 1e9;
  for (const e of s.enemies) {
    const dx = e.x - s.px, dy = e.y - s.py, d = Math.hypot(dx, dy);
    let da = Math.atan2(dy, dx) - s.a;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) < Math.atan(0.32 / d) && d < wall && d < bd) { best = e; bd = d; }
  }
  if (best) {
    best.hp -= 1;
    best.hit = 0.12;
    if (best.hp <= 0) {
      s.enemies = s.enemies.filter((e) => e !== best);
      s.kills += 1;
      s.score = s.kills * 10;
      sfx.point();
    }
  }
}

function tryMove(s, nx, ny) {
  const r = 0.2;
  if (!isWall(nx + Math.sign(nx - s.px) * r, s.py)) s.px = nx;
  if (!isWall(s.px, ny + Math.sign(ny - s.py) * r)) s.py = ny;
}

function step(s, dt, k) {
  s.t += dt;
  s.a += (k.right - k.left) * 2.4 * dt;
  const mv = (k.up - k.down) * 3 * dt;
  if (mv) tryMove(s, s.px + Math.cos(s.a) * mv, s.py + Math.sin(s.a) * mv);

  s.cd -= dt; s.flash -= dt; s.hurt -= dt;
  if (k.fire && s.cd <= 0) shoot(s);

  s.spawn -= dt;
  if (s.spawn <= 0 && s.enemies.length < 8) {
    spawnEnemy(s);
    s.spawn = Math.max(0.8, 2.5 - s.t * 0.02);
  }

  const sp = 0.9 + Math.min(s.t * 0.01, 1);
  for (const e of s.enemies) {
    e.hit -= dt;
    const dx = s.px - e.x, dy = s.py - e.y, d = Math.hypot(dx, dy);
    if (d > 0.7) {
      const nx = e.x + (dx / d) * sp * dt, ny = e.y + (dy / d) * sp * dt;
      if (!isWall(nx, e.y)) e.x = nx;
      if (!isWall(e.x, ny)) e.y = ny;
    } else {
      e.cd -= dt;
      if (e.cd <= 0) { s.hp -= 10; s.hurt = 0.3; e.cd = 0.8; haptic(); }
    }
  }
  if (s.hp <= 0) {
    s.hp = 0; s.phase = "dead"; s.deadAt = performance.now(); s.justDied = true;
  }
}

function draw(ctx, s, poop = false, zbuf = new Float32Array(COLS)) {
  // потолок и пол
  ctx.fillStyle = "#1a0a0a"; ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = "#2b2220"; ctx.fillRect(0, H / 2, W, H / 2);

  if(poop)drawWcRoom(ctx,W,H);

  const dx = Math.cos(s.a), dy = Math.sin(s.a);
  const plx = -dy * FOV, ply = dx * FOV;
  const cw = W / COLS;

  for (let i = 0; i < COLS; i++) {
    const cam = (2 * i) / COLS - 1;
    const { dist, side, wallX } = ray(s.px, s.py, dx + plx * cam, dy + ply * cam);
    zbuf[i] = dist;
    const lh = Math.min(H * 2, H / dist);
    const fog = Math.max(0.15, 1 - dist / 12);
    if(poop){
      const texture=wcWall(side,fog);
      ctx.drawImage(texture,Math.floor(wallX*32),0,1,32,i*cw,(H-lh)/2,cw+.5,lh);
      continue;
    }
    const base = side ? 110 : 150;
    ctx.fillStyle = `rgb(${Math.floor(base * fog)},${Math.floor(base * 0.35 * fog)},${Math.floor(base * 0.25 * fog)})`;
    ctx.fillRect(i * cw, (H - lh) / 2, cw + 0.5, lh);
  }

  // враги (билборды), дальние первыми
  const list = s.enemies
    .map((e) => {
      const rx = e.x - s.px, ry = e.y - s.py;
      const inv = 1 / (plx * dy - dx * ply);
      const tx = inv * (dy * rx - dx * ry);
      const ty = inv * (-ply * rx + plx * ry);
      return { e, tx, ty };
    })
    .filter((o) => o.ty > 0.2)
    .sort((a, b) => b.ty - a.ty);

  for (const { e, tx, ty } of list) {
    const sxc = (W / 2) * (1 + tx / ty);
    const size = Math.min(H * 1.5, H / ty);
    const left = sxc - size / 4, widthPx = size / 2;
    const top = (H - size) / 2 + size * 0.1;
    const fog = Math.max(0.3, 1 - ty / 12);
    for (let x = Math.floor(left); x < left + widthPx; x += 1) {
      const col = Math.floor(x / cw);
      if (col < 0 || col >= COLS || ty > zbuf[col]) continue;
      const u = (x - left) / widthPx;
      if(poop){drawWcEnemyColumn(ctx,x,top,size,u,e.hit>0);continue;}
      const body = e.hit > 0 ? "#ffffff" : `rgb(${Math.floor(200 * fog)},${Math.floor(40 * fog)},${Math.floor(30 * fog)})`;
      ctx.fillStyle = body;
      ctx.fillRect(x, top + size * 0.25, 1, size * 0.55); // тело
      if (u > 0.25 && u < 0.75) ctx.fillRect(x, top, 1, size * 0.3); // голова
      ctx.fillStyle = "#ffe000";
      if ((u > 0.33 && u < 0.43) || (u > 0.57 && u < 0.67)) ctx.fillRect(x, top + size * 0.08, 1, size * 0.04); // глаза
      ctx.fillStyle = `rgb(${Math.floor(120 * fog)},0,0)`;
      if (u < 0.15 || u > 0.85) ctx.fillRect(x, top + size * 0.3, 1, size * 0.35); // руки
    }
  }

  // оружие
  const bob = s.phase === "run" ? Math.sin(s.t * 8) * 1.5 : 0;
  const kick = s.flash > 0 ? 6 : 0;
  if(poop){drawPlungerWeapon(ctx,W,H,bob,kick,s.flash>0);}else{
  ctx.fillStyle = "#555"; ctx.fillRect(W / 2 - 10, H - 40 + kick + bob, 20, 40);
  ctx.fillStyle = "#333"; ctx.fillRect(W / 2 - 4, H - 52 + kick + bob, 8, 16);
  if (s.flash > 0) { ctx.fillStyle = "#ffd24a"; ctx.fillRect(W / 2 - 8, H - 66, 16, 14); }

  }

  // прицел
  ctx.fillStyle = "#fff";
  ctx.fillRect(W / 2 - 1, H / 2 - 5, 2, 4); ctx.fillRect(W / 2 - 1, H / 2 + 1, 2, 4);
  ctx.fillRect(W / 2 - 5, H / 2 - 1, 4, 2); ctx.fillRect(W / 2 + 1, H / 2 - 1, 4, 2);

  // урон
  if (s.hurt > 0) { ctx.fillStyle = `rgba(200,0,0,${Math.min(0.5, s.hurt * 1.5)})`; ctx.fillRect(0, 0, W, H); }

  // HUD
  ctx.fillStyle = "#000"; ctx.fillRect(0, H - 14, 90, 14);
  ctx.fillStyle = s.hp > 30 ? "#4c4" : "#e33";
  ctx.fillRect(4, H - 10, (s.hp / 100) * 82, 6);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 14px monospace"; ctx.textAlign = "right";
  ctx.fillText(String(s.score).padStart(5, "0"), W - 8, 18);
  ctx.textAlign = "center";
  if (s.phase === "idle") ctx.fillText("Тапни, чтобы начать", W / 2, 60);
  if (s.phase === "dead") ctx.fillText("Ты погиб. Тапни ещё раз", W / 2, 60);
}

export default function Hell({ onBack }) {
  const { me, theme } = useStore();
  const themeRef=useRef(theme);
  useEffect(()=>{themeRef.current=theme;},[theme]);
  const stick=useRef({x:0,y:0});
  const touchFire=useRef(0);
  const firePointer=useRef(null);
  const cv = useRef(null);
  const g = useRef(fresh());
  const keys = useRef(KEYS());
  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const [top, setTop] = useState(null);
  const [muted, setMuted] = useState(sfx.muted);

  const loadTop = () => api(`/game/top?game=${GAME}`).then(setTop).catch(() => {});
  useEffect(() => { loadTop(); }, []);

  const die = async () => {
    sfx.die();
    keys.current = KEYS();
    stick.current={x:0,y:0};touchFire.current=0;
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
    g.current = { ...fresh(), phase: "run" };
    keys.current = KEYS();
    setPhase("run");
    setResult(null);
    setScore(0);
    api("/game/start", "POST", { game: GAME }).catch(() => {});
  };
  const startRef = useRef(start);
  startRef.current = start;

  const tap = () => {
    const s = g.current;
    if (s.phase === "run") touchFire.current = 1; // одиночный тап = выстрел
    else if (s.phase === "idle" || performance.now() - s.deadAt > 500) startRef.current();
  };

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.current.width = W * dpr;
    cv.current.height = H * dpr;
    const ctx = cv.current.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    const input=KEYS();
    const zbuf=new Float32Array(COLS);
    const resetInput=()=>{keys.current=KEYS();stick.current={x:0,y:0};touchFire.current=0;firePointer.current=null;};
    const onVisibility=()=>{if(document.hidden)resetInput();};
    window.addEventListener("blur",resetInput);
    document.addEventListener("visibilitychange",onVisibility);
    let raf, last = performance.now();
    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = g.current;
      mergeControls(keys.current,stick.current,touchFire.current,input);
      if (s.phase === "run") step(s, dt, input);
      draw(ctx, s, themeRef.current === "poop", zbuf);
      if (s.justDied) { s.justDied = false; dieRef.current(); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const map = {
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "fire",
    };
    const down = (e) => {
      const k = map[e.code];
      if (!k) return;
      e.preventDefault();
      if (g.current.phase !== "run" && k === "fire") return tap();
      keys.current[k] = 1;
    };
    const up = (e) => { const k = map[e.code]; if (k) keys.current[k] = 0; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      resetInput();
      window.removeEventListener("blur",resetInput);
      document.removeEventListener("visibilitychange",onVisibility);
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const releaseFire=(e)=>{
    if(e.pointerId!==firePointer.current)return;
    firePointer.current=null;touchFire.current=0;
  };
  const pressFire=(e)=>{
    if(firePointer.current!==null)return;
    e.preventDefault();firePointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);
    tap();
  };

  const best = result?.best ?? top?.my_best;

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
          onPointerDown={pressFire}
          onPointerUp={releaseFire}
          onPointerCancel={releaseFire}
          onLostPointerCapture={releaseFire}
          style={{ width: "100%", aspectRatio: `${W} / ${H}`, display: "block", touchAction: "none" }}
        />

        <div className="hell-controls">
          <div className="hell-stick-wrap">
            <ArcadeStick enabled={phase === "run"}
              onActivate={()=>{if(g.current.phase!=="run")tap();}}
              onChange={value=>{stick.current=value;}} />
            <span className="small muted">Ход / поворот</span>
          </div>
          <button type="button" className="hell-fire" aria-label="Удерживать для стрельбы"
            onPointerDown={pressFire} onPointerUp={releaseFire}
            onPointerCancel={releaseFire} onLostPointerCapture={releaseFire}>
            <span>{theme === "poop" ? "ПРОБИТЬ" : "ОГОНЬ"}</span>
          </button>
        </div>

        <div className="between" style={{ paddingTop: 12 }}>
          <span className="small muted">
            {phase === "dead" ? `Результат: ${score}` : "Стик — ход и поворот, кнопка — огонь. WASD / пробел"}
          </span>
          <span className="small muted">
            Рекорд: {best > 0 && (
              <button type="button" className="send" onClick={() => shareRecord(GAME, "Ад", best)}>
                Мой рекорд, сможешь побить?
              </button>
            )}
          </span>
        </div>
        {result?.record && <div className="gm-rec">Новый рекорд! Ты #{result.rank}</div>}
      </div>

      <Leaderboard title="Ад — рекорды" data={top} meId={me?.id} />
    </>
  );
}