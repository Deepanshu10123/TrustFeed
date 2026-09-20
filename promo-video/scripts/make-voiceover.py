"""Makes the voice-over: one short audio file per line in src/voiceover.json, using
Microsoft's neural voices through the `edge-tts` package.

    pip install edge-tts
    python scripts/make-voiceover.py            # every line
    python scripts/make-voiceover.py hook1 cta  # just those lines
    node scripts/measure-voiceover.mjs          # then: measure them (length, loudness)

Needs an internet connection. The files land in public/voice/ and ARE committed, so
rendering the video never needs Python or the network -- this is only for when you
change the words or the voice. (edge-tts talks to the free service behind Microsoft
Edge's "Read aloud"; it is not an official Azure Speech key-based integration.)
Change the voice with "voice" in voiceover.json; `python -m edge_tts --list-voices`
lists them (en-US-AvaNeural, en-IN-NeerjaNeural, en-IN-PrabhatNeural, ...).
"""

import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "src" / "voiceover.json").read_text(encoding="utf-8"))
OUT = ROOT / "public" / "voice"
OUT.mkdir(parents=True, exist_ok=True)


async def main() -> None:
    only = set(sys.argv[1:])
    for line in DATA["lines"]:
        if only and line["id"] not in only:
            continue
        speech = edge_tts.Communicate(line["text"], DATA["voice"], rate=line.get("rate", "+0%"))
        await speech.save(str(OUT / f"{line['id']}.mp3"))  # one at a time, to be kind to the free service
        print("made", line["id"])


asyncio.run(main())
