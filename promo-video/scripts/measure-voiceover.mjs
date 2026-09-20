// Measures every voice-over file (how long the speech lasts, how loud it is), works
// out a gain that makes all the lines sound equally loud, and saves both into
// src/voiceover.json. It also warns when a line runs into the next one or past the
// end of its scene. Uses the ffmpeg that comes with Remotion.
//
//   node scripts/measure-voiceover.mjs
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DEMO_SCENES, FPS, SC, T} from '../src/timeline.ts';

const file = path.resolve('src/voiceover.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const SR = 24000;
const TARGET_RMS_DB = -18; // how loud the voice is while it is speaking
const PEAK_LIMIT = 0.7; // about -3 dBFS
const MAX_GAIN = 1; // Remotion's preview can't go above 1, so no line is ever made louder than it came

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

// Remotion's ffmpeg is a small build: it can write WAV files but not raw audio to a pipe.
function decode(mp3) {
  const tmp = path.join(os.tmpdir(), `voiceover-measure-${process.pid}.wav`);
  execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-v', 'error', '-i', `"${mp3}"`, '-map_metadata', '-1', '-ac', '1', '-ar', String(SR), '-acodec', 'pcm_s16le', `"${tmp}"`], {
    shell: true,
  });
  const wav = fs.readFileSync(tmp);
  fs.rmSync(tmp);
  // find the "data" chunk instead of assuming a 44-byte header
  let pos = 12;
  while (pos + 8 <= wav.length && wav.toString('ascii', pos, pos + 4) !== 'data') pos += 8 + wav.readUInt32LE(pos + 4);
  const start = pos + 8;
  const samples = new Float32Array(Math.floor((wav.length - start) / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = wav.readInt16LE(start + i * 2) / 32768;
  return samples;
}

function measure(samples) {
  const win = Math.floor(0.02 * SR);
  let first = -1;
  let last = -1;
  let energy = 0;
  let count = 0;
  let peak = 0;
  for (let s = 0; s + win <= samples.length; s += win) {
    let e = 0;
    for (let i = s; i < s + win; i++) {
      e += samples[i] * samples[i];
      peak = Math.max(peak, Math.abs(samples[i]));
    }
    const rms = Math.sqrt(e / win);
    if (db(rms) > -45) {
      if (first < 0) first = s;
      last = s + win;
      if (db(rms) > -38) {
        energy += e;
        count += win;
      }
    }
  }
  return {lead: first / SR, end: last / SR, activeRms: Math.sqrt(energy / Math.max(1, count)), peak};
}

const scenes = [
  ['hook', T.hook.from / FPS, (T.hook.from + T.hook.dur) / FPS],
  ['logo', T.logo.from / FPS, (T.logo.from + T.logo.dur) / FPS],
  ...DEMO_SCENES.map(({id}) => [id, (T.demo.from + SC[id].start) / FPS, (T.demo.from + SC[id].start + SC[id].dur) / FPS]),
  ['hood', T.hood.from / FPS, (T.hood.from + T.hood.dur) / FPS],
  ['cta', T.cta.from / FPS, (T.cta.from + T.cta.dur) / FPS],
];
const sceneAt = (t) => scenes.find(([, a, b]) => t >= a && t < b)?.[0] ?? '?';

console.log('id'.padEnd(14), 'starts'.padStart(6), 'ends'.padStart(6), 'speech'.padStart(7), 'lead'.padStart(6), 'rms dB'.padStart(7), 'gain'.padStart(6), ' scene');
data.lines.forEach((line, i) => {
  const mp3 = path.resolve('public/voice', `${line.id}.mp3`);
  const m = measure(decode(mp3));
  const speech = m.end - m.lead;
  line.duration = Math.round(m.end * 100) / 100; // from the start of the file to the last audible sound
  line.gain = Math.round(Math.min(10 ** ((TARGET_RMS_DB - db(m.activeRms)) / 20), PEAK_LIMIT / m.peak, MAX_GAIN) * 1000) / 1000;

  const start = line.at + m.lead;
  const end = line.at + m.end;
  const next = data.lines[i + 1];
  const notes = [];
  if (next && end > next.at - 0.1) notes.push(`RUNS INTO "${next.id}" (starts ${next.at})`);
  if (sceneAt(start) !== sceneAt(end - 0.05)) notes.push(`spills from ${sceneAt(start)} into ${sceneAt(end - 0.05)}`);
  console.log(
    line.id.padEnd(14),
    start.toFixed(2).padStart(6),
    end.toFixed(2).padStart(6),
    speech.toFixed(2).padStart(7),
    m.lead.toFixed(2).padStart(6),
    db(m.activeRms).toFixed(1).padStart(7),
    String(line.gain).padStart(6),
    ' ' + sceneAt(start),
    notes.length ? ' <-- ' + notes.join('; ') : '',
  );
});

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log('\nscene boundaries (s):', scenes.map(([n, a]) => `${n} ${a.toFixed(1)}`).join('  |  '));
