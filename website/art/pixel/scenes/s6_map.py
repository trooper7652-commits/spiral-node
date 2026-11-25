"""Scene 6: the roadmap, one winding dotted path across a map laid on a table."""
import math
import random

from ..cast import dog, figure, snail
from ..draw import BAYER, dither, disc, line, new, outline, paste, put, rect
from ..palette import PALETTE
from ..scene import SIZES, Layer, Scene, Sprite, safe_box
from .s1_countryside import bird_frames, pick, rng_hash

NAME = {v: k for k, v in PALETTE.items()}
DARK = dict(paper="sand", sand="tan", tan="brown", brown="bark", lime="leaf", leaf="grass", grass="forest",
            sky_pale="sky", sky="sea", sea="dusk")
LIGHT = dict(sand="paper", tan="sand", brown="tan", forest="grass", grass="leaf", leaf="lime",
             dusk="sea", sea="sky", sky="sky_pale")
GREENS = ["lime", "leaf", "grass", "forest"]
R2 = [(1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2), (1, 1), (-1, -1), (1, -1), (-1, 1)]
R3 = R2 + [(3, 0), (-3, 0), (0, 3), (0, -3), (2, 2), (-2, -2), (2, -2), (-2, 2)]

# box = the map sheet (inclusive); ctrl = the path's control points, stops = indexes of r1..r6 in ctrl
GEO = {
    "wide": dict(
        box=(40, 30, 535, 329),
        ctrl=[(112, 262), (138, 244), (176, 214), (215, 222), (262, 252), (300, 236), (330, 196),
              (310, 160), (270, 140), (290, 112), (350, 92)],
        stops=[0, 2, 4, 6, 8, 10],
        land=[(230, 175, 170, 110), (150, 230, 100, 60), (330, 130, 80, 70), (480, 90, 24, 14), (505, 175, 13, 9)],
        lakes=[(180, 122, 20, 11)],
        compass=(470, 246), dog_at=1, snail=(90, 256),
        n_mount=7, n_hut=3, n_tree=80,
        ruler=(150, 338, 450, 349), candle=(550, 40), inkwell=(28, 332), birds=(420, 60),
    ),
    "tall": dict(
        box=(14, 30, 225, 449),
        ctrl=[(58, 298), (92, 290), (122, 268), (160, 262), (182, 236), (150, 218), (104, 206), (66, 186),
              (60, 160), (90, 138), (132, 130), (174, 124), (152, 110)],
        stops=[0, 2, 4, 6, 8, 12],
        land=[(120, 215, 112, 190), (100, 340, 70, 50)],
        lakes=[(150, 172, 16, 11)],
        compass=(172, 396), dog_at=1, snail=(34, 291),
        n_mount=6, n_hut=2, n_tree=55,
        ruler=(40, 460, 200, 471), candle=(198, 4), inkwell=(8, 452), birds=(130, 330),
    ),
}


# ------------------------------------------------------------------ geometry

def spline(ctrl, n=20):
    """Catmull-Rom through the control points: (x, y, u) where u is the control index (fractional)."""
    p = [ctrl[0]] + ctrl + [ctrl[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for k in range(n):
            t = k / n
            xy = [0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t * t
                         + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t ** 3) for a in (0, 1)]
            out.append((xy[0], xy[1], i - 1 + t))
    out.append((*ctrl[-1], len(ctrl) - 1))
    return out


def land_grid(c, inner):
    ix0, iy0, ix1, iy1 = inner
    rows = []
    for y in range(iy0, iy1 + 1):
        row = []
        for x in range(ix0, ix1 + 1):
            p = .07 * math.sin(x * .13 + y * .07) + .06 * math.sin(x * .05 - y * .11 + 2) + .04 * math.sin(x * .31 + y * .23)
            lake = any(((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 + p < 1 for ex, ey, rx, ry in c["lakes"])
            row.append(not lake and any(((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 + p < 1
                                        for ex, ey, rx, ry in c["land"]))
        rows.append(row)

    def at(x, y):
        return rows[min(max(y, iy0), iy1) - iy0][min(max(x, ix0), ix1) - ix0]
    return at


def shade(im, x, y, table):
    if 0 <= x < im.width and 0 <= y < im.height:
        r, g, b, a = im.getpixel((x, y))
        if a and NAME.get((r, g, b)) in table:
            put(im, x, y, table[NAME[(r, g, b)]])


# -------------------------------------------------------------- relief stamps

def pine():
    im = new(11, 13)
    for i, hf in enumerate((0, 1, 1, 2, 2, 3, 3, 4, 4)):
        y = 1 + i
        rect(im, 5 - hf, y, 5 + hf, y, "grass")
        if hf:
            rect(im, 5 - hf, y, 5 - hf + 1, y, "leaf")
            rect(im, 5 + hf - 1, y, 5 + hf, y, "forest")
    rect(im, 5, 10, 5, 11, "bark")
    return outline(im)


def round_tree():
    im = new(9, 11)
    disc(im, 4, 4, 3, "grass")
    for x in range(9):
        for y in range(9):
            if im.getpixel((x, y))[3] and (x - 4) + (y - 4) >= 3:
                put(im, x, y, "forest")
    for x, y in ((3, 2), (4, 2), (2, 3), (3, 3)):
        put(im, x, y, "leaf")
    put(im, 3, 2, "lime")
    rect(im, 4, 8, 4, 9, "bark")
    return outline(im)


def mountain():
    im = new(21, 13)
    for r in range(11):
        hf, y = round(r * .85), 1 + r
        for x in range(10 - hf, 10 + hf + 1):
            if r < 3:
                col = "white" if x < 10 else "mist"
            elif x == 10:
                col = "bark"
            else:
                dark = r > 6 and rng_hash(x, y) < .18
                col = ("brown" if dark else "tan") if x < 10 else ("bark" if dark else "brown")
            put(im, x, y, col)
    return outline(im)


def hut():
    im = new(11, 11)
    rect(im, 2, 5, 8, 9, "sand")
    rect(im, 7, 5, 8, 9, "tan")
    for i, hf in enumerate((1, 2, 3, 4)):
        rect(im, 5 - hf, 1 + i, 5 + hf, 1 + i, "rust")
        rect(im, 5 + hf - 1, 1 + i, 5 + hf, 1 + i, "plum")
    rect(im, 4, 7, 5, 9, "bark")
    return outline(im)


def place(c, at, inner, pts, clear):
    """Seeded scatter of mountains, huts and trees: on land, off the path, off the cast."""
    rnd = random.Random(6)
    ix0, iy0, ix1, iy1 = inner
    ccx, ccy = c["compass"]
    placed = []

    def free(x, y, sep, pd):
        if x - 9 < ix0 or x + 9 > ix1 or y - 12 < iy0 or y + 3 > iy1:
            return False
        if not all(at(x + dx, y + dy) for dx, dy in ((-6, 0), (6, 0), (0, -7), (0, 2))):
            return False
        if math.hypot(x - ccx, y - ccy) < 38:
            return False
        if any(math.hypot(x - px, y - py) < pd for px, py, _ in pts):
            return False
        if any(x + 9 > a - 3 and x - 9 < b + 3 and y + 2 > d - 3 and y - 12 < e + 3 for a, d, b, e in clear):
            return False
        return all(math.hypot(x - px, y - py) >= sep for px, py, _ in placed)

    for kind, n, sep, pd in (("mount", c["n_mount"], 22, 22), ("hut", c["n_hut"], 18, 14), ("tree", c["n_tree"], 8, 12)):
        got = 0
        for _ in range(4000):
            if got >= n:
                break
            x, y = rnd.randrange(ix0, ix1), rnd.randrange(iy0 + 12, iy1)
            dens = .5 + .5 * math.sin(x * .05 + 1) * math.sin(y * .07 + 2)
            if kind == "tree" and not (dens > .55 or rnd.random() < .04):
                continue
            if free(x, y, sep, pd):
                placed.append((x, y, kind))
                got += 1
    return sorted(placed, key=lambda p: p[1])


# ------------------------------------------------------------------- layers

def table_layer(w, h):
    im = new(w, h)
    dither(im, (0, 0, w - 1, h - 1), ["umber", "bark", "brown"],
           lambda x, y: .3 + .28 * (math.sin(y * .5 + 3 * math.sin(x * .03 + (y // 40) * 1.7)) * .5 + .5)
           + .07 * ((y // 40) % 3))
    for y in range(0, h, 40):
        rect(im, 0, y, w - 1, y, "umber")
        rect(im, 0, y + 1, w - 1, y + 1, "bark")
        for x in range(((y // 40) * 137) % 200, w, 260):
            rect(im, x, y, x, min(h - 1, y + 39), "umber")
    return im


def shadow_layer(c, w, h):
    im = new(w, h)
    x0, y0, x1, y1 = c["box"]
    for y in range(y0 + 7, y1 + 8):
        for x in range(x0 + 7, x1 + 8):
            if x > x1 + 4 or y > y1 + 5:
                if (x + y) % 2 == 0:
                    put(im, x, y, "ink")
    rect(im, x0 + 4, y0 + 5, x1 + 4, y1 + 5, "ink")
    return im


def compass_plate(im, cx, cy):
    R = 25
    for y in range(cy - R, cy + R + 1):
        for x in range(cx - R, cx + R + 1):
            d = math.hypot(x - cx, y - cy)
            if d <= R:
                put(im, x, y, "ink" if d > R - 1 else "bark" if d > R - 2.5 else "paper" if d > R - 5 else "sand")
    for k in range(16):
        a = k * math.pi / 8
        put(im, round(cx + (R - 4) * math.sin(a)), round(cy - (R - 4) * math.cos(a)), "ink")
    for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        line(im, cx + sx * 3, cy + sy * 3, cx + sx * 13, cy + sy * 13, "tan")
    for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        for k in range(3, 19):
            wd = (19 - k) // 7
            for o in range(-wd, wd + 1):
                put(im, cx + dx * k - dy * o, cy + dy * k + dx * o, "brown" if o <= 0 else "bark")
    rect(im, cx - 1, cy - R + 3, cx + 1, cy - R + 4, "red")


def map_layer(c, w, h, at, inner, pts, stop, clear):
    x0, y0, x1, y1 = c["box"]
    ix0, iy0, ix1, iy1 = inner
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    im = new(w, h)
    for y in range(y0, y1 + 1):  # parchment, darker towards the edge
        for x in range(x0, x1 + 1):
            d = min(x - x0, x1 - x, y - y0, y1 - y)
            t = max(0, 1 - d / 14) * .85 + (rng_hash(x >> 1, y >> 1) - .5) * .2 + .08 * math.sin(x * .05 + y * .04)
            put(im, x, y, pick(["paper", "sand", "tan"], t, x, y))
    for a, b, d, e in ((x0, y0, x1, y0), (x0, y1, x1, y1), (x0, y0, x0, y1), (x1, y0, x1, y1)):
        rect(im, a, b, d, e, "ink")
    for a, b, d, e in ((x0 + 8, y0 + 8, x1 - 8, y0 + 8), (x0 + 8, y1 - 8, x1 - 8, y1 - 8),
                       (x0 + 8, y0 + 8, x0 + 8, y1 - 8), (x1 - 8, y0 + 8, x1 - 8, y1 - 8)):
        rect(im, a, b, d, e, "bark")
    for y in range(iy0, iy1 + 1):  # sea and land
        for x in range(ix0, ix1 + 1):
            if at(x, y):
                if not (at(x - 1, y) and at(x + 1, y) and at(x, y - 1) and at(x, y + 1)):
                    col = "bark"
                elif not all(at(x + dx, y + dy) for dx, dy in R2):
                    col = "sand"
                else:
                    t = (.4 + .22 * math.sin(x * .08 + y * .05) + .18 * math.sin(y * .09 - x * .035 + 1.3)
                         + (rng_hash(x >> 1, y >> 1) - .5) * .3)
                    col = pick(GREENS, t, x, y)
            elif any(at(x + dx, y + dy) for dx, dy in R2[:4]):
                col = "sky_pale"
            else:
                near = any(at(x + dx, y + dy) for dx, dy in R3)
                t = (.6 if near else .12) + .1 * math.sin(x * .2 + y * .1) + (rng_hash(x >> 1, y) - .5) * .12
                col = pick(["sea", "sky"], t, x, y)
            put(im, x, y, col)
    for y in range(y0 + 1, y1):  # folds
        shade(im, cx, y, DARK)
        shade(im, cx + 1, y, LIGHT)
    for x in range(x0 + 1, x1):
        shade(im, x, cy, DARK)
        shade(im, x, cy + 1, LIGHT)
    compass_plate(im, *c["compass"])
    for px, py in ((x0 + 4, y0 + 4), (x1 - 4, y0 + 4), (x0 + 4, y1 - 4), (x1 - 4, y1 - 4)):  # corner pins
        disc(im, px, py, 3, "ink")
        disc(im, px, py, 2, "gold")
        put(im, px - 1, py - 1, "white")
    stamps = dict(mount=mountain(), hut=hut(), pine=pine(), round=round_tree())
    for x, y, kind in place(c, at, inner, pts, clear):
        if kind == "tree":
            kind = "round" if (x * 7 + y) % 3 == 0 else "pine"
        s = stamps[kind]
        paste(im, s, x - s.width // 2, y - s.height + 2)
    # the path: dots, red where done, white where still to go, then the stops
    done_u = c["stops"][2]
    last, acc, dots = pts[0], 0.0, [pts[0]]
    for p in pts[1:]:
        acc += math.hypot(p[0] - last[0], p[1] - last[1])
        last = p
        if acc >= 7:
            dots.append(p)
            acc = 0.0
    for x, y, u in dots:
        x, y = round(x), round(y)
        rect(im, x, y + 1, x + 2, y + 2, "ink")
        rect(im, x, y, x + 1, y + 1, "red" if u <= done_u else "white")
    for i, (sx, sy) in enumerate(stop):
        ring, core = ("gold", "white") if i < 3 else ("paper", "mist")
        disc(im, sx, sy, 5, "ink")
        disc(im, sx, sy, 4, ring)
        disc(im, sx, sy, 2, core)
    return im


def front_layer(c, w, h):
    im = new(w, h)
    rx0, ry0, rx1, ry1 = c["ruler"]
    rect(im, rx0, ry0, rx1, ry1, "sand")
    rect(im, rx0, ry1 - 1, rx1, ry1, "tan")
    for x in range(rx0 + 3, rx1 - 2, 5):
        rect(im, x, ry0 + 1, x, ry0 + (4 if (x - rx0 - 3) % 25 == 0 else 2), "ink")
    im = outline(im)
    for y in range(h):  # a light dark vignette at the frame edge
        for x in range(w):
            d = min(x, y, w - 1 - x, h - 1 - y)
            if d < 10 and (10 - d) / 10 * .7 > (BAYER[y % 4][x % 4] + .5) / 16:
                put(im, x, y, "ink")
    return im


# ------------------------------------------------------------------- sprites

def flag_frames():
    out = []
    for f in range(4):
        im = new(13, 18)
        rect(im, 2, 3, 2, 16, "bark")
        put(im, 2, 2, "gold")
        rect(im, 1, 16, 4, 16, "brown")
        for i in range(8):
            top = 3 + round(1.3 * (i / 7) * math.sin(2 * math.pi * (i / 8 - f / 4)))
            rect(im, 3 + i, top, 3 + i, top + 4, "red")
            put(im, 3 + i, top + 4, "rust")
        out.append(outline(im))
    return out


def needle_frames():
    out = []
    for deg in (0, 8, 14, 8, 0, -8, -14, -8):
        im = new(21, 21)
        dx, dy = math.sin(math.radians(deg)), -math.cos(math.radians(deg))
        line(im, 10, 10, 10 + dx * 9, 10 + dy * 9, "red")
        line(im, 11, 10, 11 + dx * 8, 10 + dy * 8, "rust")
        line(im, 10, 11, 10 - dx * 8, 11 - dy * 8, "ink")
        disc(im, 10, 10, 1, "gold")
        out.append(im)
    return out


def ripple_frames(c, at, inner):
    ix0, iy0, ix1, iy1 = inner
    w, h = ix1 - ix0 + 1, iy1 - iy0 + 1
    ccx, ccy = c["compass"]
    rnd = random.Random(4)
    spots = []
    for _ in range(w * h // 170):
        x, y = rnd.randrange(3, w - 4), rnd.randrange(2, h - 2)
        gx, gy = ix0 + x, iy0 + y
        if (not any(at(gx + dx, gy + dy) for dx in (-2, 0, 2, 4) for dy in (-2, 0, 2))
                and math.hypot(gx - ccx, gy - ccy) > 32):
            spots.append((x, y, rnd.randrange(4), rnd.random() < .25))
    frames = []
    for f in range(4):
        im = new(w, h)
        for x, y, ph, big in spots:
            k = (f + ph) % 4
            if k == 0:
                rect(im, x, y, x + 2, y, "sky_pale")
                if big:
                    put(im, x + 1, y - 1, "white")
            elif k == 1:
                put(im, x + 1, y, "sky_pale")
        frames.append(im)
    return frames


def candle_frames():
    out = []
    for f in range(4):
        s, top = (0, 1, 0, -1)[f], (3, 2, 3, 2)[f]
        im = new(12, 25)
        rect(im, 3, 10, 7, 21, "paper")
        rect(im, 7, 10, 7, 21, "sand")
        rect(im, 3, 10, 7, 10, "white")
        rect(im, 3, 11, 3, 14, "white")
        rect(im, 1, 22, 9, 22, "gold")
        rect(im, 2, 23, 9, 23, "brown")
        put(im, 5, 9, "ink")
        put(im, 5 + s, top, "orange")
        rect(im, 4 + s, top + 1, 6 + s, 8, "amber")
        rect(im, 5, top + 2, 5, 8, "sun")
        rect(im, 5, 7, 5, 8, "white")
        out.append(outline(im))
    return out


def quill_frames():
    out = []
    for tx, ty in ((13, 3), (14, 4), (14, 2), (13, 4)):
        im = new(17, 27)
        rect(im, 3, 17, 11, 24, "navy")
        rect(im, 3, 17, 4, 24, "dusk")
        rect(im, 3, 24, 11, 24, "night")
        rect(im, 5, 14, 9, 16, "navy")
        rect(im, 5, 13, 9, 13, "tan")
        line(im, 7, 12, tx, ty, "sand")
        line(im, 8, 12, tx + 1, ty, "white")
        out.append(outline(im))
    return out


def marker_spots(c, at, pts, stop, clear, variant, n=12):
    """Twelve points on open land, spread by farthest-point sampling, ordered left to right."""
    sx0, sy0, sx1, sy1 = safe_box(variant)
    ccx, ccy = c["compass"]
    cand = []
    for y in range(sy0 + 6, sy1 - 5, 2):
        for x in range(sx0 + 6, sx1 - 5, 2):
            if (all(at(x + dx, y + dy) for dx in (-4, 0, 4) for dy in (-4, 0, 4))
                    and all(math.hypot(x - px, y - py) >= 10 for px, py, _ in pts)
                    and all(math.hypot(x - a, y - b) >= 16 for a, b in stop)
                    and math.hypot(x - ccx, y - ccy) >= 34
                    and not any(a - 8 <= x <= d + 8 and b - 8 <= y <= e + 8 for a, b, d, e in clear)):
                cand.append((x, y))
    got = [min(cand)]
    while len(got) < n:
        got.append(max(cand, key=lambda p: min(math.hypot(p[0] - q[0], p[1] - q[1]) for q in got)))
    return sorted(got)


def marker_frames(spots, inner):
    ix0, iy0, ix1, iy1 = inner
    out = []
    for f in range(2):
        im = new(ix1 - ix0 + 1, iy1 - iy0 + 1)
        for mx, my in spots:
            x, y = mx - ix0, my - iy0
            for dx in range(-3, 4):
                for dy in range(-3, 4):
                    if abs(dx) + abs(dy) <= 4 and (abs(dx) < 3 or abs(dy) < 3):  # 1 px ink outline
                        put(im, x + dx, y + dy, "ink")
            for dx in range(-2, 3):
                for dy in range(-2, 3):
                    if abs(dx) + abs(dy) <= 3 and (abs(dx) < 2 or abs(dy) < 2):  # 5x5 ring, no corners
                        put(im, x + dx, y + dy, "gold" if f == 0 else "amber")
            if f:  # the twinkle: the ring brightens and four tips flare
                for dx, dy in ((0, -3), (3, 0), (0, 3), (-3, 0)):
                    put(im, x + dx, y + dy, "sun")
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    put(im, x + dx, y + dy, "white" if f == 0 or (dx, dy) == (0, 0) else "sun")
        out.append(im)
    return out


# --------------------------------------------------------------------- scene

def scene(variant):
    c = GEO[variant]
    w, h = SIZES[variant]
    x0, y0, x1, y1 = c["box"]
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    inner = (x0 + 12, y0 + 12, x1 - 12, y1 - 12)
    pts = spline(c["ctrl"])
    stop = [c["ctrl"][i] for i in c["stops"]]
    at = land_grid(c, inner)

    tpos = (stop[2][0] - 15, stop[2][1] - 22)  # the figure's flag pole lands on r3
    dgx, dgy = c["ctrl"][c["dog_at"]]
    dpos = (dgx - 12, dgy - 12)
    spos = c["snail"]
    fpos = [(sx - 2, sy - 16) for sx, sy in stop[:2]]
    clear = [(tpos[0], tpos[1], tpos[0] + 22, tpos[1] + 24), (dpos[0], dpos[1], dpos[0] + 24, dpos[1] + 14),
             (spos[0], spos[1], spos[0] + 14, spos[1] + 12)] + [(fx, fy, fx + 13, fy + 18) for fx, fy in fpos]

    layers = [
        Layer("table", table_layer(w, h), 0.0),
        Layer("shadow", shadow_layer(c, w, h), 0.25),
        Layer("map", map_layer(c, w, h, at, inner, pts, stop, clear), 0.5),
        Layer("front", front_layer(c, w, h), 1.0),
    ]
    ccx, ccy = c["compass"]
    flags = flag_frames()
    who = Sprite("who", figure("idrisi", "plant_flag"), 4, *tpos, 0.5)
    sprites = [
        Sprite("candle", candle_frames(), 6, *c["candle"], 0.25),
        Sprite("quill", quill_frames(), 2, *c["inkwell"], 0.25),
        Sprite("sea", ripple_frames(c, at, inner), 2, inner[0], inner[1], 0.5),
        Sprite("needle", needle_frames(), 4, ccx - 10, ccy - 10, 0.5),
        Sprite("flag1", flags, 5, *fpos[0], 0.5),
        Sprite("flag2", flags, 5, *fpos[1], 0.5),
        Sprite("snail", snail(), 2, *spos, 0.5),
        Sprite("dog", dog("trail"), 6, *dpos, 0.5),
        who,
        Sprite("birds", bird_frames("ink"), 8, *c["birds"], 0.8),
    ]
    spots = marker_spots(c, at, pts, stop, clear, variant)
    sprites.append(Sprite("markers", marker_frames(spots, inner), 2, inner[0], inner[1], 0.5))
    anchors = {"map": (cx, cy, 0.5), "seam": (cx, cy + 100, 0.5)}
    anchors.update({f"m{i + 1}": (mx, my, 0.5) for i, (mx, my) in enumerate(spots)})
    tags = [(f"r{i + 1}", sx, sy) for i, (sx, sy) in enumerate(stop)]
    tags.append(("who", who.x + who.frames[0].width // 2, who.y + who.frames[0].height // 3, who.depth))
    return Scene("map", variant, w, h, layers, sprites, anchors, tags, tag_depth=0.5)


SCENES = {"map": lambda v: scene(v)}
