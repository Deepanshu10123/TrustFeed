import React, {useId} from 'react';
import {useCurrentFrame} from 'remotion';
import {easeInOut, ramp} from '../lib/anim';

/** The app's loading mark: a check drawing itself inside a ring -- "checked" is
 * the whole idea of TrustFeed. */
export const LogoMark: React.FC<{size: number; start?: number}> = ({size, start = 0}) => {
  const frame = useCurrentFrame();
  const ring = ramp(frame, start, start + 22, easeInOut);
  const check = ramp(frame, start + 16, start + 36, easeInOut);
  const glow = ramp(frame, start + 30, start + 52);
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{overflow: 'visible', filter: `drop-shadow(0 0 ${30 * glow}px oklch(72% 0.1 262 / 0.55))`}}
    >
      <circle
        cx="32"
        cy="32"
        r="27"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - ring}
        opacity={ring > 0 ? 1 : 0}
        transform="rotate(-90 32 32)"
      />
      <path d="M20 33.5l8.5 8.5L44 24" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - check} opacity={check > 0 ? 1 : 0} />
    </svg>
  );
};

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** "TrustFeed" in the app's serif, with a light sweeping across it once.
 *
 * Drawn as SVG text with a gradient fill rather than CSS `background-clip: text`:
 * when a video is rendered frame after frame, Chrome stops re-clipping that
 * background and the word turns into a solid box. SVG text redraws every frame. */
export const Wordmark: React.FC<{size: number; start?: number}> = ({size, start = 0}) => {
  const frame = useCurrentFrame();
  const gradientId = useId();
  const p = ramp(frame, start, start + 18);
  const sweep = ramp(frame, start + 6, start + 46, easeInOut);
  const lit = ramp(frame, start + 40, start + 62);
  const dim = `color-mix(in oklch, var(--text) ${Math.round(lit * 100)}%, var(--text-tertiary))`;
  // Centre of the bright band as a fraction of the word's width; it starts off the left edge and ends off the right.
  const centre = -0.25 + sweep * 1.5;
  const width = size * 5.6;
  const height = size * 1.05;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{display: 'block', overflow: 'visible', opacity: p, transform: `translateY(${(1 - p) * 24}px)`}}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset={clamp01(centre - 0.18)} style={{stopColor: dim}} />
          <stop offset={clamp01(centre)} style={{stopColor: 'var(--text)'}} />
          <stop offset={clamp01(centre + 0.18)} style={{stopColor: dim}} />
        </linearGradient>
      </defs>
      <text
        x={width / 2}
        y={size * 0.84}
        textAnchor="middle"
        fill={`url(#${gradientId})`}
        style={{fontFamily: "'Source Serif Four', serif", fontWeight: 600, fontSize: size, letterSpacing: '0.005em'}}
      >
        TrustFeed
      </text>
    </svg>
  );
};
