import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Words} from '../components/Words';
import {useExit, useReveal} from '../lib/anim';

const COLUMNS = [
  {x: 12, speed: 1.3, heights: [420, 300, 460, 340, 400, 320, 440, 360]},
  {x: 368, speed: 2.1, heights: [340, 440, 300, 420, 360, 460, 320, 400]},
  {x: 724, speed: 0.9, heights: [400, 340, 440, 300, 380, 420, 320, 450]},
];
const GAP = 22;

/** Endless faint cards drifting upward -- the feeds everyone already scrolls. */
const ScrollingCards: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{opacity: 0.55, filter: 'blur(1.5px)'}}>
      {COLUMNS.map((col, ci) => {
        const cycle = col.heights.reduce((sum, h) => sum + h + GAP, 0);
        const offset = (frame * col.speed * 2.2 + ci * 240) % cycle;
        return (
          <div key={ci} style={{position: 'absolute', left: col.x, top: 0, width: 344, transform: `translateY(${-offset}px)`}}>
            {[...col.heights, ...col.heights, ...col.heights].map((h, i) => (
              <div
                key={i}
                style={{
                  height: h,
                  marginBottom: GAP,
                  borderRadius: 30,
                  background: 'oklch(19% 0.01 262 / 0.9)',
                  border: '1px solid oklch(29% 0.012 262)',
                }}
              />
            ))}
          </div>
        );
      })}
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 45% at 40% 52%, oklch(9% 0.004 260 / 0.93) 30%, oklch(9% 0.004 260 / 0.2) 100%)'}} />
    </AbsoluteFill>
  );
};

/** 0:00 -- the question that makes someone stop scrolling. */
export const Hook: React.FC = () => {
  const exit = useExit(8);
  const sub = useReveal(52, 20);
  return (
    <AbsoluteFill style={{opacity: exit}}>
      <ScrollingCards />
      <div style={{position: 'absolute', left: 72, right: 72, top: 400}}>
        <h1 className="promo-hook">
          <Words text="Is what|you're scrolling|[[actually true?]]" start={6} stagger={4} />
        </h1>
        <p className="promo-hook-sub" style={sub}>
          Most feeds <span className="hl-bad">never check.</span>
        </p>
      </div>
    </AbsoluteFill>
  );
};
