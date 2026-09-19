import React from 'react';
import {ramp} from '../lib/anim';
import {Reel} from './Reel';
import {ProfileSheetMock, ReportSheetMock} from './Sheets';
import {AppScreen, Tap, useSceneFrame} from './parts';

/** Scene 06: open a profile and follow, then report a post. */
export const CommunityScreen: React.FC = () => {
  const f = useSceneFrame();
  const profileOpen = ramp(f, 16, 30) * (1 - ramp(f, 80, 92));
  const following = f >= 56;
  const reportOpen = ramp(f, 102, 116) * (1 - ramp(f, 150, 160));
  const reasonPicked = f >= 128;
  const sending = f >= 144;
  const toast = f >= 154;

  return (
    <AppScreen>
      <Reel variant="octopus" liked likes={25} />
      <ProfileSheetMock open={profileOpen} following={following} />
      <ReportSheetMock open={reportOpen} selected={reasonPicked} sending={sending} />
      {toast && <div className="feed-toast">Thanks for reporting. It's off your feed now.</div>}
      <Tap x={90} y={588} at={12} />
      <Tap x={63} y={262} at={52} />
      <Tap x={326} y={33} at={98} />
      <Tap x={180} y={380} at={124} />
      <Tap x={180} y={745} at={140} />
    </AppScreen>
  );
};
