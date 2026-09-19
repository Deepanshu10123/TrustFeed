import React from 'react';
import {AbsoluteFill} from 'remotion';
import {LogoMark, Wordmark} from '../components/Brand';
import {SITE} from '../content';
import {usePop, useReveal} from '../lib/anim';

/** The end card: the name, the promise, and where to try it. */
export const Cta: React.FC = () => {
  const tagline = useReveal(24, 16);
  const pop = usePop(40, {damping: 15, stiffness: 140, mass: 0.8});
  const line1 = useReveal(62, 14);
  const line2 = useReveal(76, 14);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: -30}}>
        <LogoMark size={190} />
        <div style={{marginTop: 34}}>
          <Wordmark size={150} start={10} />
        </div>
        <div style={{...tagline, marginTop: 20, font: "400 44px/1.3 'Public Sans', sans-serif", color: 'var(--text-secondary)'}}>{SITE.tagline}</div>

        <div
          style={{
            marginTop: 70,
            padding: '30px 54px',
            borderRadius: 999,
            background: 'var(--btn-bg)',
            color: 'var(--btn-fg)',
            font: "700 46px/1 'Public Sans', sans-serif",
            opacity: Math.min(1, pop * 1.5),
            transform: `scale(${0.85 + 0.15 * pop})`,
            boxShadow: '0 20px 70px oklch(72% 0.1 262 / 0.25)',
          }}
        >
          {SITE.url}
        </div>

        <div style={{...line1, marginTop: 56, font: "500 34px/1.3 'Public Sans', sans-serif", color: 'var(--text)'}}>
          Designed, built and shipped solo by {SITE.author}.
        </div>
        <div style={{...line2, marginTop: 12, font: "400 32px/1.3 'Public Sans', sans-serif", color: 'var(--text-secondary)'}}>
          Try it and tell me what you think.
        </div>
      </div>
    </AbsoluteFill>
  );
};
