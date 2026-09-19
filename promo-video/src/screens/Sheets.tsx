import React from 'react';
import {BORDERLINE, MOON, REJECTION, MYTH} from '../content';
import {ramp} from '../lib/anim';
import {Grid, type Tile} from './MyPostsBase';
import {Sheet, StatusBadge, VerdictBadge, reveal, type Status} from './parts';

/** "How this was checked" -- the topic score, the verdict, and the real sources.
 * `f` counts frames from the moment the sheet starts opening. */
export const EvidenceSheetMock: React.FC<{f: number; open: number}> = ({f, open}) => {
  const score = Math.round(MOON.relevance * ramp(f, 12, 42));
  return (
    <Sheet open={open} title="How this was checked">
      <div className="evidence-topic" style={reveal(f, 10)}>
        <span>Matches its topic &ldquo;{MOON.topic}&rdquo;</span>
        <strong>{score}/100</strong>
      </div>
      <div className="evidence-claim">
        <div className="evidence-claim-text" style={reveal(f, 22)}>
          &ldquo;{MOON.claims[0]}&rdquo;
        </div>
        <span style={reveal(f, 34)}>
          <VerdictBadge label="Well Supported" />
        </span>
        <p className="evidence-explanation" style={reveal(f, 44)}>
          {MOON.explanation}
        </p>
        <ul className="evidence-sources">
          {MOON.sources.map((s, i) => (
            <li key={s.host} style={reveal(f, 60 + i * 16)}>
              <a>{s.title}</a>
              <span className="evidence-host">{s.host}</span>
              <span className="evidence-snippet">{s.snippet}</span>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
};

/** The panel My Posts opens for a post that is not (or not yet) in the feed. */
export const PostDetailMock: React.FC<{
  open: number;
  preview: string;
  status: Status;
  body?: React.ReactNode;
}> = ({open, preview, status, body}) => (
  <div className="post-detail-overlay" style={{background: `rgba(0,0,0,${0.55 * open})`}}>
    <div className="post-detail-sheet" style={{transform: `translateY(${(1 - open) * 100}%)`}}>
      <button className="detail-close" type="button">
        &times;
      </button>
      <div className="mypost-top">
        <span className="mypost-preview">{preview}</span>
        <StatusBadge status={status} />
      </div>
      {body}
      <div className="mypost-bottom">
        <span className="mypost-time">just now</span>
        <button className="mypost-delete" type="button">
          Delete
        </button>
      </div>
    </div>
  </div>
);

export const REJECTED_PREVIEW = `${MYTH.topic} · "${MYTH.text}"`;
export const REJECTED_BODY = <div className="status-sub">{REJECTION}</div>;
export const REVIEW_PREVIEW = 'culture · video post';
export const REVIEW_BODY = <div className="status-sub">{BORDERLINE}</div>;

const PROFILE_TILES: Tile[] = [
  {kind: 'text', text: 'Octopuses have three hearts and blue blood.', dot: 'published'},
  {kind: 'video', hue: 190, dot: 'published'},
  {kind: 'text', text: 'A group of flamingos is called a flamboyance.', dot: 'published'},
  {kind: 'text', text: 'Sea otters hold hands while they sleep.', dot: 'published'},
  {kind: 'video', hue: 120, dot: 'published'},
  {kind: 'text', text: 'Crows can recognise individual human faces.', dot: 'published'},
];

/** Someone else's public profile, opened from their name on a post. */
export const ProfileSheetMock: React.FC<{open: number; following: boolean}> = ({open, following}) => (
  <Sheet open={open} title="@nova" tall>
    <div className="profile-header">
      <div className="profile-avatar static">
        <span className="avatar-placeholder" style={{color: 'var(--accent)'}}>
          N
        </span>
      </div>
      <div className="profile-info">
        <div className="user-handle">@nova</div>
        <div className="profile-stats">
          <div className="stat">
            <strong>8</strong>
            <span>Posts</span>
          </div>
          <div className="stat">
            <strong>{following ? 42 : 41}</strong>
            <span>Followers</span>
          </div>
          <div className="stat">
            <strong>12</strong>
            <span>Following</span>
          </div>
        </div>
      </div>
    </div>
    <button className={`follow-btn${following ? ' following' : ''}`} type="button">
      {following ? 'Following' : 'Follow'}
    </button>
    <Grid tiles={PROFILE_TILES} />
  </Sheet>
);

const REASONS = ['False or misleading', 'Hateful or harassing', 'Violent or dangerous', 'Spam or a scam', 'Something else'];

export const ReportSheetMock: React.FC<{open: number; selected: boolean; sending: boolean}> = ({open, selected, sending}) => (
  <Sheet
    open={open}
    title="Report this post"
    footer={
      <div className="report-footer">
        <button className="report-submit" type="button" disabled={!selected || sending} style={{opacity: selected ? 1 : 0.5}}>
          {sending ? 'Sending...' : 'Send report'}
        </button>
      </div>
    }
  >
    <div className="report-intro">Why are you reporting it?</div>
    {REASONS.map((label, i) => (
      <button key={label} className={`report-reason${selected && i === 0 ? ' selected' : ''}`} type="button">
        {label}
        <span className="report-radio" />
      </button>
    ))}
    <div className="report-note" style={{color: 'var(--text-secondary)', opacity: 0.7}}>
      Add a note (optional)
    </div>
  </Sheet>
);
