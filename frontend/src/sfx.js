let ctx = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, endFreq, dur, type = "square", vol = 0.08, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

let muted = false;
try {
  muted = localStorage.getItem("mute") === "1";
} catch (e) {}

export const sfx = {
  get muted() {
    return muted;
  },
  jump() {
    if (muted) return;
    tone(380, 760, 0.12);
  },
  die() {
    if (muted) return;
    tone(300, 60, 0.35, "square", 0.1);
    tone(150, 40, 0.4, "sawtooth", 0.06, 0.05);
  },
  point() {
    if (muted) return;
    tone(880, 880, 0.07);
    tone(1175, 1175, 0.09, "square", 0.08, 0.08);
  },
  toggle() {
    muted = !muted;
    try {
      localStorage.setItem("mute", muted ? "1" : "0");
    } catch (e) {}
    return muted;
  },
};