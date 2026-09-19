export const FPS = 30;
export const W = 1080; // 4:5 -- the tallest shape LinkedIn shows in the feed without cropping
export const H = 1350;

const sec = (s: number) => Math.round(s * FPS);

// The phone scenes, in order. Each one is a numbered step in the story.
export const DEMO_SCENES = [
  {id: 'post', dur: sec(5)},
  {id: 'check', dur: sec(7)},
  {id: 'prove', dur: sec(7)},
  {id: 'protect', dur: sec(6)},
  {id: 'personalize', dur: sec(5.5)},
  {id: 'community', dur: sec(7)}, // the last 22 frames are the phone sliding away, so this one needs room for the toast
] as const;

export type SceneId = (typeof DEMO_SCENES)[number]['id'];

/** Where each phone scene starts, counted from the start of the phone section. */
export const SC = {} as Record<SceneId, {start: number; dur: number}>;
let acc = 0;
for (const scene of DEMO_SCENES) {
  SC[scene.id] = {start: acc, dur: scene.dur};
  acc += scene.dur;
}
export const DEMO_DUR = acc;

export const T = {
  hook: {from: 0, dur: sec(3)},
  logo: {from: sec(3), dur: sec(4)},
  demo: {from: sec(7), dur: DEMO_DUR},
  hood: {from: sec(7) + DEMO_DUR, dur: sec(6)},
  cta: {from: sec(7) + DEMO_DUR + sec(6), dur: sec(4.5)},
};

export const DURATION = T.cta.from + T.cta.dur;
