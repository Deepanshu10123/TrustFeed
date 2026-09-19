import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const clampOpts = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const linear = (t: number): number => t;

/** 0 -> 1 between two frames, eased. */
export const ramp = (frame: number, from: number, to: number, ease: (t: number) => number = easeOut): number =>
  interpolate(frame, [from, to], [0, 1], {...clampOpts, easing: ease});

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

type Springy = {damping?: number; stiffness?: number; mass?: number};

/** A springy 0 -> 1 that starts at `start`. */
export function usePop(start: number, config: Springy = {damping: 14, stiffness: 150, mass: 0.7}): number {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - start, fps, config});
}

/** Style for something that fades up into place at `start`. */
export function useReveal(start: number, distance = 22): {opacity: number; transform: string} {
  const frame = useCurrentFrame();
  const p = ramp(frame, start, start + 16);
  return {opacity: p, transform: `translateY(${(1 - p) * distance}px)`};
}

/** 1 for most of the scene, dropping to 0 over the last `frames` frames. */
export function useExit(frames = 8): number {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return 1 - ramp(frame, durationInFrames - frames, durationInFrames);
}
