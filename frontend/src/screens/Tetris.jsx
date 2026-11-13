import GameTimers from '../components/GameTimers';
import GameCanvas from '../components/GameCanvas';
import { setSoftDrop as setSoft } from '../tetrisInput';
import { useEffect, useRef, useState } from "react";
import { gameApi as api,discTempo } from "../discPlaySession";
import { useStore } from "../store";
import { haptic, notify } from "../tg";
import { sfx } from "../sfx";
import { nyanSfx, isNyan } from "../nyanSfx";
import { drawStars } from "../nyan";
import Leaderboard from "../components/Leaderboard";
import { BackIcon } from "../components/Icons";
import { Sound, SoundOff } from "../components/Icons";
import { tetrisSfx, isTetrisTheme } from "../tetrisSfx";
import { usePreferences } from "../preferences";
import Pad from "../components/Pad";
import { drawCeramic, drawWcFloor, drawToilet, drawFlush } from "../wcGames";
const GAME = "tetris";

const COLS = 10, ROWS = 20, C = 12;
const BW = COLS * C, H = ROWS * C, W = BW + 70;
const POINTS = [0, 10, 30, 50, 80]; // очки за 0..4 линии сразу
const RAINBOW = ["#FF0000", "#FF9900", "#FFFF00", "#33FF00", "#0099FF", "#6633FF", "#FF99FF"];
const PIECES = ["#00F0F0", "#F0F000", "#A000F0", "#00F000", "#F00000", "#0000F0", "#F0A000"];
const SHAPES = [
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[1, 1], [1, 1]], // O
  [[0, 1, 0], [1, 1, 1], [0, 0, 0]], // T
  [[0, 1, 1], [1, 1, 0], [0, 0, 0]], // S
  [[1, 1, 0], [0, 1, 1], [0, 0, 0]], // Z
  [[1, 0, 0], [1, 1, 1], [0, 0, 0]], // J
  [[0, 0, 1], [1, 1, 1], [0, 0, 0]], // L
];

const rnd = () => Math.floor(Math.random() * SHAPES.length);
const rot = (m) => m[0].map((_, i) => m.map((row) => row[i]).reverse());

const spawn = (k) => {
  const m = SHAPES[k].map((r) => [...r]);
  return { k, m, x: Math.floor((COLS - m[0].length) / 2), y: 0 };
};

const fresh = () => ({
  phase: "idle",
  grid: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
  cur: spawn(rnd()),
  next: rnd(),
  acc: 0,
  t: 0,
  lines: 0,
  score: 0,
  soft: false,
  cleared: false,
  clearFx: null,
  deadAt: 0,
  justDied: false,
});

function kill(s) {
  s.phase = "dead";
  s.deadAt = performance.now();
  s.justDied = true;
}

function fits(grid, m, x, y) {
  for (let r = 0; r < m.length; r++) {
    for (let c = 0; c < m[r].length; c++) {
      if (!m[r][c]) continue;
      const gx = x + c, gy = y + r;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return false;
      if (gy >= 0 && grid[gy][gx]) return false;
    }
  }
  return true;
}

function lock(s) {
  const { m, x, y, k } = s.cur;
  m.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v && y + r >= 0) s.grid[y + r][x + c] = k + 1;
    })
  );
  const fullRows = [];
  s.grid.forEach((row,index) => { if(row.every(Boolean)) fullRows.push({index,values:[...row]}); });
  const left = s.grid.filter((row) => row.some((v) => !v));
  const n = ROWS - left.length;
  if (n) {
    s.clearFx = { at: performance.now(), rows: fullRows };
    s.grid = [...Array.from({ length: n }, () => Array(COLS).fill(0)), ...left];
    s.lines += n;
    s.score += POINTS[n];
    s.cleared = true;
  }
  s.cur = spawn(s.next);
  s.next = rnd();
  if (!fits(s.grid, s.cur.m, s.cur.x, s.cur.y)) kill(s);
}

function down(s) {
  if (fits(s.grid, s.cur.m, s.cur.x, s.cur.y + 1)) s.cur.y += 1;
  else lock(s);
}

function move(s, dx) {
  if (fits(s.grid, s.cur.m, s.cur.x + dx, s.cur.y)) s.cur.x += dx;
}

function rotate(s) {
  const r = rot(s.cur.m);
  for (const k of [0, -1, 1, -2, 2]) {
    if (fits(s.grid, r, s.cur.x + k, s.cur.y)) {
      s.cur.m = r;
      s.cur.x += k;
      return;
    }
  }
}

function hardDrop(s) {
  while (fits(s.grid, s.cur.m, s.cur.x, s.cur.y + 1)) s.cur.y += 1;
  lock(s);
}

function step(s, dt) {
  s.t += dt;
  s.acc += dt;
  const level = Math.floor(s.lines / 10);
  const interval = s.soft ? 0.065 : Math.max(0.09, 0.8 - level * 0.07);
  while (s.acc >= interval && s.phase === "run") {
    s.acc -= interval;
    down(s);
  }
}

function cell(ctx, col, x, y, k, size = C) {
  if(col.poop){drawCeramic(ctx,x*size,y*size,k,size);return;}
  const c = col.nyan ? RAINBOW[k % RAINBOW.length] : col.tetris ? PIECES[k] : col.fg;
  const px = x * size + 1, py = y * size + 1, s = size - 2;
  ctx.fillStyle = c;
  ctx.fillRect(px, py, s, s);
  if (col.tetris) {
    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.fillRect(px, py, s, 2);
    ctx.fillRect(px, py, 2, s);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(px, py + s - 2, s, 2);
    ctx.fillRect(px + s - 2, py, 2, s);
  }
}

function draw(ctx, s, col) {
  ctx.fillStyle = col.bg;
  ctx.fillRect(0, 0, W, H);
  if (col.nyan) drawStars(ctx, W, H, s.t);
  if (col.poop) {
    drawWcFloor(ctx,BW,H,C);
    ctx.fillStyle="#fcf6dd";ctx.fillRect(BW,0,W-BW,H);
  }

  ctx.fillStyle = col.fg;
  ctx.fillRect(BW, 0, 2, H);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) if (s.grid[r][c]) cell(ctx, col, c, r, s.grid[r][c] - 1);

  const { m, x, y, k } = s.cur;
  m.forEach((row, r) => row.forEach((v, c) => v && y + r >= 0 && cell(ctx, col, x + c, y + r, k)));

  // правая панель
  ctx.fillStyle = col.fg;
  ctx.font = `bold 10px ${col.font}`;
  ctx.textAlign = "center";
  const cx = BW + 36;
  ctx.fillText("ДАЛЬШЕ", cx, 14);
  const nm = SHAPES[s.next];
  const off = cx - (nm[0].length * 8) / 2;
  nm.forEach((row, r) =>
    row.forEach((v, c) => {
      if (!v) return;
      if(col.poop){drawCeramic(ctx,off+c*8,22+r*8,s.next,8);return;}
      ctx.fillStyle = col.nyan ? RAINBOW[s.next] : col.tetris ? PIECES[s.next] : col.fg;
      ctx.fillRect(off + c * 8, 22 + r * 8, 7, 7);
    })
  );
  ctx.fillStyle = col.fg;
  ctx.fillText("СЧЁТ", cx, 80);
  ctx.font = `bold 14px ${col.font}`;
  ctx.fillText(String(s.score), cx, 98);
  ctx.font = `bold 10px ${col.font}`;
  ctx.fillText("ЛИНИИ", cx, 126);
  ctx.font = `bold 14px ${col.font}`;
  ctx.fillText(String(s.lines), cx, 144);

  if(col.poop){
    const progress=drawFlush(ctx,s.clearFx,BW,C,performance.now(),col.reduced);
    drawToilet(ctx,cx-22,166,progress);
    ctx.fillStyle=col.fg;ctx.font=`bold 7px ${col.font}`;ctx.fillText(progress ? "СМЫВАЕМ!" : "ЗОЛОТОЙ СМЫВ",cx,236);
  }

  ctx.font = `bold 11px ${col.font}`;
  if (s.phase === "idle") {
    ctx.fillText("Тапни,", BW / 2, H / 2 - 6);
    ctx.fillText("чтобы начать", BW / 2, H / 2 + 8);
  }
  if (s.phase === "dead") {
    ctx.fillText("Конец.", BW / 2, H / 2 - 6);
    ctx.fillText("Тапни ещё раз", BW / 2, H / 2 + 8);
  }
}

export default function Tetris({ onBack }) {
  const { me } = useStore();
  const {tetrisController,tetrisGap,tetrisOrder}=usePreferences();
  const cv = useRef(null);
  const g = useRef(fresh());
  const col = useRef({ fg: "#fff", bg: "#000", font: "monospace", nyan: false });
  const ptr = useRef(null);
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
  tetrisSfx.stop();
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
} else if (isTetrisTheme()) {
  tetrisSfx.start();
} else {
  sfx.jump();
}
    api("/game/start", "POST", { game: GAME }).catch(() => {});
  };
  const act = (fn) => {
  const s = g.current;
  if (s.phase === "run") fn(s);
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
          reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
tetris: document.documentElement.dataset.theme === "tetris",
        };
        lastCol = now;
      }
      const s = g.current;
      if (s.phase === "run") step(s, dt);
      if (s.cleared) {
        s.cleared = false;
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
      const s = g.current;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD", "KeyW", "KeyS"].includes(e.code)) return;
      e.preventDefault();
      if (s.phase !== "run") {
        if (e.code === "Space" || e.code.startsWith("Arrow")) startRef.current();
        return;
      }
      if (e.code === "ArrowLeft" || e.code === "KeyA") move(s, -1);
      else if (e.code === "ArrowRight" || e.code === "KeyD") move(s, 1);
      else if (e.code === "ArrowUp" || e.code === "KeyW") rotate(s);
      else if (e.code === "ArrowDown" || e.code === "KeyS") setSoft(s,true);
      else if (e.code === "Space") hardDrop(s);
    };
    const keyUp = (e) => {
      if (e.code === "ArrowDown" || e.code === "KeyS") setSoft(g.current,false);
    };
    const releaseSoft=()=>{setSoft(g.current,false);ptr.current=null;};
    window.addEventListener("blur",releaseSoft);
    document.addEventListener("visibilitychange",releaseSoft);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", keyUp);
    return () => {
    tetrisSfx.stop();
      nyanSfx.stop();
      cancelAnimationFrame(raf);
      window.removeEventListener("blur",releaseSoft);
      document.removeEventListener("visibilitychange",releaseSoft);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);

  // тач: свайп влево/вправо двигает, свайп вниз ускоряет, тап вращает
  const onDown = (e) => {
    if (g.current.phase !== "run") {
      start();
      ptr.current = null;
      return;
    }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    ptr.current = { x: e.clientX, y: e.clientY, sy: e.clientY, moved: false, dropped: false };
  };
  const onMove = (e) => {
    const p = ptr.current;
    const s = g.current;
    if (!p || s.phase !== "run") return;
    const dx = e.clientX - p.x;
    if (Math.abs(dx) >= 22) {
      move(s, dx > 0 ? 1 : -1);
      p.x = e.clientX;
      p.moved = true;
    }
    if (!p.dropped && e.clientY - p.sy > 50 && e.clientY - p.sy > Math.abs(e.clientX - p.x) * 1.5) {
      setSoft(s,true);
      p.dropped = true;
    }
  };
  const onUp = (e) => {
    setSoft(g.current,false);
    const p = ptr.current;
    ptr.current = null;
    if (e?.type!=='pointercancel' && e?.type!=='lostpointercapture' && p && !p.moved && !p.dropped && g.current.phase === "run") {
      rotate(g.current);
      haptic();
    }
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

      <GameTimers stateRef={g}/>
      <div className="card gm">
        <GameCanvas
          ref={cv}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
          style={{
            width: "100%",
            maxWidth: 320,
            margin: "0 auto",
            aspectRatio: `${W} / ${H}`,
            display: "block",
            touchAction: "none",
          }}
        />
        {tetrisController&&<Pad always row className="tetris-custom-pad" style={{gap:tetrisGap}} keys={tetrisOrder.split(',').map(id=>({
 left:{label:'◀',on:()=>act(s=>move(s,-1))},
 rotate:{label:'⟳',on:()=>act(rotate)},
 right:{label:'▶',on:()=>act(s=>move(s,1))},
 down:{label:'▼',on:()=>act(s=>setSoft(s,true)),off:()=>setSoft(g.current,false)},
})[id])}/>}
        <div className="between" style={{ paddingTop: 12 }}>
          <span className="small muted">
            {phase === "dead" ? `Результат: ${score}` : "Свайп ↔ двигает, ↓ ускоряет при удержании, тап вращает"}
          </span>
          <span className="small muted">
            Рекорд: {result?.best ?? top?.my_best ?? 0}
          </span>
        </div>
        {result?.record_reward>0&&<div className="gm-rec">Рекорд всех времён · +{result.record_reward} Йер</div>}
        {result?.record && (
          <div className="gm-rec">Новый рекорд! Ты #{result.rank}</div>
        )}
      </div>

      <Leaderboard title="Тетрис — рекорды" data={top} meId={me?.id} />
    </>
  );
}
