"""
PHASE 2 — narration, synthesised with Kokoro.

Reads demo/narration.json, writes one WAV per line into demo/audio/, and prints
each file's REAL measured duration as JSON on stdout for tts.mjs to consume.
Nothing here estimates a length from character count; the duration is the sample
count divided by the sample rate.

Kokoro runs through onnxruntime rather than torch: the model is the same, the
install is a fraction of the size, and it needs no GPU. Model files live in
.cache/kokoro (gitignored, ~337MB) and are fetched by scripts/fetch_kokoro.sh.

    python3 scripts/kokoro_tts.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "kokoro"
OUT = ROOT / "demo" / "audio"

# af_heart is the warmest of the American female voices and reads long
# explanatory sentences without the clipped cadence the lighter voices give.
VOICE = "af_heart"
SPEED = 1.0


def main() -> None:
    model = CACHE / "kokoro-v1.0.onnx"
    voices = CACHE / "voices-v1.0.bin"
    if not model.exists() or not voices.exists():
        raise SystemExit(
            f"KOKORO_MODEL_MISSING: expected {model.name} and {voices.name} in {CACHE}.\n"
            "Run scripts/fetch_kokoro.sh first."
        )

    script = json.loads((ROOT / "demo" / "narration.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)

    # Only the narration files. bgm.wav lives in this directory too, and wiping
    # the whole thing once deleted the music bed with no error to explain it.
    for stale in OUT.glob("[0-9][0-9]-*.wav"):
        stale.unlink()

    kokoro = Kokoro(str(model), str(voices))
    lines = {}

    for i, line in enumerate(script["lines"]):
        name = f"{i:02d}-{line['id']}.wav"
        samples, rate = kokoro.create(line["text"], voice=VOICE, speed=SPEED, lang="en-us")
        sf.write(OUT / name, samples, rate)

        # Measured, not estimated: sample count over sample rate is the only
        # duration that cannot drift from the file the cutter will actually read.
        seconds = len(samples) / rate
        lines[line["id"]] = {"file": f"demo/audio/{name}", "seconds": round(seconds, 3)}
        print(f"  {name:<28} {seconds:6.2f}s", file=sys.stderr)

    print(json.dumps({"voice": VOICE, "speed": SPEED, "lines": lines}))


if __name__ == "__main__":
    main()
