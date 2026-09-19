import React from 'react';
import {Header, TabBar} from './parts';

export type Tile = {
  kind: 'text' | 'video';
  dot: 'processing' | 'published' | 'rejected' | 'review';
  text?: string;
  hue?: number;
  moon?: boolean;
};

/** The three-across grid of posts, used on My Posts and on other people's profiles. */
export const Grid: React.FC<{tiles: Tile[]}> = ({tiles}) => (
  <div className="profile-grid">
    {tiles.map((t, i) => (
      <div className="grid-tile" key={i}>
        {t.kind === 'text' ? (
          <div className="grid-tile-text">{t.text}</div>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(160deg, oklch(46% 0.08 ${t.hue ?? 260}), oklch(20% 0.06 ${(t.hue ?? 260) + 20}))`,
            }}
          >
            {t.moon && (
              <div
                style={{
                  position: 'absolute',
                  left: '32%',
                  top: '24%',
                  width: '38%',
                  height: '38%',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 34% 30%, oklch(97% 0.012 90), oklch(72% 0.012 90))',
                  boxShadow: '0 0 22px oklch(92% 0.05 90 / 0.4)',
                }}
              />
            )}
          </div>
        )}
        <span className={`grid-dot ${t.dot}`} />
        {t.kind === 'video' && (
          <svg className="grid-reel-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="14" height="14" rx="2" />
            <path d="M17 9.5l4-2.5v10l-4-2.5" />
          </svg>
        )}
      </div>
    ))}
  </div>
);

/** Posts the user already has published, so the grid isn't empty. */
export const OLDER_TILES: Tile[] = [
  {kind: 'text', text: 'Honey found in ancient tombs was still edible.', dot: 'published'},
  {kind: 'video', hue: 30, dot: 'published'},
  {kind: 'text', text: 'Venus spins the opposite way to most planets.', dot: 'published'},
  {kind: 'text', text: 'Bananas are berries, but strawberries are not.', dot: 'published'},
  {kind: 'video', hue: 150, dot: 'published'},
  {kind: 'text', text: 'Lightning is hotter than the surface of the Sun.', dot: 'published'},
  {kind: 'text', text: 'A day on Venus is longer than its year.', dot: 'published'},
  {kind: 'video', hue: 330, dot: 'published'},
];

/** The user's own profile (the My Posts tab). `children` is drawn over the grid --
 * the post detail sheet lives there, as in the real app. */
export const MyPostsBase: React.FC<{tiles: Tile[]; children?: React.ReactNode}> = ({tiles, children}) => (
  <>
    <Header title="My Posts" />
    <div className="app-content">
      <div className="profile-screen">
        <div className="profile-scroll">
          <div className="profile-header">
            <div className="profile-avatar">
              <span className="avatar-placeholder" style={{color: 'var(--accent)'}}>
                S
              </span>
            </div>
            <div className="profile-info">
              <div className="profile-name">
                @stargazer
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="profile-stats-row">
            <div className="stat">
              <strong>{tiles.length}</strong>
              <span>Posts</span>
            </div>
            <div className="stat">
              <strong>{tiles.filter((t) => t.dot === 'published').length}</strong>
              <span>Published</span>
            </div>
            <div className="stat">
              <strong>41</strong>
              <span>Followers</span>
            </div>
            <div className="stat">
              <strong>12</strong>
              <span>Following</span>
            </div>
          </div>
          <Grid tiles={tiles} />
        </div>
        {children}
      </div>
    </div>
    <TabBar active="myposts" />
  </>
);
