import React from 'react';
import {useCurrentFrame} from 'remotion';
import {MOON} from '../content';
import {ramp} from '../lib/anim';
import {MyPostsBase, OLDER_TILES, type Tile} from './MyPostsBase';
import {PostDetailMock} from './Sheets';
import {AppScreen, SceneSfx, Tap, useSceneFrame} from './parts';

// The live progress lines, word for word what the app's worker sends.
const preview = (claim: string): string => (claim.length <= 70 ? claim : claim.slice(0, 67) + '...');

export const CHECK_MESSAGES = [
  {at: 24, text: 'Downloading video...'},
  {at: 46, text: 'Watching the video and extracting claims...'},
  {at: 82, text: `Found ${MOON.claims.length} claim(s) to check.`},
  {at: 100, text: `Researching claim 1 of ${MOON.claims.length}: ${preview(MOON.claims[0])}`},
  {at: 128, text: `Researching claim 2 of ${MOON.claims.length}: ${preview(MOON.claims[1])}`},
  {at: 158, text: `Scoring relevance to '${MOON.topic}'...`},
  {at: 180, text: 'Making final decision...'},
];
export const CHECK_DONE = 198;

/** Scene 02: the post is "Processing" while the agents report what they're doing. */
export const CheckScreen: React.FC = () => {
  const f = useSceneFrame();
  const open = ramp(f, 8, 24);
  const done = f >= CHECK_DONE;
  const current = CHECK_MESSAGES.reduce((found, m, i) => (f >= m.at ? i : found), -1);
  const message = current >= 0 ? CHECK_MESSAGES[current] : null;

  // The new video first (newest posts come first), then the older ones.
  const tiles: Tile[] = [{kind: 'video', hue: 265, moon: true, dot: done ? 'published' : 'processing'}, ...OLDER_TILES];

  return (
    <AppScreen>
      <MyPostsBase tiles={tiles}>
        <PostDetailMock
          open={open}
          preview={`${MOON.topic} · video post`}
          status={done ? 'published' : 'processing'}
          body={
            !done && message ? (
              <div className="status-sub" style={{opacity: ramp(f, message.at, message.at + 6), fontSize: 14.5, color: 'var(--text)'}}>
                {message.text}
              </div>
            ) : null
          }
        />
      </MyPostsBase>
      <Tap x={72} y={315} at={2} />
      <SceneSfx name="swish" at={8} />
      {/* a small pip each time the agents report a new step, and a bell when the post is published */}
      {CHECK_MESSAGES.map((m) => (
        <SceneSfx key={m.at} name="blip" at={m.at} volume={0.55} />
      ))}
      <SceneSfx name="ding" at={CHECK_DONE} />
    </AppScreen>
  );
};

const STEPS = [
  {label: 'Watch', from: 24, to: 82},
  {label: 'Search', from: 82, to: 158},
  {label: 'Score', from: 158, to: 180},
  {label: 'Decide', from: 180, to: CHECK_DONE},
];

/** The four steps under the headline, lighting up in time with the phone. */
export const Steps: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <div className="promo-steps">
      {STEPS.map((s, i) => {
        const state = f >= s.to ? 'done' : f >= s.from ? 'active' : '';
        return (
          <div key={s.label} className={`promo-step ${state}`}>
            {state === 'done' ? (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : (
              <span style={{opacity: 0.7}}>{i + 1}</span>
            )}
            {s.label}
          </div>
        );
      })}
    </div>
  );
};
