import React from 'react';
import {AbsoluteFill} from 'remotion';
import {LogoMark, Wordmark} from '../components/Brand';
import {BADGE_CLASS, SITE, type VerdictLabel} from '../content';
import {usePop, useExit, useReveal} from '../lib/anim';

const LABELS: VerdictLabel[] = ['Well Supported', 'Mixed Evidence', 'Unsupported', 'Unable to Verify'];

const PopBadge: React.FC<{label: VerdictLabel; start: number}> = ({label, start}) => {
  const p = usePop(start);
  return (
    <span className={`promo-badge badge ${BADGE_CLASS[label]}`} style={{opacity: Math.min(1, p * 1.4), transform: `scale(${0.7 + 0.3 * p})`}}>
      {label}
    </span>
  );
};

/** 0:03 -- the brand: the check draws itself, the name appears, the four verdicts. */
export const Logo: React.FC = () => {
  const exit = useExit(8);
  const eyebrow = useReveal(26, 12);
  const tagline = useReveal(52, 16);
  return (
    <AbsoluteFill style={{opacity: exit, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: -40}}>
        <LogoMark size={250} />
        <div className="promo-eyebrow" style={{...eyebrow, marginTop: 46, marginBottom: 14, color: 'var(--text-secondary)'}}>
          Verified feed
        </div>
        <Wordmark size={176} start={30} />
        <div style={{...tagline, marginTop: 22, font: "400 46px/1.3 'Public Sans', sans-serif", color: 'var(--text-secondary)'}}>{SITE.tagline}</div>
        <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 64, width: 900}}>
          {LABELS.map((label, i) => (
            <PopBadge key={label} label={label} start={72 + i * 7} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
