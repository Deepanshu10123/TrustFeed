import React from 'react';
import {MOON} from '../content';
import {easeInOut, ramp} from '../lib/anim';
import {AppScreen, Header, TabBar, Tap, useSceneFrame} from './parts';

/** Scene 01: pick Video, choose a file, choose a topic, submit. */
export const UploadScreen: React.FC = () => {
  const f = useSceneFrame();
  const isVideo = f >= 34;
  const fileChosen = f >= 58;
  const topicChosen = f >= 82;
  const uploading = f >= 108;
  const pct = Math.round(ramp(f, 110, 140, easeInOut) * 100);
  const sent = f >= 140;
  const done = f >= 146;

  let label = 'Submit for review';
  if (uploading && !done) label = sent ? 'Finishing up...' : `Uploading ${pct}%`;

  return (
    <AppScreen>
      <Header title="New post" />
      <div className="app-content">
        <div className="panel-padding">
          <div className="segmented">
            <button className={!isVideo ? 'active' : ''} type="button">
              Text
            </button>
            <button className={isVideo ? 'active' : ''} type="button">
              Video
            </button>
          </div>

          {isVideo ? (
            <div className="field">
              <label className="field-label">Video</label>
              <div className="dropzone">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15V4M8 8l4-4 4 4" />
                  <path d="M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
                </svg>
                <div className="dz-title">{fileChosen ? MOON.fileName : 'Tap to choose a video'}</div>
                <div className="dz-sub">{fileChosen ? MOON.fileSize : 'MP4, up to 2 minutes and 50 MB'}</div>
              </div>
            </div>
          ) : (
            <div className="field">
              <label className="field-label">What are you sharing?</label>
              <div className="field-input" style={{minHeight: 154, color: 'var(--text-secondary)'}}>
                <span style={{opacity: 0.7}}>Write the claim or post you want checked...</span>
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label">
              Topic <span className="req">Required</span>
            </label>
            <div className="field-input promo-select" style={{color: topicChosen ? 'var(--text)' : 'var(--text-secondary)'}}>
              <span>{topicChosen ? 'Space' : 'Choose a topic...'}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
            <div className="field-hint">This is what your post gets checked against before it's shown to anyone.</div>
          </div>

          {uploading && !done && (
            <div className="upload-progress">
              <div className="upload-progress-bar" style={{width: `${pct}%`}} />
            </div>
          )}
          {done && <div className="upload-message success">Submitted -- check My Posts for its status.</div>}

          <button className="btn-primary" type="button" style={{opacity: uploading && !done ? 0.6 : 1}}>
            {label}
          </button>
        </div>
      </div>
      <TabBar active="upload" />
      <Tap x={259} y={119} at={30} />
      <Tap x={180} y={253} at={52} />
      <Tap x={180} y={384} at={76} />
      <Tap x={180} y={500} at={102} />
    </AppScreen>
  );
};
