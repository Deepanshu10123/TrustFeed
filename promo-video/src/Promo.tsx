import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import './promo.css';
import {Backdrop} from './components/Backdrop';
import {Cta} from './scenes/Cta';
import {Demo} from './scenes/Demo';
import {Hood} from './scenes/Hood';
import {Hook} from './scenes/Hook';
import {Logo} from './scenes/Logo';
import {T} from './timeline';

/** The whole video, start to finish. See timeline.ts for how long each part runs. */
export const Promo: React.FC = () => (
  <AbsoluteFill className="promo-root">
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
