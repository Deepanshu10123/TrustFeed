import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

/** The dark canvas with a soft blue glow that drifts slowly, like the link card. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 110) * 6;
  return (
    <AbsoluteFill style={{background: 'var(--bg)'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1000px 760px at ${86 + drift}% -6%, oklch(33% 0.075 262 / 0.6), transparent 70%), radial-gradient(900px 700px at ${-4 - drift}% 104%, oklch(27% 0.055 262 / 0.5), transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};
