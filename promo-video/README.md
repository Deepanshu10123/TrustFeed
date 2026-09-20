# TrustFeed promo video

The LinkedIn marketing video, built with [Remotion](https://www.remotion.dev)
(write the video as React, render it to MP4). It is separate from the app --
nothing here is deployed.

    npm install
    npm start          # opens the preview editor (scrub the timeline, change text live)
    npm run render     # writes out/trustfeed-promo.mp4  (1080x1350, 30 fps, with sound)
    npm run audio      # remakes the music and sounds (start/render already do this first)

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
- **Sound is made from scratch.** `scripts/make-audio.mjs` synthesises an
  ambient music bed (uneasy in the hook, resolving at the logo, lifting for the
  end card) and the small interface sounds (taps, sheets, the "checked" bell...).
  Nothing is sampled or downloaded, so there is nothing to license. The files go
  to `public/audio/` and are not committed -- `npm run audio` recreates them
  identically. The music's chord changes follow `src/timeline.ts`; each small
  sound is placed next to the on-screen event it belongs to (`<Sfx>`, and every
  `<Tap>` plays its own tick). The story still works with the sound off, since
  LinkedIn autoplays muted and the captions carry it.
- To use your own music instead, drop a file in `public/` and swap the
  `<Audio>` in `src/Promo.tsx`.
- **Voice-over.** `src/voiceover.json` lists every narrated line, when it starts
  and which voice says it. The clips are in `public/voice/*.mp3` and ARE
  committed, so rendering never needs Python or the internet. To change the
  words or the voice: edit the JSON, then

      pip install edge-tts
      python scripts/make-voiceover.py        # makes the clips (needs internet)
      node scripts/measure-voiceover.mjs      # measures them, evens out loudness,
                                              # warns if a line runs into the next

  and render again. (The speech comes from the free service behind Microsoft
  Edge's "Read aloud", through the `edge-tts` package -- not an official
  key-based Azure Speech setup. `python -m edge_tts --list-voices` lists voices.)
  The music dips while the voice is speaking (`musicLevel` in
  `src/components/VoiceOver.tsx`). To use your own voice, record each line, save
  it as `public/voice/<id>.mp3`, and run the measure step.
- `scripts/stills.mjs 60 340 ...` renders single frames to `out/stills/`, handy
  for checking a layout without rendering the whole video.
