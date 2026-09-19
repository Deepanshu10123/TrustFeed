import React from 'react';
import {easeInOut, lerp} from '../lib/anim';

export type CameraKey = {f: number; s: number; y: number};

/** Where the "camera" is at a given frame: `s` is the zoom, `y` is how far down
 * the screen (in the app's own pixels) the view has scrolled. It glides between
 * neighbouring keys, so repeat a key to hold still. */
export function cameraAt(frame: number, keys: CameraKey[]): {s: number; y: number} {
  if (frame <= keys[0].f) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.f) {
      const t = b.f === a.f ? 1 : easeInOut((frame - a.f) / (b.f - a.f));
      return {s: lerp(a.s, b.s, t), y: lerp(a.y, b.y, t)};
    }
  }
  return keys[keys.length - 1];
}

/** A phone that is bigger than the frame -- the camera shows the part that matters. */
export const Phone: React.FC<{s: number; y: number; enter: number; children: React.ReactNode}> = ({
  s,
  y,
  enter,
  children,
}) => (
  <div className="promo-phone" style={{transform: `translateX(-50%) translateY(${-y * s + (1 - enter) * 1100}px) scale(${s})`}}>
    <div className="promo-phone-screen">{children}</div>
  </div>
);
