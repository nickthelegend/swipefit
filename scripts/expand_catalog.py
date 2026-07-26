"""
Expands src/data/catalog.json with additional brands, without touching the
COS / Uniqlo / Levi's entries already in the file.

Method is the one proved out in build_catalog.py: hit a public JSON commerce
API rather than scraping HTML, then verify every image with a real request and
a pixel test before it is allowed into the catalogue.

Sources, all public JSON, all found by probing rather than assuming:

  * H&M            api.hm.com/search-services (Elevate) — per-colourway
                   "DescriptiveStillLife" packshots, name, price, sizes.
  * Zara           www.zara.com/us/en/category/{id}/products?ajax=true
  * Massimo Dutti  same Inditex endpoint — MD categories are served through
                   zara.com, so one code path covers both brands.
  * Shopify stores /products.json, which returns everything (title, variants,
                   every image) with no key and no bot protection.

Two things from build_catalog.py are reused verbatim:
  is_flat_lay()            — rejects on-model photographs
  dominant_garment_color() — samples the real hex off the pixels

with one correction, see looks_like_flat_lay() below.

Usage:  python3 scripts/expand_catalog.py
"""

from __future__ import annotations

import json
import math
import re
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_catalog import (  # noqa: E402
    chroma_of,
    dominant_garment_color,
    is_flat_lay,
    rgb_to_lch,
    temperature,
    to_hex,
)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
HEADERS = {"User-Agent": UA, "Accept": "application/json, text/plain, */*"}
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "catalog.json"

TARGET_NEW = 36


# --------------------------------------------------------------------------
# Image verification
# --------------------------------------------------------------------------

def _skin_profile(img: Image.Image) -> tuple[float, float, tuple[int, int, int] | None]:
    """Skin-classified fraction, vertical extent, and mean colour of those pixels."""
    small = img.convert("RGB").resize((150, 200))
    pixels = list(small.getdata())
    bg = small.getpixel((3, 3))

    skin: list[tuple[int, int, int]] = []
    for r, g, b in pixels:
        y = 0.299 * r + 0.587 * g + 0.114 * b
        cb = -0.169 * r - 0.331 * g + 0.500 * b + 128
        cr = 0.500 * r - 0.419 * g - 0.081 * b + 128
        if 80 <= cb <= 125 and 133 <= cr <= 175 and y > 40:
            skin.append((r, g, b))

    rows = [
        row for row in range(200)
        if sum(1 for col in range(150) if math.dist(small.getpixel((col, row)), bg) > 30) > 3
    ]
    extent = (max(rows) - min(rows)) / 200 if rows else 1.0

    mean = None
    if skin:
        n = len(skin)
        mean = (
            round(sum(p[0] for p in skin) / n),
            round(sum(p[1] for p in skin) / n),
            round(sum(p[2] for p in skin) / n),
        )
    return 100 * len(skin) / len(pixels), extent, mean


def plain_background(img: Image.Image) -> bool:
    """
    True when the frame's border is a uniform studio sweep.

    Needed because the skin-colour rescue below has one blind spot: a cream
    garment on a model has skin pixels that really are close to the garment
    colour, so a cropped lifestyle shot can satisfy every other test. A Zara
    beach photograph reached the catalogue that way on the first build.

    Measured over 28 verified packshots the border's worst channel deviation is
    0.51 and the largest corner-to-corner distance is 1.7; the lifestyle frame
    scores 43.4 and 130.4. The thresholds below sit an order of magnitude above
    the packshots and far under the lifestyle shot.
    """
    small = img.convert("RGB").resize((120, 160))
    px = small.load()
    border = []
    for x in range(120):
        border += [px[x, 0], px[x, 1], px[x, 158], px[x, 159]]
    for y in range(160):
        border += [px[0, y], px[1, y], px[118, y], px[119, y]]
    spread = max(
        max(c) - min(c) if len(set(c)) == 1 else _pstdev(c)
        for c in zip(*border)
    )
    corners = [px[3, 3], px[116, 3], px[3, 156], px[116, 156]]
    worst = max(math.dist(a, b) for a in corners for b in corners)
    return spread < 4.0 and worst < 12.0


def _pstdev(values: tuple[int, ...]) -> float:
    n = len(values)
    mean = sum(values) / n
    return math.sqrt(sum((v - mean) ** 2 for v in values) / n)


def looks_like_flat_lay(img: Image.Image, garment: tuple[int, int, int] | None) -> bool:
    """
    is_flat_lay() plus a correction for warm garments.

    The reference test calls anything with >0.6% skin-range pixels a model shot.
    That is right for Uniqlo's largely cool/neutral range, but it also throws out
    every rust, terracotta, camel and clay garment — a maroon H&M packshot on a
    clean white sweep measures 9% "skin" purely because dark brown sits inside
    the YCbCr skin box. Those are exactly the colours this catalogue is short of,
    so silently dropping them would defeat the point of the expansion.

    What actually separates the two cases is not how much skin-toned area there
    is but whether it is the garment. Measured on known examples:

        warm packshot   9.1% "skin", extent 0.59, skin mean 21 from garment hex
        cream packshot  6.8% "skin", extent 0.56, skin mean 27 from garment hex
        model photo     3.5% skin,   extent 0.94, skin mean 180 from garment hex
        model photo    11.2% skin,   extent 0.97, skin mean 161 from garment hex

    So: accept whatever the reference test accepts, and additionally accept an
    image whose skin-range pixels are essentially the garment's own colour and
    which does not span the frame the way a person does.
    """
    if not plain_background(img):
        return False
    if is_flat_lay(img):
        return True
    if garment is None:
        return False
    pct, extent, mean = _skin_profile(img)
    if mean is None or extent >= 0.80:
        return False
    return math.dist(mean, garment) < 70


def verify_image(url: str) -> tuple[str, tuple[int, int, int]] | None:
    """HTTP 200 + content-type image/* + flat-lay + a sampled colour, or nothing."""
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
        if r.status_code != 200 or "image" not in r.headers.get("content-type", "").lower():
            return None
        img = Image.open(BytesIO(r.content))
        if min(img.size) < 300:
            return None
        rgb = dominant_garment_color(img)
        if rgb is None:
            return None
        if not looks_like_flat_lay(img, rgb):
            return None
        return to_hex(rgb), rgb
    except Exception:  # noqa: BLE001
        return None


# --------------------------------------------------------------------------
# Classification
# --------------------------------------------------------------------------

# Word-boundary matching throughout. Substring matching is what turned
# "Short Sleeve Linen Shirt" into a lower_body item on the first pass, and
# "Cosmos Organic - Hand Soap" into a garment.
LOWER_RE = re.compile(
    r"\b(pants?|trousers?|jeans?|chinos?|shorts|bermudas?|skirts?|leggings?"
    r"|joggers?|sweatpants?|culottes?|cargos?|jorts)\b")
FULL_RE = re.compile(r"\b(dress|dresses|jumpsuits?|rompers?|playsuits?|boilersuits?|coveralls?|dungarees)\b")
GARMENT_RE = re.compile(
    r"\b(shirts?|tees?|t-shirts?|tops?|blouses?|sweaters?|jumpers?|knits?|knitwear"
    r"|cardigans?|hoodies?|sweatshirts?|jackets?|coats?|blazers?|overshirts?|polos?"
    r"|dress|dresses|pants?|trousers?|jeans?|chinos?|shorts|skirts?|jumpsuits?"
    r"|vests?|gilets?|parkas?|tanks?|turtlenecks?|pullovers?|bombers?|trench"
    r"|waistcoats?|camisoles?|bodysuits?|rompers?|anoraks?|leggings?|joggers?)\b")

EXCLUDE_RE = re.compile(
    r"\b(kids?|baby|babies|toddler|children|socks?|hats?|caps?|beanies?|scarf|scarves"
    r"|gloves?|belts?|bags?|totes?|backpacks?|shoes?|sneakers?|boots?|sandals?|loafers?"
    r"|slippers?|trainers?|underwear|boxers?|briefs?|thongs?|boyshorts?|bras?|lingerie"
    r"|swim\w*|bikinis?|trunks|boardshorts?|sunglasses|watch|wallets?|towels?|blankets?|candles?"
    r"|fragrance|perfume|soap|shampoo|lotion|cream\s+cleanser|keyring|necklaces?|earrings?"
    r"|bracelets?|pouches?|cardholders?|masks?|gift\s+cards?|stickers?|umbrellas?|ties?"
    r"|cufflinks?|robes?|pyjamas?|pajamas?|nightwear|loungewear\s+set|\d+[- ]pack|multipack|pack\s+of)\b")
PATTERN_RE = re.compile(
    r"\b(stripe[ds]?|check(ed)?|gingham|print(ed)?|floral|plaid|tartan|leopard"
    r"|camo|camouflage|polka|paisley|houndstooth|argyle|colou?rblock|tie[- ]dye"
    r"|patterned|graphic|jacquard|fair\s*isle)\b")
NON_APPAREL_TYPE = re.compile(
    r"bag|shoe|accessor|beauty|home|sock|hat|belt|jewel|fragrance|care|candle|gift"
    r"|underwear|swim|lingerie|sunglass|scarf|glove|wallet|footwear|grooming|small\s+leather")


def category_for(text: str) -> str:
    low = f" {text.lower()} "
    # "shirt dress" is a dress; "dress shirt" and "dress pants" are not.
    if re.search(r"\bshirt\s*dress\b", low):
        return "full_body"
    if re.search(r"\bdress\s+(shirt|trouser|pant)", low):
        return LOWER_RE.search(low) and "lower_body" or "upper_body"
    if LOWER_RE.search(low):
        return "lower_body"
    if FULL_RE.search(low):
        return "full_body"
    return "upper_body"


def excluded(text: str) -> bool:
    return bool(EXCLUDE_RE.search(text.lower()))


def is_garment(text: str) -> bool:
    return bool(GARMENT_RE.search(text.lower()))


# Fit notes are looked up per body category, because the cut vocabulary does not
# transfer: "relaxed" on a trouser is not "drops off the shoulder".
FIT_RULES_LOWER: list[tuple[str, str]] = [
    (r"wide[- ]?leg|palazzo|parachute", "wide leg, breaks at the ankle"),
    (r"flare", "high rise, flares below the knee"),
    (r"bootcut", "fitted thigh, opens below the knee"),
    (r"balloon|barrel", "rounded through the thigh, narrow hem"),
    (r"baggy", "baggy through hip and thigh"),
    (r"cargo", "straight leg, patch pockets at the thigh"),
    (r"jogger", "elasticated cuff, tapered leg"),
    (r"sweatpant|sweat pant", "elasticated waist, relaxed leg"),
    (r"pleated|pleat", "pleated front, straight leg"),
    (r"skinny", "skinny through thigh and calf"),
    (r"taper", "roomy hip, tapers to the ankle"),
    (r"slim", "slim through the thigh"),
    (r"loose|relaxed", "loose through hip and leg"),
    (r"straight", "straight leg, sits at the waist"),
    (r"midi skirt|midi", "straight cut, falls mid calf"),
    (r"mini skirt|mini", "straight cut, sits above the knee"),
    (r"maxi", "column cut, falls to the ankle"),
    (r"\bskirt", "straight cut, falls below the knee"),
    (r"\bshorts?\b|bermuda|jort", "mid thigh, flat front"),
    (r"chino", "flat front, straight through the leg"),
]
FIT_RULES_UPPER: list[tuple[str, str]] = [
    (r"overshirt", "boxy overshirt, drops at hip"),
    (r"oversize", "oversized, drops off the shoulder"),
    (r"boxy", "boxy, drops at hip"),
    (r"cropped|crop ", "cropped, sits above the waist"),
    (r"blazer", "structured shoulder, single breasted"),
    (r"trench", "straight cut, belted at the waist"),
    (r"parka", "long cut, drops below the hip"),
    (r"puffer|padded|quilted", "boxy, padded through the body"),
    (r"bomber", "boxy, ribbed hem and cuff"),
    (r"hoodie|hooded", "relaxed hood, ribbed hem"),
    (r"sweatshirt", "regular fit, ribbed hem and cuff"),
    (r"cardigan", "regular knit, buttons through"),
    (r"turtleneck|polo neck|roll neck|funnel", "close knit, high rolled neck"),
    (r"crew ?neck", "regular knit, ribbed crew neck"),
    (r"relaxed", "relaxed, dropped shoulder"),
    (r"slim", "slim through body and sleeve"),
    (r"polo", "regular fit, ribbed placket"),
    (r"cashmere|merino|cable|sweater|jumper|knit", "regular knit, holds its shape"),
    (r"tank|camisole", "close fit, cut away at the arm"),
    (r"t-?shirt|\btee\b", "regular fit, straight hem"),
    (r"blouse", "soft drape, falls at the hip"),
    (r"shirt", "regular fit, straight point collar"),
    (r"jacket", "regular fit, hits at the hip"),
    (r"coat", "straight cut, falls below the knee"),
    (r"vest|waistcoat|gilet", "close fit, cut away at the arm"),
    (r"top", "regular fit, straight hem"),
]
FIT_RULES_FULL: list[tuple[str, str]] = [
    (r"shirt ?dress", "straight cut, buttons through"),
    (r"wrap", "wrap front, ties at the waist"),
    (r"maxi", "column cut, falls to the ankle"),
    (r"midi", "straight cut, falls mid calf"),
    (r"mini", "straight cut, sits above the knee"),
    (r"halter|strappy|slip", "narrow strap, straight through the body"),
    (r"jumpsuit", "straight leg, sits at the natural waist"),
    (r"flare", "fitted bodice, flares from the waist"),
]


def fit_note_for(text: str, category: str) -> str:
    rules = {
        "lower_body": FIT_RULES_LOWER,
        "full_body": FIT_RULES_FULL,
    }.get(category, FIT_RULES_UPPER)
    low = text.lower()
    for pattern, note in rules:
        if re.search(pattern, low):
            return note
    return {
        "lower_body": "regular rise, straight through the leg",
        "full_body": "straight cut, falls at the knee",
    }.get(category, "regular fit, true to size")


# --------------------------------------------------------------------------
# Colour families
#
# Used for three jobs: naming a colourway when the brand does not publish one
# (Norse Projects ships no colour data at all), catching brand names that
# contradict the pixels, and steering selection towards the palette the deck
# sort actually needs rather than whatever happens to be most saturated.
# --------------------------------------------------------------------------

PALETTE: list[tuple[str, str, str, str]] = [
    # name, hex, basic bucket, warm/cool/neutral
    ("Black",       "#1C1C1C", "black",  "neutral"),
    ("Charcoal",    "#35383B", "grey",   "cool"),
    ("Slate",       "#55606B", "grey",   "cool"),
    ("Cool Grey",   "#9AA0A6", "grey",   "cool"),
    ("Light Grey",  "#C9CCD1", "grey",   "neutral"),
    ("White",       "#F5F5F3", "white",  "cool"),
    ("Cream",       "#F2EADC", "beige",  "warm"),
    ("Ecru",        "#E7DFCC", "beige",  "warm"),
    ("Oatmeal",     "#DCD2C0", "beige",  "neutral"),
    ("Stone",       "#C9BFB0", "beige",  "neutral"),
    ("Taupe",       "#A99C8E", "beige",  "neutral"),
    ("Sand",        "#D8C7A8", "beige",  "warm"),
    ("Camel",       "#B8925F", "beige",  "warm"),
    ("Khaki",       "#8A8055", "green",  "warm"),
    ("Olive",       "#5C6141", "green",  "warm"),
    ("Forest",      "#24402E", "green",  "cool"),
    ("Sage",        "#A9B99C", "green",  "cool"),
    ("Green",       "#2E7D4F", "green",  "cool"),
    ("Teal",        "#256B6B", "blue",   "cool"),
    ("Navy",        "#1B2440", "blue",   "cool"),
    ("Indigo",      "#38455E", "blue",   "neutral"),
    ("Denim Blue",  "#4A6A8F", "blue",   "neutral"),
    ("Sky Blue",    "#A9C9E0", "blue",   "cool"),
    ("Blue",        "#2D5FA8", "blue",   "cool"),
    ("Purple",      "#6B4C93", "purple", "cool"),
    ("Plum",        "#5A3A4E", "purple", "cool"),
    ("Lilac",       "#B7A8CE", "purple", "cool"),
    ("Blush",       "#EAC9C6", "pink",   "warm"),
    ("Pink",        "#E6A2B4", "pink",   "cool"),
    ("Fuchsia",     "#C4177A", "pink",   "cool"),
    ("Mahogany",    "#4E241A", "brown",  "warm"),
    ("Burgundy",    "#5A2029", "red",    "cool"),
    ("Red",         "#B3231F", "red",    "warm"),
    ("Tomato",      "#D6432F", "red",    "warm"),
    ("Rust",        "#9A4A22", "orange", "warm"),
    ("Terracotta",  "#B4573A", "orange", "warm"),
    ("Orange",      "#D97428", "orange", "warm"),
    ("Mustard",     "#C9962C", "yellow", "warm"),
    ("Yellow",      "#E8C64A", "yellow", "warm"),
    ("Chocolate",   "#3E2F27", "brown",  "warm"),
    ("Tobacco",     "#6B4B32", "brown",  "warm"),
    ("Mocha",       "#7A6355", "brown",  "warm"),
    ("Brown",       "#5A4033", "brown",  "warm"),
]

# Brand colour vocabulary → basic bucket, for catching a published colour name
# that the pixels contradict (a "Neon Pink" record whose packshot measures
# #424250 is not the garment the shopper will be shown).
COLOR_WORDS: dict[str, str] = {
    "black": "black", "jet": "black", "onyx": "black", "noir": "black",
    "white": "white", "ivory": "white", "chalk": "white", "optic": "white",
    "grey": "grey", "gray": "grey", "charcoal": "grey", "anthracite": "grey",
    "slate": "grey", "graphite": "grey", "silver": "grey", "ash": "grey",
    "beige": "beige", "cream": "beige", "ecru": "beige", "oatmeal": "beige",
    "stone": "beige", "taupe": "beige", "sand": "beige", "camel": "beige",
    "nude": "beige", "natural": "beige", "oat": "beige", "bone": "beige",
    "brown": "brown", "chocolate": "brown", "tobacco": "brown", "mocha": "brown",
    "coffee": "brown", "walnut": "brown", "chestnut": "brown", "espresso": "brown",
    "green": "green", "olive": "green", "khaki": "green", "forest": "green",
    "sage": "green", "moss": "green", "loden": "green", "pistachio": "green",
    "blue": "blue", "navy": "blue", "indigo": "blue", "denim": "blue",
    "cobalt": "blue", "teal": "blue", "aqua": "blue", "sky": "blue", "marine": "blue",
    "purple": "purple", "plum": "purple", "lilac": "purple", "lavender": "purple",
    "violet": "purple", "aubergine": "purple", "mauve": "purple",
    "pink": "pink", "fuchsia": "pink", "magenta": "pink", "rose": "pink", "blush": "pink",
    "red": "red", "burgundy": "red", "wine": "red", "maroon": "red", "cherry": "red",
    "scarlet": "red", "crimson": "red", "bordeaux": "red", "claret": "red",
    "orange": "orange", "rust": "orange", "terracotta": "orange", "apricot": "orange",
    "coral": "orange", "brick": "orange", "clay": "orange",
    "yellow": "yellow", "mustard": "yellow", "gold": "yellow", "ochre": "yellow",
}


def _lab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    L, C, h = rgb_to_lch(rgb)
    return L, C * math.cos(math.radians(h)), C * math.sin(math.radians(h))


def nearest_family(rgb: tuple[int, int, int]) -> tuple[str, str, str]:
    """(display name, basic bucket, warm/cool/neutral) of the closest palette entry."""
    target = _lab(rgb)
    best = min(
        PALETTE,
        key=lambda p: math.dist(target, _lab(tuple(int(p[1][i:i + 2], 16) for i in (1, 3, 5)))),
    )
    return best[0], best[2], best[3]


def color_name_agrees(brand_name: str, bucket: str, rgb: tuple[int, int, int] | None = None) -> bool:
    """False only when the brand names a colour family the pixels contradict."""
    words = re.findall(r"[a-z]+", (brand_name or "").lower())
    claimed = {COLOR_WORDS[w] for w in words if w in COLOR_WORDS}
    if not claimed:
        return True

    # Lightness guard. A ribbed black dress can sample to #8B8A87 because the
    # knit's highlights beat the shadow for pixel share, and "black" plus a mid
    # grey hex is the one disagreement the family buckets let through — grey is
    # a legal neighbour of black. The deck sorts on lightness, so this matters.
    if rgb is not None:
        L = rgb_to_lch(rgb)[0]
        if "black" in claimed and L > 42:
            return False
        if "white" in claimed and L < 72:
            return False
    compatible = {
        "beige": {"beige", "white", "brown"},
        "brown": {"brown", "beige", "orange", "red"},
        "white": {"white", "beige", "grey"},
        "grey": {"grey", "black", "white", "blue"},
        "black": {"black", "grey"},
        "blue": {"blue", "grey", "purple"},
        "green": {"green", "beige", "grey"},
        "red": {"red", "pink", "orange", "purple", "brown"},
        "pink": {"pink", "red", "purple", "beige"},
        "purple": {"purple", "blue", "pink", "grey"},
        "orange": {"orange", "red", "brown", "yellow"},
        "yellow": {"yellow", "orange", "beige", "green"},
    }
    return any(bucket in compatible.get(c, {c}) for c in claimed)


def size_range(labels: list[str], category: str, womens: bool = False) -> str:
    """
    Numeric size labels are only waist measurements on menswear. H&M's ladies
    jeans run 2–18 and A.P.C.'s womenswear runs FR 34–42; calling either of
    those "waist" would print a garment size that does not exist.
    """
    labels = [str(s).strip() for s in labels if str(s).strip()]
    order = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "3XL", "4XL"]
    letters = [s.upper() for s in labels if s.upper() in order]
    if letters:
        idx = sorted({order.index(s) for s in letters})
        return f"{order[idx[0]]}–{order[idx[-1]]}"

    nums = sorted({
        int(s.split("/")[0]) for s in labels
        if re.fullmatch(r"\d{1,2}(/\d{1,2})?", s.strip())
    })
    if len(nums) >= 2:
        if womens:
            return f"FR {nums[0]}–{nums[-1]}" if nums[0] >= 30 else f"US {nums[0]}–{nums[-1]}"
        if 24 <= nums[0] and nums[-1] <= 48:
            unit = "chest" if category == "upper_body" else "waist"
            return f"{nums[0]}–{nums[-1]} {unit}"
        return f"US {nums[0]}–{nums[-1]}"

    if category == "upper_body":
        return "XS–XL"
    if womens:
        return "US 0–14"
    return "28–38 waist" if category == "lower_body" else "XS–XL"


def clean_name(name: str) -> str:
    for _ in range(3):
        name = re.sub(r"\s*[-–—(]\s*(final\s*sale|sale|outerworn|clearance|last\s*chance)\s*[)]*\s*$",
                      "", name, flags=re.I)
    name = re.sub(r"\s*\((?:M|W|F|Men|Women)\)\s*$", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip(" -|")
    if name.isupper():
        name = name.title()
    return name


def clean_color(color: str) -> str:
    color = re.sub(r"\s+", " ", color or "").strip(" -|")
    # Massimo Dutti publishes bare numeric colour codes ("456"); those are not a
    # colour name a shopper can read, so they are dropped and the name is taken
    # from the measured pixels instead.
    if not re.search(r"[a-zA-Z]{3}", color):
        return ""
    # "Navy / White" cannot be represented by one hex, and the sampled dominant
    # of a two-tone garment is a blend of neither.
    if re.search(r"[/&+]|\bmulti\b", color, re.I):
        return ""
    return color.title()


# --------------------------------------------------------------------------
# H&M
# --------------------------------------------------------------------------

HM_API = "https://api.hm.com/search-services/v1/en_US/listing/resultpage"
HM_CATEGORIES = [
    "men_shirts", "men_tshirtstanks", "men_trousers", "men_jeans",
    "men_cardigansjumpers", "men_hoodiessweatshirts", "men_jacketscoats",
    "ladies_dresses", "ladies_trousers", "ladies_jeans", "ladies_skirts",
    "ladies_cardigansjumpers", "ladies_tops", "ladies_blazersandwaistcoats",
]


def harvest_hm() -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for cat in HM_CATEGORIES:
        for page in (1, 2):
            try:
                r = requests.get(
                    HM_API,
                    params={
                        "pageSource": "PLP", "page": page, "sort": "RELEVANCE",
                        "categoryId": cat, "pageId": f"/{cat}", "page-size": 36,
                        "touchPoint": "DESKTOP", "skipStockCheck": "false",
                    },
                    headers=HEADERS, timeout=30,
                )
                r.raise_for_status()
                products = r.json()["plpList"]["productList"]
            except Exception as exc:  # noqa: BLE001
                print(f"  ! H&M {cat} p{page}: {exc}")
                continue

            for p in products:
                name = clean_name(p.get("productName", ""))
                if not name or excluded(name) or not is_garment(name):
                    continue
                if PATTERN_RE.search(name.lower()):
                    continue
                prices = {x["priceType"]: x["price"] for x in p.get("prices", [])}
                price = prices.get("redPrice") or prices.get("whitePrice")
                if not price:
                    continue
                category = category_for(name)
                womens = cat.startswith("ladies")
                sizes = size_range([s.get("label", "") for s in p.get("sizes", [])], category, womens)

                variants = [{
                    "articleId": p.get("id"),
                    "colorName": p.get("colorName", ""),
                    "url": p.get("url", ""),
                    "image": (p.get("productImageInfo") or {}).get("url"),
                }]
                for sw in p.get("swatches", []):
                    variants.append({
                        "articleId": sw.get("articleId"),
                        "colorName": sw.get("colorName", ""),
                        "url": sw.get("url", ""),
                        "image": sw.get("productImage"),
                    })

                for v in variants:
                    if not v["image"] or not v["articleId"] or v["articleId"] in seen:
                        continue
                    seen.add(v["articleId"])
                    out.append({
                        "brand": "H&M",
                        "name": name,
                        "category": category,
                        "price": round(float(price), 2),
                        "currency": "USD",
                        "productImageUrl": v["image"],
                        "brandProductUrl": "https://www2.hm.com" + (v["url"] or f"/en_us/productpage.{v['articleId']}.html"),
                        "colorName": "" if PATTERN_RE.search((v["colorName"] or "").lower()) else clean_color(v["colorName"]),
                        "colorHex": "",
                        "sizeInfo": sizes,
                        "fitNote": fit_note_for(name, category),
                    })
            time.sleep(0.2)
    return out


# --------------------------------------------------------------------------
# Inditex (Zara + Massimo Dutti, same endpoint)
# --------------------------------------------------------------------------

INDITEX_GRID = "https://www.zara.com/us/en/category/{cid}/products?ajax=true"
INDITEX_PDP = {
    "Zara": "https://www.zara.com/us/en/{kw}-p{pid}.html",
    "Massimo Dutti": "https://www.massimodutti.com/us/{kw}-l{pid}.html",
}
ZARA_CATEGORIES = [
    2579028, 2578528, 2551442, 2578029, 2579029, 2444334, 2432075, 2432100,
    2728908, 2431959, 2431960, 2420337, 2420324, 2490844, 2491844, 2490344,
    2420430, 2467842, 2491345,
]
MD_CATEGORIES = [
    2437436, 2440339, 2439336, 2437432, 2439837, 2437434, 2436117, 2437337,
    2437338, 2437340, 2437371, 2432439, 2434578, 2434575, 2626648, 2436154,
]


def _inditex_items(cid: int) -> list[dict]:
    try:
        r = requests.get(INDITEX_GRID.format(cid=cid), headers=HEADERS, timeout=40)
        r.raise_for_status()
        data = r.json()
    except Exception as exc:  # noqa: BLE001
        print(f"  ! inditex {cid}: {exc}")
        return []
    comps: list[dict] = []
    for group in data.get("productGroups", []):
        for element in group.get("elements", []):
            comps += element.get("commercialComponents", []) or []
    return [c for c in comps if c.get("type") == "Product" and c.get("kind") == "Wear"]


def harvest_inditex(brand: str, categories: list[int]) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for cid in categories:
        for product in _inditex_items(cid):
            name = clean_name(product.get("name", ""))
            price = product.get("price")
            seo = product.get("seo", {})
            if not name or not price or not seo.get("keyword"):
                continue
            if excluded(name) or not is_garment(name):
                continue
            if PATTERN_RE.search(name.lower()):
                continue
            womens = (product.get("sectionName") or "").upper().startswith("WOMAN")
            category = category_for(name)
            pid = str(seo["seoProductId"])
            pdp = INDITEX_PDP[brand].format(
                kw=seo["keyword"],
                pid=pid if brand == "Zara" else pid.lstrip("0"),
            )
            for color in product.get("detail", {}).get("colors", []):
                key = color.get("reference") or f"{pid}-{color.get('id')}"
                if key in seen:
                    continue
                seen.add(key)
                # Prefer the packshot: Inditex names it "-p" (kind "full") and
                # the still-life alternate "-e1" (kind "plain"). Everything else
                # on the record is a lookbook frame.
                media = color.get("xmedia", []) or []
                ranked = sorted(
                    media,
                    key=lambda m: 0 if m.get("kind") == "full" else 1 if m.get("kind") == "plain" else 2,
                )
                urls = [
                    m["url"].replace("{width}", "1024")
                    for m in ranked
                    if m.get("type") == "image" and m.get("url")
                ][:3]
                if not urls:
                    continue
                out.append({
                    "brand": brand,
                    "name": name,
                    "category": category,
                    "price": round(float(color.get("price") or price) / 100, 2),
                    "currency": "USD",
                    "productImageUrl": urls[0],
                    "_altImages": urls[1:],
                    "brandProductUrl": pdp,
                    "colorName": clean_color(color.get("name", "")) if not PATTERN_RE.search((color.get("name") or "").lower()) else "",
                    "colorHex": "",
                    "sizeInfo": size_range([s.get("name", "") for s in color.get("sizes", [])], category, womens),
                    "fitNote": fit_note_for(name, category),
                })
        time.sleep(0.2)
    return out


# --------------------------------------------------------------------------
# Shopify
# --------------------------------------------------------------------------

SHOPIFY = {
    "Ted Baker": "https://www.tedbaker.com",
    "A.P.C.": "https://www.apc-us.com",
    "Faherty": "https://fahertybrand.com",
    "Marine Layer": "https://www.marinelayer.com",
    "Alo Yoga": "https://www.aloyoga.com",
    "Norse Projects": "https://www.norseprojects.com",
    "Outerknown": "https://www.outerknown.com",
    "Sunspel": "https://www.sunspel.com",
}


def harvest_shopify(brand: str, host: str, pages: int = 4) -> list[dict]:
    out: list[dict] = []
    for page in range(1, pages + 1):
        products = None
        # Shopify storefronts throttle hard on /products.json; a 429 here is a
        # pause, not a dead source, and giving up on it silently loses a brand.
        for attempt in range(4):
            try:
                r = requests.get(f"{host}/products.json", params={"limit": 250, "page": page},
                                 headers=HEADERS, timeout=40)
                if r.status_code == 429:
                    time.sleep(6 * (attempt + 1))
                    continue
                r.raise_for_status()
                products = r.json().get("products", [])
                break
            except Exception as exc:  # noqa: BLE001
                print(f"  ! {brand} p{page} attempt {attempt + 1}: {exc}")
                time.sleep(4)
        if products is None:
            break
        if not products:
            break

        for p in products:
            raw = clean_name(p.get("title", ""))
            ptype = (p.get("product_type") or "").strip()
            blob = f"{raw} {ptype}"
            # product_type is the reliable signal on Shopify; the title alone
            # let a hand soap and a pair of knickers into the first build.
            if NON_APPAREL_TYPE.search(ptype.lower()) or excluded(blob) or not is_garment(blob):
                continue
            if PATTERN_RE.search(blob.lower()):
                continue

            opts = {o.get("name", "").lower(): o.get("values", []) for o in p.get("options", [])}
            # Colour lives in a different place at every store: Sunspel puts it
            # in the title after " in ", A.P.C. in a "CODE - Colour" option,
            # Norse Projects publishes none at all (filled from pixels later).
            name, colour = raw, ""
            m = re.search(r"^(.*?)\s+in\s+([A-Za-z][A-Za-z /'-]+)$", raw)
            if m:
                name, colour = m.group(1).strip(), m.group(2).strip()
            if not colour:
                opt = (opts.get("color") or opts.get("colour") or [""])[0]
                colour = opt.split(" - ")[-1] if " - " in opt else opt
            if colour and PATTERN_RE.search(colour.lower()):
                colour = ""
            if not colour and " - " in raw:
                head, _, tail = raw.partition(" - ")
                if is_garment(head) and not is_garment(tail):
                    name, colour = head.strip(), tail.strip()

            variants = p.get("variants", [])
            if not variants:
                continue
            price = float(variants[0].get("price") or 0)
            if price <= 0:
                continue

            category = category_for(f"{name} {ptype}")
            womens = bool(re.search(r"\bwomen|\bladies|gender:female", f"{blob} {p.get('tags')}", re.I))
            sizes = size_range(opts.get("size", []), category, womens)
            images = [i.get("src") for i in p.get("images", []) if i.get("src")][:4]
            if not images:
                continue
            out.append({
                "brand": brand,
                "name": clean_name(name),
                "category": category,
                "price": round(price, 2),
                "currency": "USD",
                "productImageUrl": images[0],
                "_altImages": images[1:],
                "brandProductUrl": f"{host}/products/{p.get('handle')}",
                "colorName": clean_color(colour),
                "colorHex": "",
                "sizeInfo": sizes,
                "fitNote": fit_note_for(f"{name} {ptype}", category),
            })
        time.sleep(0.2)
    return out


# --------------------------------------------------------------------------
# Verify pool
# --------------------------------------------------------------------------

def verify(candidate: dict) -> dict | None:
    """Try the candidate's images in order; keep the first that is a real flat-lay."""
    urls = [candidate["productImageUrl"], *candidate.pop("_altImages", [])]
    for url in urls:
        got = verify_image(url)
        if got is None:
            continue
        hexcode, rgb = got
        family, bucket, temp = nearest_family(rgb)
        published = candidate.get("colorName", "")
        # A published colour name the pixels contradict means the record and the
        # image are not the same colourway; the shopper would be shown one thing
        # and sorted on another, so the candidate is dropped rather than patched.
        if published and not color_name_agrees(published, bucket, rgb):
            return None
        candidate["productImageUrl"] = url
        candidate["colorHex"] = hexcode
        candidate["colorName"] = published or family
        candidate["_temp"] = temp
        candidate["_hue_temp"] = temperature(rgb)
        candidate["_family"] = family
        candidate["_chroma"] = chroma_of(rgb)
        return candidate
    candidate.pop("_altImages", None)
    return None


def verify_all(pool: list[dict], workers: int = 12) -> list[dict]:
    with ThreadPoolExecutor(max_workers=workers) as ex:
        return [c for c in ex.map(verify, pool) if c]


# Brands kept after measuring flat-lay yield on a 30-item sample of each pool.
# Ted Baker (2/30), Faherty (2/30), Marine Layer (6/30) and Alo Yoga (0/30)
# photograph almost everything on a model, so they cannot supply a try-on
# reference image and are dropped rather than padded out with bad URLs.
KEEP_BRANDS = ["H&M", "Zara", "Massimo Dutti", "A.P.C.", "Sunspel", "Outerknown"]

PER_BRAND = 7
LOWER_FLOOR = 13
FULL_FLOOR = 3


def _dedupe_key(c: dict) -> str:
    return f"{c['brand']}|{c['name'].lower()}"


def select(verified: list[dict], target: int) -> list[dict]:
    """
    Greedy fill against three quotas at once: brand, body category and colour
    temperature. Left unconstrained this pool collapses to neutral upper-body
    knitwear, which is the one shape that makes both the skin-tone sort and the
    outfit builder useless.
    """
    want_temp = {"warm": target // 3, "cool": target // 3, "neutral": target - 2 * (target // 3)}
    want_cat = {"lower_body": LOWER_FLOOR, "full_body": FULL_FLOOR}
    have_brand: Counter[str] = Counter()
    have_temp: Counter[str] = Counter()
    have_cat: Counter[str] = Counter()
    used_names: Counter[str] = Counter()
    chosen: list[dict] = []
    picked_hex: list[tuple[int, int, int]] = []

    have_family: Counter[str] = Counter()
    pool = list(verified)
    remaining = list(range(len(pool)))

    def score(c: dict) -> float | None:
        if used_names[_dedupe_key(c)] >= 1:
            return None
        lo, _, hi = c["sizeInfo"].partition("–")
        if not hi or lo.strip() == hi.strip():
            return None
        if have_brand[c["brand"]] >= PER_BRAND:
            return None
        rgb = tuple(int(c["colorHex"][i:i + 2], 16) for i in (1, 3, 5))
        if any(math.dist(rgb, p) < 22 for p in picked_hex):
            return None
        s = 0.0
        s += 16.0 * max(0, want_temp[c["_temp"]] - have_temp[c["_temp"]])
        s += 5.0 * max(0, want_cat.get(c["category"], 0) - have_cat[c["category"]])
        s += 3.0 * (PER_BRAND - have_brand[c["brand"]])
        # Spread across named families, so the "warm" third is camel/rust/olive
        # and not six variations on the same clay.
        s -= 2.5 * max(0, have_family[c["_family"]] - 3)
        return s

    while len(chosen) < target and remaining:
        best_i, best_s = None, -1e9
        for i in remaining:
            sc = score(pool[i])
            if sc is not None and sc > best_s:
                best_i, best_s = i, sc
        if best_i is None:
            break
        best = pool[best_i]
        remaining.remove(best_i)
        chosen.append(best)
        have_brand[best["brand"]] += 1
        have_temp[best["_temp"]] += 1
        have_cat[best["category"]] += 1
        have_family[best["_family"]] += 1
        used_names[_dedupe_key(best)] += 1
        picked_hex.append(tuple(int(best["colorHex"][i:i + 2], 16) for i in (1, 3, 5)))
    return chosen


def harvest_all() -> dict[str, list[dict]]:
    pools: dict[str, list[dict]] = {}
    pools["H&M"] = harvest_hm()
    pools["Zara"] = harvest_inditex("Zara", ZARA_CATEGORIES)
    pools["Massimo Dutti"] = harvest_inditex("Massimo Dutti", MD_CATEGORIES)
    for brand, host in SHOPIFY.items():
        pools[brand] = harvest_shopify(brand, host)
    return pools


def main() -> None:
    cache = ROOT / "scripts" / ".catalog_pool.json"
    if cache.exists():
        pools = json.loads(cache.read_text())
    else:
        print("Harvesting…")
        pools = harvest_all()
        cache.write_text(json.dumps(pools))
    for brand, pool in pools.items():
        print(f"  {brand:16} {len(pool):5} colourway candidates")

    global PER_BRAND
    brands = [b for b in KEEP_BRANDS if pools.get(b)]
    PER_BRAND = max(PER_BRAND, -(-TARGET_NEW // len(brands)) + 1)

    vcache = ROOT / "scripts" / ".catalog_verified.json"
    if vcache.exists():
        verified = [
            c for c in json.loads(vcache.read_text())
            if c["brand"] in brands
            and color_name_agrees(
                c["colorName"],
                nearest_family(tuple(int(c["colorHex"][i:i + 2], 16) for i in (1, 3, 5)))[1],
                tuple(int(c["colorHex"][i:i + 2], 16) for i in (1, 3, 5)),
            )
        ]
        print(f"\nreusing {len(verified)} verified items from {vcache.name}")
    else:
        print("\nVerifying images (HTTP 200 + image/* + flat-lay + sampled hex)…")
        verified = []
        for brand in brands:
            pool = [dict(c) for c in pools[brand]]
            # Spread the verification budget over the whole pool rather than the
            # first N, which would all come from one category.
            pool.sort(key=lambda c: (c["name"], c["colorName"]))
            step = max(1, len(pool) // 120)
            ok = verify_all(pool[::step][:120], workers=16)
            print(f"  {brand:16} {len(ok):3} verified")
            verified += ok
        vcache.write_text(json.dumps(verified))

    chosen = select(verified, TARGET_NEW)

    # Keep the original catalogue untouched, and make re-runs idempotent by
    # dropping anything a previous run of this script appended.
    ORIGINAL = {"COS", "Uniqlo", "Levi's"}
    existing = [c for c in json.loads(OUT.read_text()) if c["brand"] in ORIGINAL]
    for c in chosen:
        for key in ("_temp", "_hue_temp", "_family", "_chroma"):
            c.pop(key, None)
    combined = existing + chosen
    OUT.write_text(json.dumps(combined, indent=1) + "\n")

    print(f"\nwrote {len(combined)} items ({len(existing)} kept + {len(chosen)} new)")
    for label, rows in (("added", chosen), ("catalogue", combined)):
        temps = Counter(
            nearest_family(tuple(int(c["colorHex"][i:i + 2], 16) for i in (1, 3, 5)))[2]
            for c in rows
        )
        print(f"  {label:10} n={len(rows)} "
              f"brands={dict(Counter(c['brand'] for c in rows))} "
              f"category={dict(Counter(c['category'] for c in rows))} "
              f"temp={dict(temps)}")


if __name__ == "__main__":
    main()
