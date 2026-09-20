// Makes every sound in the video from scratch -- no samples, no downloads, so
// there is nothing to license: an ambient music bed plus small interface sounds.
// The files land in public/audio/. Every run makes identical files (the random
// numbers are seeded), and the section changes follow src/timeline.ts.
//
//   node scripts/make-audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import {DURATION, FPS, T} from '../src/timeline.ts';

const SR = 44100;
const TAU = Math.PI * 2;
const OUT = path.resolve('public/audio');
fs.mkdirSync(OUT, {recursive: true});

// ---------------------------------------------------------------- basics
let seed = 20260919;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rand() * 2 - 1;
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

const makeBuf = (seconds) => ({L: new Float32Array(Math.ceil(seconds * SR)), R: new Float32Array(Math.ceil(seconds * SR))});
const panGains = (pan) => [Math.cos(((pan + 1) * Math.PI) / 4), Math.sin(((pan + 1) * Math.PI) / 4)]; // equal power, pan -1..1

function peakOf(arr) {
  let m = 0;
  for (let i = 0; i < arr.length; i++) m = Math.max(m, Math.abs(arr[i]));
  return m;
}
function rmsOf(arr, from = 0, to = arr.length) {
  let s = 0;
  for (let i = from; i < to; i++) s += arr[i] * arr[i];
  return Math.sqrt(s / Math.max(1, to - from));
}
function scaleTo(arr, peak) {
  const g = peak / Math.max(peakOf(arr), 1e-9);
  for (let i = 0; i < arr.length; i++) arr[i] *= g;
  return arr;
}
function fade(arr, headSec, tailSec) {
  const h = Math.floor(headSec * SR);
  const t = Math.floor(tailSec * SR);
  for (let i = 0; i < h; i++) arr[i] *= i / h;
  for (let i = 0; i < t; i++) arr[arr.length - 1 - i] *= i / t;
  return arr;
}
function onePole(arr, cutoff) {
  const a = 1 - Math.exp((-TAU * cutoff) / SR);
  let y = 0;
  for (let i = 0; i < arr.length; i++) {
    y += a * (arr[i] - y);
    arr[i] = y;
  }
}
function highPass(arr, cutoff) {
  const a = Math.exp((-TAU * cutoff) / SR);
  let px = 0;
  let py = 0;
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i];
    py = a * (py + x - px);
    px = x;
    arr[i] = py;
  }
}

// A soft saw wave (first 7 harmonics) so pads sound warm rather than buzzy.
const TABLE = 4096;
const softSaw = new Float32Array(TABLE);
for (let i = 0; i < TABLE; i++) {
  let s = 0;
  for (let h = 1; h <= 7; h++) s += Math.sin((TAU * h * i) / TABLE) / h;
  softSaw[i] = s * 0.55;
}
const lookup = (table, phase) => {
  const x = phase * TABLE;
  const i = Math.floor(x);
  const fr = x - i;
  return table[i % TABLE] * (1 - fr) + table[(i + 1) % TABLE] * fr;
};

// A Freeverb-style reverb: gives everything a soft, roomy tail.
function reverbChannel(input, spread, room, damp) {
  const n = input.length;
  const out = new Float32Array(n);
  for (const d0 of [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]) {
    const d = d0 + spread;
    const line = new Float32Array(d);
    let idx = 0;
    let store = 0;
    for (let i = 0; i < n; i++) {
      const y = line[idx];
      store = y * (1 - damp) + store * damp;
      line[idx] = input[i] * 0.015 + store * room;
      idx = (idx + 1) % d;
      out[i] += y;
    }
  }
  for (const d0 of [556, 441, 341, 225]) {
    const d = d0 + spread;
    const line = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const b = line[idx];
      const x = out[i];
      out[i] = -x + b;
      line[idx] = x + b * 0.5;
      idx = (idx + 1) % d;
    }
  }
  return out;
}
const reverb = (bus, {room = 0.86, damp = 0.4} = {}) => ({
  L: reverbChannel(bus.L, 0, room, damp),
  R: reverbChannel(bus.R, 23, room, damp),
});

// ---------------------------------------------------------------- music voices
function addPad(buf, notes, t0, t1, gain) {
  const attack = 1.1;
  const release = 1.6;
  const s0 = Math.max(0, Math.floor(t0 * SR));
  const s1 = Math.min(buf.L.length, Math.floor((t1 + release) * SR));
  for (const note of notes) {
    [-0.07, 0, 0.07].forEach((detune, k) => {
      const f = midi(note) * Math.pow(2, detune / 12);
      const [gl, gr] = panGains((k - 1) * 0.55);
      const lfoRate = 0.13 + 0.09 * k;
      const lfoPhase = rand() * TAU;
      let ph = rand();
      for (let s = s0; s < s1; s++) {
        const t = s / SR;
        const up = Math.min(1, (t - t0) / attack);
        const down = t <= t1 ? 1 : Math.max(0, 1 - (t - t1) / release);
        const env = up * down;
        ph += f / SR;
        ph -= Math.floor(ph);
        const wobble = 0.86 + 0.14 * Math.sin(TAU * lfoRate * t + lfoPhase);
        const v = lookup(softSaw, ph) * env * env * wobble * gain;
        buf.L[s] += v * gl;
        buf.R[s] += v * gr;
      }
    });
  }
}

function addBass(buf, note, t0, t1, gain) {
  const f = midi(note);
  const s0 = Math.max(0, Math.floor(t0 * SR));
  const s1 = Math.min(buf.L.length, Math.floor((t1 + 0.5) * SR));
  let ph = 0;
  for (let s = s0; s < s1; s++) {
    const t = s / SR;
    ph += f / SR;
    const tri = 2 * Math.abs(2 * (ph - Math.floor(ph + 0.5))) - 1;
    const wave = tri + 0.35 * Math.sin(TAU * ph * 2) + 0.18 * Math.sin(TAU * ph * 3); // the overtones let phone speakers play it
    const env = Math.min(1, (t - t0) / 0.04) * (t <= t1 ? 0.55 + 0.45 * Math.exp(-(t - t0) / 1.4) : Math.max(0, 1 - (t - t1) / 0.5) * 0.55);
    const v = wave * env * gain;
    buf.L[s] += v;
    buf.R[s] += v;
  }
}

// A soft electric-piano note (two sine waves, one modulating the other).
function addKey(buf, note, t, vel, pan, decay = 0.6) {
  const f = midi(note);
  const dur = decay * 4;
  const s0 = Math.floor(t * SR);
  const s1 = Math.min(buf.L.length, s0 + Math.floor(dur * SR));
  const [gl, gr] = panGains(pan);
  for (let s = s0; s < s1; s++) {
    const x = (s - s0) / SR;
    const index = 1.4 * Math.exp(-x / 0.25);
    const env = Math.min(1, x / 0.004) * Math.exp(-x / decay);
    const v = (Math.sin(TAU * f * x + index * Math.sin(TAU * f * x)) + 0.25 * Math.sin(TAU * f * 2 * x) * Math.exp(-x / 0.2)) * env * vel;
    buf.L[s] += v * gl;
    buf.R[s] += v * gr;
  }
}

function addRiser(buf, t0, t1, gain) {
  const s0 = Math.floor(t0 * SR);
  const s1 = Math.min(buf.L.length, Math.floor(t1 * SR));
  let lp = 0;
  for (let s = s0; s < s1; s++) {
    const p = (s - s0) / (s1 - s0);
    const cutoff = 250 + 7000 * p * p;
    lp += (1 - Math.exp((-TAU * cutoff) / SR)) * (noise() - lp);
    const v = lp * p * p * gain;
    buf.L[s] += v;
    buf.R[s] += v;
  }
}

function addBoom(buf, t, gain) {
  const s0 = Math.floor(t * SR);
  const s1 = Math.min(buf.L.length, s0 + Math.floor(1.6 * SR));
  let ph = 0;
  for (let s = s0; s < s1; s++) {
    const x = (s - s0) / SR;
    ph += (46 + 60 * Math.exp(-x / 0.08)) / SR;
    const v = Math.sin(TAU * ph) * Math.exp(-x / 0.5) * gain;
    buf.L[s] += v;
    buf.R[s] += v;
  }
}

// ---------------------------------------------------------------- the music
function makeMusic() {
  const total = DURATION / FPS;
  const logoAt = T.logo.from / FPS;
  const demoAt = T.demo.from / FPS;
  const hoodAt = T.hood.from / FPS;
  const ctaAt = T.cta.from / FPS;

  const pads = makeBuf(total);
  const keys = makeBuf(total);
  const bass = makeBuf(total);
  const fx = makeBuf(total);

  // pad = chord notes, arp = notes the electric piano walks through, bass = root note (MIDI)
  const CH = {
    // (no very deep notes: phone speakers can't play them, and they muddy headphones)
    Asus2: {pad: [52, 57, 59, 64], arp: [57, 59, 64, 69], bass: 45},
    C: {pad: [55, 60, 64, 67], arp: [72, 76, 79, 84], bass: 48},
    G: {pad: [50, 59, 62, 67], arp: [71, 74, 79, 83], bass: 43},
    Am: {pad: [52, 57, 60, 64], arp: [69, 72, 76, 81], bass: 45},
    F: {pad: [48, 57, 60, 65], arp: [69, 72, 77, 81], bass: 41},
  };
  // The chord changes at the start of the video's sections where it can, so the
  // music turns the corner with the picture.
  const schedule = [
    [0, 'Asus2'], // hook: unresolved, a little uneasy
    [logoAt, 'C'], // logo: it resolves
    [demoAt, 'G'],
    [12, 'Am'],
    [17, 'F'],
    [22, 'C'],
    [26, 'G'],
    [31, 'Am'],
    [36, 'F'],
    [40, 'C'],
    [hoodAt, 'Am'],
    [hoodAt + 3, 'G'],
    [ctaAt, 'C'], // end card: home chord
  ];

  const beat = 60 / 96;
  schedule.forEach(([t0, name], i) => {
    const t1 = i + 1 < schedule.length ? schedule[i + 1][0] : total;
    const c = CH[name];
    const hook = t0 < logoAt;
    addPad(pads, c.pad, t0, t1, hook ? 0.5 : 0.62);
    addBass(bass, c.bass, t0, t1, hook ? 0.25 : 0.34);

    if (!hook) {
      // a gentle arpeggio; it doubles up on the "under the hood" section for momentum
      const step = t0 >= hoodAt && t0 < ctaAt ? beat / 2 : beat;
      const pattern = [0, 2, 3, 2, 1, 2, 3, 2];
      const first = Math.max(t0, logoAt + 0.9);
      let k = 0;
      for (let t = first; t < t1 - 0.05; t += step, k++) {
        const note = c.arp[pattern[k % pattern.length]];
        const accent = k % 4 === 0 ? 1 : 0.72;
        addKey(keys, note, t, 0.62 * accent, ((k % 5) - 2) * 0.22, 0.7);
      }
    }
  });

  // uneasy build into the logo, a lift into "under the hood", and a big finish
  addRiser(fx, logoAt - 1.7, logoAt, 0.55);
  addBoom(fx, logoAt, 0.9);
  for (const n of [72, 76, 79, 84]) addKey(keys, n, logoAt, 0.7, (n - 78) / 20, 1.6);
  addRiser(fx, hoodAt - 1.0, hoodAt, 0.3);
  addRiser(fx, ctaAt - 1.2, ctaAt, 0.45);
  addBoom(fx, ctaAt, 0.8);
  for (const [n, dt] of [[72, 0], [76, 0.06], [79, 0.12], [84, 0.18], [88, 0.3]]) addKey(keys, n, ctaAt + dt, 0.7, (n - 80) / 24, 2.2);

  onePole(pads.L, 2300);
  onePole(pads.R, 2300);

  // a reverb "send": pads and keys go through it, and the result is mixed back in
  const send = makeBuf(total);
  for (let i = 0; i < send.L.length; i++) {
    send.L[i] = pads.L[i] * 0.45 + keys.L[i] * 0.75 + fx.L[i] * 0.35;
    send.R[i] = pads.R[i] * 0.45 + keys.R[i] * 0.75 + fx.R[i] * 0.35;
  }
  const wet = reverb(send);

  const mix = makeBuf(total);
  for (const ch of ['L', 'R']) {
    for (let i = 0; i < mix.L.length; i++) mix[ch][i] = pads[ch][i] + keys[ch][i] + bass[ch][i] + fx[ch][i] + wet[ch][i] * 3.2;
    highPass(mix[ch], 55);
  }

  // a gentle build: quiet unease in the hook, full through the demo, then a lift
  // for "under the hood" and the end card
  const contour = [[0, 0.72], [logoAt - 0.6, 0.78], [logoAt + 0.2, 1], [hoodAt - 0.5, 1], [hoodAt + 0.7, 1.1], [ctaAt - 0.2, 1.1], [ctaAt + 0.6, 1.17]];
  const level = (t) => {
    if (t <= contour[0][0]) return contour[0][1];
    for (let i = 0; i < contour.length - 1; i++) {
      const [ta, ga] = contour[i];
      const [tb, gb] = contour[i + 1];
      if (t <= tb) return ga + ((gb - ga) * (t - ta)) / (tb - ta);
    }
    return contour[contour.length - 1][1];
  };
  for (const ch of ['L', 'R']) for (let i = 0; i < mix[ch].length; i++) mix[ch][i] *= level(i / SR);

  // loudness: set an even, moderate level, then a very light safety limiter
  const rms = Math.sqrt((rmsOf(mix.L) ** 2 + rmsOf(mix.R) ** 2) / 2);
  const gain = 0.17 / rms; // about -16 dBFS on average, close to what feed videos sound like
  for (const ch of ['L', 'R']) {
    for (let i = 0; i < mix[ch].length; i++) mix[ch][i] = Math.tanh(mix[ch][i] * gain * 1.4) / 1.4;
    fade(mix[ch], 0.5, 2.6);
  }
  return mix;
}

// ---------------------------------------------------------------- the small sounds
const render = (seconds, fn) => {
  const n = Math.ceil(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i, n);
  return out;
};
const bell = (f, t, decay, index) => Math.sin(TAU * f * t + index * Math.exp(-t / 0.12) * Math.sin(TAU * f * 3.5 * t)) * Math.exp(-t / decay);
const withReverb = (mono, amount) => {
  const bus = {L: Float32Array.from(mono), R: Float32Array.from(mono)};
  const wet = reverb(bus, {room: 0.8, damp: 0.5});
  const L = new Float32Array(mono.length);
  const R = new Float32Array(mono.length);
  for (let i = 0; i < mono.length; i++) {
    L[i] = mono[i] + wet.L[i] * amount;
    R[i] = mono[i] + wet.R[i] * amount;
  }
  return {L, R};
};
const dry = (mono) => ({L: mono, R: Float32Array.from(mono)});

const sweep = (seconds, cutoffAt, shape) => {
  let low = 0;
  let band = 0;
  return render(seconds, (t, i, n) => {
    const p = i / n;
    const f = 2 * Math.sin((Math.PI * cutoffAt(p)) / SR);
    const high = noise() - low - 0.45 * band;
    band += f * high;
    low += f * band;
    return band * shape(p);
  });
};
const popAt = (semitones) => () => {
  let ph = 0;
  const k = Math.pow(2, semitones / 12);
  return dry(
    render(0.2, (t) => {
      ph += ((280 + 560 * (1 - Math.exp(-t / 0.03))) * k) / SR;
      return Math.sin(TAU * ph) * Math.min(1, t / 0.002) * Math.exp(-t / 0.05);
    }),
  );
};

// [maker, peak level, fade at the end]
const SFX = {
  // a light finger tap
  tap: [() => {
    let ph = 0;
    return dry(render(0.07, (t) => {
      ph += (850 + 1300 * Math.exp(-t / 0.007)) / SR;
      return Math.sin(TAU * ph) * Math.exp(-t / 0.012) + noise() * 0.35 * Math.exp(-t / 0.002);
    }));
  }, 0.5, 0.01],
  // a sheet sliding up
  swish: [() => dry(sweep(0.42, (p) => 300 + 2800 * p * p, (p) => Math.pow(Math.sin(Math.PI * p), 1.6))), 0.35, 0.05],
  // a bigger movement (the phone arriving or leaving)
  whoosh: [() => dry(sweep(0.8, (p) => 200 + 3400 * Math.pow(Math.sin(Math.PI * p), 2), (p) => Math.pow(Math.sin(Math.PI * p), 2))), 0.4, 0.08],
  // a small "something happened" pip
  blip: [() => dry(render(0.14, (t) => Math.sin(TAU * 1046.5 * t) * Math.min(1, t / 0.003) * Math.exp(-t / 0.035) + 0.3 * Math.sin(TAU * 2093 * t) * Math.exp(-t / 0.02))), 0.3, 0.02],
  tick: [() => dry(render(0.03, (t) => Math.sin(TAU * 3200 * t) * Math.exp(-t / 0.006))), 0.22, 0.005],
  // a friendly pop, plus four rising ones for the verdict badges
  pop: [popAt(0), 0.5, 0.03],
  pop1: [popAt(0), 0.5, 0.03],
  pop2: [popAt(2), 0.5, 0.03],
  pop3: [popAt(4), 0.5, 0.03],
  pop4: [popAt(7), 0.5, 0.03],
  // "checked!" -- a short bell, kept under 0.65 s so it is never cut off
  ding: [() => dry(render(0.62, (t) => 0.8 * bell(1318.5, t, 0.16, 1.4) + 0.45 * bell(1975.5, t, 0.1, 1.0))), 0.55, 0.12],
  // the logo and end-card sparkle: four bells climbing, with a soft tail
  chime: [() => {
    const notes = [1046.5, 1318.5, 1568, 2093];
    const mono = render(1.9, (t) => notes.reduce((v, f, k) => (t - k * 0.09 >= 0 ? v + bell(f, t - k * 0.09, 0.42, 1.2) * (0.9 - k * 0.1) : v), 0));
    return withReverb(mono, 2.5);
  }, 0.5, 0.4],
  // a gentle "no": two soft notes going down
  reject: [() => dry(render(0.42, (t) => {
    const a = t < 0.13 ? Math.sin(TAU * 440 * t) * Math.exp(-t / 0.07) : 0;
    const x = t - 0.13;
    const b = x >= 0 ? Math.sin(TAU * 330 * x) * Math.exp(-x / 0.09) : 0;
    return (a + b) * Math.min(1, t / 0.003);
  })), 0.4, 0.06],
};

// ---------------------------------------------------------------- write the files
function writeWav(name, buf) {
  const n = buf.L.length;
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf.L[i])) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf.R[i])) * 32767), i * 4 + 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(2, 22);
  head.writeUInt32LE(SR, 24);
  head.writeUInt32LE(SR * 4, 28);
  head.writeUInt16LE(4, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, `${name}.wav`), Buffer.concat([head, data]));
}

const music = makeMusic();
writeWav('music', music);
console.log(
  `music.wav  ${(music.L.length / SR).toFixed(1)}s  peak ${db(Math.max(peakOf(music.L), peakOf(music.R))).toFixed(1)} dBFS  rms ${db(rmsOf(music.L)).toFixed(1)} dBFS`,
);

for (const [name, [make, peak, tail]] of Object.entries(SFX)) {
  const buf = make();
  const m = Math.max(peakOf(buf.L), peakOf(buf.R));
  for (const ch of ['L', 'R']) {
    for (let i = 0; i < buf[ch].length; i++) buf[ch][i] *= peak / m;
    fade(buf[ch], 0, tail);
  }
  writeWav(name, buf);
  console.log(`${name}.wav`.padEnd(11), `${(buf.L.length / SR).toFixed(2)}s  peak ${db(peak).toFixed(1)} dBFS`);
}
