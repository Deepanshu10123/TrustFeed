import React from 'react';
import {AbsoluteFill, Sequence, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Caption} from '../components/Caption';
import {Phone, cameraAt, type CameraKey} from '../components/Phone';
import {Sfx} from '../components/Sfx';
import {ramp} from '../lib/anim';
import {CheckScreen, Steps} from '../screens/CheckScreen';
import {CommunityScreen} from '../screens/CommunityScreen';
import {PersonalizeScreen} from '../screens/PersonalizeScreen';
import {ProtectScreen} from '../screens/ProtectScreen';
import {ProveScreen} from '../screens/ProveScreen';
import {UploadScreen} from '../screens/UploadScreen';
import {ScreenSlot} from '../screens/parts';
import {DEMO_DUR, DEMO_SCENES, SC, type SceneId} from '../timeline';

const CAPTIONS: Record<SceneId, {eyebrow: string; headline: string; sub?: React.ReactNode}> = {
  post: {
    eyebrow: '01 · Post',
    headline: 'Share a video or a written claim.',
    sub: 'You pick the topic it should be checked against.',
  },
  check: {
    eyebrow: '02 · Check',
    headline: 'AI agents check it [[first.]]',
    sub: <Steps />,
  },
  prove: {
    eyebrow: '03 · Prove',
    headline: 'Every verdict [[shows its work.]]',
    sub: 'Tap the badge to see the real sources.',
  },
  protect: {
    eyebrow: '04 · Protect',
    headline: 'Myths never reach the feed.',
    sub: 'Unsupported claims are rejected. Borderline posts get a human look.',
  },
  personalize: {
    eyebrow: '05 · Personalize',
    headline: 'A feed built around [[your interests.]]',
    sub: 'Pick topics, then like, comment and share a link to the exact post.',
  },
  community: {
    eyebrow: '06 · Community',
    headline: "Follow who you trust. Report what you don't.",
    sub: 'Reports from 3 different people hide a post for everyone.',
  },
};

// Where the "camera" looks in each scene: [frame in scene, zoom, how far down the
// screen]. It glides between them, and holds at the end so the next scene's
// first move happens while the screens cross-fade.
const CAMERA: Record<SceneId, [number, number, number][]> = {
  post: [[0, 2.05, 0], [56, 2.05, 0], [82, 2.05, 125]],
  check: [[0, 2.05, 125], [24, 2.05, 345]],
  prove: [[0, 2.05, 330], [70, 2.05, 330], [96, 1.8, 255]],
  protect: [[0, 2.05, 345]],
  personalize: [[0, 2.05, 60], [62, 2.05, 60], [92, 2.05, 330]],
  community: [[0, 2.05, 330], [14, 2.05, 330], [34, 1.9, 40], [78, 1.9, 40], [96, 2.05, 0], [100, 2.05, 0], [124, 1.7, 250]],
};

const KEYS: CameraKey[] = DEMO_SCENES.flatMap(({id, dur}) => {
  const keys = CAMERA[id].map(([local, s, y]) => ({f: SC[id].start + local, s, y}));
  const last = keys[keys.length - 1];
  const hold = SC[id].start + dur - 16;
  return last.f < hold ? [...keys, {...last, f: hold}] : keys;
});

/** The phone section: one phone stays on screen while the app changes inside it. */
export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cam = cameraAt(frame, KEYS);
  const enter = spring({frame, fps, config: {damping: 200}, durationInFrames: 30});
  const leave = ramp(frame, DEMO_DUR - 22, DEMO_DUR);

  return (
    <AbsoluteFill>
      {/* the phone sliding in, and later sliding away */}
      <Sfx name="whoosh" at={0} volume={0.45} />
      <Sfx name="whoosh" at={DEMO_DUR - 26} volume={0.45} />
      {DEMO_SCENES.map(({id}) => (
        <Sequence key={id} from={SC[id].start} durationInFrames={SC[id].dur} layout="none">
          <Caption {...CAPTIONS[id]} />
        </Sequence>
      ))}
      <div className="promo-stage">
        <Phone s={cam.s} y={cam.y} enter={enter * (1 - leave)}>
          <ScreenSlot start={SC.post.start} dur={SC.post.dur} fadeIn={false}>
            <UploadScreen />
          </ScreenSlot>
          <ScreenSlot start={SC.check.start} dur={SC.check.dur}>
            <CheckScreen />
          </ScreenSlot>
          <ScreenSlot start={SC.prove.start} dur={SC.prove.dur}>
            <ProveScreen />
          </ScreenSlot>
          <ScreenSlot start={SC.protect.start} dur={SC.protect.dur}>
            <ProtectScreen />
          </ScreenSlot>
          <ScreenSlot start={SC.personalize.start} dur={SC.personalize.dur}>
            <PersonalizeScreen />
          </ScreenSlot>
          <ScreenSlot start={SC.community.start} dur={SC.community.dur} fadeOut={false}>
            <CommunityScreen />
          </ScreenSlot>
        </Phone>
      </div>
    </AbsoluteFill>
  );
};
