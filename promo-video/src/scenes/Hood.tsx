import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Words} from '../components/Words';
import {TECH} from '../content';
import {useExit, usePop, useReveal} from '../lib/anim';

const Card: React.FC<{n: number; title: string; start: number; children: React.ReactNode}> = ({n, title, start, children}) => {
  const p = usePop(start, {damping: 18, stiffness: 130, mass: 0.8});
  return (
    <div className="promo-card" style={{opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 40}px)`}}>
      <div className="promo-card-num">{n}</div>
      <div style={{flex: 1}}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
};

const Rule: React.FC<{tone: 'supported' | 'mixed' | 'unsupported'; start: number; children: React.ReactNode}> = ({tone, start, children}) => {
  const style = useReveal(start, 10);
  return (
    <span className="promo-rule" style={{...style, background: `var(--${tone}-bg)`, color: `var(--${tone}-fg)`}}>
      {children}
    </span>
  );
};

/** 0:43 -- for the engineers watching: how the decision is actually made. */
export const Hood: React.FC = () => {
  const exit = useExit(8);
  const eyebrow = useReveal(0, 12);
  const chips = useReveal(128, 16);
  return (
    <AbsoluteFill style={{opacity: exit}}>
      <div className="promo-caption">
        <div className="promo-eyebrow" style={eyebrow}>
          07 · Under the hood
        </div>
        <h1 className="promo-headline">
          <Words text="Two scores.|[[One clear decision.]]" start={3} />
        </h1>
      </div>

      <div style={{position: 'absolute', left: 72, right: 72, top: 322, display: 'flex', flexDirection: 'column', gap: 26}}>
        <Card n={1} title="You post" start={14}>
          <p>A video or some text, tagged with a topic.</p>
        </Card>
        <Card n={2} title="AI agents check it" start={36}>
          <p>Gemini watches the video and pulls out the claims. Tavily searches the web for proof.</p>
        </Card>
        <Card n={3} title="Two scores decide" start={62}>
          <p>Is it on topic (0-100)? Do its claims hold up?</p>
          <Rule tone="supported" start={84}>
            60+ published
          </Rule>
          <Rule tone="mixed" start={92}>
            40-59 a human looks
          </Rule>
          <Rule tone="unsupported" start={100}>
            any unsupported claim: rejected
          </Rule>
        </Card>
        <Card n={4} title="It reaches the feed" start={112}>
          <p>With its verdict and its sources attached.</p>
        </Card>
      </div>

      <div style={{...chips, position: 'absolute', left: 72, right: 72, bottom: 64, display: 'flex', flexWrap: 'wrap', gap: 12}}>
        {TECH.map((t) => (
          <span key={t} className="promo-chip">
            {t}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
