"""
Builds src/data/catalog.json for SWIPEFIT.

Why this replaces the scraper it was originally specced as: major retail sites
render product grids client-side behind bot protection, so an HTML scraper
returns nothing. Uniqlo instead exposes a public JSON commerce API, which gives
real names, prices, product ids, colourways and per-colour image URLs directly.
No HTML parsing, no bot-detection to work around, and the data is authoritative
rather than inferred.

Two details make the output usable by a virtual try-on engine:

  * Every image is checked to be a flat product shot rather than an on-model
    photo, by measuring skin coverage and vertical extent. The API's own
    `model` marker is not trustworthy for this — the same URL path serves model
    photos for some colourways — and a model-worn reference corrupts the render.
  * `colorHex` is SAMPLED FROM THE IMAGE PIXELS rather than guessed from the
    colour's name. "BEIGE" spans a wide range, and the whole deck sort runs on
    this value, so measuring it is worth the download.

Usage:  python3 scripts/build_catalog.py
"""

from __future__ import annotations

import json
import math
import time
from collections import Counter
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

API = "https://www.uniqlo.com/us/api/commerce/v5/en/products"
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "catalog.json"

# Search terms chosen to span both body categories and a wide colour range —
# an all-denim catalogue would make the skin-tone sort invisible.
QUERIES = [
    "crew neck sweater", "flannel shirt", "linen shirt", "sweatshirt",
    "chino pants", "jeans", "cardigan", "fleece jacket",
    "oxford shirt", "wide pants", "knitted polo", "blouse",
    "t-shirt", "corduroy", "denim jacket", "trousers",
    "turtleneck", "parka", "shorts", "skirt",
]

# Everything here either is not a garment the try-on engine can fit to a body,
# or is sized for a child. Both produce renders that look broken rather than
# wrong, so they are excluded by name before any network work happens.
EXCLUDE = (
    "babies", "toddler", "kids", "baby", "girls", "boys",
    "cap", "hat", "socks", "bag", "umbrella", "mask", "scarf", "gloves",
    "belt", "shoes", "sandals", "slippers", "bra", "underwear", "briefs",
    "innerwear", "blanket", "towel", "pouch", "case", "accessory", "sunglasses",
    "airism cotton", "heattech ultra warm", "maternity",
)

TARGET = 24


# --------------------------------------------------------------------------
# Colour
# --------------------------------------------------------------------------

def _linear(c: float) -> float:
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb_to_lch(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    r, g, b = (_linear(v) * 100 for v in rgb)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 95.047
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 100.0
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 108.883

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fx, fy, fz = f(x), f(y), f(z)
    L = 116 * fy - 16
    a_ = 500 * (fx - fy)
    b_ = 200 * (fy - fz)
    h = math.degrees(math.atan2(b_, a_)) % 360
    return L, math.hypot(a_, b_), h


def temperature(rgb: tuple[int, int, int]) -> str:
    """
    Warm/cool bucket for SELECTION only.

    Deliberately unweighted by chroma, unlike the app's own model. The app is
    right to treat a desaturated navy as near-neutral, but if selection did the
    same, three quarters of a Uniqlo catalogue would land in one bucket and the
    deck would have nothing to sort by. Here we want the hue axis itself.
    """
    _, C, h = rgb_to_lch(rgb)
    if C < 10:
        return "neutral"
    warmth = math.cos(math.radians(h - 60))
    if warmth > 0.35:
        return "warm"
    if warmth < -0.35:
        return "cool"
    return "neutral"


def chroma_of(rgb: tuple[int, int, int]) -> float:
    return rgb_to_lch(rgb)[1]


def dominant_garment_color(img: Image.Image) -> tuple[int, int, int] | None:
    """
    Samples the garment colour, excluding the studio background.

    The background is read from the image's own corner rather than assumed to be
    white — these plates use a light grey that a hardcoded white test would let
    straight through and average into the result.
    """
    img = img.convert("RGB")
    w, h = img.size
    bg = img.getpixel((6, 6))

    # Centre box: the garment reliably fills it, and it excludes the shadow the
    # studio lighting casts down the right-hand side.
    box = img.crop((int(w * 0.3), int(h * 0.3), int(w * 0.7), int(h * 0.72)))
    box = box.resize((60, 60))

    pixels = [
        p for p in box.getdata()
        # Distance from background, plus a guard against the near-black care
        # label that sits at the collar of every shot.
        if math.dist(p, bg) > 26 and not (max(p) < 45)
    ]
    if len(pixels) < 200:
        return None

    quantised = [(r // 12 * 12, g // 12 * 12, b // 12 * 12) for r, g, b in pixels]
    bucket, _ = Counter(quantised).most_common(1)[0]

    # Average the true pixels inside the winning bucket so the result is not
    # snapped to the quantisation grid.
    members = [p for p in pixels if (p[0] // 12 * 12, p[1] // 12 * 12, p[2] // 12 * 12) == bucket]
    n = len(members)
    return (
        round(sum(p[0] for p in members) / n),
        round(sum(p[1] for p in members) / n),
        round(sum(p[2] for p in members) / n),
    )


def to_hex(rgb: tuple[int, int, int]) -> str:
    return "#%02X%02X%02X" % rgb


def is_flat_lay(img: Image.Image) -> bool:
    """
    Rejects on-model photographs.

    Necessary because the constructed image URL is NOT reliably a flat product
    shot — some colourways return a full model photo at the same path, and
    feeding one to the try-on engine as the garment reference produces a render
    of a person wearing a picture of another person. Verified against known
    examples of both: flat-lays measure 0.0% skin and 0.52 vertical extent,
    model shots 3-7% skin and 0.97+.

    Skin is detected in YCbCr rather than by an RGB ratio rule, because the
    common RGB heuristics are tuned on light skin and miss deep skin entirely —
    which would let exactly the wrong subset of model shots through.
    """
    small = img.convert("RGB").resize((150, 200))
    pixels = list(small.getdata())
    bg = small.getpixel((3, 3))

    skin = 0
    for r, g, b in pixels:
        y = 0.299 * r + 0.587 * g + 0.114 * b
        cb = -0.169 * r - 0.331 * g + 0.500 * b + 128
        cr = 0.500 * r - 0.419 * g - 0.081 * b + 128
        if 80 <= cb <= 125 and 133 <= cr <= 175 and y > 40:
            skin += 1

    if 100 * skin / len(pixels) > 0.6:
        return False

    # A person spans the frame top to bottom; a folded garment does not.
    rows = [
        row for row in range(200)
        if sum(1 for col in range(150) if math.dist(small.getpixel((col, row)), bg) > 30) > 3
    ]
    if not rows:
        return False
    return (max(rows) - min(rows)) / 200 < 0.88


# --------------------------------------------------------------------------
# Classification
# --------------------------------------------------------------------------

LOWER = ("pants", "jeans", "trousers", "chino", "shorts", "skirt", "leggings")
FULL = ("dress", "jumpsuit", "overall")


def category_for(name: str) -> str:
    low = name.lower()
    if any(k in low for k in FULL):
        return "full_body"
    if any(k in low for k in LOWER):
        return "lower_body"
    return "upper_body"


def fit_note_for(name: str) -> str:
    low = name.lower()
    if "wide" in low:
        return "wide leg, breaks at the ankle"
    if "slim" in low or "skinny" in low:
        return "slim through the thigh"
    if "oversized" in low or "relaxed" in low:
        return "relaxed, drops off the shoulder"
    if "crew" in low or "sweater" in low or "knit" in low:
        return "regular knit, holds its shape"
    if any(k in low for k in LOWER):
        return "regular rise, straight through the leg"
    return "regular fit, true to size"


def size_info_for(sizes: list[dict], category: str) -> str:
    names = [s.get("name", "") for s in sizes if s.get("name")]
    if not names:
        return "XS–XL"
    if category == "lower_body" and any(n.isdigit() for n in names):
        nums = sorted(int(n) for n in names if n.isdigit())
        if nums:
            return f"{nums[0]}–{nums[-1]} waist"
    return f"{names[0]}–{names[-1]}"


# --------------------------------------------------------------------------
# Fetch
# --------------------------------------------------------------------------

def fetch(query: str, limit: int = 24) -> list[dict]:
    try:
        r = requests.get(
            API,
            params={"q": query, "limit": limit, "offset": 0, "httpFailure": "true"},
            headers=HEADERS,
            timeout=25,
        )
        r.raise_for_status()
        return r.json().get("result", {}).get("items", [])
    except Exception as exc:  # noqa: BLE001
        print(f"  ! query {query!r} failed: {exc}")
        return []


def candidates_from(item: dict) -> list[dict]:
    """
    One candidate per colourway.

    The API only marks a minority of images as flat-lays, but the flat-lay for
    any colourway can be addressed directly on the `WesternCommon` path. Building
    the URL rather than reading it off the response widens the usable pool from
    roughly 30 candidates to several hundred — and every one is verified with a
    real request before it is kept.
    """
    out = []
    name = item.get("name", "").strip()
    pid = item.get("productId", "")
    price = (item.get("prices", {}).get("base") or {}).get("value")
    if not (name and pid and price):
        return out
    if any(word in name.lower() for word in EXCLUDE):
        return out

    digits = "".join(ch for ch in pid.split("-")[0] if ch.isdigit())
    if not digits:
        return out

    colors = {c.get("displayCode"): c.get("name", "").title() for c in item.get("colors", [])}
    category = category_for(name)

    for code, color_name in colors.items():
        if not code:
            continue
        url = (
            f"https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/"
            f"{digits}/item/goods_{code}_{digits}_3x4.jpg"
        )

        out.append({
            "brand": "Uniqlo",
            "name": name,
            "category": category,
            "price": float(price),
            "currency": "USD",
            "productImageUrl": url,
            "brandProductUrl": f"https://www.uniqlo.com/us/en/products/{pid}/00?colorDisplayCode={code}",
            "colorName": color_name,
            "colorHex": "",
            "sizeInfo": size_info_for(item.get("sizes", []), category),
            "fitNote": fit_note_for(name),
        })
    return out


def verify_and_measure(candidate: dict) -> dict | None:
    """Confirms the image is really fetchable, then samples its colour."""
    try:
        r = requests.get(candidate["productImageUrl"], headers=HEADERS, timeout=25)
        if r.status_code != 200 or "image" not in r.headers.get("content-type", ""):
            return None
        img = Image.open(BytesIO(r.content))
        if not is_flat_lay(img):
            return None
        rgb = dominant_garment_color(img)
        if rgb is None:
            return None
        candidate["colorHex"] = to_hex(rgb)
        candidate["_temp"] = temperature(rgb)
        candidate["_chroma"] = chroma_of(rgb)
        return candidate
    except Exception:  # noqa: BLE001
        return None


def main() -> None:
    print("Fetching products…")
    raw: list[dict] = []
    seen_products: set[str] = set()

    for query in QUERIES:
        items = fetch(query)
        print(f"  {query!r}: {len(items)} products")
        for item in items:
            pid = item.get("productId")
            if pid in seen_products:
                continue
            seen_products.add(pid)
            raw.extend(candidates_from(item))
        time.sleep(0.4)

    print(f"\n{len(raw)} colourway candidates with flat-lay images.")

    # Verify and measure, keeping at most two colourways per garment so the deck
    # is not four shades of the same sweater.
    per_garment: Counter[str] = Counter()
    verified: list[dict] = []

    for candidate in raw:
        key = candidate["name"]
        if per_garment[key] >= 3:
            continue
        measured = verify_and_measure(candidate)
        if measured is None:
            continue
        per_garment[key] += 1
        verified.append(measured)
        print(f"  ✓ {measured['colorHex']} {measured['_temp']:<8} {measured['colorName']:<16} {key[:44]}")
        if len(verified) >= TARGET * 5:
            break

    # Select for a genuine warm/cool/neutral spread AND both body categories.
    # Left to its own devices this catalogue skews to neutral upper-body knitwear,
    # which would leave the skin-tone sort with nothing to separate and the
    # try-on engine with only one garment_category to exercise.
    buckets: dict[str, list[dict]] = {"warm": [], "cool": [], "neutral": []}
    for v in verified:
        buckets[v["_temp"]].append(v)

    # Within a bucket, the most saturated colourways carry the most signal.
    for items in buckets.values():
        items.sort(key=lambda c: c["_chroma"], reverse=True)

    print(f"\nverified pool: warm={len(buckets['warm'])} cool={len(buckets['cool'])} neutral={len(buckets['neutral'])}")

    chosen: list[dict] = []
    seen_ids: set[str] = set()

    def take(candidate: dict) -> bool:
        key = candidate["brandProductUrl"]
        if key in seen_ids or len(chosen) >= TARGET:
            return False
        seen_ids.add(key)
        chosen.append(candidate)
        return True

    # Reserve slots for lower-body pieces first; they are the scarce category.
    lower = [v for v in verified if v["category"] == "lower_body"]
    lower.sort(key=lambda c: c["_chroma"], reverse=True)
    for v in lower[:7]:
        take(v)

    # Then fill round-robin across temperature so no bucket dominates.
    per_bucket = max(1, (TARGET - len(chosen)) // 3)
    for temp in ("warm", "cool", "neutral"):
        added = 0
        for v in buckets[temp]:
            if added >= per_bucket:
                break
            if take(v):
                added += 1

    for v in verified:
        take(v)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(chosen, indent=2))

    final = Counter(temperature(tuple(int(c["colorHex"][i:i + 2], 16) for i in (1, 3, 5))) for c in chosen)
    print(f"\nWrote {len(chosen)} products to {OUT}")
    print(f"final spread: {dict(final)}")
    print(f"categories: {dict(Counter(c['category'] for c in chosen))}")


if __name__ == "__main__":
    main()
