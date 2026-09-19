import React from 'react';
import {Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {BADGE_CLASS, type VerdictLabel} from '../content';
import {linear, ramp} from '../lib/anim';

/** Frames each screen sits in the phone before/after its own scene, so the old
 * one can fade out and the new one fade in. */
export const OV = 8;

/** The frame counted from the moment this screen's scene starts (0 = its first beat). */
export const useSceneFrame = (): number => useCurrentFrame() - OV;

const SlotFade: React.FC<{fadeIn: boolean; fadeOut: boolean; children: React.ReactNode}> = ({fadeIn, fadeOut, children}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  // A quick dip through the phone's dark screen: the old screen fades out, then
  // the new one fades in (two screens' text on top of each other looks messy).
  const inn = fadeIn ? ramp(frame, OV, OV * 2, linear) : 1;
  const out = fadeOut ? 1 - ramp(frame, durationInFrames - OV * 2, durationInFrames - OV, linear) : 1;
  return <div style={{position: 'absolute', inset: 0, opacity: Math.min(inn, out)}}>{children}</div>;
};

/** Puts one screen on the phone for its scene, dipping through dark to the next. */
export const ScreenSlot: React.FC<{
  start: number;
  dur: number;
  fadeIn?: boolean;
  fadeOut?: boolean;
  children: React.ReactNode;
}> = ({start, dur, fadeIn = true, fadeOut = true, children}) => (
  <Sequence from={start - OV} durationInFrames={dur + OV * 2} layout="none">
    <SlotFade fadeIn={fadeIn} fadeOut={fadeOut}>
      {children}
    </SlotFade>
  </Sequence>
);

/** The app's own frame (header, content, tab bar), at a fixed phone size. */
export const AppScreen: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div className="phone-frame promo-screen">{children}</div>
);

const GearIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);

export const Header: React.FC<{title: string; gear?: boolean}> = ({title, gear = true}) => (
  <div className="app-header">
    <div className="header-text">
      <div className="eyebrow">TrustFeed</div>
      <div className="title">{title}</div>
    </div>
    <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
      {gear && (
        <button className="sign-out-btn" type="button">
          <GearIcon />
        </button>
      )}
      <button className="sign-out-btn" type="button">
        Sign out
      </button>
    </div>
  </div>
);

export const TabBar: React.FC<{active: 'feed' | 'upload' | 'myposts' | null}> = ({active}) => (
  <div className="tab-bar">
    <button className={`tab-btn ${active === 'feed' ? 'active' : ''}`} type="button">
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="16" y2="12" />
        <line x1="4" y1="17" x2="12" y2="17" />
      </svg>
      <span className="label">Feed</span>
    </button>
    <button className={`tab-btn ${active === 'upload' ? 'active' : ''}`} type="button">
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
      <span className="label">Upload</span>
    </button>
    <button className={`tab-btn ${active === 'myposts' ? 'active' : ''}`} type="button">
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
      </svg>
      <span className="label">My Posts</span>
    </button>
  </div>
);

/** A finger tap: a ring that grows and fades where (x, y) is on the phone screen. */
export const Tap: React.FC<{x: number; y: number; at: number}> = ({x, y, at}) => {
  const f = useSceneFrame();
  const t = (f - at) / 16;
  if (t < 0 || t > 1) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 24,
        top: y - 24,
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.26)',
        border: '2px solid rgba(255,255,255,0.85)',
        transform: `scale(${0.5 + t * 0.8})`,
        opacity: 1 - t * t,
        zIndex: 200,
        pointerEvents: 'none',
      }}
    />
  );
};

export const VerdictBadge: React.FC<{label: VerdictLabel; chevron?: boolean}> = ({label, chevron = false}) => (
  <span className={`badge ${BADGE_CLASS[label]}`}>
    {label}
    {chevron && (
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    )}
  </span>
);

export type Status = 'processing' | 'published' | 'rejected' | 'review';

export const StatusBadge: React.FC<{status: Status}> = ({status}) => {
  const frame = useCurrentFrame();
  if (status === 'processing') {
    return (
      <span className="status-badge processing">
        <span className="spin" style={{transform: `rotate(${frame * 14}deg)`}} />
        Processing
      </span>
    );
  }
  const label = {published: 'Published', rejected: 'Rejected', review: 'Needs Review'}[status];
  return <span className={`status-badge ${status}`}>{label}</span>;
};

/** A bottom sheet over the screen, sliding up as `open` goes 0 -> 1. */
export const Sheet: React.FC<{
  open: number;
  title: string;
  tall?: boolean;
  height?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}> = ({open, title, tall = false, height, footer, children}) => {
  if (open <= 0.001) return null;
  return (
    <div className="sheet-overlay" style={{background: `rgba(0,0,0,${0.55 * open})`}}>
      <div className={`sheet${tall ? ' tall' : ''}`} style={{transform: `translateY(${(1 - open) * 100}%)`, height}}>
        <div className="sheet-header">
          <span>{title}</span>
          <button className="sheet-close" type="button">
            &times;
          </button>
        </div>
        <div className="sheet-list">{children}</div>
        {footer}
      </div>
    </div>
  );
};

/** Fades something up into place `at` frames into the scene. */
export const reveal = (f: number, at: number): React.CSSProperties => {
  const p = ramp(f, at, at + 12);
  return {opacity: p, transform: `translateY(${(1 - p) * 10}px)`};
};
