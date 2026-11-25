"""Scene 5: an amber library, a long scroll unrolling across a table."""
import math
import random
from types import SimpleNamespace

from ..cast import dog, figure, snail
from ..draw import BAYER, dither, disc, line, new, outline, paste, put, rect
from ..scene import SIZES, Layer, Scene, Sprite

# Same vertical layout in both variants; only the horizontal arrangement differs.
GEO = {
    "wide": dict(
        floor=262, ty=226, tx0=96, tx1=348, roll=114, lamp=232, thx=192, page=202,
        candles=(262, 138), win=(366, 36, 56, 150), snail=(150, 112), gap=(136, 180), devs=(170, 232, 300),
        hearth=436, ladder=14, rug=(70, 276, 372, 352), pile=(14, 316), seed=5,
        dust1=(110, 150, 240, 130), dust2=(330, 30, 200, 120),
    ),
    "tall": dict(
        floor=262, ty=226, tx0=40, tx1=180, roll=58, lamp=110, thx=90, page=100,
        candles=(176, 46), win=(158, 66, 46, 104), snail=(56, 112), gap=(46, 100), devs=(80, 120, 160),
        hearth=None, ladder=4, rug=(10, 284, 230, 420), pile=(6, 430), seed=6,
        dust1=(20, 120, 200, 150), dust2=(30, 20, 180, 90),
    ),
}

PLANKS = [68, 124, 180, 236]
BOOKS = [
    ("red", "rust", "plum"), ("leaf", "olive", "olive_deep"), ("sky", "dusk", "navy"),
    ("sun", "gold", "tan"), ("leaf", "teal", "forest"), ("white", "paper", "sand"),
    ("rust", "plum", "aubergine"), ("tan", "brown", "bark"), ("orange", "rust", "plum"),
    ("mist", "slate", "dusk"),
]
HANG = 44  # length of the scroll end hanging off the table
FIRE = ["red", "orange", "amber", "sun", "white"]
CANDLE = ["orange", "amber", "sun", "white"]


# ---------------------------------------------------------------- helpers

def rng_hash(x, y):
    n = (x * 73856093) ^ (y * 19349663)
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def pick(ramp, t, x, y):
    """Ordered-dither choice from a ramp for t in 0..1."""
    p = max(0.0, min(0.99999, t)) * (len(ramp) - 1)
    i = int(p)
    return ramp[i + 1] if p - i > (BAYER[y % 4][x % 4] + 0.5) / 16 else ramp[i]


def in_arch(win, x, y, pad=0):
    wx, wy, ww, wh = win
    if x < wx - pad or x >= wx + ww + pad or y > wy + wh + pad - 1:
        return False
    cx, cy = wx + ww / 2, wy + ww / 2
    return y >= cy or math.hypot(x + .5 - cx, y + .5 - cy) <= ww / 2 + pad


def flame(im, cx, by, h, wmax, sway, cols):
    """A teardrop flame, base row at by, cols from the outer glow to the core."""
    for i in range(h):
        t = i / h
        half = wmax * (1 - t) ** .8 * (.5 + .5 * min(1, t * 4))
        off = round(sway * t * t)
        for k, c in enumerate(cols):
            if i >= h * (1 - .17 * k):
                break
            hw = round(half * (1 - .27 * k))
            rect(im, cx + off - hw, by - i, cx + off + hw, by - i, c)


# ------------------------------------------------------------------ layers

def wall_layer(g):
    im = new(g.w, g.h)
    dither(im, (0, 0, g.w - 1, g.h - 1), ["umber", "bark"], lambda x, y: .3 + .4 * y / g.h)
    wx, wy, ww, wh = g.win
    for y in range(wy - 1, wy + wh + 1):
        for x in range(wx - 1, wx + ww + 1):
            if in_arch(g.win, x, y):
                put(im, x, y, pick(["night", "navy", "dusk"], (y - wy) / wh, x, y))
    rnd = random.Random(g.seed + 1)
    for _ in range(26):
        x, y = wx + rnd.randrange(ww), wy + rnd.randrange(wh - 12)
        if in_arch(g.win, x, y):
            put(im, x, y, rnd.choice(["white", "sky_pale", "sky_pale"]))
    mx, my = wx + ww * 2 // 3, wy + ww // 2
    disc(im, mx, my, 4, "paper")
    disc(im, mx - 1, my - 1, 2, "white")
    for x in range(wx, wx + ww):  # far hills in the window
        top = wy + wh - 12 - round(6 * math.sin(x * .17 + 1) + 3 * math.sin(x * .41))
        for y in range(top, wy + wh):
            if in_arch(g.win, x, y):
                put(im, x, y, "night" if y > top else "navy")
    return im


def book(im, g, x, pl, bw, bh, tone, band):
    for dx in range(-1, bw):
        for dy in range(bh):
            y = pl - 1 - dy
            if dx == -1:
                put(im, x + dx, y, "ink")
                continue
            c = tone[0] if dx == 0 else tone[1]  # flat spine, 1 px lighter edge
            if band and dy in (3, bh - 4) and dx:
                c = "gold"
            elif not band and bw >= 5 and dy == bh // 2 and 1 <= dx < bw - 1:
                c = tone[0]  # title mark
            put(im, x + dx, y, c)


def shelf_row(im, g, rnd, i, y0, pl):
    x, rh = 2, pl - y0
    while x < g.w - 2:
        if i == 1 and g.gap[0] <= x < g.gap[1]:
            x = g.gap[1]
            continue
        if i != 1 and rnd.random() < .1 and x + 16 < g.w:  # a lying stack
            for k in range(rnd.randrange(2, 4)):
                t = BOOKS[rnd.randrange(len(BOOKS))]
                yy = pl - 5 * (k + 1)
                rect(im, x, yy, x + 13, yy + 3, t[1])
                rect(im, x, yy, x + 13, yy, t[0])
                rect(im, x, yy + 3, x + 13, yy + 3, t[2])
                rect(im, x + 11, yy + 1, x + 13, yy + 2, "paper")
            x += 15
            continue
        bw = rnd.randrange(4, 9)
        bh = rnd.randrange(rh - 18, rh - 5)
        book(im, g, x, pl, bw, bh, BOOKS[rnd.randrange(len(BOOKS))], rnd.random() < .5)
        x += bw + 1


def shelves_layer(g):
    im = new(g.w, g.h)
    rnd = random.Random(g.seed)
    rect(im, 0, 0, g.w - 1, 3, "umber")
    rect(im, 0, 4, g.w - 1, 5, "tan")
    rect(im, 0, 6, g.w - 1, 9, "brown")
    rect(im, 0, 10, g.w - 1, 11, "bark")
    for i, pl in enumerate(PLANKS):
        y0 = 12 if i == 0 else PLANKS[i - 1] + 4
        rect(im, 0, y0, g.w - 1, pl - 1, "umber")
        if i == 1:  # a lit niche where the snail sits
            rect(im, g.gap[0], y0, g.gap[1] - 1, pl - 1, "bark")
        shelf_row(im, g, rnd, i, y0, pl)
        rect(im, 0, pl, g.w - 1, pl, "tan")
        rect(im, 0, pl + 1, g.w - 1, pl + 2, "brown")
        rect(im, 0, pl + 3, g.w - 1, pl + 3, "bark")
    top = PLANKS[-1] + 4  # cabinet base
    rect(im, 0, top, g.w - 1, g.floor - 1, "brown")
    for px in range(0, g.w, 72):
        rect(im, px + 3, top + 3, px + 68, g.floor - 3, "bark")
        rect(im, px + 5, top + 5, px + 66, g.floor - 5, "brown")
        rect(im, px + 5, top + 5, px + 66, top + 5, "tan")
    for px in range(0, g.w, 144):  # pilasters
        rect(im, px, 12, px + 3, top - 1, "bark")
        rect(im, px, 12, px, top - 1, "brown")
    wx, wy, ww, wh = g.win  # the arched window
    ring = {4: "ink", 3: "bark", 2: "brown", 1: "tan"}
    for k in (4, 3, 2, 1, 0):
        for y in range(wy - 6, wy + wh + 6):
            for x in range(wx - 6, wx + ww + 6):
                if in_arch(g.win, x, y, k):
                    if k:
                        put(im, x, y, ring[k])
                    else:
                        im.putpixel((x, y), (0, 0, 0, 0))
    mx = wx + ww // 2
    rect(im, mx - 1, wy, mx, wy + wh - 1, "bark")
    rect(im, wx, wy + wh // 2 + ww // 4, wx + ww - 1, wy + wh // 2 + ww // 4 + 1, "bark")
    rect(im, wx - 6, wy + wh, wx + ww + 5, wy + wh + 2, "tan")
    rect(im, wx - 6, wy + wh + 3, wx + ww + 5, wy + wh + 3, "ink")
    return im


FLOOR = ["tan", "brown", "bark", "umber"]


def ladder(im, x, y0, y1):
    h = y1 - y0
    lad = new(18, h)
    rect(lad, 1, 1, 2, h - 2, "tan")
    rect(lad, 13, 1, 14, h - 2, "tan")
    rect(lad, 2, 1, 2, h - 2, "brown")
    rect(lad, 14, 1, 14, h - 2, "brown")
    for yy in range(8, h - 4, 10):
        rect(lad, 1, yy, 14, yy + 1, "brown")
        rect(lad, 1, yy, 14, yy, "tan")
    paste(im, outline(lad), x, y0)


def hearth_image():
    im = new(128, 116)
    rnd = random.Random(41)
    rect(im, 8, 14, 119, 115, "umber")
    for row, y in enumerate(range(14, 116, 6)):
        for bx in range(8 - (0 if row % 2 == 0 else 6), 120, 12):
            tone = ("rust", "rust", "plum", "red")[rnd.randrange(4)]
            rect(im, max(bx, 8), y, min(bx + 10, 119), min(y + 4, 115), tone)
    dither(im, (26, 42, 101, 115), ["ink", "umber", "bark"], lambda x, y: (y - 42) / 90 * .8)
    rect(im, 22, 36, 105, 41, "mist")
    rect(im, 22, 41, 105, 41, "slate")
    rect(im, 18, 108, 109, 115, "mist")
    rect(im, 18, 108, 109, 108, "sand")
    rect(im, 18, 114, 109, 115, "slate")
    rect(im, 0, 3, 127, 3, "sand")
    rect(im, 0, 4, 127, 5, "tan")
    rect(im, 0, 6, 127, 11, "brown")
    rect(im, 0, 12, 127, 13, "bark")
    return outline(im)


def room_layer(g):
    im = new(g.w, g.h)
    f = g.floor
    cx, cy = (g.tx0 + g.tx1) / 2, f + 24
    for y in range(f, g.h):
        for x in range(g.w):
            d = math.hypot((x - cx) / 1.6, y - cy) / 150
            put(im, x, y, pick(FLOOR, (y - f) / (g.h - f) * .8 + min(d, 1) * .25 - .15, x, y))
    for y in range(f + 14, g.h, 14):  # boards
        rect(im, 0, y, g.w - 1, y, "bark")
        k = (y - f) // 14
        for j in range(g.w // 64 + 1):
            sx = (k * 37 + j * 64) % g.w
            rect(im, sx, y + 1, sx, y + 13, "bark")
    rect(im, 0, f, g.w - 1, f, "bark")
    x0, y0, x1, y1 = g.rug  # the rug
    rect(im, x0, y0, x1, y1, "gold")
    rect(im, x0 + 2, y0 + 2, x1 - 2, y1 - 2, "rust")
    rect(im, x0 + 5, y0 + 5, x1 - 5, y1 - 5, "plum")
    for y in range(y0 + 9, y1 - 8):
        for x in range(x0 + 9, x1 - 8):
            if (x + y) % 12 == 0 or (x - y) % 12 == 0:
                put(im, x, y, "rust")
    for y in range(y0, y1 + 1, 2):
        put(im, x0 - 2, y, "paper")
        put(im, x1 + 2, y, "paper")
    ladder(im, g.ladder, 30, f + 30)
    if g.hearth is not None:
        paste(im, hearth_image(), g.hearth, f + 14 - 116)
    return im


DEV_W, SCR_W, SCR_H = 22, 16, 14


def device(im, cx, by):
    """A small upright device, feet on row by; the screen well is left for the screen sprite."""
    x0, y0 = cx - DEV_W // 2, by - 29
    rect(im, x0, y0, x0 + DEV_W - 1, by - 1, "olive")
    rect(im, x0, y0, x0 + DEV_W - 1, y0, "leaf")
    rect(im, x0, y0, x0, by - 1, "leaf")
    rect(im, x0 + DEV_W - 2, y0 + 1, x0 + DEV_W - 1, by - 1, "olive_deep")
    rect(im, x0 + 1, by - 1, x0 + DEV_W - 1, by - 1, "olive_deep")
    rect(im, x0 + 2, y0 + 2, x0 + DEV_W - 3, y0 + 2 + SCR_H + 1, "olive_deep")
    rect(im, x0 + 2, by - 11, x0 + 7, by - 8, "paper")  # two keys
    rect(im, x0 + 2, by - 8, x0 + 7, by - 8, "sand")
    wx, wy = x0 + 15, by - 8
    disc(im, wx, wy, 4, "ink")
    disc(im, wx, wy, 3, "gold")
    disc(im, wx, wy, 1, "ink")
    put(im, wx - 1, wy - 2, "sun")


def screen_frame(k):
    im = new(SCR_W, SCR_H)
    rect(im, 0, 0, SCR_W - 1, SCR_H - 1, "paper")
    rect(im, 0, 0, SCR_W - 1, 0, "white")
    rect(im, 2, 2, 2 + (5, 8)[k], 3, "ink")
    for y, n in ((6, (11, 9)[k]), (9, (8, 11)[k]), (12, 5)):
        rect(im, 2, y, 2 + n - 1, y, "slate")
    return im


def table_layer(g):
    im = new(g.w, g.h)
    x0, x1, ty, f = g.tx0, g.tx1, g.ty, g.floor
    for y in range(ty, ty + 16):
        for x in range(x0, x1 + 1):
            put(im, x, y, pick(["tan", "brown"], (y - ty) / 16 * .7 + (rng_hash(x // 7, y) - .5) * .25, x, y))
    rect(im, x0, ty, x1, ty, "sand")
    rnd = random.Random(g.seed + 20)
    for _ in range((x1 - x0) // 3):  # wood grain
        gx, gy = rnd.randrange(x0 + 2, x1 - 6), ty + 1 + rnd.randrange(14)
        rect(im, gx, gy, gx + rnd.randrange(2, 6), gy, "brown")
    rect(im, x0 - 2, ty + 16, x1 + 2, ty + 17, "tan")
    rect(im, x0 - 2, ty + 18, x1 + 2, ty + 24, "brown")
    rect(im, x0 - 2, ty + 25, x1 + 2, ty + 25, "bark")
    for lx in (x0 + 4, x1 - 10):  # legs and a stretcher
        rect(im, lx, ty + 26, lx + 6, f + 38, "brown")
        rect(im, lx, ty + 26, lx, f + 38, "tan")
        rect(im, lx + 6, ty + 26, lx + 6, f + 38, "bark")
    rect(im, x0 + 11, f + 22, x1 - 11, f + 25, "brown")
    rect(im, x0 + 11, f + 25, x1 - 11, f + 25, "bark")
    sx0, sx1 = g.roll + 7, x1 - 12  # the scroll lying on the table
    for x in range(sx0, sx1 + 1):
        for k in range(12):
            put(im, x, ty + 3 + k, "white" if k == 0 else "sand" if k >= 10 else "paper")
    for row in (ty + 5, ty + 8, ty + 11):
        x = sx0 + 8
        while x < sx1 - 4:
            n = rnd.randrange(3, 9)
            rect(im, x, row, min(x + n, sx1 - 3), row, "bark")
            x += n + 2
    rect(im, g.page - 14, ty + 4, g.page - 12, ty + 6, "red")
    put(im, g.page - 13, ty + 5, "gold")
    r = g.roll  # the wooden roller with the scroll wound round it
    rect(im, r - 1, ty - 2, r + 1, ty + 17, "brown")
    rect(im, r - 1, ty - 2, r - 1, ty + 17, "tan")
    disc(im, r, ty - 3, 2, "gold")
    disc(im, r, ty + 18, 2, "gold")
    for x in range(-6, 7):
        u = (x + 6) / 12
        rect(im, r + x, ty + 2, r + x, ty + 14,
             "sand" if u < .12 else "white" if u < .35 else "paper" if u < .75 else "sand")
    for x in (r - 2, r + 3):
        rect(im, x, ty + 3, x, ty + 13, "sand")
    for cx in g.candles:  # candles on brass holders
        by = ty + 12
        rect(im, cx - 3, by - 1, cx + 3, by, "gold")
        rect(im, cx - 3, by, cx + 3, by, "tan")
        rect(im, cx - 1, by - 9, cx + 1, by - 2, "paper")
        rect(im, cx + 1, by - 9, cx + 1, by - 2, "sand")
        put(im, cx, by - 10, "ink")
    for cx in g.devs:  # small Spiral Node devices standing on the table
        device(im, cx, ty + 12)
    return outline(im)


def front_layer(g):
    im = new(g.w, g.h)
    px, py = g.pile
    pile = new(62, 44)
    rnd = random.Random(g.seed + 30)
    yy = 42
    for k, bw in enumerate((44, 38, 46, 32)):
        t = BOOKS[(k * 3 + 2) % len(BOOKS)]
        x = 4 + rnd.randrange(0, 8)
        rect(pile, x, yy - 8, x + bw, yy, t[1])
        rect(pile, x, yy - 8, x + bw, yy - 8, t[0])
        rect(pile, x, yy, x + bw, yy, t[2])
        rect(pile, x + bw - 3, yy - 6, x + bw, yy - 2, "paper")
        rect(pile, x + 5, yy - 5, x + 6, yy - 3, "gold")
        yy -= 9
    paste(im, outline(pile), px, py)
    return im


# ------------------------------------------------------------------- sprites

def candle_frames(ph, n=4):
    out = []
    for f in range(n):
        k = (f + ph) % n
        im = new(17, 22)
        for y in range(16):
            for x in range(17):
                d = math.hypot(x - 8, y - 10)
                gl = 1 - d / 8
                if d > 2.5 and gl * .6 > (BAYER[y % 4][x % 4] + .5) / 16:
                    put(im, x, y, "sun" if gl > .6 else "amber")
        flame(im, 8, 15, (8, 9, 8, 7)[k], 2.4, (1, 0, -1, 0)[k], CANDLE)
        out.append(im)
    return out


def fire_frames(n=4):
    logs = new(60, 44)
    for d, c in ((0, "brown"), (1, "bark"), (2, "umber")):
        line(logs, 8, 36 + d, 52, 41 + d, c)
        line(logs, 8, 41 + d, 52, 36 + d, c)
    logs = outline(logs)
    for x, y, c in ((20, 38, "orange"), (30, 39, "red"), (38, 37, "amber"), (26, 40, "orange")):
        put(logs, x, y, c)
    out = []
    for f in range(n):
        im = new(60, 44)
        for cx, h, wm, ph in ((14, 18, 6, 0), (30, 27, 8, 1), (46, 17, 6, 2)):
            k = (f + ph) % n
            flame(im, cx, 40, h + (0, 2, 0, -2)[k], wm, (2, 0, -2, 0)[k], FIRE)
        paste(im, logs, 0, 0)
        out.append(im)
    return out


def sheet_frames(n=4):
    """The loose end of the scroll: hangs off the table, rippling, then curls along the floor."""
    w, h = 30, HANG + 9
    out = []
    for f in range(n):
        r = (0, -1, 0, 1)[f]
        im = new(w, h)
        for y in range(HANG):
            sway = round(1.6 * math.sin(2 * math.pi * f / n - y * .1) * min(1, y / 24))
            x0 = 14 + sway
            for k in range(13):
                put(im, x0 + k, y, "white" if k < 2 else "sand" if k > 10 else "paper")
            if y % 5 == 2:
                rect(im, x0 + 2, y, x0 + 3 + (y * 7) % 6, y, "bark")
        for x in range(1, 28):
            top = HANG + round(r * max(0, 1 - (x - 1) / 13))
            for k in range(7):
                put(im, x, top + k, "white" if k == 0 else "sand" if k >= 5 else "paper")
        out.append(outline(im))
    return out


def dust_frames(rnd, w, h, n=8, count=18):
    ms = [(rnd.randrange(6, w - 6), rnd.randrange(6, h - 6), rnd.randrange(2, 6), rnd.randrange(2, 5),
           rnd.randrange(1, 3), rnd.randrange(1, 3), rnd.randrange(n), rnd.randrange(n)) for _ in range(count)]
    out = []
    for f in range(n):
        im = new(w, h)
        for cx, cy, ax, ay, kx, ky, ph, bp in ms:
            x = cx + round(ax * math.sin(2 * math.pi * (kx * f + ph) / n))
            y = cy + round(ay * math.cos(2 * math.pi * (ky * f + ph) / n))
            v = (f + bp) % n
            c = "white" if v < 2 else "sun" if v < 5 else "amber" if v < 7 else None
            if c:
                put(im, x, y, c)
        out.append(im)
    return out


def lantern_frames(n=8):
    w, h, px, length = 56, 72, 28, 34
    lan = new(12, 18)
    rect(lan, 3, 1, 8, 2, "bark")
    rect(lan, 2, 3, 9, 4, "brown")
    rect(lan, 2, 5, 9, 13, "brown")
    rect(lan, 3, 5, 8, 13, "sun")
    rect(lan, 3, 10, 8, 13, "amber")
    rect(lan, 5, 7, 6, 11, "white")
    rect(lan, 2, 14, 9, 15, "brown")
    rect(lan, 3, 16, 8, 16, "bark")
    lan = outline(lan)
    out = []
    for f in range(n):
        a = .2 * math.sin(2 * math.pi * f / n)
        ex, ey = px + length * math.sin(a), length * math.cos(a)
        im = new(w, h)
        for y in range(h):
            for x in range(w):
                d = math.hypot(x - ex, y - ey - 9)
                gl = 1 - d / 24
                if d > 9 and gl * .6 > (BAYER[y % 4][x % 4] + .5) / 16:
                    put(im, x, y, "sun" if gl > .55 else "amber")
        line(im, px, 0, ex, ey, "mist")
        for i in range(1, length, 2):
            put(im, round(px + i * math.sin(a)), round(i * math.cos(a)), "slate")
        paste(im, lan, round(ex) - 6, round(ey) - 2)
        out.append(im)
    return out


# --------------------------------------------------------------------- scene

def scene(variant):
    w, h = SIZES[variant]
    g = SimpleNamespace(w=w, h=h, **GEO[variant])
    layers = [
        Layer("wall", wall_layer(g), 0.0),
        Layer("shelves", shelves_layer(g), 0.25),
        Layer("room", room_layer(g), 0.5),
        Layer("table", table_layer(g), 0.7),
        Layer("front", front_layer(g), 1.0),
    ]
    rnd = random.Random(g.seed + 50)
    sx, sy = g.snail
    th = figure("lovelace", "read")
    sprites = [Sprite("snail", snail(), 3, sx, sy, 0.25)]
    if g.hearth is not None:
        sprites.append(Sprite("fire", fire_frames(), 6, g.hearth + 34, g.floor + 14 - 116 + 104 - 41, 0.5))
    d2 = g.dust2
    sprites.append(Sprite("dust_high", dust_frames(rnd, d2[2], d2[3], count=12), 3, d2[0], d2[1], 0.6))
    who = Sprite("who", th, 3, g.thx, g.ty + 18, 0.9)  # in front of the table, full figure
    sprites.append(who)
    for i, cx in enumerate(g.devs):
        sprites.append(Sprite(f"devscreen{i + 1}", [screen_frame(0), screen_frame(1)], 1.5 + i * .3,
                              cx - 8,g.ty + 12 - 29 + 3, 0.7))
    for i, cx in enumerate(g.candles):
        sprites.append(Sprite(f"flame{i + 1}", candle_frames(i * 2), 8, cx - 8, g.ty - 14, 0.7))
    sprites.append(Sprite("scroll_end", sheet_frames(), 6, g.tx1 - 26, g.ty + 2, 0.9))
    sprites.append(Sprite("dog", dog("tug"), 6, g.tx1 - 52, g.ty + 40, 0.9))
    d1 = g.dust1
    sprites.append(Sprite("dust", dust_frames(rnd, d1[2], d1[3]), 3, d1[0], d1[1], 0.9))
    sprites.append(Sprite("lantern", lantern_frames(), 5, g.lamp - 28, 0, 0.9))
    anchors = {"page": (g.page, g.ty + 8, 0.7), "roller": (g.roll, g.ty + 8, 0.7)}
    for i, cx in enumerate(g.devs):
        anchors[f"screen{i + 1}"] = (cx, g.ty + 12 - 29 + 3 + SCR_H // 2, 0.7)
    tags = [("who", who.x + th[0].width // 2, who.y + th[0].height // 3, who.depth)]
    return Scene("scroll", variant, w, h, layers, sprites, anchors, tags)


SCENES = {"scroll": lambda v: scene(v)}
