import React from 'react';
import {ramp} from '../lib/anim';
import {MyPostsBase, OLDER_TILES, type Tile} from './MyPostsBase';
import {PostDetailMock, REJECTED_BODY, REJECTED_PREVIEW, REVIEW_BODY, REVIEW_PREVIEW} from './Sheets';
import {AppScreen, SceneSfx, Tap, useSceneFrame} from './parts';

const SWAP = 92;

/** Scene 04: a myth is rejected with the reason; a borderline post waits for a human. */
export const ProtectScreen: React.FC = () => {
  const f = useSceneFrame();
  const open = ramp(f, 8, 24);
  const review = f >= SWAP;
  // The text inside the sheet dips out and back in as it changes.
  const dip = Math.min(1, Math.abs(f - SWAP) / 6);

  const tiles: Tile[] = [
    {kind: 'text', text: 'Humans only use 10% of their brains', dot: 'rejected'},
    {kind: 'video', hue: 20, dot: 'review'},
    ...OLDER_TILES.slice(0, 7),
  ];

  return (
    <AppScreen>
      <MyPostsBase tiles={tiles}>
        <PostDetailMock
          open={open}
          preview={review ? REVIEW_PREVIEW : REJECTED_PREVIEW}
          status={review ? 'review' : 'rejected'}
          body={<div style={{opacity: dip}}>{review ? REVIEW_BODY : REJECTED_BODY}</div>}
        />
      </MyPostsBase>
      <Tap x={72} y={315} at={2} />
      <SceneSfx name="swish" at={8} />
      <SceneSfx name="reject" at={20} />
      <SceneSfx name="blip" at={SWAP + 2} />
    </AppScreen>
  );
};
