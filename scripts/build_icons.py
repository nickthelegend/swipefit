"""
Rasterises the FITCHECK mark into every icon slot the app and site need.

One source of geometry (assets/brand/*.svg) so the app icon, the splash and the
favicon cannot drift apart — which is exactly what happens when each size is
exported by hand.

Two constraints drive the odd numbers below:

  * Android adaptive icons mask the outer edge. Of a 108dp canvas only the
    central 66dp is guaranteed visible, so the foreground is scaled to ~58% and
    centred. Anything larger risks the shadow being clipped by a circular or
    squircle mask.
  * Below ~32px the full mark turns to mush, so the small slots are rendered
    from favicon.svg (redrawn for the size) rather than downscaled.

Usage:  python3 scripts/build_icons.py
"""

from __future__ import annotations

import io
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"
APP_ASSETS = ROOT / "assets"
WEB_PUBLIC = ROOT / "web" / "public"

GROUND = "#FA9DCD"
INK = "#000000"

MARK = BRAND / "logo-mark.svg"
SMALL = BRAND / "favicon.svg"
MONO = BRAND / "logo-mono.svg"

# The real Archivo, shipped with the app's font package. The lockup SVG uses
# live text, which means a rasteriser without Archivo installed silently falls
# back to a light system face — the wordmark came out thin Helvetica against a
# 900-weight design. Drawing the OG card with the actual TTF avoids that.
FONT_DIR = ROOT / "node_modules" / "@expo-google-fonts" / "archivo"
FONT_BLACK = FONT_DIR / "900Black" / "Archivo_900Black.ttf"
FONT_SEMI = FONT_DIR / "600SemiBold" / "Archivo_600SemiBold.ttf"


def render(svg: Path, px: int, background: str | None = None) -> Image.Image:
    """SVG -> RGBA at an exact pixel size."""
    data = cairosvg.svg2png(
        url=str(svg), output_width=px, output_height=px, background_color=background
    )
    return Image.open(io.BytesIO(data)).convert("RGBA")


def on_ground(svg: Path, px: int, inset: float, ground: str = GROUND) -> Image.Image:
    """The mark centred on a flat ground, inset so nothing touches the edge."""
    canvas = Image.new("RGBA", (px, px), ground)
    size = int(px * (1 - inset * 2))
    mark = render(svg, size)
    canvas.alpha_composite(mark, ((px - size) // 2, (px - size) // 2))
    return canvas


def rounded(img: Image.Image, radius_ratio: float) -> Image.Image:
    """Squircle-ish corners for the slots that are not masked by the OS."""
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, img.size[0] - 1, img.size[1] - 1],
        radius=int(img.size[0] * radius_ratio),
        fill=255,
    )
    out = img.copy()
    out.putalpha(mask)
    return out


def silhouette(px: int) -> Image.Image:
    """
    Single-tone cut-out for Android's monochrome (themed icon) slot.

    Rendered from logo-mono.svg, which punches the eyes out as holes rather than
    drawing them — the OS re-tints this layer to one flat colour, so a drawn eye
    would vanish while a hole survives. Flattening the full mark here would ship
    a featureless black tag.
    """
    mono = render(MONO, int(px * 0.58))
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    canvas.alpha_composite(mono, ((px - mono.size[0]) // 2, (px - mono.size[1]) // 2))
    return canvas


def main() -> None:
    written: list[tuple[str, str]] = []

    def save(img: Image.Image, path: Path, label: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        img.save(path)
        written.append((str(path.relative_to(ROOT)), label))

    # --- Expo / app ------------------------------------------------------
    save(on_ground(MARK, 1024, inset=0.14), APP_ASSETS / "icon.png", "app icon, full bleed")
    save(on_ground(MARK, 1024, inset=0.26), APP_ASSETS / "splash-icon.png", "splash, extra breathing room")

    # Adaptive foreground stays transparent; the OS composites it over the
    # background layer and then applies its own mask.
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    mark = render(MARK, int(1024 * 0.58))
    fg.alpha_composite(mark, ((1024 - mark.size[0]) // 2, (1024 - mark.size[1]) // 2))
    save(fg, APP_ASSETS / "android-icon-foreground.png", "adaptive foreground, 58% safe zone")

    save(Image.new("RGBA", (1024, 1024), GROUND), APP_ASSETS / "android-icon-background.png", "adaptive background")
    save(silhouette(1024), APP_ASSETS / "android-icon-monochrome.png", "adaptive monochrome / themed")

    # Small slots come from the redrawn mark, not a downscale.
    save(on_ground(SMALL, 48, inset=0.06), APP_ASSETS / "favicon.png", "expo web favicon")

    # --- Website ---------------------------------------------------------
    save(on_ground(SMALL, 32, inset=0.04), WEB_PUBLIC / "favicon-32.png", "site favicon 32")
    save(on_ground(SMALL, 16, inset=0.0), WEB_PUBLIC / "favicon-16.png", "site favicon 16")
    save(rounded(on_ground(MARK, 180, inset=0.12), 0.0), WEB_PUBLIC / "apple-touch-icon.png", "iOS home screen")
    save(on_ground(MARK, 512, inset=0.14), WEB_PUBLIC / "icon-512.png", "PWA / manifest")
    save(on_ground(MARK, 192, inset=0.14), WEB_PUBLIC / "icon-192.png", "PWA / manifest")

    # Open Graph card, at the 1.91:1 ratio scrapers want. Composed here rather
    # than rasterised from the lockup SVG so the wordmark uses real Archivo 900.
    og = Image.new("RGBA", (1200, 630), GROUND)
    mark_og = render(MARK, 300)
    og.alpha_composite(mark_og, (96, 165))

    draw = ImageDraw.Draw(og)
    if FONT_BLACK.exists() and FONT_SEMI.exists():
        draw.text((432, 246), "FITCHECK", font=ImageFont.truetype(str(FONT_BLACK), 116), fill=INK)
        draw.text((436, 372), "THE FACE DECIDES WHAT YOU WEAR",
                  font=ImageFont.truetype(str(FONT_SEMI), 30), fill=INK)
    else:
        # Better an honest gap than a thin fallback masquerading as the wordmark.
        print("  ! Archivo TTF not found — OG card shipped without the wordmark")
    save(og.convert("RGB"), WEB_PUBLIC / "og.png", "Open Graph card")

    # The SVG favicon is served directly — no raster step, sharp at any size.
    (WEB_PUBLIC / "favicon.svg").write_text((BRAND / "favicon.svg").read_text())
    written.append(("web/public/favicon.svg", "site favicon, vector"))

    width = max(len(p) for p, _ in written)
    for path, label in written:
        print(f"  {path:<{width}}  {label}")
    print(f"\n{len(written)} files written from assets/brand/*.svg")


if __name__ == "__main__":
    main()
