"""Procedural pixel art for the Spiral Node website (original drawing, Pillow only).

Run: cd website && python art/make_art.py
Writes PNGs + scene.json + device.json to public/art/. Deterministic.
"""
import json, math, random, subprocess, sys, tempfile
from datetime import datetime
from pathlib import Path

from PIL import Image

from cast import KEY, SPRITES

HERE = Path(__file__).resolve().parent
SITE = HERE.parent
OUT = SITE / "public" / "art"
OS_DIR = SITE.parent / "os"
OUT.mkdir(parents=True, exist_ok=True)

# ---- palette "Helix 16" (+ the black colourway's highlight, per DESIGN.md)
HEX = dict(ink="1d1a16", paper="f4ecd8", cloud="e9dcc6", olive="6f7d2c", olive_deep="424c19",
           olive_bright="b5c25a", brown="7a5230", brown_deep="3e2a1a", amber="f0a33a",
           apple="d23a2c", leaf="4e8c3a", forest="23402f", night="1a1d45", dusk="5a3d7a",
           rose="d77a8f", sky="7fb2df", ink_hi="3a342c", copper="c97b4a", copper_deep="8a4b23", brown_hi="a8794c",
           # night mapping colours, derived from night/forest/leaf for the moonlit land
           n_sky2="262a5c", n_sky3="343a78", n_deep="0b0f26", n_forest="0f1a2e", n_leaf="1f3a4a",
           n_hi="3f6a6a", n_olive="1d3a3a", n_olive_deep="12262e", n_brown="3a2f4a", n_brown_deep="1f1a2e",
           n_haze="2a2f66")
C = {k: tuple(int(v[i:i + 2], 16) for i in (0, 2, 4)) + (255,) for k, v in HEX.items()}
ALLOWED = {c[:3] for c in C.values()}
CLEAR = (0, 0, 0, 0)
W, H = 320, 180
HORIZON = 104

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def new(w, h):
    return Image.new("RGBA", (w, h), CLEAR)


def put(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), C[c] if isinstance(c, str) else c)


def rect(im, x0, y0, x1, y1, c):
    """inclusive corners"""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(im, x, y, c)


def disc(im, cx, cy, r, c):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6:
                put(im, x, y, c)


def disc_pts(cx, cy, r):
    return {(x, y) for y in range(cy - r, cy + r + 1) for x in range(cx - r, cx + r + 1)
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6}


def sprite(rows, key):
    im = new(len(rows[0]), len(rows))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key:
                put(im, x, y, key[ch])
    return im


# ------------------------------------------------------------------ sky
def sky(im, bands, blend=10):
    """bands: [(y_end, colour)], dithered (ordered) over `blend` rows before each boundary."""
    for y in range(HORIZON + 8):
        for x in range(W):
            col = None
            for i, (yend, c) in enumerate(bands):
                if y < yend:
                    col = c
                    if i + 1 < len(bands) and y >= yend - blend:
                        t = (y - (yend - blend) + 0.5) / blend  # 0..1 toward next band
                        if BAYER[y % 4][x % 4] / 16 < t:
                            col = bands[i + 1][1]
                    break
            put(im, x, y, col or bands[-1][1])


def night_sky(im):
    sky(im, [(34, "night"), (66, "n_sky2"), (999, "n_sky3")], 12)
    rng = random.Random(7)
    for _ in range(26):  # still stars baked in, so the reduced-motion night reads as night too
        put(im, rng.randint(2, W - 3), rng.randint(2, 72), "cloud" if rng.random() < .7 else "paper")
    for (x, y) in disc_pts(40, 28, 10) - disc_pts(46, 25, 9):  # crescent moon
        put(im, x, y, "paper")


SUN = (50, 92, 15)  # cx, cy, r: sits on the horizon in the left third; the device covers the middle/right


def sunset_sky(im):
    sky(im, [(36, "sky"), (70, "rose"), (999, "amber")], 14)
    cx, cy, r = SUN
    for y in range(cy - r - 26, cy + r + 27):
        for x in range(cx - r - 28, cx + r + 29):
            d = math.hypot(x - cx, y - cy)
            if r < d < r + 26 and BAYER[y % 4][x % 4] / 16 < (r + 26 - d) / 26 * 0.55 and y < HORIZON - 1:
                put(im, x, y, "amber" if im.getpixel((x, y))[:3] != C["amber"][:3] else "paper")
    disc(im, cx, cy, r, "amber")
    disc(im, cx, cy, r - 3, "paper")


# palette maps applied to the drawn land pixels (a colour mapping, not a filter)
NIGHT_MAP = dict(forest="n_forest", leaf="n_leaf", olive_bright="n_hi", olive="n_olive", olive_deep="n_olive_deep",
                 brown="n_brown", brown_deep="n_brown_deep", night="n_deep", dusk="n_haze", amber="cloud",
                 sky="n_sky3", paper="cloud", rose="dusk")
SUNSET_MAP = dict(olive_bright="amber", leaf="olive_bright", olive="leaf", olive_deep="olive", forest="brown_deep")


def remap(im, m):
    inv = {C[k][:3]: C[v] for k, v in m.items()}
    for y in range(im.height):
        for x in range(im.width):
            p = im.getpixel((x, y))
            if p[3] and p[:3] in inv:
                im.putpixel((x, y), inv[p[:3]])


# ------------------------------------------------------------------ forest and hill
def tree_layer(im, rng, base, rmin, rmax, body, top=None, shade=None, x0=-6, x1=W + 6, wave=3, dither=None):
    """a row of rounded tree-tops rolling along `base`, everything below filled."""
    phase = rng.random() * 6
    x = x0
    blobs = []
    while x < x1:
        r = rng.randint(rmin, rmax)
        cy = base + int(wave * math.sin(x / 37 + phase)) + rng.randint(-1, 1)
        blobs.append((x, cy, r))
        x += rng.randint(max(3, rmin), rmax + 2)
    for bx, cy, r in blobs:
        if shade:
            disc(im, bx + 1, cy + 2, r, shade)
    for bx, cy, r in blobs:
        disc(im, bx, cy, r, body)
    # fill below with the body colour from the lowest bump line
    for bx in range(0, W):
        ys = [cy for (px, cy, r) in blobs if abs(px - bx) <= r + 2]
        ytop = min(ys) if ys else base
        for y in range(ytop + 1, H):
            put(im, bx, y, body)
    if top:
        for bx, cy, r in blobs:
            if rng.random() < 0.55:
                put(im, bx - r // 2, cy - r // 2, top)
                put(im, bx - r // 2 + 1, cy - r // 2, top)
                if r > 4 and rng.random() < 0.5:
                    put(im, bx - r // 2 - 1, cy - r // 2 + 1, top)
    if dither:  # hazy top edge on the far layer
        for bx in range(W):
            for y in range(base - rmax - 3, base + 3):
                if im.getpixel((bx, y))[:3] == C[body][:3] and BAYER[y % 4][bx % 4] < 4 + (base - y) // 2:
                    if (base - y) > rmax - 1:
                        put(im, bx, y, dither)


def forest(im, rng):
    tree_layer(im, rng, HORIZON + 2, 2, 4, "forest", dither="dusk", wave=2)
    for x in range(W):  # haze: the far canopy fades toward dusk at its top
        top = next(y for y in range(H) if im.getpixel((x, y))[:3] == C["forest"][:3])
        for dy in range(6):
            if BAYER[(top + dy) % 4][x % 4] < 12 - dy * 2.4:
                put(im, x, top + dy, "dusk")
    tree_layer(im, rng, HORIZON + 12, 4, 6, "forest", top="leaf", shade="night", wave=3)
    shapes(im, random.Random(31), range(6, 262, 17), HORIZON + 30, (34, 52), (7, 10))  # tall pines, birches and oaks behind the near canopy
    tree_layer(im, rng, HORIZON + 26, 5, 7, "leaf", top="olive_bright", shade="forest", wave=4)
    shapes(im, random.Random(32), range(4, 150, 13), HORIZON + 44, (20, 30), (5, 7))
    tree_layer(im, rng, HORIZON + 48, 7, 9, "forest", top="leaf", shade="night", wave=5)


# ---- tree shapes in the forest band (pine, birch, round oak), then meadow, pond, bushes, flowers, milkweed
def pine(im, cx, base, h):
    th, w = max(4, h // 4), h // 3 + 5
    for y in range(h):
        tier, within = min(3, y // th), y % th
        half = max(1, round((tier + 1) / 4 * (w / 2) * (0.4 + 0.6 * within / th)))
        for x in range(cx - half, cx + half + 1):
            put(im, x, base - h + y, "leaf" if x <= cx - half + 1 and within > 0 else "forest")
    rect(im, cx - 1, base - 3, cx, base, "brown_deep")


def birch(im, cx, base, h):
    for y in range(base - h, base + 1):
        put(im, cx, y, "ink" if (y % 4 == 0 and y < base - 3) else "paper")
        put(im, cx + 1, y, "cloud")
    for dx, dy, r in ((0, 0, 4), (-3, 4, 3), (4, 3, 3), (1, 7, 3)):
        disc(im, cx + dx, base - h + dy, r, "leaf")
        put(im, cx + dx - r // 2, base - h + dy - r // 2, "olive_bright")
        put(im, cx + dx - r // 2 + 1, base - h + dy - r // 2, "olive_bright")


def oak(im, cx, base, r):
    rect(im, cx - 1, base - 2 * r - 4, cx, base, "brown_deep")
    cy = base - 2 * r - 6
    disc(im, cx, cy + 1, r, "forest")
    disc(im, cx - 1, cy - 1, r - 1, "leaf")
    for dx, dy in ((-r // 2, -r // 2), (-r // 2 + 3, -r // 2 - 1), (-r // 2 - 1, -r // 2 + 3)):
        put(im, cx + dx, cy + dy, "olive_bright"); put(im, cx + dx + 1, cy + dy, "olive_bright")


def shapes(im, rng, xs, base, hs, rs):
    for x in xs:
        x += rng.randint(-4, 4)
        roll = rng.random()
        if roll < 0.45:
            pine(im, x, base, rng.randint(*hs))
        elif roll < 0.7:
            birch(im, x, base, rng.randint(hs[0] - 4, hs[1] - 6))
        else:
            oak(im, x, base, rng.randint(*rs))


def meadow_top(x):
    return 153 + int(2 * math.sin(x / 19))


def ground_col(d, x, y):
    if d == 0:
        return "olive_bright"
    if d < 4:
        return "leaf"
    if d < 9:
        return "leaf" if BAYER[y % 4][x % 4] > 3 else "olive"
    return "olive" if (BAYER[y % 4][x % 4] > 11 or d < 16) else "olive_deep"


def meadow(im):
    for x in range(0, 232):
        t = meadow_top(x)
        for y in range(t, H):
            put(im, x, y, ground_col(y - t, x, y))


POND = (90, 168, 22, 5)  # cx, cy, rx, ry


def pond(im, rng):
    cx, cy, rx, ry = POND
    for y in range(cy - ry - 2, cy + ry + 3):
        for x in range(cx - rx - 3, cx + rx + 4):
            e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if e <= 1:
                put(im, x, y, "amber" if (abs(y - cy) <= 1 and (x // 3 + y) % 3 == 0) else "sky")
            elif e <= 1.35:
                put(im, x, y, "olive_deep")
    for _ in range(9):
        put(im, cx + rng.randint(-rx + 4, rx - 4), cy + rng.randint(-ry + 2, ry - 2), "paper")
    for x in (cx - rx - 1, cx + rx - 2, cx + rx):  # reeds
        for k in range(8):
            put(im, x, cy - 1 - k, "olive_deep" if k < 7 else "brown")


def bush(im, cx, base, r):
    disc(im, cx + 1, base - r + 1, r, "forest")
    disc(im, cx, base - r, r - 1, "leaf")
    put(im, cx - r // 2, base - r - r // 2, "olive_bright"); put(im, cx - r // 2 + 1, base - r - r // 2, "olive_bright")
    put(im, cx + 1, base - r + 1, "apple" if r > 4 else "rose")


def milkweed(im, x, base):
    for k in range(11):
        put(im, x, base - k, "olive_deep")
    for k in (3, 6):
        put(im, x - 1, base - k, "leaf"); put(im, x - 2, base - k - 1, "leaf")
        put(im, x + 1, base - k - 1, "leaf"); put(im, x + 2, base - k - 2, "leaf")
    rect(im, x - 2, base - 14, x + 2, base - 12, "rose")
    rect(im, x - 1, base - 15, x + 1, base - 15, "rose")
    for dx in (-2, 0, 2):
        put(im, x + dx, base - 11, "dusk")
    put(im, x + 3, base - 8, "olive"); put(im, x + 3, base - 7, "olive")  # seed pod


def ground_top(x):
    t = meadow_top(x) if x < 232 else 999
    return min(t, hill_top(x)) if x >= HILL_X0 - 10 else t


def flowers(im, rng):
    heads = ["rose", "paper", "amber", "dusk", "paper", "rose"]
    for _ in range(46):
        x = rng.randint(2, W - 3)
        y = ground_top(x) + rng.randint(3, 13)
        if y + 3 >= H or (x in range(296, 320) and y < 120):
            continue
        put(im, x, y + 1, "olive_deep"); put(im, x, y + 2, "olive_deep")
        put(im, x, y, rng.choice(heads))
        if rng.random() < .4:
            put(im, x + 1, y, "olive_bright"); put(im, x - 1, y + 1, "olive_bright")


def extras(im):
    rng = random.Random(2026)
    pond(im, rng)
    for x, b, r in ((58, 155, 5), (150, 154, 4), (206, 147, 4), (222, 132, 4), (270, 119, 5), (14, 156, 5)):
        bush(im, x, b, r)
    for x in (78, 150, 224):
        milkweed(im, x, ground_top(x) + 6)
    flowers(im, rng)


HILL_X0 = 150


def hill_top(x):
    return int(114 + (max(0, 300 - x) ** 2) / 330)


def hill(im, rng):
    for x in range(HILL_X0 - 10, W):
        t = hill_top(x)
        for y in range(t, H):
            d = y - t
            if d == 0:
                c = "olive_bright"
            elif d < 4:
                c = "leaf"
            elif d < 9:
                c = "leaf" if BAYER[y % 4][x % 4] > 3 else "olive"
            else:
                c = "olive" if (BAYER[y % 4][x % 4] > 11 or d < 16) else "olive_deep"
            put(im, x, y, c)
    for _ in range(40):  # grass specks
        x = rng.randint(HILL_X0, W - 1)
        y = hill_top(x) + rng.randint(2, 40)
        if y < H:
            put(im, x, y, "olive_bright" if rng.random() < .5 else "olive_deep")


TREE_X, GROUND = 284, hill_top(284)
APPLE = (297, 51)
SNAIL_AT = (262, 76)   # top-left of the 10x8 sprite; bottom row sits on the branch


def tree(im):
    # branch for Helix, then trunk
    for x in range(252, 282):
        put(im, x, 84 - (281 - x) // 14, "brown_deep")
        put(im, x, 85 - (281 - x) // 14, "brown_deep")
        put(im, x, 86 - (281 - x) // 14, "brown_deep")
    for x in range(252, 262):
        put(im, x, 83 - (281 - x) // 14, "brown")
    for y in range(GROUND + 2, 44, -1):
        flare = 4 if y > GROUND - 5 else (1 if y > GROUND - 9 else 0)
        for x in range(TREE_X - 4 - flare, TREE_X + 5 + flare):
            put(im, x, y, "brown_deep")
        put(im, TREE_X - 3, y, "brown"); put(im, TREE_X - 2, y, "brown")
        if y % 5 == 0:
            put(im, TREE_X - 1, y, "brown")
    for x in range(289, 319):  # perch twig on the right for the cardinal
        put(im, x, 70 - (x - 288) // 10, "brown_deep"); put(im, x, 71 - (x - 288) // 10, "brown_deep")
    # a twig up each side into the canopy
    for i in range(14):
        put(im, TREE_X + 3 + i // 2, 62 - i, "brown_deep"); put(im, TREE_X + 4 + i // 2, 62 - i, "brown_deep")
        put(im, TREE_X - 4 - i // 2, 66 - i, "brown_deep"); put(im, TREE_X - 5 - i // 2, 66 - i, "brown_deep")
    blobs = [(262, 40, 9), (308, 40, 10), (270, 28, 12), (298, 26, 12), (284, 20, 12),
             (276, 46, 14), (298, 46, 14), (284, 36, 15)]
    for cx, cy, r in blobs:
        disc(im, cx, cy + 1, r, "forest")
        disc(im, cx - 1, cy - 1, r - 2, "leaf")
        for dx, dy in ((-r // 2, -r // 2), (-r // 2 + 2, -r // 2 - 1), (-r // 2 - 1, -r // 2 + 2), (0, -r // 2 - 1)):
            put(im, cx + dx, cy + dy, "olive_bright"); put(im, cx + dx + 1, cy + dy, "olive_bright")
    # shade the underside so the canopy reads as a mass
    pts = set()
    for cx, cy, r in blobs:
        pts |= disc_pts(cx - 1, cy - 1, r - 2)
    for (x, y) in pts:
        if (x, y + 3) not in pts and BAYER[y % 4][x % 4] > 3:
            put(im, x, y, "forest")
    # THE apple: forest ring, red body, glint, stem
    ax, ay = APPLE
    apple = sprite([".bb..",
                    "kkbkk",
                    "kaaaak"[:5],
                    ], {})  # placeholder to keep sprite helper imported use simple
    rows = ["..s...",
            ".RRRR.",
            "RRRRRR",
            "RRRRRR",
            "RRRRRR",
            ".RRRR."]
    for yy, row in enumerate(rows):
        for xx, ch in enumerate(row):
            if ch == "R":
                put(im, ax + xx, ay + yy, "apple")
    put(im, ax + 2, ay + 1, "amber"); put(im, ax + 1, ay + 2, "amber")
    put(im, ax + 2, ay - 1, "brown_deep"); put(im, ax + 2, ay, "brown_deep")
    for xx in range(-1, 7):  # dark ring below/right for contrast
        for yy in range(-2, 7):
            pass
    put(im, ax + 5, ay + 5, "forest")
    for xx, yy in [(1, 6), (2, 6), (3, 6), (4, 6), (6, 2), (6, 3), (6, 4), (5, 5)]:
        put(im, ax + xx, ay + yy, "ink")


def scene(kind):
    im = new(W, H)
    (night_sky if kind == "night" else sunset_sky)(im)
    land = new(W, H)
    rng = random.Random(1107)
    forest(land, rng)
    meadow(land)
    hill(land, rng)
    extras(land)
    tree(land)
    remap(land, NIGHT_MAP if kind == "night" else SUNSET_MAP)
    im.alpha_composite(land)
    return im


# ------------------------------------------------------------------ sprites
def make_stars():
    rng = random.Random(42)
    im = new(W, H)
    stars = []
    spots = [(20, 10, 1), (52, 24, 0), (88, 8, 1), (125, 20, 0), (160, 6, 1), (196, 26, 0),
             (232, 12, 0), (40, 38, 0)]
    for x, y, plus in spots:
        stars.append({"x": x, "y": y, "plus": bool(plus)})
        put(im, x, y, "paper")
        if plus:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put(im, x + dx, y + dy, "cloud")
    return im, stars


def cloud(widths, flat_to):
    """widths: list of (cx, cy, r) discs; shaded paper/cloud/rose, flat underside."""
    pts = set()
    for cx, cy, r in widths:
        pts |= {p for p in disc_pts(cx, cy, r) if p[1] <= flat_to}
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    x0, y0 = min(xs), min(ys)
    im = new(max(xs) - x0 + 1, max(ys) - y0 + 1)
    for (x, y) in pts:
        c = "cloud"
        if (x, y - 1) not in pts or (x, y - 2) not in pts and (x - 1, y - 1) not in pts:
            c = "paper"
        if (x, y + 1) not in pts:
            c = "rose"
        put(im, x - x0, y - y0, c)
    return im


def make_birds():
    im = new(15, 5)
    for ox in (0, 9):
        for dx, dy in ((0, 0), (1, 1), (2, 2), (3, 1), (4, 0)) if ox == 0 else ((0, 1), (1, 0), (2, 1), (3, 0)):
            put(im, ox + dx, dy, "ink")
    return im


SNAIL = sprite([
    "..........",
    ".K........",
    ".K..BBBB..",
    ".C.BAAAAB.",
    "CC.BABBAB.",
    "CCCBAABAB.",
    "CCCCBAAAB.",
    "CCCCCBBBB.",
], {"K": "ink", "C": "cloud", "B": "brown_deep", "A": "amber"})


# ------------------------------------------------------------------ device
# Landscape river-stone pager (~95 x 62 x 20 mm at ~4.2 art px per mm): the page-margin e-ink screen across the top,
# Back + Home keys and a small spiral logo bottom left, the subtle spiral wheel bottom right.
# Left side face (USB-C, charge light, power button) is drawn face-on as its own image.
DW, DH = 400, 264
SCREEN = dict(x=75, y=28, w=250, h=122)  # unchanged size: the simulator renders the OS frame into it
MARGIN_X, MARGIN_Y = 28, 12  # paper page-margin border around the screen, art px
WHEEL = dict(cx=322, cy=212, r=36, centerR=8)
KEY_W, KEY_H = 40, 24
KEYS = dict(back=dict(x=84, y=200, w=KEY_W, h=KEY_H), home=dict(x=132, y=200, w=KEY_W, h=KEY_H))
LOGO = dict(cx=62, cy=212, r=8)
SIDE_W = 84  # 20 mm of thickness, seen face-on
SIDE_USB = dict(x=42, y=46, w=14, h=36)
SIDE_LIGHT = dict(x=42, y=84, r=3)
SIDE_POWER = dict(x=42, y=114, w=12, h=30)
COLOURWAYS = {  # body, hi, lo, face (wheel), arm (spiral), button fill
    "olive": dict(body="olive", hi="olive_bright", lo="olive_deep", face="olive_deep", arm="olive", btn="olive"),
    "brown": dict(body="brown", hi="brown_hi", lo="brown_deep", face="brown_deep", arm="brown", btn="brown"),
    "black": dict(body="ink", hi="ink_hi", lo="ink", face="ink", arm="ink_hi", btn="ink_hi"),
}


def rounded(x0, y0, x1, y1, rad):
    pts = set()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            cx = min(max(x, x0 + rad), x1 - rad)
            cy = min(max(y, y0 + rad), y1 - rad)
            if (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad - 1 + (0 if rad < 3 else rad * 0.4):
                pts.add((x, y))
    return pts


def edge_shade(im, pts, hi, lo):
    for (x, y) in pts:
        if (x, y - 1) not in pts or (x - 1, y) not in pts:
            put(im, x, y, hi)
    for (x, y) in pts:
        if (x, y + 1) not in pts or (x + 1, y) not in pts:
            put(im, x, y, lo)


def pebble(w, h, p=6, bias=0.0):
    """Soft river-stone outline: a superellipse (bias leans it a little wider toward the bottom)."""
    pts = set()
    for y in range(h):
        u = (y + 0.5 - h / 2) / (h / 2)
        hw = (w / 2) * (1 - abs(u) ** p) ** (1 / p) * (1 - bias + bias * (y + 0.5) / h)
        for x in range(w):
            if abs(x + 0.5 - w / 2) <= hw:
                pts.add((x, y))
    return pts


# spiral groove: 2-3 loops, kept subtle (one ink line with a one-pixel highlight beside it)
SPIRAL_R0, SPIRAL_R1, SPIRAL_PITCH = WHEEL["centerR"] + 5, WHEEL["r"] - 9, 5.5


def spiral_pts(cw):
    """Archimedean groove (~2.5 turns): [(dx, dy, colour)] relative to the wheel centre."""
    out, th = [], 0.0
    while True:
        r = SPIRAL_R0 + SPIRAL_PITCH * th / (2 * math.pi)
        if r > SPIRAL_R1:
            return out
        out.append((round(r * math.cos(th)), round(r * math.sin(th)), "ink"))
        out.append((round((r + 1) * math.cos(th)), round((r + 1) * math.sin(th)), cw["arm"]))
        th += 0.4 / max(r, 1)


def wheel_sprite(name):
    """Just the spiral groove on a transparent square, so CSS can turn it over the still wheel face."""
    n = SPIRAL_R1 + 3
    im = new(2 * n + 1, 2 * n + 1)
    for dx, dy, c in spiral_pts(COLOURWAYS[name]):
        put(im, n + dx, n + dy, c)
    return im


def _line(a, b):
    (x0, y0), (x1, y1) = a, b
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    return [(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)) for i in range(n + 1)]


def glyph_back():
    """Small left arrow, 11 x 9."""
    pts = set(_line((0, 4), (10, 4)))
    for p in _line((0, 4), (4, 0)) + _line((0, 4), (4, 8)):
        pts.add(p); pts.add((p[0] + 1, p[1]))
    return pts, (11, 9)


def glyph_home():
    """Small house, 11 x 10: pitched roof, walls, a door."""
    pts = set()
    for p in _line((5, 0), (0, 5)) + _line((5, 0), (10, 5)):
        pts.add(p); pts.add((p[0], p[1] + 1))
    for y in range(5, 10):
        pts.add((2, y)); pts.add((8, y))
    for x in range(2, 9):
        pts.add((x, 9))
    for y in range(6, 10):
        pts.add((4, y)); pts.add((5, y)); pts.add((6, y))
    return pts, (11, 10)


def engrave(im, pts, size, cx, cy, cw, name):
    """Glyph cut into the key: a dark stroke with a light edge one pixel below and right of it."""
    ox, oy = cx - size[0] // 2, cy - size[1] // 2
    light = cw["hi"] if name != "black" else "ink_hi"
    dark = cw["lo"] if name != "black" else "ink"
    for (x, y) in pts:
        put(im, ox + x + 1, oy + y + 1, light)
    for (x, y) in pts:
        put(im, ox + x, oy + y, dark)


def key(im, k, cw, name, glyph):
    x0, y0, w, h = k["x"], k["y"], k["w"], k["h"]
    outer = rounded(x0, y0, x0 + w - 1, y0 + h - 1, 5)
    inner = {(x, y) for (x, y) in outer if all(n in outer for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))}
    lo = cw["lo"] if name != "black" else "ink"
    for p in outer:
        put(im, *p, lo)  # flat key: a thin recessed seam all round
    for p in inner:
        put(im, *p, cw["btn"])
    for (x, y) in inner:  # just a hint of light along the top edge
        if (x, y - 1) not in inner:
            put(im, x, y, cw["hi"] if name != "black" else "ink_hi")
    pts, size = glyph
    engrave(im, pts, size, x0 + w // 2, y0 + h // 2, cw, name)


def logo(im, cw):
    """Small copper spiral, the mark in the corner."""
    cx, cy, r = LOGO["cx"], LOGO["cy"], LOGO["r"]
    th = 0.0
    while True:
        rr = 1 + (r - 1) * th / (2.2 * 2 * math.pi)
        if rr > r:
            break
        put(im, round(cx + rr * math.cos(th)), round(cy + rr * math.sin(th)), "copper")
        th += 0.3 / max(rr, 1)


def device(name, spiral=True):
    cw = COLOURWAYS[name]
    im = new(DW, DH)
    outer = pebble(DW, DH)
    inner = {(x, y) for (x, y) in outer if all(n in outer for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))}
    for p in outer:
        put(im, *p, "ink")
    for p in inner:
        put(im, *p, cw["body"])
    edge_shade(im, inner, cw["hi"], cw["lo"])
    # page-margin frame: an ink plate, then a wide paper border like the margin of a printed page
    s = SCREEN
    mx, my = MARGIN_X, MARGIN_Y
    plate = rounded(s["x"] - mx - 2, s["y"] - my - 2, s["x"] + s["w"] + mx + 1, s["y"] + s["h"] + my + 1, 5)
    assert plate <= inner and all((x, y) in inner for (x, y) in {(x + dx, y + dy) for (x, y) in plate for dx in (-4, 4) for dy in (-4, 4)}), "frame must sit inside the stone"
    ring = {(x + dx, y + dy) for (x, y) in plate for dx, dy in ((0, -1), (-1, 0), (0, 1), (1, 0))} - plate
    for (x, y) in ring:
        if (x, y + 1) in plate or (x + 1, y) in plate:
            put(im, x, y, cw["lo"] if name != "black" else "ink_hi")
        else:
            put(im, x, y, cw["hi"])
    for p in plate:
        put(im, *p, "ink")
    paper = rounded(s["x"] - mx, s["y"] - my, s["x"] + s["w"] + mx - 1, s["y"] + s["h"] + my - 1, 3)
    for (x, y) in paper:
        put(im, x, y, "cloud" if (x + 1, y) not in paper or (x, y + 1) not in paper else "paper")
    # wheel (bottom right): thin copper ring, soft body band, recessed face
    cx, cy, R, cr = WHEEL["cx"], WHEEL["cy"], WHEEL["r"], WHEEL["centerR"]
    assert cy - R > s["y"] + s["h"] + my + 8 and cy + R < DH - 12
    assert all((cx + dx, cy + dy) in inner for dx in (-R - 6, R + 6) for dy in (-R - 6, R + 6)), "wheel must sit inside the stone"
    for y in range(cy - R, cy + R + 1):
        for x in range(cx - R, cx + R + 1):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d > R + 0.3:
                continue
            sh = (dx + dy) / (max(d, 1) * 1.414)
            if d > R - 1.2:
                c = "ink"
            elif d > R - 3.2:  # copper accent ring
                c = "copper_deep" if sh > 0.35 else "copper"
            elif d > R - 6:
                c = cw["hi"] if sh < -0.35 else (cw["lo"] if sh > 0.35 else cw["body"])
            else:
                c = cw["face"]
            put(im, x, y, c)
    if spiral:  # the hero version leaves this out; hero-wheel-olive.png turns it
        for dx, dy, c in spiral_pts(cw):
            put(im, cx + dx, cy + dy, c)
    # four small ticks for up/right/down/left
    for ang in (0, 90, 180, 270):
        for rr in range(R - 6, R - 4):
            x = round(cx + rr * math.cos(math.radians(ang))); y = round(cy + rr * math.sin(math.radians(ang)))
            put(im, x, y, "ink")
    # centre press button
    disc(im, cx, cy, cr, "ink")
    disc(im, cx, cy, cr - 1, cw["btn"])
    for y in range(cy - cr, cy + cr + 1):
        for x in range(cx - cr, cx + cr + 1):
            dx, dy = x - cx, y - cy
            if math.hypot(dx, dy) <= cr - 1 and math.hypot(dx, dy) > cr - 3:
                sh = (dx + dy)
                if sh < -cr * 0.7:
                    put(im, x, y, cw["hi"])
                elif sh > cr * 0.7:
                    put(im, x, y, cw["lo"] if name != "black" else "ink")
    # bottom left: spiral logo, then the Back and Home keys
    logo(im, cw)
    key(im, KEYS["back"], cw, name, glyph_back())
    key(im, KEYS["home"], cw, name, glyph_home())
    # transparent screen window
    for y in range(s["y"], s["y"] + s["h"]):
        for x in range(s["x"], s["x"] + s["w"]):
            im.putpixel((x, y), CLEAR)
    return im


def device_side(name):
    """The left side face, seen face-on: USB-C, the charge light and the power button, high up. Nothing else."""
    cw = COLOURWAYS[name]
    im = new(SIDE_W, DH)
    pts = rounded(0, 0, SIDE_W - 1, DH - 1, 22)
    inner = {(x, y) for (x, y) in pts if all(n in pts for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))}
    for p in pts:
        put(im, *p, "ink")
    for p in inner:
        put(im, *p, cw["body"])
    for (x, y) in inner:  # the face curves away at both long edges: a light band toward the front, a dark one toward the back
        if x < 7 and (x < 3 or (x + y) % 2 == 0):
            put(im, x, y, cw["hi"])
        elif x > SIDE_W - 8 and (x > SIDE_W - 4 or (x + y) % 2 == 0):
            put(im, x, y, cw["lo"])
    edge_shade(im, inner, cw["hi"], cw["lo"])
    lo = cw["lo"] if name != "black" else "ink"
    u = SIDE_USB  # USB-C: a vertical stadium slot with its tongue
    cx, w, h = u["x"], u["w"], u["h"]
    slot = rounded(cx - w // 2, u["y"] - h // 2, cx + w // 2 - 1, u["y"] + h // 2 - 1, w // 2)
    ins = {(x, y) for (x, y) in slot if all(n in slot for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))}
    for p in slot:
        put(im, *p, lo)
    for p in ins:
        put(im, *p, "ink")
    rect(im, cx - 1, u["y"] - h // 2 + 6, cx, u["y"] + h // 2 - 7, "ink_hi")  # the tongue
    L = SIDE_LIGHT  # charge light: a small amber lens
    disc(im, L["x"], L["y"], L["r"] + 1, lo)
    disc(im, L["x"], L["y"], L["r"], "amber")
    put(im, L["x"] - 1, L["y"] - 1, "paper")
    p_ = SIDE_POWER  # power button: a flat oblong key
    x0, y0 = p_["x"] - p_["w"] // 2, p_["y"] - p_["h"] // 2
    outer = rounded(x0, y0, x0 + p_["w"] - 1, y0 + p_["h"] - 1, 5)
    inn = {(x, y) for (x, y) in outer if all(n in outer for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))}
    for p in outer:
        put(im, *p, lo)
    for p in inn:
        put(im, *p, cw["btn"])
    for (x, y) in inn:
        if (x, y - 1) not in inn or (x - 1, y) not in inn:
            put(im, x, y, cw["hi"] if name != "black" else "ink_hi")
    return im


def pct(v, of):
    return round(100 * v / of, 2)


def layout_json():
    """Where things sit on the front art, as a percentage of the device image (for the simulator's overlays)."""
    def box(r):
        return dict(x=pct(r["x"], DW), y=pct(r["y"], DH), w=pct(r["w"], DW), h=pct(r["h"], DH))
    return {
        "note": "Percent of the front device image (device-<colour>.png). Generated by make_art.py; do not edit.",
        "image": {"width": DW, "height": DH},
        "screen": box(SCREEN),
        "back": box(KEYS["back"]),
        "home": box(KEYS["home"]),
        "wheel": dict(cx=pct(WHEEL["cx"], DW), cy=pct(WHEEL["cy"], DH), r=pct(WHEEL["r"], DW), centerR=pct(WHEEL["centerR"], DW)),
    }


def side_meta():
    return dict(width=SIDE_W, height=DH, usb=SIDE_USB, light=SIDE_LIGHT, power=SIDE_POWER)


# ------------------------------------------------------------------ OS screens
def two_colour(img):
    g = img.convert("L")
    out = Image.new("RGB", g.size)
    out.putdata([C["paper"][:3] if v > 127 else C["ink"][:3] for v in g.getdata()])
    return out


def os_frames():
    sys.path.insert(0, str(OS_DIR))
    from spiral.render import TopBar, page_screen
    from spiral.scripts_api import Page
    base = OS_DIR / "spiral" / "builtin_scripts" / "fun_fact_question"
    facts = json.loads((base / "facts.json").read_text())
    qs = json.loads((base / "questions.json").read_text())
    fact, q = facts[0]["text"], qs[0]["text"]
    frame = page_screen(Page("Fun fact", f"{fact}\n\nQ: {q}"), TopBar(datetime(2026, 11, 11, 2, 47), False, 100))
    hero = two_colour(frame)
    hero.save(OUT / "hero-screen.png")
    with tempfile.TemporaryDirectory() as tmp:
        snap = Path(tmp) / "home.png"
        subprocess.run([sys.executable, "-m", "spiral", "--data-dir", tmp, "--snapshot", str(snap)],
                       cwd=OS_DIR, check=True, capture_output=True)
        two_colour(Image.open(snap)).save(OUT / "home-still.png")
    return hero


# ------------------------------------------------------------------ animals (strips of frames; the page animates them with CSS)
def animal(tid, name, x, y, kind, **kw):
    frames = SPRITES[name]
    w, h = len(frames[0][0]), len(frames[0])
    strip = new(w * len(frames), h)
    for i, f in enumerate(frames):
        strip.alpha_composite(sprite(f, KEY), (i * w, 0))
    strip.save(OUT / f"animal-{name}.png")
    assert x >= 0 and y >= 0 and x + w <= W and y + h <= H, tid
    return dict(testId=tid, file=f"animal-{name}.png", x=x, y=y, w=w, h=h, frames=len(frames), kind=kind, **kw)


def idle(tid, name, x, y, dur, delay):
    return animal(tid, name, x, y, "idle", dur=dur, delay=delay, hold=85)


def cast():
    sunset = [
        animal("butterfly-1", "monarch", 96, 134, "flyer", dur=26, delay=-6, bob=6, flap=0.25),
        animal("butterfly-2", "monarch", 190, 112, "flyer", dur=23, delay=-30, bob=6, flap=0.25),
        animal("thinker", "thinker", 308, 101, "still"),
        idle("dog", "dog", 300, 152, 4.5, -1),
        idle("deer-doe", "doe", 118, 137, 8.5, -2),
        idle("deer-fawn", "fawn", 140, 144, 7, -5),
        idle("frog-1", "frog", 71, 157, 6, -1),
        idle("frog-2", "frog", 98, 157, 5, -3.2),
        idle("toad", "toad", 116, 162, 9, -4),
        idle("robin", "robin", 253, 75, 4, -2),
        idle("cardinal", "cardinal", 302, 60, 5.5, -3),
        idle("rabbit", "rabbit", 240, 152, 7.5, -6),
        idle("squirrel", "squirrel", 289, 72, 4.5, -0.5),
    ]
    ff = [(76, 146), (104, 138), (132, 124), (146, 166), (82, 126), (234, 100), (235, 122), (310, 92)]
    night = [
        animal("thinker", "thinker_night", 309, 109, "still"),
        idle("dog-asleep", "dog_asleep", 300, 152, 5, -1),
        animal("owl", "owl", 272, 73, "blink", dur=7, delay=-2, hold=94),
        *[animal(f"firefly-{i + 1}", "firefly", x, y, "blink", dur=round(2.6 + (i % 4) * 0.4, 1), delay=-round(i * 0.7, 1),
                 drift=[5, -4, 6, -5][i % 4], driftDur=9 + i) for i, (x, y) in enumerate(ff)],
        animal("bat-1", "bat", 120, 44, "flyer", dur=16, delay=-3, bob=8, flap=0.3),
        animal("bat-2", "bat", 210, 58, "flyer", dur=20, delay=-26, bob=7, flap=0.3),
        idle("deer-night", "deer_night", 118, 137, 9, -2),
        animal("fox", "fox", 70, 146, "idle", dur=70, delay=-10, hold=50, walk=30, flap=0.6),
        idle("frog-1", "frog", 71, 157, 6, -2),
        idle("toad", "toad", 116, 162, 8, -5),
    ]
    return sunset, night


# ------------------------------------------------------------------ main
def main():
    if "--check" in sys.argv:
        check()
        print("ok")
        return
    scene("night").save(OUT / "scene-night.png")
    scene("sunset").save(OUT / "scene-sunset.png")
    stars, star_list = make_stars()
    stars.save(OUT / "stars.png")
    ca = cloud([(6, 6, 5), (13, 4, 6), (21, 6, 5), (27, 7, 3), (3, 8, 3)], 9)
    cb = cloud([(4, 4, 3), (9, 3, 4), (14, 5, 3)], 6)
    ca.save(OUT / "cloud-a.png"); cb.save(OUT / "cloud-b.png")
    make_birds().save(OUT / "birds.png")
    SNAIL.save(OUT / "snail.png")
    sunset_cast, night_cast = cast()
    scene_json = {
        "canvas": {"width": W, "height": H},
        "note": "stars.png is a full 320x180 overlay (star positions listed for per-star fades); the other sprites are small and placed at x,y (top-left, art px).",
        "horizon": HORIZON,
        "stars": {"file": "stars.png", "list": star_list},
        "night": {"clouds": [], "animals": night_cast},
        "sunset": {"clouds": [{"file": "cloud-a.png", "x": 150, "y": 30}],
                   "birds": {"file": "birds.png", "x": 120, "y": 22, "w": 15, "h": 5}, "animals": sunset_cast},
        "keepOut": json.loads((HERE / "keepout.json").read_text()),
        "snail": {"file": "snail.png", "x": SNAIL_AT[0], "y": SNAIL_AT[1], "w": SNAIL.width, "h": SNAIL.height},
        "apple": {"x": APPLE[0], "y": APPLE[1], "w": 6, "h": 6},
    }
    (OUT / "scene.json").write_text(json.dumps(scene_json, indent=1))
    devs = {n: device(n) for n in COLOURWAYS}
    for n, im in devs.items():
        im.save(OUT / f"device-{n}.png")
    for n in COLOURWAYS:
        device_side(n).save(OUT / f"device-side-{n}.png")
    wheel_sprite("olive").save(OUT / "hero-wheel-olive.png")
    (OUT / "device.json").write_text(json.dumps({"width": DW, "height": DH, "screen": SCREEN, "wheel": WHEEL,
                                                 "keys": KEYS, "logo": LOGO,
                                                 "side": side_meta(),
                                                 "wheelSprite": dict(size=2 * (SPIRAL_R1 + 3) + 1)}))
    (HERE / "device-layout.json").write_text(json.dumps(layout_json(), indent=1) + "\n")
    hero = os_frames()
    hd = device("olive", spiral=False)
    hd.alpha_composite(hero.convert("RGBA"), (SCREEN["x"], SCREEN["y"]))
    # alpha_composite over transparent pixels: result keeps hero colours, opaque
    hd.save(OUT / "hero-device-olive.png")
    make_icons()
    make_explore()
    make_og_and_press()
    make_script_cards()
    check()
    print("ok")


# ------------------------------------------------------------------ explore row (24x24 "thinking artefacts", ink-line style)
EX = 24


def _outline(im, mask, c="ink"):
    """ink outline: every masked pixel that touches an unmasked 4-neighbour."""
    for (x, y) in mask:
        if any((x + dx, y + dy) not in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            put(im, x, y, c)


def explore_nautilus():
    im = new(EX, EX)
    cx, cy, R = 11.5, 11.5, 10.8
    mask = set()
    for y in range(EX):
        for x in range(EX):
            dx, dy = x - cx, y - cy
            if math.hypot(dx, dy) <= R * (1 + 0.06 * math.cos(math.atan2(dy, dx) - 0.7)):
                mask.add((x, y))
    b = 0.2
    for (x, y) in mask:
        dx, dy = x - cx, y - cy
        r = max(math.hypot(dx, dy), 0.5)
        th = math.atan2(dy, dx)
        turn = math.log(r / 1.4) / (b * 2 * math.pi) - th / (2 * math.pi)
        whorl = math.floor(turn)
        f = turn - whorl
        col = "paper"
        if whorl >= 1 and int((th + math.pi) / (2 * math.pi) * 18 + whorl) % 2 == 0:
            col = "copper"  # tiger stripes on the two outer whorls
        if whorl >= 2 and col == "copper" and f > 0.5:
            col = "copper_deep"
        if whorl < 1:
            col = "cloud" if int(th * 3 + 20) % 2 else "paper"
        # spiral wall: one pixel wide, whatever the radius
        if f * r * b * 2 * math.pi < 1.0:
            col = "ink"
        put(im, x, y, col)
    for (x, y) in [(11, 11), (12, 11), (11, 12), (12, 12)]:
        put(im, x, y, "ink")
    _outline(im, mask)
    return im


def explore_compass():
    im = new(EX, EX)
    cx = cy = 11.5
    for y in range(EX):
        for x in range(EX):
            r = math.hypot(x - cx, y - cy)
            if r <= 11.4:
                put(im, x, y, "ink")
            if r <= 10.4:
                put(im, x, y, "copper_deep")
            if r <= 9.4:
                put(im, x, y, "brown_hi")
            if r <= 8.4:
                put(im, x, y, "paper")
    for k in range(8):  # ticks round the dial
        a = k * math.pi / 4
        for rr in ((7.6, 6.6) if k % 2 == 0 else (7.6,)):
            put(im, round(cx + rr * math.cos(a)), round(cy + rr * math.sin(a)), "ink")
    # needle: a long diamond turned 40 degrees; north half red, south half ink, ink outline
    ang = math.radians(40)
    pts = {}
    for y in range(EX):
        for x in range(EX):
            dx, dy = x - cx, y - cy
            v = -(dx * math.sin(ang) + dy * math.cos(ang))  # along the needle (north is +)
            u = dx * math.cos(ang) - dy * math.sin(ang)
            if abs(u) / 3.2 + abs(v) / 9.6 <= 1:
                pts[(x, y)] = "apple" if v > 0 else "ink_hi"
    for (x, y), c in pts.items():
        put(im, x, y, c)
    _outline(im, set(pts))
    for (x, y) in [(11, 11), (12, 11), (11, 12), (12, 12)]:
        put(im, x, y, "amber")
    put(im, 11, 11, "paper")
    return im


def explore_quill():
    im = new(EX, EX)
    x0, y0, x1, y1 = 3.0, 21.0, 21.5, 2.5
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    mask = set()
    for y in range(EX):
        for x in range(EX):
            t = ((x - x0) * ux + (y - y0) * uy) / L
            d = -(x - x0) * uy + (y - y0) * ux
            if 0.3 <= t <= 1.0:
                u = (t - 0.3) / 0.7
                hw = 6.8 * math.sin(math.pi * u ** 0.75) ** 0.8 + 0.4 * (u > 0.9)
                if abs(d) <= hw and (u < 0.995):
                    mask.add((x, y))
    for (x, y) in mask:
        t = ((x - x0) * ux + (y - y0) * uy) / L
        d = -(x - x0) * uy + (y - y0) * ux
        barb = (t * L * 1.2 - abs(d) * 1.0) % 3 < 1.0  # barbs slant from the spine toward the tip
        col = "paper"
        if d > 0:
            col = "copper" if barb else "cloud"
        elif barb:
            col = "cloud"
        put(im, x, y, col)
    _outline(im, mask)
    steps = int(L * 2)
    for i in range(steps + 1):
        tt = i / steps
        put(im, int(round(x0 + (x1 - x0) * tt * 0.97)), int(round(y0 + (y1 - y0) * tt * 0.97)), "ink")
    for (x, y) in [(2, 22), (1, 23), (2, 23), (3, 22), (3, 21), (4, 21)]:
        put(im, x, y, "ink")
    put(im, 4, 20, "brown"); put(im, 5, 19, "brown"); put(im, 4, 22, "brown")
    return im


def explore_apple():
    im = new(EX, EX)
    mask = set()
    for y in range(EX):
        for x in range(EX):
            lobe = min(math.hypot(x - 8.2, y - 14.0) / 7.2, math.hypot(x - 15.2, y - 14.0) / 7.2)
            dip = 1.0 - 0.18 * math.exp(-((x - 11.7) ** 2) / 4.0) * (y < 9)
            body = math.hypot((x - 11.7) / 10.4, (y - 14.2) / 9.2)
            if body <= dip and (y > 6 or lobe <= 1.2) and y >= 5:
                mask.add((x, y))
    for (x, y) in mask:
        put(im, x, y, "apple")
        if x > 14 and y > 12 and (x + y) % 2 == 0:
            put(im, x, y, "copper_deep") if x + y > 30 else None
    _outline(im, mask)
    for (x, y) in [(6, 10), (5, 11), (5, 12), (6, 13), (7, 9), (6, 11)]:
        put(im, x, y, "paper")
    # shaded right-hand side: ink hatch just inside the outline
    for (x, y) in mask:
        if all((x + dx, y + dy) in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            if (x - 11.7) ** 2 / 100 + (y - 14.2) ** 2 / 85 > 0.55 and x > 15 and (x + y) % 2 == 0:
                put(im, x, y, "ink_hi")
    # stem and leaf
    for y in range(2, 7):
        put(im, 11 + (1 if y < 4 else 0), y, "brown")
    put(im, 12, 2, "brown_deep"); put(im, 12, 3, "brown_deep")
    for (x, y) in [(13, 3), (14, 2), (15, 2), (16, 2), (17, 3), (14, 4), (15, 4), (16, 4), (17, 4), (15, 3), (16, 3), (13, 4)]:
        put(im, x, y, "leaf")
    for (x, y) in [(13, 2), (14, 1), (15, 1), (16, 1), (17, 2), (18, 3), (18, 4), (17, 5), (16, 5), (15, 5), (14, 5), (13, 5), (12, 4)]:
        put(im, x, y, "ink")
    put(im, 15, 3, "olive_bright"); put(im, 16, 3, "olive_bright")
    return im


def make_explore():
    for name, fn in (("nautilus", explore_nautilus), ("compass", explore_compass), ("quill", explore_quill), ("apple", explore_apple)):
        fn().save(OUT / f"explore-{name}.png")


# ------------------------------------------------------------------ feature icons (16x16, home page grid)
ICON_KEY = {"K": "ink", "C": "copper", "O": "olive"}
ICONS = {
    "offline": [
        "................",
        ".............C..",
        "...KKKKKKKKKC...",
        "..K........C.K..",
        ".K...KKKKKC...K.",
        "....K....C.K....",
        "...K..KKCK..K...",
        "......KC.K......",
        "......C.........",
        ".....C.KK.......",
        "....C..KK.......",
        "...C............",
        "..C.............",
        ".C..............",
        "................",
        "................",
    ],
    "eink": [
        "................",
        ".KKKKKKKKKKKKKK.",
        ".K............K.",
        ".K.KKKKKKKKKK.K.",
        ".K............K.",
        ".K.KKKKKKKK...K.",
        ".K............K.",
        ".K.KKKKKKKKKK.K.",
        ".K............K.",
        ".K.KKKKK......K.",
        ".K............K.",
        ".K.........CC.K.",
        ".K.........CC.K.",
        ".K............K.",
        ".KKKKKKKKKKKKKK.",
        "................",
    ],
    "scripts": [
        "................",
        "....KK....KK....",
        "...K........K...",
        "...K........K...",
        "...K........K...",
        "...K........K...",
        "..K..........K..",
        ".K.....CC.....K.",
        ".K.....CC.....K.",
        "..K..........K..",
        "...K........K...",
        "...K........K...",
        "...K........K...",
        "...K........K...",
        "....KK....KK....",
        "................",
    ],
    "connect": [
        "................",
        "..KKK...........",
        ".K...K..........",
        ".K.C.K..........",
        ".K...K..........",
        "..KKK.K.........",
        ".......K........",
        "........O.......",
        ".........O......",
        "..........K.....",
        "...........KKK..",
        "..........K...K.",
        "..........K.C.K.",
        "..........K...K.",
        "...........KKK..",
        "................",
    ],
    "norepeats": [
        "................",
        "....C...........",
        ".C.C...KKKKKKKK.",
        "..C.............",
        "................",
        "....C...........",
        ".C.C...KKKKKKKK.",
        "..C.............",
        "................",
        "....C...........",
        ".C.C...KKKKKKKK.",
        "..C.............",
        "................",
        ".KKK............",
        ".K.K...KKKKKKKK.",
        ".KKK............",
    ],
    "sourced": [
        "................",
        "..KKKKK..KKKKK..",
        ".K.....KK.....K.",
        ".K.KKK.KK.KKK.K.",
        ".K.....KK.....K.",
        ".K.KKK.KK.KKK.K.",
        ".K.....KK.....K.",
        ".K.KKK.KK.KKK.K.",
        ".K.....KK.....K.",
        ".K.....KK.....K.",
        ".KKKKKKKKKKKKKK.",
        "...........C....",
        "...........C....",
        "..........C.C...",
        "................",
        "................",
    ],
    "wheel": [
        "................",
        ".KKKKKKKKKKKKKK.",
        "..............K.",
        ".KKKKKKKKKKKK.K.",
        ".K..........K.K.",
        ".K.KKKKKKKK.K.K.",
        ".K.K......K.K.K.",
        ".K.K.KKKK.K.K.K.",
        ".K.K.K.CC.K.K.K.",
        ".K.K.K.CC.K.K.K.",
        ".K.K.KKKKKK.K.K.",
        ".K.K........K.K.",
        ".K.KKKKKKKKKK.K.",
        ".K............K.",
        ".KKKKKKKKKKKKKK.",
        "................",
    ],
    "opensource": [
        "................",
        "..KKK......KKK..",
        ".K...K....K...K.",
        ".K.C.K....K.C.K.",
        ".K...K....K...K.",
        "..KKK......KKK..",
        "...K........K...",
        "...K........K...",
        "....K......K....",
        ".....KK..KK.....",
        ".......KK.......",
        "......KKKK......",
        ".....K....K.....",
        ".....K.CC.K.....",
        ".....K....K.....",
        "......KKKK......",
    ],
}


def make_icons():
    for name, rows in ICONS.items():
        assert len(rows) == 16 and all(len(r) == 16 for r in rows), name
        sprite(rows, ICON_KEY).save(OUT / f"icon-{name}.png")


# ------------------------------------------------------------------ link previews (1200x630) and the press logo
OG_PAGES = {"home": ("Spiral Node", "sunset"), "try": ("Try Spiral Node", "sunset"), "scripts": ("Scripts", "sunset"),
            "devlog": ("Devlog", "night"), "press": ("Press", "night"), "company": ("Helix Velocities", "night")}


def pixel_text(text, scale):
    """Crisp 1-bit text from Pillow's built-in font, scaled up with hard pixel edges."""
    from PIL import ImageDraw, ImageFont
    font = ImageFont.load_default(size=16)
    im = Image.new("1", (int(font.getlength(text)) + 4, 22), 0)
    ImageDraw.Draw(im).text((2, 1), text, font=font, fill=1)
    return im.resize((im.width * scale, im.height * scale), Image.NEAREST)


def make_og_and_press():
    from PIL import ImageDraw
    og_dir, press_dir = SITE / "public" / "og", SITE / "public" / "press"
    og_dir.mkdir(exist_ok=True)
    press_dir.mkdir(exist_ok=True)
    device = Image.open(OUT / "hero-device-olive.png").convert("RGBA")
    for name, (title, kind) in OG_PAGES.items():
        im = Image.open(OUT / f"scene-{kind}.png").convert("RGB").resize((1280, 720), Image.NEAREST).crop((40, 45, 1240, 675))
        im.paste(device, (1200 - device.width - 100, 630 - device.height - 60), device)
        t, sub = pixel_text(title, 4), pixel_text("Offline. Open source.", 2)
        box = Image.new("RGB", (max(t.width, sub.width) + 64, t.height + sub.height + 72), C["night"][:3])
        box.paste(C["paper"][:3], (32, 24), t)
        box.paste(C["olive_bright"][:3], (32, 48 + t.height), sub)
        im.paste(C["ink"][:3], (68, 68, 68 + box.width, 68 + box.height))  # hard shadow
        im.paste(box, (60, 60))
        im.save(og_dir / f"{name}.png")
    # the spiral logo: 64x64 art px, ink on transparent, saved at 8x (512x512)
    size = 64
    mask = Image.new("1", (size, size), 0)
    pts = [(size / 2 + (size / 2 - 4) * t * math.cos(t * 6 * math.pi), size / 2 + (size / 2 - 4) * t * math.sin(t * 6 * math.pi))
           for t in (i / 400 for i in range(401))]
    ImageDraw.Draw(mask).line(pts, fill=1, width=3)
    logo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    logo.paste(C["ink"], (0, 0), mask)
    logo.resize((size * 8, size * 8), Image.NEAREST).save(press_dir / "spiral-node-logo.png")


def make_script_cards():
    """public/og/script-<id>.png for every script: its first page on the real OS renderer, 4x, in a night frame."""
    import random
    sys.path.insert(0, str(OS_DIR))
    from spiral.loader import discover
    from spiral.render import TopBar, page_screen
    from spiral.scripts_api import Page, ScriptContext, valid_prefs
    from spiral.storage import Store
    root = SITE.parent
    infos = [i for d in (OS_DIR / "spiral" / "builtin_scripts", root / "scripts") if d.is_dir()
             for i in discover(d, d) if i.id != "TEMPLATE"]
    bg = Image.open(OUT / "scene-night.png").convert("RGB").resize((1280, 720), Image.NEAREST).crop((40, 45, 1240, 675))
    when = datetime(2026, 11, 17, 9, 41)
    for info in infos:
        page = None
        try:
            if info.error:
                raise ValueError(info.error)
            with tempfile.TemporaryDirectory() as tmp:
                ctx = ScriptContext(info.id, info.folder, valid_prefs(info.preferences, {}), Store(Path(tmp), lambda: 0.0),
                                    random.Random(1), when.date)
                page = info.module.create(ctx).next()
            assert isinstance(page, Page)
        except (Exception, SystemExit):
            page = None
        im = bg.copy()
        t = pixel_text(info.name if page else info.id, 3)
        box = Image.new("RGB", (t.width + 64, t.height + 48), C["night"][:3])
        box.paste(C["paper"][:3], (32, 24), t)
        im.paste(C["ink"][:3], (108, 20, 108 + box.width, 20 + box.height))
        im.paste(box, (100, 12))
        if page:
            screen = two_colour(page_screen(page, TopBar(when, False, 100))).resize((1000, 488), Image.NEAREST)
            im.paste(C["ink"][:3], (108, 140, 108 + 1000, 140 + 488))
            im.paste(screen, (100, 132))
        im.save(SITE / "public" / "og" / f"script-{info.id}.png")


def colours(path):
    im = Image.open(path).convert("RGBA")
    return {p[:3] for p in im.getdata() if p[3] == 255}, {p[3] for p in im.getdata()}


def check():
    for f in ("scene-night.png", "scene-sunset.png"):
        assert Image.open(OUT / f).size == (W, H), f
    for f in OUT.glob("*.png"):
        if f.name in ("hero-screen.png", "home-still.png"):
            cs = {p for p in Image.open(f).convert("RGB").getdata()}
            assert cs == {C["paper"][:3], C["ink"][:3]} or cs <= {C["paper"][:3], C["ink"][:3]}, (f, cs)
            assert Image.open(f).size == (250, 122), f
        else:
            cs, alphas = colours(f)
            assert cs <= ALLOWED, (f.name, cs - ALLOWED)
            assert alphas <= {0, 255}, f.name
    for f in ("scene-night.png", "scene-sunset.png"):
        assert all(p[3] == 255 for p in Image.open(OUT / f).getdata()), f
    meta = json.loads((OUT / "device.json").read_text())
    s = meta["screen"]
    assert (s["w"], s["h"]) == (250, 122)
    for n in COLOURWAYS:
        im = Image.open(OUT / f"device-{n}.png")
        assert im.size == (meta["width"], meta["height"]) == (DW, DH)
        for y in range(s["y"], s["y"] + s["h"]):
            for x in range(s["x"], s["x"] + s["w"]):
                assert im.getpixel((x, y))[3] == 0, (n, x, y)
        # the window is enclosed: its border ring is opaque
        for x in range(s["x"] - 1, s["x"] + s["w"] + 1):
            assert im.getpixel((x, s["y"] - 1))[3] == 255 and im.getpixel((x, s["y"] + s["h"]))[3] == 255
    assert meta["width"] > meta["height"] and meta["wheel"]["cy"] - meta["wheel"]["r"] > s["y"] + s["h"]  # landscape, wheel below the screen
    assert meta["wheel"]["cx"] > meta["width"] // 2 and all(k["x"] + k["w"] < meta["wheel"]["cx"] - meta["wheel"]["r"] for k in meta["keys"].values())  # wheel bottom right, keys bottom left
    assert meta["keys"]["back"]["x"] + meta["keys"]["back"]["w"] < meta["keys"]["home"]["x"] and meta["keys"]["back"]["y"] == meta["keys"]["home"]["y"]
    lay = json.loads((HERE / "device-layout.json").read_text())
    assert lay["screen"]["w"] == round(100 * 250 / DW, 2) and lay["back"]["x"] < lay["home"]["x"]
    assert set(meta["side"]) == {"width", "height", "usb", "light", "power"}  # nothing else on the side face
    for n in COLOURWAYS:
        assert Image.open(OUT / f"device-side-{n}.png").size == (SIDE_W, DH), n
    assert Image.open(OUT / "hero-wheel-olive.png").size == (meta["wheelSprite"]["size"],) * 2
    hd = Image.open(OUT / "hero-device-olive.png")
    assert hd.size == (DW, DH)
    assert hd.getpixel((s["x"], s["y"]))[3] == 255


if __name__ == "__main__":
    main()
