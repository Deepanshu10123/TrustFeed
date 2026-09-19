import React from 'react';
import {random, useCurrentFrame} from 'remotion';
import {MOON, OCTOPUS} from '../content';
import {ramp} from '../lib/anim';
import {CommentIcon, MutedIcon, PauseIcon, ShareIcon} from './ReelIcons';
import {TabBar, VerdictBadge} from './parts';

/** Stand-in "footage" for the Moon video: stars, and a Moon that slowly recedes. */
const MoonFootage: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = ramp(frame, 0, 320, (t) => t);
  const size = 230 - drift * 46;
  return (
    <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(170deg, oklch(29% 0.075 268), oklch(12% 0.05 288))'}}>
      {Array.from({length: 46}, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: random(`sx${i}`) * 360,
            top: random(`sy${i}`) * 560,
            width: 1.5 + random(`ss${i}`) * 2,
            height: 1.5 + random(`ss${i}`) * 2,
            borderRadius: '50%',
            background: '#fff',
            opacity: 0.25 + random(`so${i}`) * 0.6,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 100 + drift * 60,
          top: 330 - drift * 40,
          width: size,
          height: size,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 34% 30%, oklch(97% 0.012 90), oklch(80% 0.012 90) 55%, oklch(52% 0.014 260))',
          boxShadow: '0 0 90px oklch(92% 0.05 90 / 0.35)',
        }}
      >
        {[
          [0.58, 0.32, 0.16],
          [0.3, 0.6, 0.2],
          [0.66, 0.68, 0.11],
          [0.42, 0.22, 0.08],
        ].map(([x, y, r], i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${r * 100}%`,
              height: `${r * 100}%`,
              borderRadius: '50%',
              background: 'oklch(70% 0.012 260 / 0.55)',
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: -230,
          bottom: -300,
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 68% 26%, oklch(66% 0.12 245), oklch(36% 0.1 255) 58%, oklch(20% 0.05 262))',
          boxShadow: '0 0 70px oklch(70% 0.1 245 / 0.4)',
        }}
      />
    </div>
  );
};

export const FeedTabs: React.FC<{mode?: 'all' | 'following'}> = ({mode = 'all'}) => (
  <div className="feed-tabs">
    <button className={mode === 'all' ? 'active' : ''} type="button">
      For you
    </button>
    <button className={mode === 'following' ? 'active' : ''} type="button">
      Following
    </button>
  </div>
);

export type ReelVariant = 'moon' | 'octopus';

/** One full-screen post in the feed, drawn with the app's own styles. */
export const Reel: React.FC<{variant: ReelVariant; liked?: boolean; likes?: number}> = ({variant, liked = false, likes = 24}) => {
  const isMoon = variant === 'moon';
  const handle = isMoon ? MOON.handle : OCTOPUS.handle;
  const topic = isMoon ? MOON.topic : OCTOPUS.topic;
  const preview = isMoon ? MOON.transcript : OCTOPUS.explanation;
  const bg = isMoon ? undefined : 'linear-gradient(160deg, oklch(46% 0.08 205), oklch(20% 0.06 225))';

  return (
    <>
      <FeedTabs />
      <div className="app-content">
        <div className="feed-scroll">
          <div className="feed-slide" style={{background: bg}}>
            {isMoon ? <MoonFootage /> : <div className="slide-quote">&ldquo;{OCTOPUS.quote}&rdquo;</div>}
            <div className="slide-scrim" />

            <div className="top-controls">
              <div className="pill-group">
                {isMoon && (
                  <button className="icon-pill" type="button">
                    <PauseIcon />
                  </button>
                )}
                <button className="icon-pill" type="button">
                  <MutedIcon />
                </button>
              </div>
              <button className="icon-pill wide" type="button">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </button>
            </div>

            <div className="side-rail">
              <button className={`rail-btn${liked ? ' liked' : ''}`} type="button">
                <span className="circle">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20s-7-4.4-9.5-8.7C.8 8 2 4.5 5.2 4c2-.3 3.8.7 4.8 2.3C11 4.7 12.8 3.7 14.8 4c3.2.5 4.4 4 3.7 7.3C16 15.6 12 20 12 20z" />
                  </svg>
                </span>
                <span className="count">{likes}</span>
              </button>
              <button className="rail-btn" type="button">
                <span className="circle">
                  <CommentIcon />
                </span>
              </button>
              <button className="rail-btn" type="button">
                <span className="circle">
                  <ShareIcon />
                </span>
                <span className="count">Share</span>
              </button>
            </div>

            <div className="bottom-info">
              <div className="creator-row">
                <span className="creator-link">
                  <span className="avatar">{handle.charAt(1).toUpperCase()}</span>
                  <span className="handle">{handle}</span>
                </span>
                <span className="posted-ago">2h ago</span>
              </div>
              <div className="tag-row">
                <span className="topic-chip">{topic}</span>
                <VerdictBadge label="Well Supported" chevron />
              </div>
              <div className="post-text-btn">
                <span className="caption clamped">{preview}</span>
                <span className="more-btn">more</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <TabBar active="feed" />
    </>
  );
};
