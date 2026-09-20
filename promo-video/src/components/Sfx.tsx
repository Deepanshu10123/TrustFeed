import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';

export type SfxName =
  | 'tap'
  | 'swish'
  | 'whoosh'
  | 'blip'
  | 'tick'
  | 'pop'
  | 'pop1'
  | 'pop2'
  | 'pop3'
  | 'pop4'
  | 'ding'
  | 'chime'
  | 'reject';

/** A short sound that starts `at` frames into the scene it is placed in. The
 * sounds themselves are made by scripts/make-audio.mjs (run `npm run audio`). */
export const Sfx: React.FC<{name: SfxName; at: number; volume?: number}> = ({name, at, volume = 0.8}) => (
  <Sequence from={Math.round(at)} layout="none" name={`sound: ${name}`}>
    <Audio src={staticFile(`audio/${name}.wav`)} volume={volume} />
  </Sequence>
);
