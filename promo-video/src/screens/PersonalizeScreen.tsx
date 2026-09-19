import React from 'react';
import {easeInOut, ramp} from '../lib/anim';
import {Reel} from './Reel';
import {AppScreen, Header, TabBar, Tap, useSceneFrame} from './parts';

const TOPICS = ['space', 'science', 'history', 'nutrition', 'technology', 'wildlife', 'sports', 'politics', 'finance', 'health', 'psychology', 'culture'];
// The frame each topic gets ticked.
const TICKS: Record<string, number> = {space: 26, science: 44, technology: 62};
const SAVE_TAP = 96;
const SWITCH = 116;

const Interests: React.FC<{f: number}> = ({f}) => {
  const scroll = 139 * ramp(f, 68, 90, easeInOut); // as far as the list can scroll, so the Save button is fully in view
  const saving = f >= SAVE_TAP + 2 && f < SAVE_TAP + 8;
  const saved = f >= SAVE_TAP + 8;
  return (
    <>
      <Header title="Interests" gear={false} />
      <div className="app-content">
        <div className="panel-padding">
          <div style={{display: 'flex', flexDirection: 'column', gap: 22, transform: `translateY(${-scroll}px)`}}>
            <div className="interests-hint">Pick what you want to see. Leave everything unchecked to see the full, unfiltered feed.</div>
            <div className="interests-list">
              {TOPICS.map((topic) => {
                const checked = topic in TICKS && f >= TICKS[topic];
                return (
                  <div key={topic} className={`interest-row ${checked ? 'checked' : ''}`}>
                    {topic[0].toUpperCase() + topic.slice(1)}
                    <span className="interest-check">
                      {checked && (
                        <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 10.5l3.5 3.5L16 6" />
                        </svg>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            <button className="btn-primary" type="button">
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save interests'}
            </button>
          </div>
        </div>
      </div>
      <TabBar active={null} />
      <Tap x={324} y={174} at={TICKS.space - 4} />
      <Tap x={324} y={225} at={TICKS.science - 4} />
      <Tap x={324} y={380} at={TICKS.technology - 4} />
      <Tap x={180} y={675} at={SAVE_TAP} />
    </>
  );
};

/** Scene 05: choose interests, then the feed opens and a post gets a like. */
export const PersonalizeScreen: React.FC = () => {
  const f = useSceneFrame();
  const onFeed = f >= SWITCH;
  const liked = f >= 140;
  return (
    <AppScreen>
      {onFeed ? <Reel variant="octopus" liked={liked} likes={liked ? 25 : 24} /> : <Interests f={f} />}
      {onFeed && <Tap x={318} y={502} at={136} />}
    </AppScreen>
  );
};
