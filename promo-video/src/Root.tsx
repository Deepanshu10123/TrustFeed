import React from 'react';
import {Composition} from 'remotion';
import './fonts';
import {Promo} from './Promo';
import {DURATION, FPS, H, W} from './timeline';

export const Root: React.FC = () => (
  <Composition id="TrustFeedPromo" component={Promo} durationInFrames={DURATION} fps={FPS} width={W} height={H} />
);
