// Renders a handful of still frames so the layout can be checked without
// rendering the whole video.  Usage: node scripts/stills.mjs 60 190 460 ...
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';

const frames = process.argv.slice(2).map(Number);
const entry = path.resolve('src/index.ts');
const outDir = path.resolve('out/stills');

const serveUrl = await bundle({entryPoint: entry});
const composition = await selectComposition({serveUrl, id: 'TrustFeedPromo'});
for (const frame of frames) {
  const output = path.join(outDir, `frame-${String(frame).padStart(4, '0')}.png`);
  await renderStill({composition, serveUrl, frame, output, imageFormat: 'png'});
  console.log('rendered', output);
}
