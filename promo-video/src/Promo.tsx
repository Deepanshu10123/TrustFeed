import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import './promo.css';
import {Backdrop} from './components/Backdrop';
import {VoiceOver, musicLevel} from './components/VoiceOver';
import {Cta} from './scenes/Cta';
import {Demo} from './scenes/Demo';
import {Hood} from './scenes/Hood';
import {Hook} from './scenes/Hook';
import {Logo} from './scenes/Logo';
import {T} from './timeline';

/** The whole video, start to finish. See timeline.ts for how long each part runs. */
export const Promo: React.FC = () => (
  <AbsoluteFill className="promo-root">
    {/* The music bed, made by scripts/make-audio.mjs. It turns the corner with the
        picture: uneasy in the hook, resolving at the logo, lifting for the end -- and
        it dips whenever the narration is speaking. */}
    <Audio src={staticFile('audio/music.wav')} volume={(frame) => 0.8 * musicLevel(frame)} />
    <VoiceOver />
    <Backdrop />
    <Sequence from={T.hook.from} durationInFrames={T.hook.dur} name="Hook">
      <Hook />
    </Sequence>
    <Sequence from={T.logo.from} durationInFrames={T.logo.dur} name="Logo">
      <Logo />
    </Sequence>
    <Sequence from={T.demo.from} durationInFrames={T.demo.dur} name="Phone demo">
      <Demo />
    </Sequence>
    <Sequence from={T.hood.from} durationInFrames={T.hood.dur} name="Under the hood">
      <Hood />
    </Sequence>
    <Sequence from={T.cta.from} durationInFrames={T.cta.dur} name="End card">
      <Cta />
    </Sequence>
  </AbsoluteFill>
);
