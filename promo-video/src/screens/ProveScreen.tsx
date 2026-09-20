import React from 'react';
import {ramp} from '../lib/anim';
import {Reel} from './Reel';
import {EvidenceSheetMock} from './Sheets';
import {AppScreen, SceneSfx, Tap, useSceneFrame} from './parts';

// The tap waits until the narration says "tap the badge" (see src/voiceover.json).
const TAP = 68;
const SHEET = TAP + 6;

/** Scene 03: the reel with its verdict badge; tapping it opens the evidence. */
export const ProveScreen: React.FC = () => {
  const f = useSceneFrame();
  const open = ramp(f, SHEET, SHEET + 16);
  return (
    <AppScreen>
      <Reel variant="moon" />
      <EvidenceSheetMock f={f - (SHEET + 4)} open={open} />
      <Tap x={146} y={622} at={TAP} />
      <SceneSfx name="swish" at={SHEET} />
    </AppScreen>
  );
};
