"""
Draws the animated intro and outro, frame by frame.

ffmpeg here is built without libfreetype, so drawtext does not exist and the
cards cannot be generated in the filter graph. Rather than settle for a zoom or
a crossfade standing in for animation, every frame is composed with PIL: lines
rise into place on an eased curve, staggered, and the outro settles then leaves.

Uses the app's own typeface (Archivo 900, from node_modules) and the app's own
ground colour, so the cards belong to the same world as the footage between them.

    python3 scripts/title_cards.py intro out/intro
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "node_modules" / "@expo-google-fonts" / "archivo"
BLACK_TTF = FONT_DIR / "900Black" / "Archivo_900Black.ttf"
SEMI_TTF = FONT_DIR / "600SemiBold" / "Archivo_600SemiBold.ttf"

W, H, FPS = 1080, 2400, 30
GROUND = (250, 157, 205)
INK = (0, 0, 0)
VIOLET = (77, 23, 245)


def ease_out_cubic(t: float) -> float:
    """Fast then settling — an entrance, not a linear slide."""
    return 1 - pow(1 - t, 3)


def draw_card(frames_dir: Path, lines, seconds: float, fade_out: bool) -> int:
    frames_dir.mkdir(parents=True, exist_ok=True)
    total = int(seconds * FPS)
    fonts = {}

    for n in range(total):
        t = n / FPS
        img = Image.new("RGB", (W, H), GROUND)
        d = ImageDraw.Draw(img)

        block_h = sum(l["size"] * 1.25 for l in lines)
        y0 = (H - block_h) / 2

        for i, line in enumerate(lines):
            key = (line["ttf"], line["size"])
            if key not in fonts:
                fonts[key] = ImageFont.truetype(str(line["ttf"]), line["size"])
            font = fonts[key]

            # Staggered: each line begins 0.28s after the one above it.
            delay = 0.25 + i * 0.28
            p = 0.0 if t < delay else min(1.0, (t - delay) / 0.55)
            eased = ease_out_cubic(p)

            # 90px of travel, and opacity tied to the same curve so the line
            # arrives rather than fading in where it already is.
            offset = 90 * (1 - eased)
            alpha = eased

            if fade_out:
                alpha *= min(1.0, max(0.0, (seconds - t) / 0.7))

            if alpha <= 0.01:
                continue

            y = y0 + sum(l["size"] * 1.25 for l in lines[:i]) + offset
            w = d.textlength(line["text"], font=font)

            # Composited rather than drawn flat, so alpha is real.
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(layer).text(
                ((W - w) / 2, y), line["text"], font=font, fill=(*line["colour"], int(255 * alpha))
            )
            img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

        img.save(frames_dir / f"{n:05d}.png")

    return total


INTRO = [
    {"text": "SWIPEFIT", "size": 190, "ttf": BLACK_TTF, "colour": INK},
    {"text": "the face decides", "size": 76, "ttf": SEMI_TTF, "colour": VIOLET},
    {"text": "what you wear", "size": 76, "ttf": SEMI_TTF, "colour": VIOLET},
]

OUTRO = [
    {"text": "SWIPEFIT", "size": 170, "ttf": BLACK_TTF, "colour": INK},
    {"text": "thanks for watching", "size": 70, "ttf": SEMI_TTF, "colour": VIOLET},
]

if __name__ == "__main__":
    which = sys.argv[1]
    out = Path(sys.argv[2])
    if which == "intro":
        n = draw_card(out, INTRO, 3.6, fade_out=False)
    else:
        n = draw_card(out, OUTRO, 4.4, fade_out=True)
    print(f"{n} frames -> {out}")
