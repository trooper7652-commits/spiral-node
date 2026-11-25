"""Scene 7: the star atlas. A night hilltop, a telescope, twelve bright stars joined as constellations."""
import math
import random

from ..cast import dog, figure, snail
from ..draw import BAYER, line, new, outline, paste, put, rect
from ..scene import SIZES, Layer, Scene, Sprite
from .s1_countryside import (cloud_frames, firefly_frames, front_layer, grass_sprite, hills_layer,
                             pick, rng_hash, shooting_star_frames)

# far = (base, wave 1, wave 2); near = (base, bump height, bump half-width); band = (y at left, y at right, half-width)
GEO = {
    "wide": dict(
        horizon=232, far=(218, 12, 6), mid=240, wave=1.0, near=(276, 34, 230), tx=205,
        band=(170, 40, 34), rock=(122, 24, 9), thx=165, dgx=203,
        path=(177, 270),
        rocks=[(92, 282, 12, 6), (250, 296, 10, 5), (60, 326, 14, 7), (330, 312, 9, 5)],
        clumps=[(30, 290), (150, 300), (210, 330), (120, 340), (300, 290), (340, 335)],
        flowers=[(70, 300), (262, 285), (190, 318), (100, 318)],
        cloud=(396, 150, 96), shoot=(400, 40), fire=(230, 244, 240, 60), grass=[(0, 288), (288, 288)],
        seam=(288, 232),
        # two loose columns of six; the questions are written to the right of each star
        stars=[(94, 85), (104, 110), (96, 135), (106, 160), (98, 185), (104, 209),
               (198, 86), (208, 111), (200, 136), (210, 161), (202, 186), (208, 207)],
        lines=[(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (6, 7), (7, 8), (8, 9), (9, 10), (10, 11)],
        fall=(386, 96, 300, 202),
    ),
    "tall": dict(
        horizon=272, far=(262, 9, 5), mid=280, wave=1.6, near=(318, 28, 190), tx=105,
        band=(200, 30, 26), rock=(44, 22, 9), thx=70, dgx=104,
        path=(84, 150),
        rocks=[(30, 330, 12, 6), (190, 320, 10, 5), (60, 380, 14, 7), (200, 400, 10, 5)],
        clumps=[(20, 345), (180, 350), (150, 372), (40, 410), (210, 380), (150, 420)],
        flowers=[(70, 345), (165, 335), (30, 395), (130, 395)],
        cloud=(90, 212, 70), shoot=(150, 20), fire=(20, 262, 200, 56), grass=[(0, 240)],
        seam=(120, 268),
        stars=[(40, 114), (70, 108), (100, 122), (126, 108),
               (150, 128), (182, 110), (200, 146), (172, 164),
               (40, 150), (66, 178), (100, 166), (120, 202)],
        lines=[(0, 1), (1, 2), (2, 3), (4, 5), (5, 6), (6, 7), (7, 4), (5, 7), (8, 9), (9, 10), (10, 11)],
        fall=(206, 168, 150, 236),
    ),
}
NEAR = ["teal", "forest", "forest", "night"]


class Geo:
    def __init__(self, variant, **kw):
        self.w, self.h = SIZES[variant]
        self.__dict__.update(kw)

    def far_y(self, x):
        base, a1, a2 = self.far
        return round(base - a1 * math.sin(x * 0.016 * self.wave + 0.5) - a2 * math.sin(x * 0.05 * self.wave + 2))

    def mid_y(self, x):
        return round(self.mid - 7 * math.sin(x * 0.011 * self.wave + 2.2) - 3 * math.sin(x * 0.06 * self.wave))

    def near_y(self, x):
        base, bump, span = self.near
        d = (x - self.tx) / span
        b = bump * (1 - d * d) ** 2 if abs(d) < 1 else 0
        return round(base - b - 1.5 * math.sin(x * 0.035))


# ------------------------------------------------------------------- layers

def sky_layer(g):
    im = new(g.w, g.h)
    ramp = ["night", "night", "navy", "dusk", "slate"]
    for y in range(g.h):
        for x in range(g.w):
            p = max(0.0, min(0.99999, y / (g.horizon + 10))) * (len(ramp) - 1)
            i = int(p)
            put(im, x, y, ramp[i + 1] if p - i > (BAYER[y % 4][x % 4] + 0.5) / 16 else ramp[i])
    y0, y1, bw = g.band  # a faint milky band across the sky
    for y in range(g.horizon - 24):
        for x in range(g.w):
            t = 1 - abs(y - (y0 + (y1 - y0) * x / g.w)) / bw
            if t > 0:
                if t * 0.8 > (BAYER[y % 4][x % 4] + 0.5) / 16:
                    put(im, x, y, "dusk")
                if t > 0.55 and rng_hash(x, y) < 0.22:
                    put(im, x, y, "slate")
    rnd = random.Random(3)
    for _ in range(g.w * g.h // 240):
        x, y = rnd.randrange(1, g.w - 1), rnd.randrange(1, g.horizon - 12)
        put(im, x, y, rnd.choice(["mist", "slate", "slate", "sky_pale", "white"]))
    for a, b in g.lines:  # constellation lines stop short of the stars
        (ax, ay), (bx, by) = g.stars[a], g.stars[b]
        d = math.hypot(bx - ax, by - ay)
        ux, uy = (bx - ax) / d, (by - ay) / d
        line(im, ax + 4 * ux, ay + 4 * uy, bx - 4 * ux, by - 4 * uy, "slate")
    return im


def mid_layer(g):
    im = hills_layer(g, ["navy", "night"], g.mid_y, 22)
    rnd = random.Random(8)
    for _ in range(40):  # a few lit windows far away
        x = rnd.randrange(8, g.w - 8)
        y = g.mid_y(x) + 5
        if g.near_y(x) - y > 6 and rnd.random() < 0.3:
            put(im, x, y, "gold")
            put(im, x + 1, y, "gold")
    return im


def rock_image(rw, rh):
    im = new(rw + 4, rh + 5)
    cx = (rw + 4) // 2
    for x in range(2, rw + 3):
        u = (x - cx) / (rw / 2)
        if abs(u) > 1:
            continue
        top = rh + 2 - round(rh * math.sqrt(1 - u * u))
        for y in range(top, rh + 3):
            put(im, x, y, pick(["mist", "slate", "dusk", "navy"], (y - top) / rh + 0.3 * (u + 1) / 2, x, y))
    return outline(im)


def ground_detail(im, g):
    x0, xe = g.path  # a worn footpath winding from the cast toward the viewer
    ytop = g.near_y(x0) + 2
    for y in range(ytop, g.h):
        s = (y - ytop) / (g.h - ytop)
        cx = x0 + (xe - x0) * s + 6 * math.sin(s * 5)
        half = 2 + 8 * s
        for x in range(int(cx - half) - 1, int(cx + half) + 2):
            d = abs(x - cx)
            if d <= half - 1:
                put(im, x, y, pick(["slate", "dusk"], d / half * 0.9 + (rng_hash(x, y) - .5) * .3, x, y))
            elif d <= half:
                put(im, x, y, "navy")
    for x, y, rw, rh in g.rocks:
        paste(im, rock_image(rw, rh), x - (rw + 4) // 2, y - rh - 2)
    for x, y in g.clumps:  # tufts of grass, in clusters
        rect(im, x - 3, y + 1, x + 3, y + 1, "ink")
        for i, h in enumerate((2, 3, 5, 4, 3, 2, 1)):
            for k in range(h):
                put(im, x - 3 + i, y - k, "grass" if k == h - 1 and h > 2 else "teal")
    for x, y in g.flowers:
        put(im, x, y + 1, "forest")
        put(im, x, y + 2, "forest")
        for dx, dy in ((-1, 0), (1, 0), (0, -1)):
            put(im, x + dx, y + dy, "sky_pale")
        put(im, x, y, "gold")


def near_layer(g):
    im = new(g.w, g.h)
    for x in range(g.w):
        ny = g.near_y(x)
        for y in range(max(0, ny), g.h):
            if y == ny:
                c = NEAR[0]
            else:
                t = (y - ny) / (g.h - ny) * 1.05 + (rng_hash(x >> 2, y >> 1) - .5) * .1
                c = pick(NEAR[1:], t, x, y)
            put(im, x, y, c)
    ground_detail(im, g)
    cx, rw, rh = g.rock
    base = g.near_y(cx) + 3
    paste(im, rock_image(rw, rh), cx - (rw + 4) // 2, base - rh - 2)
    return im


# ------------------------------------------------------------------ sprites

def twinkle_frames(g, rnd, sky_h, n=3):
    frames = [new(g.w, sky_h) for _ in range(n)]
    for _ in range(g.w * sky_h // 1100):
        x, y = rnd.randrange(2, g.w - 2), rnd.randrange(2, sky_h - 2)
        ph, big = rnd.randrange(n), rnd.random() < .2
        bright = rnd.choice(["white", "white", "sun", "sky_pale"])
        for f in range(n):
            lvl = (f + ph) % n
            put(frames[f], x, y, ("slate", "mist", bright)[lvl])
            if big and lvl == 2:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    put(frames[f], x + dx, y + dy, "mist")
    return frames


def bright_sprite(pts):
    ox, oy = min(p[0] for p in pts) - 5, min(p[1] for p in pts) - 5
    w, h = max(p[0] for p in pts) - ox + 6, max(p[1] for p in pts) - oy + 6
    frames = []
    for f in range(3):
        im = new(w, h)
        for i, (x, y) in enumerate(pts):
            x, y, lvl = x - ox, y - oy, (f + i) % 3
            for ry in range(-3, 4):  # a diamond halo that separates the star from the band
                for rx in range(-3 + abs(ry), 4 - abs(ry)):
                    put(im, x + rx, y + ry, "navy")
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                put(im, x + dx, y + dy, "white")
                put(im, x + 2 * dx, y + 2 * dy, "sun" if lvl == 0 else "white")
                if lvl == 2:
                    put(im, x + 3 * dx, y + 3 * dy, "sky_pale")
            if lvl:
                for dx, dy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                    put(im, x + dx, y + dy, "sun")
            put(im, x, y, "paper" if lvl == 1 else "gold")
        frames.append(im)
    return Sprite("bright_stars", frames, 3, ox, oy, 0.0)


def glint_frames():
    frames = []
    for f in range(4):
        im = new(5, 5)
        if f in (1, 2):
            put(im, 2, 2, "white")
        if f == 1:
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                put(im, 2 + dx, 2 + dy, "sky_pale")
        frames.append(im)
    return frames


def falling_star(g, n=20):
    """A shooting star that falls only in the last fifth of the shot and lands at (x1, y1)."""
    x0, y0, x1, y1 = g.fall
    ox, oy = min(x0, x1) - 6, min(y0, y1) - 6
    w, h = abs(x1 - x0) + 13, abs(y1 - y0) + 13
    first = int(n * 0.8)
    frames = [new(w, h) for _ in range(n)]
    for f in range(first, n):
        t = (f - first + 1) / (n - first)
        hx, hy = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        tx, ty = hx - (x1 - x0) * 0.22, hy - (y1 - y0) * 0.22  # the tail trails back up the path
        im = frames[f]
        line(im, tx - ox, ty - oy, hx - ox, hy - oy, "sky_pale")
        line(im, tx + (hx - tx) * .5 - ox, ty + (hy - ty) * .5 - oy, hx - ox, hy - oy, "white")
        put(im, round(hx) - ox, round(hy) - oy, "sun")
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            put(im, round(hx) - ox + dx, round(hy) - oy + dy, "white")
        put(im, round(hx) - ox, round(hy) - oy, "white")
    return Sprite("falling_star", frames, 1, ox, oy, 0.0, "scrub")


# -------------------------------------------------------------------- scene

def scene(variant):
    g = Geo(variant, **GEO[variant])
    rnd = random.Random(7)
    layers = [
        Layer("sky", sky_layer(g), 0.0),
        Layer("far", hills_layer(g, ["dusk", "navy"], g.far_y, 30), 0.25),
        Layer("mid", mid_layer(g), 0.5),
        Layer("near", near_layer(g), 0.8),
        Layer("front", front_layer(g, {"front": ["night", "forest", "teal"]}), 1.0),
    ]
    sky_h = g.horizon - 12
    cx, cy, cw = g.cloud
    amp = 5
    cloud = cloud_frames(cw, ["mist", "slate", "dusk"], rnd, amp)
    sprites = [
        Sprite("stars", twinkle_frames(g, rnd, sky_h), 2, 0, 0, 0.0),
        Sprite("cloud", cloud, 3, cx, cy, 0.0),
        bright_sprite(g.stars),
        Sprite("shooting_star", shooting_star_frames(), 8, g.shoot[0], g.shoot[1], 0.0),
    ]
    for i, (x0, w) in enumerate(g.grass):
        sprites.append(grass_sprite(g, {"tuft": ["forest", "teal", "sea"]}, "grass" if i == 0 else f"grass{i + 1}",
                                    x0, w, 21 + i))
    fx, fy, fw, fh = g.fire
    sprites.append(Sprite("fireflies", firefly_frames(rnd, fw, fh), 4, fx, fy, 0.8))

    thx = g.thx
    thy = g.near_y(thx + 8) - 25
    dgx = g.dgx
    dgy = g.near_y(dgx + 10) - 13
    rcx, rw, rh = g.rock
    top = g.near_y(rcx) + 3 - rh
    snx, sny = rcx - 7, top - 10
    sprites += [
        Sprite("who", figure("galileo", "telescope"), 3, thx, thy, 0.8),
        Sprite("lens_glint", glint_frames(), 3, thx + 21, thy + 1, 0.8),
        Sprite("dog", dog("look_up"), 3, dgx, dgy, 0.8),
        Sprite("snail", snail(), 2, snx, sny, 0.8),
    ]
    sprites.append(falling_star(g))
    tags = [(f"q{i + 1}", x, y) for i, (x, y) in enumerate(g.stars)] + [("who", thx + 10, thy + 12, 0.8)]
    # the star anchor takes the falling star's depth (0), or the pan pulls the disc away from it
    anchors = {"star": (*g.fall[2:], 0.0), "seam": (*g.seam, 0.25), "cloud": (cx + cw // 2 + amp // 2, cy + (round(cw * .45) + 2) // 2, 0.0)}
    return Scene("atlas", variant, g.w, g.h, layers, sprites, anchors, tags, tag_depth=0.0)  # the bright stars sprite


SCENES = {"atlas": lambda v: scene(v)}
