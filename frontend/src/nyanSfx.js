
import { sfx } from "./sfx";

/*
  Nyan Cat with Bass
  JavaScript / Web Audio API adaptation
  Original Arduino version by electricmango
  https://electricmango.github.io

  Original license: CC BY-SA 4.0
  https://creativecommons.org/licenses/by-sa/4.0/

  Adapted for JavaScript.
*/

// ========================================
// 1. NOTE FREQUENCIES (pitches.h)
// ========================================

const P = {
  DS3: 155.56,
  E3: 164.81,
  FS3: 185.00,
  GS3: 207.65,
  AS3: 233.08,
  B3: 246.94,

  D4: 293.66,
  DS4: 311.13,
  E4: 329.63,
  FS4: 369.99,
  GS4: 415.30,
  CS4: 277.18,

  FS2: 92.50,

  DS5: 622.25,
  E5: 659.26,
  FS5: 739.99,
  AS5: 932.33,
  B5: 987.77,

  CS6: 1108.73,
  DS6: 1244.51,
  E6: 1318.51,
};

// ========================================
// 2. ORIGINAL MELODY
// ========================================

const melody = `
DS5 E5 FS5 0 B5 E5 DS5 E5 FS5 B5 DS6 E6 DS6 AS5 B5 0
FS5 0 DS5 E5 FS5 0 B5 CS6 AS5 B5 CS6 E6 DS6 E6 CS6
FS4 GS4 D4 DS4 FS2 CS4 D4 CS4 B3 B3 CS4
D4 D4 CS4 B3 CS4 DS4 FS4 GS4 DS4 FS4 CS4 DS4 B3 CS4 B3
DS4 FS4 GS4 DS4 FS4 CS4 DS4 B3 D4 DS4 D4 CS4 B3 CS4
D4 B3 CS4 DS4 FS4 CS4 D4 CS4 B3 CS4 B3 CS4
FS4 GS4 D4 DS4 FS2 CS4 D4 CS4 B3 B3 CS4
D4 D4 CS4 B3 CS4 DS4 FS4 GS4 DS4 FS4 CS4 DS4 B3 CS4 B3
DS4 FS4 GS4 DS4 FS4 CS4 DS4 B3 D4 DS4 D4 CS4 B3 CS4
D4 B3 CS4 DS4 FS4 CS4 D4 CS4 B3 CS4 B3 B3

B3 FS3 GS3 B3 FS3 GS3 B3 CS4 DS4 B3 E4 DS4 E4 FS4
B3 B3 FS3 GS3 B3 FS3 E4 DS4 CS4 B3 E3 DS3 E3 FS3
B3 FS3 GS3 B3 FS3 GS3 B3 B3 CS4 DS4 B3 FS3 GS3 FS3
B3 B3 AS3 B3 FS3 GS3 B3 E4 DS4 E4 FS4 B3 AS3
B3 FS3 GS3 B3 FS3 GS3 B3 CS4 DS4 B3 E4 DS4 E4 FS4
B3 B3 FS3 GS3 B3 FS3 E4 DS4 CS4 B3 E3 DS3 E3 FS3
B3 FS3 GS3 B3 FS3 GS3 B3 B3 CS4 DS4 B3 FS3 GS3 FS3
B3 B3 AS3 B3 FS3 GS3 B3 E4 DS4 E4 FS4 B3 CS4

FS4 GS4 D4 DS4 FS2 CS4 D4 CS4 B3 B3 CS4
D4 D4 CS4 B3 CS4 DS4 FS4 GS4 DS4 FS4 CS4 DS4 B3 CS4 B3
DS4 FS4 GS4 DS4 FS4 CS4 DS4 B3 D4 DS4 D4 CS4 B3 CS4
D4 B3 CS4 DS4 FS4 CS4 D4 CS4 B3 CS4 B3 CS4
FS4 GS4 D4 DS4 FS2 CS4 D4 CS4 B3 B3 CS4
D4 D4 CS4 B3 CS4 DS4 FS4 GS4 DS4 FS4 CS4 DS4 B3 CS4 B3
DS4 FS4 GS4 DS4 FS4 CS4 DS4 B3 D4 DS4 D4 CS4 B3 CS4
D4 B3 CS4 DS4 FS4 CS4 D4 CS4 B3 CS4 B3 B3

B3 FS3 GS3 B3 FS3 GS3 B3 CS4 DS4 B3 E4 DS4 E4 FS4
B3 B3 FS3 GS3 B3 FS3 E4 DS4 CS4 B3 E3 DS3 E3 FS3
B3 FS3 GS3 B3 FS3 GS3 B3 B3 CS4 DS4 B3 FS3 GS3 FS3
B3 B3 AS3 B3 FS3 GS3 B3 E4 DS4 E4 FS4 B3 AS3
B3 FS3 GS3 B3 FS3 GS3 B3 CS4 DS4 B3 E4 DS4 E4 FS4
B3 B3 FS3 GS3 B3 FS3 E4 DS4 CS4 B3 E3 DS3 E3 FS3
B3 FS3 GS3 B3 FS3 GS3 B3 B3 CS4 DS4 B3 FS3 GS3 FS3
B3 B3 AS3 B3 FS3 GS3 B3 E4 DS4 E4 FS4 B3 CS4
`.trim().split(/\s+/).map(n => n === "0" ? 0 : P[n]);

// ========================================
// 3. ORIGINAL NOTE DURATIONS
// ========================================

const noteDurations = [
16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,
16,16,16,16,16,16,8,16,16,16,16,16,16,16,16,

8,8,16,16,16,16,16,16,8,8,8,
8,16,16,16,16,16,16,16,16,16,16,16,16,16,16,
8,8,16,16,16,16,16,16,16,16,16,16,16,16,
8,16,16,16,16,16,16,16,16,8,8,8,
8,8,16,16,16,16,16,16,8,8,8,
8,16,16,16,16,16,16,16,16,16,16,16,16,16,16,
8,8,16,16,16,16,16,16,16,16,16,16,16,16,
8,16,16,16,16,16,16,16,16,8,8,8,

8,16,16,8,16,16,16,16,16,16,16,16,16,16,
8,8,16,16,16,16,16,16,16,16,16,16,16,16,
8,16,16,8,16,16,16,16,16,16,16,16,16,16,
8,16,16,16,16,16,16,16,16,16,16,8,8,
8,16,16,8,16,16,16,16,16,16,16,16,16,16,
8,8,16,16,16,16,16,16,16,16,16,16,16,16,
8,16,16,8,16,16,16,16,16,16,16,16,16,16,
8,16,16,16,16,16,16,16,16,16,16,8,8,

8,8,16,16,16,16,16,16,8,8,8,
8,16,16,16,16,16,16,16,16,16,16,16,16,16,16,
8,8,16,16,16,16,16,16,16,16,16,16,16,16,
8,16,16,16,16,16,16,16,16,8,8,8,
8,8,16,16,16,16,16,16,8,8,8,
8,16,16,16,16,16,16,16,16,16,16,16,16,16,16,
8,8,16,16,16,16,16,16,16,16,16,16,16,16,
8,16,16,16,16,16,16,16,16,8,8,8,

8,16,16,8,16,16,16,16,16,16,16,16,16,16,
8,8,16,16,16,16,16,16,16,16,16,16,16,16,
8,16,16,8,16,16,16,16,16,16,16,16,16,16,
8,16,16,16,16,16,16,16,16,16,16,8,8,
8,16,16,8,16,16,16,16,16,16,16,16,16,16,
8,8,16,16,16,16,16,16,16,16,16,16,16,16,
8,16,16,8,16,16,16,16,16,16,16,16,16,16,
8,16,16,16,16,16,16,16,16,16,16,8,8,
];

// ========================================
// 4. AUDIO ENGINE
// ========================================

let ac = null;
let timer = null;
let index = 0;
let nextTime = 0;
let playing = false;
let runId = 0;

const NOTE_GAP = 1.30 * (1 / 0.7);

function ctx() {
  try {
    ac = ac || new (
      window.AudioContext ||
      window.webkitAudioContext
    )();

    if (ac.state === "suspended") {
      ac.resume();
    }

    return ac;
  } catch {
    return null;
  }
}

function playNote(frequency, time, duration) {
  if (!frequency || sfx.muted) return;

  const c = ctx();
  if (!c) return;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = "square";

  osc.frequency.setValueAtTime(frequency, time);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(0.065, time + 0.003);

  gain.gain.setValueAtTime(
    0.065,
    time + duration * 0.85
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    time + duration
  );

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(time);
  osc.stop(time + duration + 0.01);
}

// ========================================
// 5. SEQUENCER
// ========================================

function schedule() {
  const c = ctx();

  if (!c || !playing) return;

  const horizon = c.currentTime + 0.2;

  while (
    index < melody.length &&
    nextTime < horizon
  ) {
    const frequency = melody[index];

    const duration =
      (1000 / noteDurations[index]) / 1000;

    playNote(
      frequency,
      nextTime,
      duration
    );

    nextTime += duration * NOTE_GAP;

    index++;
  }

  if (index >= melody.length) {
    stopPlayback();
  }
}

function stopPlayback() {
  playing = false;

  clearInterval(timer);
  timer = null;
}

// ========================================
// 6. PUBLIC API
// ========================================

export const nyanSfx = {
  start() {
    if (playing) return;

    const c = ctx();

    if (!c) return;

    runId++;

    index = 0;
    playing = true;

    nextTime = c.currentTime + 0.05;

    schedule();

    timer = setInterval(schedule, 25);
  },

  stop() {
    runId++;

    stopPlayback();

    index = 0;
  },

  nya() {
    if (sfx.muted) return;

    const c = ctx();

    if (!c) return;

    const t = c.currentTime;

    playNote(520, t, 0.07);
    playNote(980, t + 0.07, 0.1);
  }
};

// ========================================
// 7. THEME DETECTION
// ========================================

export const isNyan = () =>
  document.documentElement.dataset.theme === "nyan";
