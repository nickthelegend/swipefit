"""
Renders each subtitle cue as a transparent PNG plate.

This ffmpeg is built without libass, so neither the `subtitles` nor the `ass`
filter exists and captions cannot be burned in the usual way. Drawing them here
keeps full control of the typography and the safe area, and the plates composite
with plain `overlay`, which every ffmpeg has.

Each plate is the full frame width and only as tall as the text needs, so the
caption band sits clear of the bottom edge and never covers the phone UI it is
describing.

    python3 scripts/caption_plates.py cues.json out_dir
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "node_modules" / "@expo-google-fonts" / "archivo" / "600SemiBold" / "Archivo_600SemiBold.ttf"

W = 1080
SIZE = 38
PAD_X, PAD_Y = 34, 22
LINE_GAP = 10
MAX_LINES = 2


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    lines, buf = [], ""
    for word in text.split():
        trial = f"{buf} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            buf = trial
        else:
            if buf:
                lines.append(buf)
            buf = word
    if buf:
        lines.append(buf)
    return lines


def main() -> None:
    cues = json.loads(Path(sys.argv[1]).read_text())
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)

    font = ImageFont.truetype(str(FONT), SIZE)
    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    max_w = W - PAD_X * 4

    for i, cue in enumerate(cues):
        lines = wrap(probe, cue["text"], font, max_w)

        # Never silently truncate. A dropped tail looks fine in a spot check and
        # is wrong everywhere else, so an over-long cue is a hard failure.
        if len(lines) > MAX_LINES:
            raise SystemExit(
                f"CUE_WRAPS_PAST_TWO_LINES: cue {i} needs {len(lines)} lines — {cue['text']!r}"
            )

        text_w = max(probe.textlength(l, font=font) for l in lines)
        plate_w = int(text_w) + PAD_X * 2
        plate_h = len(lines) * SIZE + (len(lines) - 1) * LINE_GAP + PAD_Y * 2

        img = Image.new("RGBA", (plate_w, plate_h), (0, 0, 0, 205))
        d = ImageDraw.Draw(img)
        for n, line in enumerate(lines):
            lw = d.textlength(line, font=font)
            d.text(
                ((plate_w - lw) / 2, PAD_Y + n * (SIZE + LINE_GAP)),
                line,
                font=font,
                fill=(255, 255, 255, 255),
            )
        img.save(out / f"{i:04d}.png")

    print(f"{len(cues)} plates -> {out}")


if __name__ == "__main__":
    main()
