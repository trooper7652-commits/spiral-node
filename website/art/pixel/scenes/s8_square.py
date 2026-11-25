"""Scene 8: the town square at lantern dusk."""
import math
import random

from PIL import ImageOps

from ..cast import dog, figure, snail
from ..draw import BAYER, disc, dither, line, new, outline, paste, put, rect
from ..palette import PALETTE
from ..scene import SIZES, Layer, Scene, Sprite
from .s1_countryside import cloud_frames, draw_glow, pick, rng_hash

SKY = ["night", "navy", "dusk", "plum", "rust", "orange", "amber"]
FAR = ["aubergine", "night"]
PAVE = ["umber", "bark", "brown", "tan", "sand"]
WALL = ["umber", "bark", "brown", "tan"]
RIM = ["brown", "tan", "sand", "paper"]
POST = ["bark", "brown", "tan", "sand"]
WATER = ["night", "navy", "dusk", "sea", "teal"]
WATER2 = ["dusk", "sea", "teal", "sky"]
CLOUD_MAIN = ["sun", "amber", "orange", "rust"]
CLOUD_FAR = ["rust", "plum", "aubergine"]
# wall light, mid, dark, roof light, roof dark
PALS = [("sand", "tan", "brown", "rust", "plum"), ("mist", "slate", "dusk", "sea", "navy"),
        ("tan", "brown", "bark", "red", "rust"), ("paper", "sand", "tan", "plum", "aubergine")]
BOWL_Y = 26

GEO = {
    "wide": dict(
        gb=226, sky_h=170, far_base=196, far_h=(34, 96), tower=(277, 84),
        blds=[(-4, 70, 120, 0, "gable"), (70, 132, 100, 1, "flat"), (132, 214, 128, 2, "gable"),
              (214, 262, 112, 3, "flat"), (292, 360, 112, 0, "gable"), (360, 430, 124, 1, "flat"),
              (430, 500, 104, 2, "gable"), (500, 580, 130, 3, "flat")],
        awn={2: (8, 22), 5: (4, 24)}, win=(317, 150),
        fount=(330, 268, 50), lamp=(468, 184, 300), flamp=(250, 192),
        bunt=(214, 140, 500, 128, 20), clouds=[(336, 62, 76), (452, 54, 56), (130, 84, 60)],
        stars=60, thinker=(394, 254), lamp_up=(430, 90), dogs=((206, 266), (231, 266)),
        folk=[(438, 277), (486, 280), (262, 238)],
        people=[(376, 208), (398, 208), (420, 208), (442, 208), (420, 232), (440, 232), (426, 252), (442, 252)],
        pools=[(468, 288, 95, 28, .85), (250, 238, 55, 12, .5)],
        planters=[(14, 314, 36, 1), (528, 314, 36, 2)],
    ),
    "tall": dict(
        gb=190, sky_h=150, far_base=160, far_h=(30, 70), tower=(170, 86),
        blds=[(-4, 50, 135, 0, "gable"), (50, 108, 123, 1, "flat"), (108, 150, 139, 2, "gable"),
              (190, 244, 127, 3, "flat")],
        awn={3: (4, 18)}, win=(117, 153),
        fount=(80, 248, 42), lamp=(204, 130, 272), flamp=(146, 160),
        bunt=(108, 152, 190, 146, 12), clouds=[(70, 92, 64), (186, 70, 40), (8, 24, 40)],
        stars=70, thinker=(140, 238), lamp_up=(196, 108), dogs=((36, 284), (61, 284)),
        folk=[(172, 246), (12, 262), (186, 286)],
        people=[(128, 186), (150, 186), (172, 186), (128, 210), (150, 210), (172, 210), (128, 265), (150, 265)],
        pools=[(204, 272, 70, 22, .85), (146, 196, 45, 10, .5)],
        planters=[], calm=288,
    ),
}


# ---------------------------------------------------------------- fountain

def fgeo(rx):
    """Canvas width, height, centre x, basin centre y and basin ry of the fountain."""
    return 2 * rx + 8, 91, rx + 4, 62, 14


def ellipse(im, cx, cy, rx, ry, fn):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                put(im, x, y, fn(x, y))


def bowl(im, cx, cy, rx, ry, wall_h, ix, iy, ramp):
    for x in range(cx - rx, cx + rx + 1):
        d = (x - cx) / rx
        yf = cy + round(ry * math.sqrt(max(0.0, 1 - d * d)))
        for y in range(yf, yf + wall_h):
            put(im, x, y, pick(WALL, (d + 1) / 2 * .9 + (rng_hash(x, y) - .5) * .15, x, y))
        put(im, x, yf + wall_h - 1, "umber")
    ellipse(im, cx, cy, rx, ry,
            lambda x, y: pick(RIM, .25 + .6 * (x - cx + rx) / (2 * rx) + (rng_hash(x, y) - .5) * .2, x, y))
    top = cy - (ry - iy)
    ellipse(im, cx, cy, rx - ix, ry - iy,
            lambda x, y: "bark" if y - top < 2 else pick(ramp, (y - top) / (2 * (ry - iy)), x, y))


def draw_fountain(rx):
    W, H, cx, by, ry = fgeo(rx)
    im = new(W, H)
    bowl(im, cx, by, rx, ry, 10, 5, 4, WATER)
    ellipse(im, cx, by + 1, 9, 3, lambda x, y: pick(RIM, .5 + (x - cx) / 20, x, y))
    for y in range(38, by + 1):
        half = 4 + max(0, y - (by - 10)) // 4
        for x in range(cx - half, cx + half + 1):
            put(im, x, y, pick(POST, (x - cx + half) / (2 * half) * .9 + (rng_hash(x, y) - .5) * .1, x, y))
        if y in (44, 45):
            rect(im, cx - half - 1, y, cx + half + 1, y, "tan")
    bowl(im, cx, BOWL_Y, 21, 6, 6, 3, 2, WATER2)
    rect(im, cx - 1, 14, cx + 1, BOWL_Y, "tan")
    rect(im, cx - 1, 14, cx - 1, BOWL_Y, "brown")
    rect(im, cx + 1, 14, cx + 1, BOWL_Y, "sand")
    disc(im, cx, 10, 3, "gold")
    put(im, cx + 1, 9, "sun")
    put(im, cx, 5, "gold")
    put(im, cx, 6, "gold")
    return outline(im)


def water_frames(rx):
    """Jets from the finial, curtains off the upper bowl, rings on the basin; loops in 4 frames."""
    W, H, cx, by, ry = fgeo(rx)
    frames = []
    for f in range(4):
        im = new(W, H)
        for k in range(3):
            r = 6 + (f * 2 + k * 8) % 24
            c = "white" if r < 14 else "sky_pale" if r < 22 else "teal"
            for i in range(61):
                a = math.pi * (.1 + .8 * i / 60)
                put(im, round(cx + r * math.cos(a)), round(by + 1 + .24 * r * math.sin(a)), c)
        for k in (-18, -15, -12, -9, 9, 12, 15, 18):
            start = BOWL_Y + round(6 * math.sqrt(1 - (k / 21) ** 2)) + 6
            for y in range(start, by + 1):
                if (y - f + (k & 3)) % 4 < 2:
                    put(im, cx + k, y, "sky_pale" if (y // 2) % 2 else "white")
        for sign in (-1, 1):
            for v in (6, 10, 14):
                for i in range(25):
                    t = i / 24
                    put(im, cx + sign * round(v * t), 6 + round((BOWL_Y - 8) * t * t - 10 * t * (1 - t)),
                        "white" if (i + f) % 4 < 2 else "sky_pale")
        frames.append(im)
    return frames


# ------------------------------------------------------------------ layers

def sky_layer(g, w, h):
    im = new(w, h)
    dither(im, (0, 0, w - 1, h - 1), SKY, lambda x, y: y / g["sky_h"])
    return im


def far_layer(g, w, h):
    im = new(w, h)
    base = g["far_base"]
    lo, hi = g["far_h"]
    rnd = random.Random(8)
    x = -6
    while x < w:
        bw, bh = rnd.randrange(16, 38), rnd.randrange(lo, hi)
        top = base - bh
        for xx in range(max(0, x), min(w, x + bw)):
            for y in range(top, base + 1):
                put(im, xx, y, pick(FAR, (y - top) / (bh + 30), xx, y))
        if rnd.random() < .6:
            rh = bw // 3
            for r in range(rh):
                half = bw // 2 * (r + 1) // rh
                rect(im, x + bw // 2 - half, top - rh + r, x + bw // 2 + half, top - rh + r, FAR[0])
        for _ in range(bw * bh // 260):
            if rnd.random() < .6:
                put(im, x + rnd.randrange(2, bw - 2), top + rnd.randrange(4, bh - 3), "amber")
        x += bw - rnd.randrange(0, 4)
    rect(im, 0, base + 1, w - 1, h - 1, "night")
    tx, tt = g["tower"]
    rect(im, tx - 8, tt, tx + 8, base, "aubergine")
    rect(im, tx + 4, tt, tx + 8, base, "night")
    rect(im, tx - 9, tt, tx - 9, base, "ink")
    rect(im, tx + 9, tt, tx + 9, base, "ink")
    for r in range(22):
        half = (r + 1) * 11 // 22
        y = tt - 22 + r
        rect(im, tx - half, y, tx + half, y, "aubergine" if r < 18 else "night")
        put(im, tx - half - 1, y, "ink")
        put(im, tx + half + 1, y, "ink")
    rect(im, tx, tt - 30, tx, tt - 22, "ink")
    disc(im, tx, tt + 14, 5, "amber")
    disc(im, tx, tt + 14, 4, "sun")
    for dx, dy in ((0, -2), (0, -1), (1, 0), (2, 0)):
        put(im, tx + dx, tt + 14 + dy, "ink")
    return im


def window(im, x, y, lit):
    rect(im, x, y, x + 6, y + 8, "umber")
    if lit:
        rect(im, x + 1, y + 1, x + 5, y + 7, "gold")
        rect(im, x + 2, y + 2, x + 4, y + 6, "sun")
        rect(im, x + 3, y + 1, x + 3, y + 7, "bark")
        rect(im, x + 1, y + 4, x + 5, y + 4, "bark")
    else:
        rect(im, x + 1, y + 1, x + 5, y + 7, "night")
        rect(im, x + 1, y + 1, x + 2, y + 3, "navy")
    rect(im, x - 1, y + 9, x + 7, y + 9, "brown")


def awning(im, x, y, w):
    rect(im, x - 1, y - 1, x + w, y - 1, "ink")
    rect(im, x - 1, y, x - 1, y + 4, "ink")
    rect(im, x + w, y, x + w, y + 4, "ink")
    for i in range(w):
        c = "red" if (i // 4) % 2 == 0 else "paper"
        rect(im, x + i, y, x + i, y + 3, c)
        if i % 4 in (1, 2):
            put(im, x + i, y + 4, c)
            put(im, x + i, y + 5, "ink")


def building(im, b, gb):
    x0, x1, top, pi, roof = b
    wl, wm, wd, rl, rd = PALS[pi]
    w = x1 - x0
    for y in range(top, gb):  # flat facade: shade band under the eaves, light edge on the left
        for x in range(max(0, x0), min(im.width, x1)):
            put(im, x, y, wd if y < top + 6 else wl if x == x0 + 1 else wm)
    if x0 >= 0:
        rect(im, x0, top, x0, gb - 1, "ink")
    cx = (x0 + x1) // 2
    if roof == "gable":
        rh = max(12, w * 3 // 10)
        for r in range(rh):
            half = (w // 2 + 3) * (r + 1) // rh
            for x in range(cx - half, cx + half + 1):
                put(im, x, top - rh + r, rd if (x < cx or r % 4 == 3 or r == rh - 1) else rl)
        rect(im, cx + 8, top - rh - 2, cx + 12, top - rh + 8, "brown")
        rect(im, cx + 11, top - rh - 2, cx + 12, top - rh + 8, "bark")
        rect(im, cx + 7, top - rh - 3, cx + 13, top - rh - 2, "umber")
    else:
        rect(im, x0 - 1, top - 5, x1, top - 1, wl)
        rect(im, x0 - 1, top - 1, x1, top - 1, wd)
        for x in range(x0 + 2, x1 - 4, 8):
            rect(im, x, top - 8, x + 3, top - 5, wl)
            rect(im, x, top - 8, x + 3, top - 8, "paper")
    for y in range(top + 14, gb - 30, 24):
        for x in range(x0 + 9, x1 - 12, 16):
            window(im, x, y, rng_hash(x, y) < .45)
    dx = cx - 4
    rect(im, dx, gb - 14, dx + 8, gb - 1, "bark")
    rect(im, dx + 1, gb - 15, dx + 7, gb - 15, "bark")
    rect(im, dx + 5, gb - 14, dx + 8, gb - 1, "umber")
    rect(im, dx + 2, gb - 12, dx + 4, gb - 10, "gold" if rng_hash(dx, 3) < .6 else "night")


def mid_layer(g, w, h):
    im = new(w, h)
    gb = g["gb"]
    for i, b in enumerate(g["blds"]):
        building(im, b, gb)
        if i in g["awn"]:
            dx, aw = g["awn"][i]
            awning(im, b[0] + dx, gb - 28, aw)
    wx, wy = g["win"]
    window(im, wx, wy, False)
    up = {PALETTE[p[1]]: PALETTE[p[0]] for p in PALS}
    lx, hy, _ = g["lamp"]
    for y in range(hy - 46, hy + 46):  # dither only where lamp light falls on a wall
        for x in range(lx - 46, lx + 47):
            if 0 <= x < w and 0 <= y < h:
                r, g_, b, a = im.getpixel((x, y))
                d = math.hypot(x - lx, y - hy)
                if a and (r, g_, b) in up and d < 46 and (1 - d / 46) * .9 > (BAYER[y % 4][x % 4] + .5) / 16:
                    put(im, x, y, (*up[(r, g_, b)], 255))
    im = outline(im)
    rect(im, 0, gb, w - 1, h - 1, "bark")
    rect(im, 0, gb, w - 1, gb, "ink")
    fx, fy = g["flamp"]  # the small lamp post further back, on the building line
    for x, c in ((fx - 2, "ink"), (fx - 1, "umber"), (fx, "bark"), (fx + 1, "brown"), (fx + 2, "ink")):
        rect(im, x, fy + 6, x, gb - 1, c)
    rect(im, fx - 3, gb - 5, fx + 3, gb - 1, "bark")
    rect(im, fx - 4, gb - 5, fx - 4, gb - 1, "ink")
    rect(im, fx + 4, gb - 5, fx + 4, gb - 1, "ink")
    return im


def lamp_post(im, lx, ytop, ybase):
    ph = ybase - ytop + 3
    cv = new(15, ph)
    c = 7
    rect(cv, c - 1, 0, c - 1, ph - 10, "umber")
    rect(cv, c, 0, c, ph - 10, "bark")
    rect(cv, c + 1, 0, c + 1, ph - 10, "brown")
    for yy in (3, 14, ph - 14):
        rect(cv, c - 2, yy, c + 2, yy + 1, "brown")
        put(cv, c - 2, yy, "umber")
    rect(cv, c - 4, ph - 9, c + 4, ph - 5, "bark")
    rect(cv, c - 4, ph - 9, c + 4, ph - 8, "brown")
    rect(cv, c + 2, ph - 7, c + 4, ph - 5, "umber")
    rect(cv, c - 5, ph - 4, c + 5, ph - 2, "umber")
    rect(cv, c - 5, ph - 4, c + 5, ph - 4, "bark")
    paste(im, outline(cv), lx - c, ytop)


def near_layer(g, w, h):
    im = new(w, h)
    gb = g["gb"]
    for k, c in enumerate(("sand", "tan", "brown", "umber")):
        rect(im, 0, gb + k, w - 1, gb + k, c)
    rect(im, 0, gb + 4, w - 1, h - 1, "umber")
    pools = g["pools"]

    def light(x, y):
        return sum(k * max(0.0, 1 - ((x - px) / rx) ** 2 - ((y - py) / ry) ** 2) for px, py, rx, ry, k in pools)

    y, i = gb + 4, 0
    while y < h:  # cobbles: rows and cells grow towards the viewer
        rh = 5 + (y - gb) // 28
        cw = 9 + (y - gb) // 12
        x = -(i % 2) * (cw // 2)
        while x < w:
            t = .14 + .1 * (y - gb) / (h - gb) + light(x + cw // 2, y + rh // 2) + (rng_hash(x, y) - .5) * .3
            idx = int(max(0.0, min(0.999, t)) * 5)
            calm = y >= g.get("calm", h)
            if calm:  # flat, quiet tones under the text panel
                idx = 1 + i % 2
            for yy in range(y + 1, min(y + rh, h)):
                c = PAVE[min(4, idx + 1)] if yy == y + 1 and not calm else PAVE[idx]
                for xx in range(max(0, x + 1), min(w, x + cw)):
                    put(im, xx, yy, c)
            x += cw
        y += rh
        i += 1
    fcx, fby, frx = g["fount"]
    sx, sy = fcx - 18, fby + 15  # the fountain's shadow, thrown away from the right-hand lamp
    for yy in range(sy - 16, sy + 17):
        for xx in range(sx - frx - 16, sx + frx + 17):
            if (((xx - sx) / (frx + 14)) ** 2 + ((yy - sy) / 15) ** 2 < 1
                    and BAYER[yy % 4][xx % 4] < 8 and yy > gb + 4):
                put(im, xx, yy, "umber")
    paste(im, draw_fountain(frx), fcx - frx - 4, fby - 62)
    lx, hy, base = g["lamp"]
    lamp_post(im, lx, hy + 9, base)
    return im


def planter(im, x, y, wd, seed):
    rnd = random.Random(seed)
    cv = new(wd + 12, 44)
    for k in range(4):
        bx = 12 + k * (wd - 12) // 3
        disc(cv, bx, 15, 8, "forest")
    for k in range(4):
        bx = 12 + k * (wd - 12) // 3
        disc(cv, bx + 1, 13, 5, "grass")
        disc(cv, bx + 2, 11, 2, "leaf")
    for _ in range(wd // 4):
        fx, fy = 8 + rnd.randrange(wd - 4), 8 + rnd.randrange(12)
        c = rnd.choice(["red", "paper", "gold", "sky"])
        if cv.getpixel((fx, fy))[3]:
            put(cv, fx, fy, c)
    rect(cv, 6, 22, 6 + wd, 36, "bark")
    rect(cv, 6, 22, 6 + wd, 23, "brown")
    rect(cv, 6, 28, 6 + wd, 28, "umber")
    rect(cv, 3 + wd, 24, 6 + wd, 36, "umber")
    paste(im, outline(cv), x - 6, y)


def front_layer(g, w, h):
    im = new(w, h)
    for x, y, wd, seed in g["planters"]:
        planter(im, x, y, wd, seed)
    return im


# ------------------------------------------------------------------ sprites

def pad(im):
    big = new(im.width + 2, im.height + 2)
    paste(big, im, 1, 1)
    return outline(big)


def lantern_frame(f):
    fh = (4, 5, 3, 5, 4, 3)[f]
    im = new(13, 18)
    put(im, 6, 0, "umber")
    rect(im, 5, 1, 7, 1, "umber")
    rect(im, 3, 2, 9, 3, "bark")
    rect(im, 3, 2, 9, 2, "brown")
    rect(im, 2, 4, 10, 4, "umber")
    rect(im, 3, 5, 9, 13, "amber")
    rect(im, 4, 6, 8, 12, "gold" if f % 2 else "sun")
    rect(im, 5, 13 - fh, 7, 12, "white")
    if fh > 3:
        put(im, 6, 12 - fh, "white")
    rect(im, 3, 5, 3, 13, "umber")
    rect(im, 9, 5, 9, 13, "umber")
    rect(im, 2, 14, 10, 14, "umber")
    rect(im, 3, 15, 9, 16, "bark")
    rect(im, 5, 17, 7, 17, "umber")
    return pad(im)


def lantern_small(f):
    im = new(7, 9)
    rect(im, 2, 0, 4, 0, "umber")
    rect(im, 1, 1, 5, 1, "bark")
    rect(im, 1, 2, 5, 6, "amber")
    rect(im, 2, 3, 4, 5, "sun")
    put(im, 3, 4 - f % 2, "white")
    rect(im, 1, 7, 5, 7, "umber")
    put(im, 3, 8, "umber")
    return pad(im)


def glow_frames(size, radii):
    frames = []
    c = size // 2
    for r in radii:  # stepped round halo: gold, amber, then a dithered amber rim
        im = new(size, size)
        for y in range(size):
            for x in range(size):
                d = math.hypot(x - c, y - c)
                k = BAYER[y % 4][x % 4] < 8
                if d < r:
                    continue
                if d < r + 3:
                    put(im, x, y, "gold" if d < r + 2 or k else "amber")
                elif d < r + 6:
                    put(im, x, y, "amber")
                elif d < r + 8 and k:
                    put(im, x, y, "amber")
        frames.append(im)
    return frames


def lantern_rise(g, n=20):
    """The post lantern with its glow; it floats up above the rooftops in the last fifth of the shot."""
    lx, hy, _ = g["lamp"]
    ux, uy = g["lamp_up"]
    ox, oy = min(lx, ux) - 28, uy - 28
    w, h = abs(lx - ux) + 56, hy - uy + 56
    glow, lamp = glow_frames(56, (7,))[0], lantern_frame(0)
    first = int(n * 0.8)
    frames = []
    for f in range(n):
        t = max(0, f - first + 1) / (n - first)
        t = t * t * (3 - 2 * t)
        cx, cy = round(lx + (ux - lx) * t), round(hy + (uy - hy) * t)
        im = new(w, h)
        paste(im, glow, cx - 28 - ox, cy - 28 - oy)
        paste(im, lamp, cx - 7 - ox, cy - 10 - oy)
        frames.append(im)
    return Sprite("lantern_rise", frames, 1, ox, oy, .8, "scrub")


def moth_frames(n=8, w=50, h=44):
    moths = [(14, 9, 0.0, 1), (19, 12, .35, -1), (10, 7, .7, 1)]
    frames = []
    for f in range(n):
        im = new(w, h)
        for k, (ax, ay, ph, dr) in enumerate(moths):
            a = 2 * math.pi * (f / n * dr + ph)
            x = round(w / 2 + ax * math.cos(a))
            y = round(h / 2 + ay * math.sin(a) + 2 * math.sin(3 * a))
            if (f + k) % 2 == 0:
                put(im, x - 1, y - 1, "paper")
                put(im, x + 1, y - 1, "paper")
            else:
                put(im, x - 1, y, "white")
                put(im, x + 1, y, "white")
            put(im, x, y, "sand")
        frames.append(im)
    return frames


def star_frames(rnd, w, hh, n=3):
    frames = [new(w, hh) for _ in range(n)]
    for _ in range(w * hh // 700):
        x, y, ph = rnd.randrange(2, w - 2), rnd.randrange(2, hh - 2), rnd.randrange(n)
        for f in range(n):
            put(frames[f], x, y, ("slate", "mist", "white")[(f + ph) % n])
    return frames


def bunting(x0, y0, x1, y1, sag):
    """Flags strung between two walls; returns (frames, origin x, origin y)."""
    sw, sh = x1 - x0 + 9, abs(y1 - y0) + sag + 12
    ox, oy = x0 - 4, min(y0, y1) - 2

    def sy(x):
        u = (x - x0) / (x1 - x0)
        return round(y0 + (y1 - y0) * u + sag * 4 * u * (1 - u))

    cols = ["red", "teal", "sand", "plum", "sky", "leaf"]
    frames = []
    for f in range(4):
        fl = new(sw, sh)
        for k, fx in enumerate(range(x0 + 8, x1 - 5, 11)):
            sway = (0, 1, 0, -1)[(f + k) % 4]
            for r in range(7):
                half = (6 - r) // 2
                cx_ = fx - ox + round(sway * r / 6)
                rect(fl, cx_ - half, sy(fx) - oy + 1 + r, cx_ + half, sy(fx) - oy + 1 + r, cols[k % len(cols)])
        fl = outline(fl)
        for x in range(x0, x1 + 1):
            put(fl, x - ox, sy(x) - oy, "umber")
        frames.append(fl)
    return frames, ox, oy


def person(coat, coat2, hair, look, hat=None, dress=False, raw=False):
    im = new(11, 21)
    rect(im, 3, 2, 7, 3, hair)
    if hat:
        rect(im, 2, 2, 8, 2, hat)
        rect(im, 3, 1, 7, 1, hat)
    rect(im, 3, 4, 7, 6, "skin")
    if look:
        rect(im, 3, 4, 3, 5, hair)
        put(im, 6, 5, "ink")
        put(im, 7, 5, "tan")
    else:
        rect(im, 7, 4, 7, 5, hair)
        put(im, 4, 5, "ink")
        put(im, 3, 5, "tan")
    put(im, 5, 7, "tan")
    rect(im, 2, 8, 8, 13, coat)
    rect(im, 7, 8, 8, 13, coat2)
    rect(im, 1, 9, 1, 13, coat)
    rect(im, 9, 9, 9, 13, coat2)
    put(im, 1, 14, "skin")
    put(im, 9, 14, "skin")
    if dress:
        rect(im, 2, 14, 8, 18, coat)
        rect(im, 7, 14, 8, 18, coat2)
        rect(im, 3, 19, 4, 19, "umber")
        rect(im, 6, 19, 7, 19, "umber")
    else:
        rect(im, 3, 14, 4, 18, "navy")
        rect(im, 6, 14, 7, 18, "night")
        rect(im, 2, 19, 4, 19, "umber")
        rect(im, 6, 19, 8, 19, "umber")
    return im if raw else outline(im)


# The community: eight kinds of people, each at work with a prop. A canvas is 22 x 24 px; the body
# stands at (2, 2) facing right (head x 5-9, arms x 3 and 11, hands y 16, feet y 21).
CW, CH = 22, 24
CLEAR = (0, 0, 0, 0)


def _hand(im, x, y):
    put(im, x, y, "skin")


def _free_arm(im):
    """Take the right arm off the body (the pose draws it again)."""
    rect(im, 11, 11, 11, 16, CLEAR)


def kind_visionary(im, f):  # looks up, spyglass to the sky
    _free_arm(im)
    put(im, 11, 12, "plum")
    put(im, 12, 11, "plum")
    _hand(im, 13, 10)
    tip = (19, 4 - (f == 3))
    line(im, 13, 10, tip[0], tip[1], "tan")
    line(im, 14, 10, tip[0] - 1, tip[1] + 1, "gold")
    put(im, *tip, "gold")
    if f % 2:
        put(im, tip[0] + 1, tip[1] - 1, "white")
        put(im, tip[0] - 1, tip[1] - 2, "sun")


def kind_artisan(im, f):  # potter at a wheel
    rect(im, 13, 19, 20, 19, "brown")  # the wheel table
    rect(im, 14, 20, 14, 21, "bark")
    rect(im, 19, 20, 19, 21, "bark")
    rect(im, 13, 18, 20, 18, "sand")
    put(im, 13 + (f * 2) % 8, 18, "tan")  # a spoke turning on the disc
    put(im, 13 + (f * 2 + 4) % 8, 18, "tan")
    w = (3, 4, 4, 3)[f]  # the clay swells and settles
    rect(im, 16 - w // 2, 15, 16 - w // 2 + w, 17, "rust")
    rect(im, 16 - w // 2, 15, 16 - w // 2, 17, "red")
    put(im, 16, 14, "rust")
    _free_arm(im)
    put(im, 11, 12, "tan")
    put(im, 12, 13, "tan")
    _hand(im, 13, 14 + (f == 2))


def kind_crafter(im, f):  # knits
    _free_arm(im)
    _hand(im, 11, 14)
    line(im, 10, 15, 15, 10, "sand")
    line(im, 12, 15, 17, 11 + (f % 2) * 1, "sand")
    put(im, 16, 10, "paper")
    rect(im, 13, 18, 16, 21, "red")  # the ball of yarn
    rect(im, 13, 21, 16, 21, "rust")
    put(im, (13, 15, 16, 14)[f], (19, 19, 20, 20)[f], "white")
    line(im, 14, 18, 11, 15, "red")  # the yarn runs up to the work
    for y in range(18, 22):
        if (y + f) % 2:
            put(im, 15, y, "rust")


def kind_maker(im, f):  # hammers a board on a bench
    rect(im, 13, 17, 21, 18, "brown")
    rect(im, 13, 17, 21, 17, "tan")
    rect(im, 14, 19, 14, 21, "bark")
    rect(im, 20, 19, 20, 21, "bark")
    rect(im, 15, 16, 19, 16, "sand")
    _free_arm(im)
    up = (9, 12, 15, 12)[f]  # hammer head height: up, half, strike, half
    _hand(im, 12, 14 if f != 2 else 15)
    line(im, 12, 14 if f != 2 else 15, 16, up + 2, "bark")
    rect(im, 15, up, 18, up + 1, "mist")
    rect(im, 15, up + 1, 18, up + 1, "slate")
    if f == 2:
        put(im, 19, 15, "white")
        put(im, 14, 15, "sun")


def kind_doer(im, f):  # carries a crate
    _free_arm(im)
    dy = (0, -1, 0, 1)[f]
    rect(im, 11, 12 + dy, 19, 19 + dy, "tan")
    rect(im, 11, 12 + dy, 19, 12 + dy, "sand")
    rect(im, 11, 15 + dy, 19, 15 + dy, "brown")
    rect(im, 11, 19 + dy, 19, 19 + dy, "brown")
    rect(im, 11, 12 + dy, 11, 19 + dy, "brown")
    line(im, 12, 16 + dy, 18, 18 + dy, "bark")
    put(im, 10, 16 + dy, "skin")
    put(im, 20, 20 + dy, "skin")
    if f == 1:
        put(im, 3, 21, "sand")  # a puff of dust at the heel


def kind_designer(im, f):  # at a drawing board on legs
    rect(im, 13, 6, 21, 15, "brown")
    rect(im, 14, 7, 20, 14, "paper")
    line(im, 14, 15, 13, 21, "bark")
    line(im, 20, 15, 21, 21, "bark")
    put(im, 17, 16, "bark")
    put(im, 17, 17, "bark")
    shape = [(15, 12), (16, 11), (17, 10), (18, 11), (19, 12), (15, 12), (16, 13), (18, 13), (19, 12)]
    for x, y in shape[: 3 + 2 * f]:
        put(im, x, y, "sea")
    _free_arm(im)
    put(im, 11, 12, "mist")
    put(im, 12, 12, "mist")
    _hand(im, 13, 12)
    put(im, *shape[min(8, 2 + 2 * f)], "ink")  # the pencil point


def _gear(im, cx, cy, f):
    rect(im, cx - 1, cy - 1, cx + 1, cy + 1, "gold")
    put(im, cx, cy, "ink")
    teeth = ((0, -2), (0, 2), (-2, 0), (2, 0)) if f % 2 == 0 else ((-2, -2), (2, -2), (-2, 2), (2, 2))
    for dx, dy in teeth:
        put(im, cx + dx, cy + dy, "gold")


def kind_innovator(im, f):  # a gear-and-spark contraption
    rect(im, 12, 15, 20, 21, "mist")
    rect(im, 12, 15, 20, 15, "paper")
    rect(im, 12, 20, 20, 21, "slate")
    rect(im, 14, 17, 16, 18, "dusk")
    put(im, 18, 17, "red" if f % 2 else "orange")
    _gear(im, 16, 11, f)
    line(im, 16, 14, 16, 12, "umber")
    for dx, dy in ((18, 7), (14, 6), (19, 9), (13, 9)):  # sparks that come and go
        if (dx + dy + f) % 2 == 0:
            put(im, dx, dy, "sun" if f % 2 else "white")
    _free_arm(im)
    put(im, 11, 14, "sky")
    _hand(im, 12, 15)


def kind_operator(im, f):  # a lever on a machine panel, lamp blinking
    rect(im, 13, 10, 21, 21, "slate")
    rect(im, 13, 10, 21, 10, "mist")
    rect(im, 13, 10, 13, 21, "dusk")
    rect(im, 15, 17, 19, 17, "night")  # the lever slot
    put(im, 17, 17, "mist")
    hx = (15, 16, 19, 18)[f]  # lever swings across: left, centre, right, centre
    line(im, 17, 17, hx, 13, "paper")
    put(im, hx, 12, "red")
    put(im, 19, 12, "gold" if f in (1, 2) else "umber")  # the lamp
    put(im, 15, 12, "gold" if f in (0, 3) else "umber")
    rect(im, 15, 19, 19, 19, "umber")
    _free_arm(im)
    put(im, 11, 14, "forest")
    put(im, 12, 14, "forest")
    _hand(im, 13, 14)


KINDS = [  # kind, coat, shade, hair, hat, pose
    ("visionary", "plum", "aubergine", "mist", None, kind_visionary),
    ("artisan", "tan", "brown", "bark", "sand", kind_artisan),
    ("crafter", "olive", "olive_deep", "sand", None, kind_crafter),
    ("maker", "red", "rust", "umber", "gold", kind_maker),
    ("doer", "teal", "forest", "bark", None, kind_doer),
    ("designer", "mist", "slate", "umber", None, kind_designer),
    ("innovator", "sky", "dusk", "bark", "paper", kind_innovator),
    ("operator", "grass", "forest", "sand", "dusk", kind_operator),
]


def community_frames(kind, flip):
    (_, coat, shade, hair, hat, pose), = [k for k in KINDS if k[0] == kind]
    frames = []
    for f in range(4):
        im = new(CW, CH)
        paste(im, person(coat, shade, hair, 1, hat=hat, dress=kind == "crafter", raw=True), 2, 2)
        pose(im, f)
        frames.append(ImageOps.mirror(outline(im)) if flip else outline(im))
    return frames


def recolour(im, mp):
    sw = {PALETTE[a]: PALETTE[b] for a, b in mp.items()}
    out = im.copy()
    for y in range(im.height):
        for x in range(im.width):
            r, g_, b, a = im.getpixel((x, y))
            if a and (r, g_, b) in sw:
                out.putpixel((x, y), (*sw[(r, g_, b)], 255))
    return out


# -------------------------------------------------------------------- scene

def scene(variant):
    g = GEO[variant]
    w, h = SIZES[variant]
    layers = [
        Layer("sky", sky_layer(g, w, h), 0.0),
        Layer("far", far_layer(g, w, h), 0.2),
        Layer("mid", mid_layer(g, w, h), 0.45),
        Layer("near", near_layer(g, w, h), 0.8),
        Layer("front", front_layer(g, w, h), 1.0),
    ]
    rnd = random.Random(8)
    sp = [Sprite("stars", star_frames(rnd, w, g["stars"]), 2, 0, 0, 0.0)]
    for i, (cx, cy, cw) in enumerate(g["clouds"]):
        sp.append(Sprite(f"cloud{i + 1}", cloud_frames(cw, CLOUD_MAIN if i == 0 else CLOUD_FAR, rnd),
                         (3, 2, 3)[i], cx, cy, 0.0))
    cx, cy, cw = g["clouds"][0]
    cloud_anchor = (cx + (cw + 10) // 2, cy + (round(cw * .45) + 2) // 2)

    frames, bx, by = bunting(*g["bunt"])
    sp.append(Sprite("bunting", frames, 3, bx, by, .45))
    wx, wy = g["win"]
    dark, lit = [], []
    for fr, on in ((dark, False), (lit, True)):
        im = new(9, 10)
        window(im, 1, 0, on)
        fr.append(im)
    sp.append(Sprite("window", dark * 5 + lit * 5, 2, wx - 1, wy, .45))
    fx, fy = g["flamp"]
    sp.append(Sprite("glow2", glow_frames(36, (4, 5, 4, 5)), 5, fx - 18, fy - 18, .45))
    sp.append(Sprite("lantern2", [lantern_small(f) for f in range(4)], 5, fx - 4, fy - 5, .45))

    lx, hy, _ = g["lamp"]
    sp.append(lantern_rise(g))
    sp.append(Sprite("moths", moth_frames(), 6, lx - 25, hy - 22, .8))

    fcx, fby, frx = g["fount"]
    sp.append(Sprite("fountain", water_frames(frx), 6, fcx - frx - 4, fby - 62, .8))

    folks = [
        ([person("teal", "forest", "bark", k, hat="tan") for k in (1, 1, 1, 0, 0, 0)], 2),
        ([person("plum", "aubergine", "umber", k, dress=True) for k in (0, 0, 0, 1, 1, 1)], 2),
        ([person("slate", "dusk", "mist", k, hat="plum") for k in (1, 1, 0, 0, 0, 1)], 3),
    ]
    for i, ((px, py), (frs, fps)) in enumerate(zip(g["folk"], folks)):
        sp.append(Sprite(f"folk{i + 1}", frs, fps, px, py, .8))

    tx, ty = g["thinker"]
    for (kind, *_), (px, py) in zip(KINDS, g["people"]):  # those on his right face him
        sp.append(Sprite(f"folk-{kind}", community_frames(kind, px + CW // 2 > tx + 12), 2, px, py, .8))
    sp.append(Sprite("who", figure("socrates", "show_slate"), 3, tx, ty, .8))
    (d1x, d1y), (d2x, d2y) = g["dogs"]
    sp.append(Sprite("dog", dog("greet"), 5, d1x, d1y, .8))
    other = [ImageOps.mirror(recolour(f, {"tan": "mist", "brown": "slate", "sand": "paper"})) for f in dog("greet")]
    sp.append(Sprite("dog2", other[2:] + other[:2], 5, d2x, d2y, .8))
    sd = -.62  # the snail sits on the front lip of the basin
    sx = round(fcx + sd * frx) - 7
    sy = fby + round(14 * math.sqrt(1 - sd * sd)) - 11
    sp.append(Sprite("snail", snail(), 2, sx, sy, .8))

    return Scene("square", variant, w, h, layers, sp, {"cloud": (*cloud_anchor, 0.0), "lantern": (lx, hy, .8),
                                                                        "lantern_up": (*g["lamp_up"], .8)}, [("who", tx + 10, ty + 12, .8)])


SCENES = {"square": lambda v: scene(v)}
