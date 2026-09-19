import React from 'react';
import {useExit, useReveal} from '../lib/anim';
import {Words} from './Words';

/** The numbered headline above the phone. Place it inside a <Sequence> for its
 * scene -- it fades in on the first frame and out on the last. */
export const Caption: React.FC<{
  eyebrow: string;
  headline: string;
  sub?: React.ReactNode;
}> = ({eyebrow, headline, sub}) => {
  const exit = useExit(8);
  const eyebrowStyle = useReveal(0, 12);
  const subStyle = useReveal(16, 14);
  return (
    <div className="promo-caption" style={{opacity: exit, transform: `translateY(${-(1 - exit) * 14}px)`}}>
      <div className="promo-eyebrow" style={eyebrowStyle}>
        {eyebrow}
      </div>
      <h1 className="promo-headline">
        <Words text={headline} start={3} />
      </h1>
      {sub && (
        <div className="promo-sub" style={subStyle}>
          {sub}
        </div>
      )}
    </div>
  );
};
