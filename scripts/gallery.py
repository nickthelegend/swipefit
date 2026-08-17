"""
Devpost image gallery + thumbnail.

Devpost renders gallery images at 3:2 and a phone screenshot is 9:20, so pasting
a raw capture leaves it letterboxed into a thin strip. Each shot is instead
composed onto a 3:2 card in the product's own colours: the phone sits at full
height on the left, and the right half carries a short caption saying what the
screen is proving. That way the gallery reads on its own, without the video.

Frames come from the finished cut at the marks the cutter recorded, so what is
shown is exactly what the demo shows — not a separately staged screenshot.

    python3 scripts/gallery.py
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "demo" / "final" / "swipefit-clean.mp4"
OUT = ROOT / "demo" / "gallery"

FONT_DIR = ROOT / "node_modules" / "@expo-google-fonts" / "archivo"
BLACK = FONT_DIR / "900Black" / "Archivo_900Black.ttf"
SEMI = FONT_DIR / "600SemiBold" / "Archivo_600SemiBold.ttf"

W, H = 2400, 1600          # 3:2, comfortably above Devpost's display size
GROUND = (250, 157, 205)
INK = (0, 0, 0)
VIOLET = (77, 23, 245)
CARD = (255, 255, 255)

# (seconds into the finished cut, headline, supporting line)
# Times are the MIDPOINT of the beat that proves each claim, read from the
# cutter's timeline rather than guessed. Picked by eye the first time, two
# captions ended up over the wrong screen — the bag list captioned as the outfit
# render, and the outfit render captioned as the brand console.
SHOTS = [
    (104, "Rendered on you", "Every card is the garment on your own body, through YouCam Apparel Virtual Try-On."),
    (70, "One scan decides", "YouCam Skin AI returns the colour. Undertone, depth and season are derived in CIELAB."),
    (114, "The brand is hidden", "You judge the garment first. The label is revealed only after you have decided."),
    (158, "A whole outfit", "Top and bottom chained onto one body, with a running total across brands."),
    (146, "A bag across brands", "Five pieces, four labels, one total. Checkout stays with the brand."),
]

THUMB = (104, "the face decides", "what you wear")


def grab(seconds: int, dest: Path) -> Image.Image:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-ss", str(seconds), "-i", str(VIDEO),
         "-frames:v", "1", "-update", "1", str(dest)],
        check=True,
    )
    return Image.open(dest).convert("RGB")


def wrap(draw, text, font, max_w):
    lines, buf = [], ""
    for word in text.split():
        trial = f"{buf} {word}".strip()
        if draw.textlength(trial, font=font) <= max_w:
            buf = trial
        else:
            lines.append(buf)
            buf = word
    if buf:
        lines.append(buf)
    return lines


def compose(shot: Image.Image, headline: str, body: str, dest: Path) -> None:
    card = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(card)

    # Phone at full bleed height with a margin, rounded to match the app's own
    # card radius rather than sitting as a hard rectangle.
    margin = 70
    ph = H - margin * 2
    pw = int(shot.width * (ph / shot.height))
    phone = shot.resize((pw, ph), Image.LANCZOS)

    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw, ph], radius=48, fill=255)

    shadow = Image.new("RGBA", (pw + 24, ph + 24), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([12, 12, pw + 12, ph + 12], radius=48, fill=(0, 0, 0, 60))
    card.paste(Image.alpha_composite(card.crop((margin - 12, margin - 12, margin + pw + 12, margin + ph + 12)).convert("RGBA"), shadow).convert("RGB"), (margin - 12, margin - 12))
    card.paste(phone, (margin, margin), mask)

    # Right column.
    x = margin + pw + 90
    avail = W - x - margin

    h_font = ImageFont.truetype(str(BLACK), 108)
    b_font = ImageFont.truetype(str(SEMI), 52)

    h_lines = wrap(d, headline, h_font, avail)
    b_lines = wrap(d, body, b_font, avail)

    block = len(h_lines) * 124 + 44 + len(b_lines) * 74
    y = (H - block) / 2

    for line in h_lines:
        d.text((x, y), line, font=h_font, fill=INK)
        y += 124
    y += 44
    for line in b_lines:
        d.text((x, y), line, font=b_font, fill=VIOLET)
        y += 74

    card.save(dest, quality=95)


def thumbnail(dest: Path) -> None:
    """Play-button-friendly title card: big mark, one claim, one real render."""
    seconds, l1, l2 = THUMB
    shot = grab(seconds, OUT / "_thumb-src.png")

    card = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(card)

    margin = 70
    ph = H - margin * 2
    pw = int(shot.width * (ph / shot.height))
    phone = shot.resize((pw, ph), Image.LANCZOS)
    mask = Image.new("L", (pw, ph), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, pw, ph], radius=48, fill=255)
    # Phone on the RIGHT for the thumbnail, so the wordmark leads the eye.
    px = W - margin - pw
    card.paste(phone, (px, margin), mask)

    mark = ImageFont.truetype(str(BLACK), 190)
    sub = ImageFont.truetype(str(SEMI), 78)

    x = margin + 20
    y = (H - (190 + 40 + 96 * 2)) / 2
    d.text((x, y), "SWIPEFIT", font=mark, fill=INK)
    y += 190 + 40
    for line in (l1, l2):
        d.text((x, y), line, font=sub, fill=VIOLET)
        y += 96

    card.save(dest, quality=95)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    if not VIDEO.exists():
        raise SystemExit(f"NO_VIDEO: {VIDEO}")

    for i, (seconds, headline, body) in enumerate(SHOTS, start=1):
        src = OUT / f"_src-{i}.png"
        shot = grab(seconds, src)
        dest = OUT / f"{i:02d}-{headline.lower().replace(' ', '-')}.jpg"
        compose(shot, headline, body, dest)
        src.unlink()
        print(f"  {dest.name}")

    thumbnail(OUT / "00-thumbnail.jpg")
    (OUT / "_thumb-src.png").unlink(missing_ok=True)
    print("  00-thumbnail.jpg")


if __name__ == "__main__":
    main()
