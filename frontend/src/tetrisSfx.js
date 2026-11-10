import { sfx } from "./sfx";

// ВСТАВЬ СЮДА массив melody[] из ардуино-скетча как есть (комментарии и скобки можно оставить)
const RAW = `
NOTE_E5, 4, NOTE_B4, 8, NOTE_C5, 8, NOTE_D5, 4,
NOTE_C5, 8, NOTE_B4, 8, NOTE_A4, 4, NOTE_A4, 4,

NOTE_C5, 4, NOTE_E5, 4, NOTE_D5, 4, NOTE_C5, 8,
NOTE_B4, 8, NOTE_C5, 4, NOTE_D5, 8, NOTE_E5, 8,

NOTE_C5, 4, NOTE_A4, 4, NOTE_A4, 4, NOTE_D5, 4,
NOTE_F5, 2, NOTE_A5, 4, NOTE_G5, 8, NOTE_F5, 8,

NOTE_E5, 4, NOTE_C5, 8, NOTE_E5, 8, NOTE_D5, 4,
NOTE_C5, 4, NOTE_B4, 4, NOTE_B4, 8, NOTE_C5, 8,

NOTE_D5, 4, NOTE_E5, 4, NOTE_C5, 8, NOTE_A4, 8,
NOTE_A4, 4
`;
const TEMPO = 160; // переменная tempo из того же скетча

const SEMI = { C: 0, CS: 1, D: 2, DS: 3, E: 4, F: 5, FS: 6, G: 7, GS: 8, A: 9, AS: 10, B: 11 };

// Разбор формата Arduino: пары (нота, делитель). Делитель < 0 означает ноту с точкой (×1.5)
function parse(raw, tempo) {
  const clean = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const tokens = clean.match(/NOTE_[A-G]S?\d|REST|-?\d+/g) || [];
  const whole = (60 / tempo) * 4; // длина целой ноты, сек
  const ev = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const n = tokens[i];
    const div = parseInt(tokens[i + 1], 10);
    if (!div) continue;
    let dur = whole / Math.abs(div);
    if (div < 0) dur *= 1.5;
    let f = 0;
    const m = n.match(/NOTE_([A-G]S?)(\d)/);
    if (m) f = 440 * Math.pow(2, (SEMI[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
    ev.push({ f, dur });
  }
  return ev;
}

const EVENTS = parse(RAW, TEMPO);

let ac = null, out = null, timer = null, idx = 0, nextT = 0;

function ctx() {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch {
    return null;
  }
}

function note(c, f, t, dur) {
  if (!out) {
    out = c.createGain();
    out.connect(c.destination);
  }
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function schedule() {
  const c = ctx();
  if (!c || !EVENTS.length) return;
  while (nextT < c.currentTime + 0.2) {
    const e = EVENTS[idx % EVENTS.length];
    if (e.f && !sfx.muted) note(c, e.f, nextT, e.dur * 0.9);
    nextT += e.dur;
    idx++;
  }
}

export const tetrisSfx = {
  start() {
    if (timer || !EVENTS.length) return;
    const c = ctx();
    if (!c) return;
    idx = 0;
    nextT = c.currentTime + 0.05;
    schedule();
    timer = setInterval(schedule, 50);
  },
  stop() {
    clearInterval(timer);
    timer = null;
    if (out) {
      try { out.disconnect(); } catch {}
      out = null;
    }
  },
};

export const isTetrisTheme = () => document.documentElement.dataset.theme === "tetris";

document.addEventListener("visibilitychange", () => {
  if (document.hidden) tetrisSfx.stop();
});