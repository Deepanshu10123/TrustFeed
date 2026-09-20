// The last step of `npm run render`. Measures how loud the rendered video is and
// lifts it to about -16 LUFS (what most feed videos sound like) with a ceiling of
// -1.5 dB so nothing distorts when LinkedIn re-encodes it. The picture is copied
// across untouched; only the sound is re-encoded. Uses the ffmpeg that comes with Remotion.
//
//   out/trustfeed-raw.mp4  ->  out/trustfeed-promo.mp4
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const input = path.resolve('out/trustfeed-raw.mp4');
const output = path.resolve('out/trustfeed-promo.mp4');
const TARGET_LUFS = -16;
const TRUE_PEAK_DB = -1.5;
const LOUDNESS_RANGE = 11;

const ffmpeg = (args) => {
  const r = spawnSync('npx', ['remotion', 'ffmpeg', ...args], {shell: true, encoding: 'utf8', maxBuffer: 1 << 26});
  if (r.status !== 0) throw new Error(`ffmpeg failed:\n${r.stderr}`);
  return r.stderr;
};
const measureJson = (file) => {
  const log = ffmpeg(['-hide_banner', '-nostats', '-i', `"${file}"`, '-vn', '-af', `loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK_DB}:LRA=${LOUDNESS_RANGE}:print_format=json`, '-f', 'null', '-']);
  return JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
};

if (!fs.existsSync(input)) throw new Error(`${input} not found -- render first`);

const before = measureJson(input);
console.log(`before: ${before.input_i} LUFS, true peak ${before.input_tp} dB, range ${before.input_lra} LU`);

const filter = [
  `loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK_DB}:LRA=${LOUDNESS_RANGE}`,
  `measured_I=${before.input_i}`,
  `measured_TP=${before.input_tp}`,
  `measured_LRA=${before.input_lra}`,
  `measured_thresh=${before.input_thresh}`,
  `offset=${before.target_offset}`,
  'linear=true',
].join(':');
ffmpeg(['-y', '-v', 'error', '-i', `"${input}"`, '-c:v', 'copy', '-af', filter, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', `"${output}"`]);

const after = measureJson(output);
console.log(`after:  ${after.input_i} LUFS, true peak ${after.input_tp} dB, range ${after.input_lra} LU  ->  ${path.relative(process.cwd(), output)}`);
