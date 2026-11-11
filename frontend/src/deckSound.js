import { sfx } from "./sfx";

let context;
let noiseBuffer;
const sources = new Set();
function getContext() {
  if (!context) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    context = new Audio();
  }
  return context;
}
function tone(a, freq, end, at, duration, volume, type = "triangle") {
  const source = a.createOscillator();
  const gain = a.createGain();
  source.type = type;
  source.frequency.setValueAtTime(freq, at);
  source.frequency.exponentialRampToValueAtTime(end, at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  source.connect(gain).connect(a.destination);
  sources.add(source);
  source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); };
  source.start(at); source.stop(at + duration);
}
function click(a, at, duration = .045) {
  if (!noiseBuffer) {
    noiseBuffer = a.createBuffer(1, Math.ceil(a.sampleRate * .18), a.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const gain = a.createGain();
  source.buffer = noiseBuffer; filter.type = "bandpass"; filter.frequency.value = 1300;
  gain.gain.setValueAtTime(.065, at); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  source.connect(filter).connect(gain).connect(a.destination);
  sources.add(source);
  source.onended = () => { sources.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
  source.start(at); source.stop(at + duration);
}
export const deckSound = {
  // Called synchronously from a tap, before any async purchase/unlock work.
  unlock() {
    if (sfx.muted || document.hidden) return;
    try { const a = getContext(); if (a?.state === "suspended") void a.resume().catch(() => {}); } catch { /* Audio is optional. */ }
  },
  play(kind, compact = false) {
    if (sfx.muted || document.hidden) return;
    try {
      const a = getContext(); if (!a || a.state !== "running") return;
      const t = a.currentTime + .01;
      if (kind === "read") {
        click(a,t); tone(a,105,155,t,.3,.025,"sawtooth"); click(a,t+.16,.025);
      } else if (kind === "eject") {
        click(a,t); tone(a,160,65,t,.32,.025); click(a,t+.3);
        const start = compact ? .04 : .45;
        [523.25,659.25,783.99,1046.5].forEach((f,i) => tone(a,f,f,t+start+i*.1,.2,.04));
      } else if (kind === "recycle") {
        tone(a,310,95,t,.28,.025); click(a,t+.18);
      }
    } catch { /* Never interrupt the opening if Web Audio is unavailable. */ }
  },
  stop() {
    for (const source of sources) { try { source.stop(); } catch { /* Already ended. */ } }
    sources.clear();
  },
};
