import React from 'react';
import {ramp} from '../lib/anim';
import {Reel} from './Reel';
import {EvidenceSheetMock} from './Sheets';
import {AppScreen, Tap, useSceneFrame} from './parts';

/** Scene 03: the reel with its verdict badge; tapping it opens the evidence. */
export const ProveScreen: React.FC = () => {
  const f = useSceneFrame();
  const open = ramp(f, 40, 56);
  return (
    <AppScreen>
      <Reel variant="moon" />
      <EvidenceSheetMock f={f - 44} open={open} />
      <Tap x={146} y={622} at={34} />
    </AppScreen>
  );
};
