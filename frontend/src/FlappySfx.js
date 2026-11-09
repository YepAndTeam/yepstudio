import { sfx } from "./sfx";

// Звуки в духе Flappy Bird, синтезируются на лету (Web Audio), без файлов.
// Уважают общий mute из sfx.muted.

let ac = null;
function ctx() {
  if (sfx.muted) return null;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    return ac;
  } catch {
    return null;
  }
}

// Тон с плавным изменением частоты и затуханием
function tone({ type = "square", f0, f1 = f0, dur, vol = 0.12, delay = 0 }) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Шумовой удар через low-pass
function thud({ dur = 0.12, vol = 0.25, cutoff = 900, delay = 0 }) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime + delay;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(lp).connect(g).connect(c.destination);
  src.start(t);
}

export const flappySfx = {
  // короткий "взмах": быстрый взлёт по частоте
  flap() {
    tone({ type: "triangle", f0: 320, f1: 640, dur: 0.09, vol: 0.14 });
  },
  // "динь" за очко: две высокие ноты подряд
  point() {
    tone({ type: "square", f0: 988, dur: 0.07, vol: 0.08 });
    tone({ type: "square", f0: 1319, dur: 0.16, vol: 0.08, delay: 0.07 });
  },
  // удар о трубу/землю
  hit() {
    thud({ dur: 0.14, vol: 0.3, cutoff: 1100 });
    tone({ type: "sine", f0: 180, f1: 60, dur: 0.14, vol: 0.25 });
  },
  // падение после удара: падающий свист
  die() {
    tone({ type: "triangle", f0: 520, f1: 90, dur: 0.45, vol: 0.12, delay: 0.12 });
  },
};