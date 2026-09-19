# TrustFeed promo video

The LinkedIn marketing video, built with [Remotion](https://www.remotion.dev)
(write the video as React, render it to MP4). It is separate from the app --
nothing here is deployed.

    npm install
    npm start          # opens the preview editor (scrub the timeline, change text live)
    npm run render     # writes out/trustfeed-promo.mp4  (1080x1350, 30 fps, no sound)

## Where things are

| To change...                              | Edit                                   |
| ----------------------------------------- | -------------------------------------- |
| Any wording, sample post, source, the URL | `src/content.ts`                       |
| How long each part runs                   | `src/timeline.ts`                      |
| The headline shown above the phone        | `CAPTIONS` in `src/scenes/Demo.tsx`    |
| Where the camera zooms/pans in a scene    | `CAMERA` in `src/scenes/Demo.tsx`      |
| What happens on the phone in a scene      | the matching file in `src/screens/`    |

## The story (about 55 seconds)

Hook -> logo + the four verdicts -> 01 Post -> 02 Check -> 03 Prove ->
04 Protect -> 05 Personalize -> 06 Community -> 07 Under the hood -> end card.

## Things to know

- **The screens are recreated, not recorded.** They use the app's own
  stylesheets (copied into `src/app-css/`), with sample posts. The facts in the
  samples are true and the two sources shown are real pages.
- **The serif font is registered as "Source Serif Four"** by the font package,
  while the app's CSS says "Source Serif 4". The copied stylesheets were renamed
  to match -- redo that if you copy them again.
- **Nothing may animate by itself.** Remotion draws every frame separately, so
  motion is driven by the frame number (CSS animations/transitions are switched
  off inside the phone).
- **No sound.** LinkedIn autoplays muted, so the story is carried by the
  captions. To add music, drop an mp3 in `public/` and add an `<Audio>` to
  `src/Promo.tsx`.
- `scripts/stills.mjs 60 340 ...` renders single frames to `out/stills/`, handy
  for checking a layout without rendering the whole video.
