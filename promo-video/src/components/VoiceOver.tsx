import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import voiceover from '../voiceover.json';
import {FPS} from '../timeline';

type Line = {id: string; at: number; text: string; rate?: string; duration?: number; gain?: number};
const LINES: Line[] = voiceover.lines;

/** The narration: one short clip per line of src/voiceover.json, each starting at
 * its own time. To change the words or the voice, edit that file and see
 * scripts/make-voiceover.py. */
export const VoiceOver: React.FC = () => (
  <>
    {LINES.map((line) => (
      <Sequence key={line.id} from={Math.round(line.at * FPS)} layout="none" name={`voice: ${line.id}`}>
        <Audio src={staticFile(`voice/${line.id}.mp3`)} volume={line.gain ?? 1} />
      </Sequence>
    ))}
  </>
);

// While someone is talking the music drops to this fraction of its level...
const MUSIC_UNDER_VOICE = 0.4;
// ...quickly before the voice starts, and back up a little more slowly after it stops.
const EASE_DOWN = 0.35;
const EASE_UP = 0.6;
// Voice lines closer together than this are treated as one stretch of talking, so the
// music doesn't pump up and down between sentences.
const MERGE_GAP = 1.7;

const talking: [number, number][] = [];
for (const line of LINES) {
  const from = line.at;
  const to = line.at + (line.duration ?? 3);
  const last = talking[talking.length - 1];
  if (last && from - last[1] < MERGE_GAP) last[1] = Math.max(last[1], to);
  else talking.push([from, to]);
}

/** How loud the music should be at this frame, as a fraction: 1 when nobody is
 * talking, lower while the narration is on. */
export function musicLevel(frame: number): number {
  const t = frame / FPS;
  let quiet = 0;
  for (const [from, to] of talking) {
    const down = Math.min(1, Math.max(0, (t - (from - EASE_DOWN)) / EASE_DOWN));
    const up = Math.min(1, Math.max(0, (to + EASE_UP - t) / EASE_UP));
    quiet = Math.max(quiet, Math.min(down, up));
  }
  return 1 - (1 - MUSIC_UNDER_VOICE) * quiet;
}
