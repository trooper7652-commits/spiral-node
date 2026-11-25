"""Scene 9: a crossroads on a hill at sunrise, a wooden beam across the road."""
import math
import random

from ..cast import FIGURES, dog, figure, snail
from ..draw import BAYER, dither, disc, line, new, outline, paste, put, rect
from ..scene import SIZES, Layer, Scene, Sprite
from .s1_countryside import bird_frames, cloud_frames, draw_glow, hills_layer, pick, rng_hash, windmill_frame

MILL = dict(mill=("sand", "tan"), arm="bark", sail="paper", window="gold",
            mid=["olive", "olive_deep", "forest"])

# beam = (left x, length, top y, hook spacing, lantern offset from left x)
# bfly = (x, y, w, h, [(cx, cy, ax, ay, colour, phase)])
GEO = {
    "wide": dict(
        far=(196, 14, 6), mid=(216, 9), wave=1.0, cx=350, top=230, amp=22, span=300, off=16,
        hw0=9, hws=.4, sway=8, rh=8, sun_x=430, sun_y=116, mill_x=130, foot=278, snail_foot=274, snail_dx=24,
        beam=(244, 212, 148, 27, 34),
        crowd=[(246, 254), (277, 249), (308, 253), (339, 248), (371, 254), (403, 250), (434, 253), (463, 249)],
        dog_at=(212, 266),
        clouds=[(60, 52, 56), (390, 38, 48), (190, 96, 40)], birds=(400, 64),
        mist=[(20, 206, 190, 26), (360, 210, 190, 26)],
        bushes=[(40, 268, 7), (536, 264, 8), (500, 306, 5)],
        grass=[(0, 250, 288, 110), (288, 250, 288, 110)], dew=(0, 250, 576, 110),
        bfly=[(400, 244, 110, 50, [(30, 25, 22, 8, "white", 0.0), (75, 20, 18, 9, "gold", .4), (55, 36, 16, 6, "red", .7)]),
              (110, 262, 90, 44, [(30, 22, 20, 8, "white", .2), (62, 26, 18, 8, "orange", .6)])],
    ),
    "tall": dict(
        far=(214, 10, 5), mid=(232, 7), wave=1.6, cx=120, top=240, amp=26, span=140, off=14,
        hw0=7, hws=.25, sway=10, rh=7, sun_x=150, mill_x=215, foot=292, snail_foot=306, snail_dx=0,
        beam=(4, 232, 125, 40, 36),
        crowd=[(46, 296), (88, 306), (130, 294), (170, 304), (62, 334), (104, 340), (146, 332), (180, 342)],
        dog_at=(36, 352),
        clouds=[(10, 40, 56), (140, 70, 44), (14, 150, 40)], birds=(110, 40),
        mist=[(4, 224, 150, 24), (70, 232, 150, 24)],
        bushes=[(24, 300, 7), (222, 296, 8), (212, 345, 5)],
        grass=[(0, 252, 240, 115), (0, 365, 240, 115)], dew=(0, 252, 240, 228),
        bfly=[(140, 250, 90, 50, [(25, 25, 18, 8, "white", 0.0), (62, 20, 16, 9, "gold", .4), (45, 36, 14, 6, "red", .7)]),
              (14, 268, 80, 44, [(25, 22, 18, 8, "white", .2), (55, 26, 16, 8, "orange", .6)])],
    ),
}


class Geo:
    """Hill profiles and the roads (a cross road and one running down the hill)."""

    def __init__(self, variant, **kw):
        self.w, self.h = SIZES[variant]
        self.__dict__.update(kw)
        self.r0 = round(self.ry(self.cx))

    def far_y(self, x):
        b, a1, a2 = self.far
        return round(b - a1 * math.sin(x * .018 * self.wave + .5) - a2 * math.sin(x * .047 * self.wave + 2))

    def mid_y(self, x):
        b, a = self.mid
        return round(b - a * math.sin(x * .011 * self.wave + 2.2) - 3 * math.sin(x * .06 * self.wave))

    def raw(self, x):
        return self.top + self.amp * ((x - self.cx) / self.span) ** 2

    def near_y(self, x):
        return round(self.raw(x) + 1.2 * math.sin(x * .05))

    def ry(self, x):
        return self.raw(x) + self.off

    def vx(self, y):
        t = max(0, y - self.r0) / (self.h - self.r0)
        return self.cx - self.sway * math.sin(math.pi * .9 * t)

    def vhw(self, y):
        if y >= self.r0:
            return self.hw0 + (y - self.r0) * self.hws
        return max(1.5, self.hw0 * (1 - .7 * (self.r0 - y) / max(1, self.r0 - self.top)))

    def road(self, x, y):
        """0 on a road's centre line up to 1 at its edge; None off the road."""
        d_down = abs(x - self.vx(y)) / self.vhw(y)
        half = self.rh - 2.5 * abs(x - self.cx) / (self.w / 2)
        best = min(d_down, abs(y - self.ry(x)) / half)
        return best if best <= 1 else None


# ------------------------------------------------------------------- layers

def sky_layer(g, sx, sy):
    im = new(g.w, g.h)
    dither(im, (0, 0, g.w - 1, g.h - 1), ["dusk", "sky", "sky_pale", "sun", "amber"], lambda x, y: y / g.far[0])
    for y in range(sy - 32, sy + 33):  # round stepped halo, dithered only at ring edges
        for x in range(sx - 32, sx + 33):
            d = math.hypot(x - sx, y - sy) + ((BAYER[y % 4][x % 4] + .5) / 16 - .5) * 3
            if 15 < d < 30:
                put(im, x, y, "white" if d < 21 else "sun")
    disc(im, sx, sy, 15, "amber")
    disc(im, sx, sy, 13, "sun")
    disc(im, sx - 1, sy - 1, 8, "white")
    return im


def far_layer(g):
    im = hills_layer(g, ["mist", "slate"], g.far_y, 30)
    rnd = random.Random(4)
    x = 6
    while x < g.w - 6:  # tiny pines along the far ridge
        base = g.far_y(x) + 1
        for i in range(8):
            for dx in range(-(i // 2), i // 2 + 1):
                put(im, x + dx, base - 8 + i, "dusk")
        x += 12 + rnd.randrange(14)
    return im


def mid_layer(g):
    im = hills_layer(g, ["olive", "olive_deep", "forest"], g.mid_y, 22)
    rnd = random.Random(17)
    for _ in range(g.w // 40):
        x = rnd.randrange(10, g.w - 10)
        r = rnd.choice((3, 4))
        base = g.mid_y(x) + 2
        cy = base - r - 2
        rect(im, x, base - 2, x, base, "bark")
        for y in range(cy - r - 1, cy + r + 2):
            for xx in range(x - r - 1, x + r + 2):
                if (xx - x) ** 2 + (y - cy) ** 2 <= r * r + r * .6:
                    lit = ((xx - x) * .6 - (y - cy) * .8) / r
                    put(im, xx, y, "leaf" if lit > .6 else "grass" if lit > .1 else "forest")
    return im


def draw_bush(im, cx, base, r, rnd):
    w, h = 4 * r + 4, 3 * r + 4
    b = new(w, h)
    for dx, cy, rad in ((r + 2, 2 * r + 1, r), (3 * r + 2, 2 * r + 1, r), (2 * r + 2, round(1.3 * r) + 1, round(1.2 * r))):
        disc(b, dx, cy, rad, "grass")
    for y in range(h):
        for x in range(w):
            if b.getpixel((x, y))[3]:
                t = .6 * y / h + .4 * (1 - x / w) + (rng_hash(x, y) - .5) * .3
                c = pick(["leaf", "grass", "forest"], t, x, y)
                put(b, x, y, "gold" if rnd.random() < .05 else "white" if rnd.random() < .03 else c)
    paste(im, outline(b), cx - w // 2, base - h)


def near_layer(g, gate):
    im = new(g.w, g.h)
    ramp = ["leaf", "grass", "olive", "olive_deep"]
    path = ["paper", "sand", "tan", "brown"]
    for x in range(g.w):
        ny = g.near_y(x)
        for y in range(max(0, ny), g.h):
            r = g.road(x, y)
            if r is not None:
                c = pick(path, r * r * .8 + (rng_hash(x >> 1, y) - .5) * .25, x, y)
            elif y == ny:
                c = "lime"
            else:  # broad flat bands, darker lower down; dither only on the band edges
                t = (y - ny) / (g.h - ny) + .035 * math.sin(x * .03 + y * .02) \
                    + ((BAYER[y % 4][x % 4] + .5) / 16 - .5) * .05
                c = ramp[0] if t < .22 else ramp[1] if t < .5 else ramp[2] if t < .78 else ramp[3]
            put(im, x, y, c)
    for y in range(g.r0 + 4, g.h):  # wheel ruts
        for s in (-1, 1):
            x = round(g.vx(y) + s * .5 * g.vhw(y))
            if y % 4 < 3 and g.road(x, y) is not None:
                put(im, x, y, "tan")
    rnd = random.Random(5)
    def off_road(x, y):
        return y > g.near_y(x) + 10 and all(g.road(x + d, y + e) is None for d in (-9, 0, 9) for e in (-3, 3))

    n = 0
    for _ in range(400):  # a few small flower clusters
        if n >= 6:
            break
        cx, cy = rnd.randrange(12, g.w - 12), rnd.randrange(g.near_y(g.cx) + 12, g.h - 14)
        if not off_road(cx, cy):
            continue
        n += 1
        cols = rnd.sample(["gold", "white", "orange", "red", "sky_pale"], 2)
        for _ in range(7):
            x, y = cx + rnd.randrange(-7, 8), cy + rnd.randrange(-3, 4)
            put(im, x, y + 1, "forest")
            put(im, x, y, cols[rnd.randrange(2)])
            put(im, x, y - 1, "gold") if rnd.random() < .3 else None
    n = 0
    for _ in range(400):  # tufts with ink-dark bases
        if n >= 9:
            break
        x, y = rnd.randrange(8, g.w - 8), rnd.randrange(g.near_y(g.cx) + 14, g.h - 8)
        if not off_road(x, y):
            continue
        n += 1
        for i, hh in enumerate((3, 5, 4, 3)):
            for k in range(hh):
                put(im, x + i, y - k, "ink" if k == 0 else "olive_deep" if k == 1 else "grass" if k < hh - 1 else "leaf")
    for _ in range(g.w // 12):  # pebbles at the road edge
        x, y = rnd.randrange(g.w), g.r0 + rnd.randrange(g.h - g.r0)
        r = g.road(x, y)
        if r is not None and r > .8:
            put(im, x, y, "mist")
            put(im, x + 1, y, "slate")
    for bx, by, br in g.bushes:
        draw_bush(im, bx, by, br, rnd)
    im_gate, gx, gy, post_x, base = gate
    for px in post_x:  # post shadows fall to the left, away from the sun
        for dx in range(1, 19):
            for y in range(base - 2, base + 1):
                x = px - dx
                if (x + y) % 2 == 0:
                    put(im, x, y, "brown" if g.road(x, y) is not None else "olive_deep")
    paste(im, im_gate, gx, gy)
    return im


def front_layer(g):
    im = new(g.w, g.h)
    rect(im, 0, g.h - 3, g.w - 1, g.h - 1, "forest")
    rnd = random.Random(9)
    x = 0
    while x < g.w:
        h = 5 + rnd.randrange(9)
        lean = rnd.choice((-1, 0, 1)) * .25
        for i in range(h):
            c = "forest" if i < h * .35 else "grass" if i < h * .75 else "leaf"
            put(im, x + round(lean * i), g.h - 1 - i, c)
            put(im, x + 1 + round(lean * i), g.h - 1 - i, c)
        x += 3 + rnd.randrange(4)
    return im


# ------------------------------------------------------------ the beam gate

POST = ["umber", "bark", "brown", "brown", "brown", "tan", "tan", "sand"]
BEAM = ["sand", "tan", "tan", "brown", "brown", "brown", "brown", "bark", "bark", "umber"]


def gate_image(bw, post_h, hooks):
    """Beam (10 rows) on two posts, five hooks under it; local x 0..bw-1, y 0 is the beam's top."""
    foot = 10 + post_h
    im = new(bw + 2, foot + 2)
    P = lambda x, y, c: put(im, x + 1, y + 1, c)
    R = lambda x0, y0, x1, y1, c: rect(im, x0 + 1, y0 + 1, x1 + 1, y1 + 1, c)
    rnd = random.Random(31)
    posts = (10, bw - 18)
    for px in posts:
        for i, c in enumerate(POST):
            R(px + i, 0, px + i, foot - 1, c)
        for _ in range(post_h // 5):
            y = rnd.randrange(12, foot - 4)
            R(px + rnd.randrange(1, 7), y, px + rnd.randrange(1, 7), y + rnd.randrange(1, 4), "bark")
        R(px - 1, foot - 3, px + 8, foot - 1, "mist")
        R(px - 1, foot - 1, px + 8, foot - 1, "slate")
        R(px + 5, foot - 3, px + 8, foot - 3, "paper")
    for k in range(6):  # short braces
        P(posts[0] + 8 + k, 17 - k, "brown")
        P(posts[0] + 8 + k, 18 - k, "bark")
        P(posts[1] - 1 - k, 17 - k, "brown")
        P(posts[1] - 1 - k, 18 - k, "bark")
    for y, c in enumerate(BEAM):
        R(0, y, bw - 1, y, c)
    for _ in range(bw // 5):  # wood grain
        x, y = rnd.randrange(bw - 8), rnd.randrange(2, 8)
        R(x, y, x + rnd.randrange(3, 8), y, "bark" if y >= 4 else "brown")
    R(0, 0, 1, 9, "tan")
    R(0, 0, 0, 0, "sand")
    R(bw - 2, 0, bw - 1, 9, "tan")
    for px in posts:
        P(px + 3, 4, "mist")  # nails
    for hx in hooks:
        R(hx, 10, hx, 12, "gold")
        P(hx + 1, 12, "gold")
        P(hx + 1, 11, "gold")
    return outline(im)


def lantern_frames():
    frames = []
    for f in range(3):
        outer, inner = (("sun", "white"), ("amber", "sun"), ("sun", "paper"))[f]
        b = new(11, 16)
        rect(b, 5, 0, 5, 3, "mist")
        rect(b, 3, 3, 7, 3, "bark")
        rect(b, 2, 4, 8, 4, "bark")
        rect(b, 2, 5, 8, 12, outer)
        rect(b, 4, 6, 6, 11, inner)
        rect(b, 2, 5, 2, 12, "bark")
        rect(b, 8, 5, 8, 12, "bark")
        rect(b, 2, 13, 8, 13, "bark")
        rect(b, 3, 14, 7, 14, "umber")
        im = new(21, 28)
        k = (.75, .95, .6)[f]
        for y in range(28):
            for x in range(21):
                d = math.hypot(x - 10, y - 10)
                if 4 < d < 10:
                    gl = 1 - (d - 4) / 6
                    if gl * k > (BAYER[y % 4][x % 4] + .5) / 16:
                        put(im, x, y, "white" if gl > .7 else "sun")
        paste(im, outline(b), 5, 0)
        frames.append(im)
    return frames


# ----------------------------------------------------------------- sprites

def ray_frames(n_rays=16):
    frames = []
    for f in range(3):
        im = new(150, 150)
        seen = set()
        for i in range(n_rays):
            a = 2 * math.pi * i / n_rays + .1
            ln = (36, 26, 16)[(i + f) % 3]
            t = 18.0
            while t < 18 + ln:
                x, y = round(75 + t * math.cos(a)), round(75 + t * math.sin(a))
                near = t < 18 + ln * .5
                if (x, y) not in seen and (near or (x + y) % 2 == 0):
                    seen.add((x, y))
                    put(im, x, y, "white" if near else "sun")
                t += .7
        frames.append(im)
    return frames


def mist_frames(w, h, seed):
    rnd = random.Random(seed)
    blobs = [(rnd.uniform(.1, .9) * w, h * (.45 + rnd.random() * .2), rnd.uniform(.12, .22) * w, rnd.uniform(.28, .4) * h)
             for _ in range(5)]
    band = new(w, h)
    for y in range(h):
        for x in range(w):
            d = max(1 - (((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2) for bx, by, rx, ry in blobs)
            if d > 0 and d > (BAYER[y % 4][x % 4] + .5) / 16:
                put(band, x, y, pick(["sand", "paper", "white"], d, x, y))
    frames = []
    for px in (0, 3, 6, 9, 12, 9, 6, 3):
        f = new(w + 12, h)
        paste(f, band, px, 0)
        frames.append(f)
    return frames


def butterfly_frames(w, h, paths, n=8):
    frames = []
    for f in range(n):
        im = new(w, h)
        for k, (cx, cy, ax, ay, col, ph) in enumerate(paths):
            a = 2 * math.pi * (f / n + ph)
            x, y = round(cx + ax * math.cos(a)), round(cy + ay * math.sin(2 * a))
            if (f + k) % 2 == 0:
                for dx, dy in ((-2, -1), (-1, -1), (1, -1), (2, -1), (-1, 0), (1, 0)):
                    put(im, x + dx, y + dy, col)
                put(im, x, y, "ink")
            else:
                put(im, x, y - 1, col)
                put(im, x, y, col)
                put(im, x, y + 1, "ink")
        frames.append(im)
    return frames


def sway_frames(w, h, tufts):
    frames = []
    for f in range(4):
        im = new(w, h)
        for x, y, bh, ph in tufts:
            s = (0, 1, 0, -1)[(f + ph) % 4]
            for dx, hh in ((-2, bh - 1), (0, bh), (2, bh - 1)):
                for i in range(1, hh + 1):
                    put(im, x + dx + round(s * 1.5 * i / hh), y - i, ("grass", "leaf", "lime")[min(2, (i - 1) * 3 // hh)])
        frames.append(im)
    return frames


def grass_sprite(g, sid, region, seed, keep_out):
    x0, y0, w, h = region
    rnd = random.Random(seed)
    tufts = []
    for _ in range(160):
        if len(tufts) >= 20:
            break
        x, y = x0 + rnd.randrange(4, w - 4), y0 + rnd.randrange(9, h - 2)
        ok = y > g.near_y(x) + 8 and all(g.road(x + d, y) is None for d in (-5, 0, 5))
        ok = ok and not any(a - 8 < x < c + 8 and b - 8 < y < d + 8 for a, b, c, d in keep_out)
        if ok:
            tufts.append((x - x0, y - y0, 3 + rnd.randrange(3), rnd.randrange(4)))
    return Sprite(sid, sway_frames(w, h, tufts), 3, x0, y0, 0.9)


def dew_sprite(g, region, keep_out):
    x0, y0, w, h = region
    rnd = random.Random(23)
    pts = []
    for _ in range(300):
        if len(pts) >= w * h // 5000:
            break
        x, y = rnd.randrange(3, w - 3), rnd.randrange(3, h - 3)
        if y + y0 > g.near_y(x + x0) + 6 and g.road(x + x0, y + y0) is None:
            pts.append((x, y, rnd.randrange(3)))
    frames = [new(w, h) for _ in range(3)]
    for x, y, ph in pts:
        for f in range(3):
            lvl = (f + ph) % 3
            if lvl == 2:
                put(frames[f], x, y, "white")
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    put(frames[f], x + dx, y + dy, "sun")
            elif lvl == 1:
                put(frames[f], x, y, "sun")
    return Sprite("dew", frames, 2, x0, y0, 0.9)


# ------------------------------------------------------------------- scene

def scene(variant):
    g = Geo(variant, **GEO[variant])
    L, bw, top, spacing, lant = g.beam
    base = round(g.ry(L + 13.5)) + 2
    foot = base - top
    hooks = [g.cx - L + spacing * k for k in (-2, -1, 0, 1, 2)]
    post_x = (L + 10, L + bw - 18)
    gate = (gate_image(bw, foot - 10, hooks), L - 1, top - 1, post_x, base)

    sx = g.sun_x
    sy = getattr(g, "sun_y", None) or g.far_y(sx) - 12
    g.bushes = GEO[variant]["bushes"]
    layers = [
        Layer("sky", sky_layer(g, sx, sy), 0.0),
        Layer("far", far_layer(g), 0.2),
        Layer("mid", mid_layer(g), 0.4),
        Layer("near", near_layer(g, gate), 0.8),
        Layer("front", front_layer(g), 1.0),
    ]

    dgx, dgy = g.dog_at
    snx, sny = round(g.vx(g.snail_foot)) - 12 + g.snail_dx, g.snail_foot - 12
    keep_out = [(x, y, x + 20, y + 26) for x, y in g.crowd] + [(dgx, dgy, dgx + 24, dgy + 14), (snx, sny, snx + 14, sny + 12)]

    rnd = random.Random(7)
    sprites = [Sprite("sunrays", ray_frames(), 3, sx - 75, sy - 75, 0.0)]
    for i, (cx, cy, cw) in enumerate(g.clouds):
        sprites.append(Sprite(f"cloud{i + 1}", cloud_frames(cw, ["white", "sun", "amber", "orange"], rnd), (3, 2, 3)[i], cx, cy, 0.0))
    bx, by = g.birds
    sprites.append(Sprite("birds", bird_frames("ink"), 8, bx, by, 0.0))
    mill = [windmill_frame(MILL, k, 6) for k in range(6)]
    sprites.append(Sprite("windmill", mill, 4, g.mill_x - 18, g.mid_y(g.mill_x) - 37, 0.4))
    for i, (mx, my, mw, mh) in enumerate(g.mist):
        sprites.append(Sprite(f"mist{i + 1}", mist_frames(mw, mh, 40 + i), 2, mx, my, 0.5))

    lcx = L + lant  # the lantern stands on the beam, clear of the sign hooks
    sprites.append(Sprite("lantern", lantern_frames(), 5, lcx - 10, top - 22, 0.8))
    for name, (fx, fy) in zip(FIGURES, g.crowd):
        sprites.append(Sprite(f"who-{name}", figure(name, "stand_back"), 2, fx, fy, 0.8))
    sprites.append(Sprite("dog", dog("stand"), 4, dgx, dgy, 0.8))
    sprites.append(Sprite("snail", snail(), 2, snx, sny, 0.8))

    for i, region in enumerate(g.grass):
        sprites.append(grass_sprite(g, "grass" if i == 0 else f"grass{i + 1}", region, 21 + i, keep_out))
    for i, (x, y, w, h, paths) in enumerate(g.bfly):
        sprites.append(Sprite("butterflies" if i == 0 else f"butterflies{i + 1}", butterfly_frames(w, h, paths), 6, x, y, 0.9))
    sprites.append(dew_sprite(g, g.dew, keep_out))

    tags = [(f"who-{name}", fx + 10, fy + 10, 0.8) for name, (fx, fy) in zip(FIGURES, g.crowd)]
    anchors = {"sun": (sx, sy, 0.0), "lantern": (lcx, top - 12, 0.8), "beam": (g.cx, top + 10, 0.8),
               "beam_l": (post_x[0] + 8, top + 10, 0.8), "beam_r": (post_x[1], top + 10, 0.8)}
    return Scene("hill", variant, g.w, g.h, layers, sprites, anchors, tags)


SCENES = {"hill": lambda v: scene(v)}
