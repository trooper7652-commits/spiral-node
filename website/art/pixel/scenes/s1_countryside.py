"""Scene 1: Isaac Newton under the apple tree, at sunset and at night."""
import math
import random

from ..draw import BAYER, dither, disc, line, new, outline, paste, put, rect
from ..scene import SIZES, Layer, Scene, Sprite

# Ramps run from the first name to the last (sky: top to horizon; hills and
# canopy: see the draw functions). Every name is a key of palette.PALETTE.
MOODS = {
    "sunset": dict(
        sky=["aubergine", "plum", "rust", "orange", "amber", "sun"],
        glow=("sun", "amber"),
        far=["rust", "plum"], mid=["rust", "plum", "aubergine"],
        near=["lime", "leaf", "grass", "forest"], front=["forest", "grass", "leaf"],
        canopy=["forest", "grass", "leaf", "lime"], rim="sun", rim2="amber", rim_sparse=False, gold=True,
        cluster=["red", "gold", "white", "paper"],
        trunk=["umber", "bark", "brown", "tan"], apple=("red", "skin"),
        cloud=["sun", "amber", "orange", "rust"],
        flowers=["orange", "gold", "white", "red", "mist"], stem="forest",
        tuft=["grass", "leaf", "lime"], leaf=["leaf", "lime", "amber"],
        pants=("aubergine", "night"), mill=("tan", "brown"), sail="sand", arm="bark", window="bark",
    ),
    "night": dict(
        sky=["night", "navy", "dusk", "slate"],
        glow=("slate", "dusk"),
        far=["dusk", "navy"], mid=["dusk", "navy", "night"],
        near=["teal", "forest", "forest", "night"], front=["night", "forest", "teal"],
        canopy=["night", "forest", "teal", "sea"], rim="sky_pale", rim2="mist", rim_sparse=False, gold=False,
        cluster=["sand", "paper", "white", "rust"],
        trunk=["night", "umber", "bark", "brown"], apple=("rust", "mist"),
        cloud=["slate", "dusk", "navy"],
        flowers=["tan", "sand", "mist", "rust", "sky"], stem="forest",
        tuft=["forest", "teal", "sea"], leaf=["teal", "grass"],
        pants=("navy", "night"), mill=("slate", "dusk"), sail="mist", arm="bark", window="gold",
    ),
}

# far = (base, wave 1, wave 2); near = (base, bump height, bump half-width)
GEO = {
    "wide": dict(
        horizon=215, far=(200, 9, 5), mid=232, wave=1.0, near=(275, 24, 260),
        tx=340, trunk_h=62, tw=14, rc=44, clusters=4,
        sun=(190, 200), moon=(150, 100), mill_x=470, snail_x=185,
        clouds=[(70, 66, 48), (410, 46, 40), (230, 98, 36)],
        birds=(100, 118), fire=(140, 190), shoot=(390, 70),
        grass=[(0, 288), (288, 288)],
    ),
    "tall": dict(
        horizon=305, far=(290, 8, 4), mid=328, wave=1.7, near=(372, 20, 140),
        tx=122, trunk_h=70, tw=14, rc=40, clusters=3,
        sun=(205, 275), moon=(60, 150), mill_x=190, snail_x=55,
        clouds=[(20, 64, 44), (130, 96, 38), (40, 200, 34)],
        birds=(30, 160), fire=(0, 300), shoot=(130, 70),
        grass=[(0, 240)],
    ),
}


class Geo:
    """Scene geometry: hill profiles and where the tree stands."""

    def __init__(self, variant, **kw):
        self.w, self.h = SIZES[variant]
        self.__dict__.update(kw)
        self.base_y = self.near_y(self.tx) + 1
        self.trunk_top = self.base_y - self.trunk_h
        self.cy = self.trunk_top - round(0.5 * self.rc)  # canopy centre

    def far_y(self, x):
        base, a1, a2 = self.far
        return round(base - a1 * math.sin(x * 0.018 * self.wave + 0.5) - a2 * math.sin(x * 0.047 * self.wave + 2))

    def mid_y(self, x):
        return round(self.mid - 7 * math.sin(x * 0.011 * self.wave + 2.2) - 3 * math.sin(x * 0.06 * self.wave))

    def near_y(self, x):
        base, bump, span = self.near
        d = (x - self.tx) / span
        b = bump * (1 - d * d) ** 2 if abs(d) < 1 else 0
        return round(base - b - 1.5 * math.sin(x * 0.035))


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


# -------------------------------------------------------------------- layers

def draw_glow(im, cx, cy, r, inner, outer):
    reach = r * 3.4
    for y in range(int(cy - reach), int(cy + reach) + 2):
        for x in range(int(cx - reach), int(cx + reach) + 2):
            d = math.hypot(x - cx, y - cy)
            if d < r or d >= reach:
                continue
            gl = 1 - (d - r) / (reach - r)
            if gl * 0.9 > (BAYER[y % 4][x % 4] + 0.5) / 16:
                put(im, x, y, inner if gl > 0.55 else outer)


def draw_moon(im, cx, cy, r):
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 1, cx + r + 2):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy > r * r + r * 0.6:
                continue
            s = (dx + dy) * 0.7 / r
            put(im, x, y, "sand" if s > 0.8 else "paper" if s > 0.35 else "white")
    for ox, oy in ((-3, -2), (2, 3), (3, -3), (-2, 4)):
        for ddx, ddy in ((0, 0), (1, 0), (0, 1)):
            put(im, cx + ox + ddx, cy + oy + ddy, "mist")


def sky_layer(g, m, night):
    im = new(g.w, g.h)
    dither(im, (0, 0, g.w - 1, g.h - 1), m["sky"], lambda x, y: y / g.horizon)
    if night:
        cx, cy = g.moon
        draw_glow(im, cx, cy, 11, *m["glow"])
        draw_moon(im, cx, cy, 11)
    else:
        cx, cy = g.sun
        draw_glow(im, cx, cy, 14, *m["glow"])
        disc(im, cx, cy, 14, "amber")
        disc(im, cx, cy, 12, "sun")
        disc(im, cx - 1, cy - 1, 7, "white")
    return im


def hills_layer(g, ramp, y_of, span):
    im = new(g.w, g.h)
    for x in range(g.w):
        top = y_of(x)
        for y in range(max(0, top), g.h):
            put(im, x, y, pick(ramp, (y - top) / span, x, y))
    return im


BLOBS = [(0, 0, 1), (-.8, .25, .72), (.85, .2, .72), (-.45, -.55, .7), (.5, -.5, .7),
         (0, -.85, .6), (-1.2, .55, .45), (1.2, .5, .45), (-.2, .5, .6), (.35, .55, .55)]


def canopy_lookup(cx, cy, rc):
    blobs = [(cx + bx * rc, cy + by * rc, br * rc) for bx, by, br in BLOBS]

    def at(x, y):
        best, best_d = None, 0.0
        for b in blobs:
            q = math.hypot(x - b[0], y - b[1]) / b[2]
            if q < 1 and 1 - q > best_d:
                best, best_d = b, 1 - q
        return best
    return at


def draw_canopy(im, m, cx, cy, rc, side):
    """side is -1 when the light (sun or moon) is on the left, +1 on the right."""
    at = canopy_lookup(cx, cy, rc)
    ramp = m["canopy"]
    lx, ly = 0.6 * side, -0.8
    xs = range(int(cx - 1.8 * rc) - 1, int(cx + 1.8 * rc) + 2)
    ys = range(int(cy - 1.6 * rc) - 1, int(cy + 1.2 * rc) + 2)
    for y in ys:
        for x in xs:
            b = at(x, y)
            if b is None:
                continue
            n1 = ((x - b[0]) / b[2]) * lx + ((y - b[1]) / b[2]) * ly
            n2 = ((x - cx) / (1.8 * rc)) * lx + ((y - cy) / (1.4 * rc)) * ly
            lit = 0.5 * n1 + 0.5 * n2 + (rng_hash(x // 3, y // 3) - .5) * .55 + (rng_hash(x, y) - .5) * .15
            c = pick(ramp, (lit + 1) / 2, x, y)
            if at(x, y + 1) is None:
                c = ramp[0]
            elif at(x + side, y) is None or at(x + side, y - 1) is None:
                c = m["rim"]
            elif at(x + 2 * side, y) is None or at(x + side, y - 2) is None:
                c = m["rim2"]
            elif m["gold"] and rng_hash(x * 7, y * 3) < .035 and lit > 0:
                c = "gold"
            put(im, x, y, c)
    for y in ys:
        for x in xs:
            if at(x, y) is None and any(at(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                put(im, x, y, "ink")
    return at


def draw_trunk(im, g, m):
    for y in range(g.trunk_top, g.base_y + 2):
        w = g.tw + max(0, y - (g.base_y - 7)) + (2 if y >= g.base_y - 1 else 0)
        x0 = g.tx - w // 2
        put(im, x0 - 1, y, "ink")
        put(im, x0 + w, y, "ink")
        for i in range(w):
            u = i / max(1, w - 1)
            c = m["trunk"][3 if u < .25 else 2 if u < .6 else 1 if u < .85 else 0]
            if rng_hash(x0 + i, y) < .1:
                c = m["trunk"][1]
            put(im, x0 + i, y, c)
    for dx, c in ((0, m["trunk"][1]), (1, m["trunk"][0])):
        line(im, g.tx + dx, g.trunk_top + 3, g.tx - .7 * g.rc, g.trunk_top - .3 * g.rc, c)
        line(im, g.tx + dx, g.trunk_top + 2, g.tx + .75 * g.rc, g.trunk_top - .25 * g.rc, c)


def near_layer(g, m):
    im = new(g.w, g.h)
    ramp = m["near"]
    for x in range(g.w):
        ny = g.near_y(x)
        for y in range(max(0, ny), g.h):
            if y == ny:
                c = ramp[0]
            else:
                t = (y - ny) / (g.h - ny) * 1.05 + (rng_hash(x >> 2, y >> 1) - .5) * .1
                c = pick(ramp[1:], t, x, y)
            put(im, x, y, c)
    rnd = random.Random(5)
    for _ in range(g.w * g.h // 150):  # short grass dashes
        x, y = rnd.randrange(g.w), rnd.randrange(g.h)
        c = ramp[1] if rnd.random() < .5 else ramp[-1]
        if y > g.near_y(x) + 2:
            put(im, x, y, c)
            put(im, x + 1, y, c)
    for y in range(g.base_y - 4, g.base_y + 8):  # tree shadow, falling to the right
        for x in range(g.tx - g.rc, g.tx + 2 * g.rc + 1):
            ex = (x - (g.tx + g.rc * .7)) / (g.rc * 1.3)
            ey = (y - (g.base_y + 2)) / 3.2
            q = ex * ex + ey * ey
            if q < 1 and y > g.near_y(x):
                put(im, x, y, pick(ramp[2:], .2 + q * .6, x, y))
    rf = random.Random(3)
    for _ in range(g.w * g.h // 1800):  # flowers
        x = rf.randrange(g.w)
        ny = g.near_y(x)
        y = ny + 3 + rf.randrange(max(1, g.h - ny - 24))
        col = m["flowers"][rf.randrange(len(m["flowers"]))]
        big = rf.random() < .35
        if abs(x - g.tx) < g.tw + 8:
            continue
        put(im, x, y + 1, m["stem"])
        put(im, x, y, col)
        if big:
            for dx, dy in ((-1, 0), (1, 0), (0, -1)):
                put(im, x + dx, y + dy, col)
            put(im, x, y, "gold" if col != "gold" else "white")
    rc_ = random.Random(13)  # foreground flower clusters and dark grass clumps
    for _ in range(g.clusters):
        x = rc_.randrange(30, g.w - 30)
        y = rc_.randrange(g.near_y(x) + 24, g.h - 24)
        for _ in range(9):
            fx, fy = x + rc_.randrange(-9, 10), y + rc_.randrange(-4, 5)
            put(im, fx, fy + 1, m["stem"])
            put(im, fx, fy, m["cluster"][rc_.randrange(4)])
    for _ in range(g.clusters * 2):
        x = rc_.randrange(10, g.w - 10)
        y = rc_.randrange(g.near_y(x) + 18, g.h - 8)
        for i, h in enumerate((2, 3, 4, 3, 2)):
            for k in range(h):
                put(im, x + i, y - k, ramp[-1] if k < h - 1 else ramp[2])
    draw_trunk(im, g, m)
    side = 1 if (g.moon if m is MOODS["night"] else g.sun)[0] > g.tx else -1
    at = draw_canopy(im, m, g.tx, g.cy, g.rc, side)
    ra = random.Random(11)
    for _ in range(16):  # apples
        x = round(g.tx + (ra.random() - .5) * 3 * g.rc)
        y = round(g.cy + (ra.random() - .4) * 1.8 * g.rc)
        if all(at(x + ox, y + oy) for ox, oy in ((0, 0), (1, 0), (0, 1), (1, 1), (0, 2))):
            body, shine = m["apple"]
            put(im, x, y, shine)
            for ox, oy in ((1, 0), (0, 1), (1, 1)):
                put(im, x + ox, y + oy, body)
    return im


def front_layer(g, m):
    im = new(g.w, g.h)
    base, mid, tip = m["front"]
    rect(im, 0, g.h - 3, g.w - 1, g.h - 1, base)
    rnd = random.Random(9)
    x = 0
    while x < g.w:
        h = 5 + rnd.randrange(9)
        lean = rnd.choice((-1, 0, 1)) * .25
        for i in range(h):
            c = base if i < h * .35 else mid if i < h * .75 else tip
            put(im, x + round(lean * i), g.h - 1 - i, c)
            put(im, x + 1 + round(lean * i), g.h - 1 - i, c)
        x += 3 + rnd.randrange(4)
    return im


# ------------------------------------------------------------------- sprites

def thinker_frame(m, blink):
    """Newton: long pale curled wig to the shoulders, blue coat with gold buttons."""
    im = new(22, 29)
    rect(im, 6, 12, 15, 13, "dusk")
    rect(im, 5, 13, 16, 21, "dusk")
    rect(im, 14, 13, 16, 21, "navy")
    rect(im, 3, 14, 4, 21, "dusk")
    rect(im, 17, 14, 18, 21, "navy")
    rect(im, 4, 21, 6, 22, "skin")
    rect(im, 15, 21, 17, 22, "skin")
    rect(im, 8, 11, 13, 11, "skin")
    rect(im, 9, 12, 12, 13, "paper")
    for y in (14, 16, 18):
        put(im, 10, y, "gold")
    rect(im, 4, 23, 17, 26, "navy")
    rect(im, 4, 26, 17, 26, "night")
    rect(im, 2, 26, 7, 26, "umber")
    rect(im, 14, 26, 19, 26, "umber")
    rect(im, 2, 27, 7, 27, "bark")
    rect(im, 14, 27, 19, 27, "bark")
    rect(im, 7, 5, 14, 10, "skin")
    rect(im, 14, 5, 14, 10, "tan")
    eye = "tan" if blink else "ink"
    put(im, 9, 7, eye)
    put(im, 12, 7, eye)
    for x0, y0, x1, y1 in ((7, 1, 14, 2), (5, 3, 16, 4), (5, 5, 6, 12), (15, 5, 16, 12),
                           (3, 10, 5, 14), (16, 10, 18, 14)):    # the wig, curls to the shoulders
        rect(im, x0, y0, x1, y1, "sand")
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if (x + 2 * y) % 5 in (0, 1):
                    put(im, x, y, ("white", "paper")[(x + 2 * y) % 5])
    return outline(im)


def slate_frame(face, text):
    im = new(12, 10)
    rect(im, 1, 1, 10, 8, "mist")
    rect(im, 2, 2, 9, 7, face)
    rect(im, 3, 3, 8, 3, text)
    rect(im, 3, 5, 6, 5, text)
    return outline(im)


def dog_frame(tip):
    """Lying dog facing left, 16x9 before the outline: raised head, ear, eye, nose, paws, tail."""
    im = new(18, 11)
    rect(im, 5, 3, 14, 8, "tan")
    rect(im, 5, 3, 14, 4, "brown")        # shaded back
    rect(im, 5, 8, 14, 8, "brown")        # belly shadow
    rect(im, 10, 5, 10, 7, "brown")       # haunch line
    rect(im, 10, 9, 14, 9, "tan")         # hind paw
    line(im, 14, 4, tip[0], tip[1], "brown")
    put(im, tip[0], tip[1], "tan")
    rect(im, 2, 1, 6, 5, "tan")           # raised head
    rect(im, 1, 3, 3, 5, "tan")           # snout
    put(im, 1, 3, "ink")                  # nose
    put(im, 4, 2, "ink")                  # eye
    rect(im, 5, 1, 6, 4, "brown")         # ear
    rect(im, 1, 7, 5, 8, "tan")           # front paws forward
    rect(im, 1, 8, 5, 8, "brown")
    return outline(im)


SPIRAL = [(2, 1), (2, 0), (2, -1), (1, -2), (0, -2), (-1, -2), (-2, -1), (-2, 0), (-2, 1),
          (-1, 2), (0, 2), (1, 1), (1, 0), (0, -1), (-1, 0)]


def snail_frame(i):
    dx, bob = (0, 1, 2, 1)[i], (0, -1, 0, -1)[i]
    im = new(22, 13)
    rect(im, 2, 9, 15 + dx, 10, "paper")
    rect(im, 2, 10, 15 + dx, 10, "sand")
    rect(im, 12 + dx, 6, 15 + dx, 9, "paper")
    rect(im, 13 + dx, 7, 17 + dx, 9, "paper")
    for sx in (14, 17):
        rect(im, sx + dx, 5, sx + dx, 6, "paper")
        put(im, sx + dx, 4, "ink")
    cx, cy = 7, 6 + bob
    disc(im, cx, cy, 4, "orange")
    for ox in range(-4, 5):
        for oy in range(-4, 5):
            if ox + oy >= 5 and ox * ox + oy * oy <= 17:
                put(im, cx + ox, cy + oy, "rust")
    for ox, oy in SPIRAL:
        put(im, cx + ox, cy + oy, "gold")
    return outline(im)


def windmill_frame(m, k, n):
    im = new(36, 40)
    lit, dark = m["mill"]
    for y in range(16, 38):
        half = 3 + (y - 16) * 3 // 21
        for x in range(18 - half, 18 + half + 1):
            put(im, x, y, lit if x < 18 else dark)
    rect(im, 17, 34, 19, 36, "umber")
    rect(im, 17, 24, 18, 25, m["window"])
    rect(im, 15, 13, 21, 15, dark)
    for j in range(4):
        a = (k / n + j) * math.pi / 2
        dx, dy = math.cos(a), math.sin(a)
        px, py = -dy, dx
        line(im, 18, 16, 18 + dx * 14, 16 + dy * 14, m["arm"])
        for off in (1, 2):
            line(im, 18 + dx * 5 + px * off, 16 + dy * 5 + py * off,
                 18 + dx * 14 + px * off, 16 + dy * 14 + py * off, m["sail"])
    disc(im, 18, 16, 1, "bark")
    im = outline(im)
    # a mound of the mid hill under the tower, drawn after the outline so the hill runs under it
    rect(im, 9, 37, 27, 37, m["mid"][0])
    rect(im, 4, 38, 32, 39, m["mid"][1])
    return im


def cloud_image(w, h, ramp, rnd):
    im = new(w, h)
    puffs = []
    for i in range(5):
        puffs.append((w * (.14 + .72 * i / 4), h * (.58 + rnd.random() * .14), h * (.26 + rnd.random() * .26)))
    puffs.append((w * (.35 + rnd.random() * .3), h * .42, h * .36))
    for y in range(h - 2):
        for x in range(w):
            if any(math.hypot(x - px, (y - py) * 1.25) < pr for px, py, pr in puffs):
                put(im, x, y, pick(ramp, y / h, x, y))
    return im


def cloud_frames(w, ramp, rnd, amp=10):
    """A cloud drifting right and back; one pixel per frame, loops cleanly."""
    h = round(w * .45) + 2
    cloud = cloud_image(w, h, ramp, rnd)
    frames = []
    for px in list(range(amp + 1)) + list(range(amp - 1, 0, -1)):
        f = new(w + amp, h)
        paste(f, cloud, px, 0)
        frames.append(f)
    return frames


def bird_frames(color):
    n, w, h = 16, 72, 36
    birds = [(30, 14, 20, 6, 0.0), (46, 22, 12, 5, .33), (20, 27, 14, 4, .66)]  # circling
    up = ((-2, -1), (-1, 0), (0, 1), (1, 0), (2, -1))
    down = ((-2, 0), (-1, 0), (0, 1), (1, 0), (2, 0))
    frames = []
    for f in range(n):
        im = new(w, h)
        for k, (cx, cy, ax, ay, ph) in enumerate(birds):
            a = 2 * math.pi * (f / n + ph)
            x, y = round(cx + ax * math.cos(a)), round(cy + ay * math.sin(a))
            for dx, dy in (up if ((f + k) // 2) % 2 == 0 else down):
                put(im, x + dx, y + dy, color)
        frames.append(im)
    return frames


def star_frames(g, rnd, sky_h):
    n = 3
    frames = [new(g.w, sky_h) for _ in range(n)]
    mx, my = g.moon
    for _ in range(g.w * sky_h // 900):
        x, y = rnd.randrange(2, g.w - 2), rnd.randrange(2, sky_h - 2)
        ph, big = rnd.randrange(n), rnd.random() < .15
        bright = rnd.choice(["white", "white", "sun", "sky_pale"])
        if y > g.far_y(x) - 6 or math.hypot(x - mx, y - my) < 30:
            continue
        for f in range(n):
            lvl = (f + ph) % n  # 0 dim, 1 mid, 2 bright
            put(frames[f], x, y, ("slate", "mist", bright)[lvl])
            if big and lvl == 2:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    put(frames[f], x + dx, y + dy, "mist")
    return frames


def shooting_star_frames(n=48, w=42, h=20):
    cols = ["white", "white", "sky_pale", "sky_pale", "mist", "mist", "slate"]
    frames = []
    for f in range(n):
        im = new(w, h)
        if f < 6:
            hx, hy = 2 + 6 * f, 1 + 3 * f
            for i, c in enumerate(cols):
                put(im, round(hx - i * .9), round(hy - i * .45), c)
        frames.append(im)
    return frames


def firefly_frames(rnd, w=240, h=64, n=8):
    flies = []
    for _ in range(14):
        flies.append((rnd.randrange(12, w - 12), rnd.randrange(10, h - 10), rnd.randrange(3, 8),
                      rnd.randrange(2, 5), rnd.randrange(1, 3), rnd.randrange(1, 3), rnd.randrange(n), rnd.randrange(n)))
    frames = []
    for f in range(n):
        im = new(w, h)
        for cx, cy, ax, ay, kx, ky, ph, bp in flies:
            x = cx + round(ax * math.sin(2 * math.pi * (kx * f + ph) / n))
            y = cy + round(ay * math.cos(2 * math.pi * (ky * f + ph) / n))
            v = (f + bp) % n
            if v < 2:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    put(im, x + dx, y + dy, "lime")
                put(im, x, y, "white")
            elif v < 5:
                put(im, x, y, "lime")
            elif v < 7:
                put(im, x, y, "leaf")
        frames.append(im)
    return frames


def leaf_frames(m, rnd, w, h, n=10):
    leaves = []
    for _ in range(5):
        leaves.append((rnd.randrange(4, w - 6), rnd.randrange(n), rnd.randrange(2, 4), rnd.choice(m["leaf"])))
    frames = []
    for f in range(n):
        im = new(w, h)
        for x0, ph, amp, c in leaves:
            k = (f + ph) % n
            x = x0 + round(amp * math.sin(2 * math.pi * (f + ph) / n))
            y = 1 + k * (h - 4) // n
            put(im, x, y, c)
            if (f + ph) % 2 == 0:
                put(im, x + 1, y, c)
        frames.append(im)
    return frames


def grass_sprite(g, m, sid, x0, w, seed):
    top = min(g.near_y(x) for x in range(x0, x0 + w)) - 6
    h = max(g.near_y(x) for x in range(x0, x0 + w)) - top + 2
    rnd = random.Random(seed)
    tufts, x = [], x0
    while x < x0 + w - 3:
        tufts.append((x, 2 + rnd.randrange(3), rnd.randrange(4)))
        x += 3 + rnd.randrange(4)
    frames = []
    for f in range(4):
        im = new(w, h)
        for tx, th, ph in tufts:
            gy = g.near_y(tx) - top
            for blade, (bx, bh, sign) in enumerate(((tx, th, 1), (tx + 2, max(1, th - 1), -1))):
                off = (0, 1, 0, -1)[(f + ph) % 4] * sign
                for i in range(1, bh + 1):
                    put(im, bx - x0 + (off if i == bh else 0), gy - i, m["tuft"][min(2, i - 1)])
        frames.append(im)
    return Sprite(sid, frames, 3, x0, top, 0.8)


# --------------------------------------------------------------------- scene

def scene(mood, variant):
    g = Geo(variant, **GEO[variant])
    m = MOODS[mood]
    night = mood == "night"
    rnd = random.Random(7)
    layers = [
        Layer("sky", sky_layer(g, m, night), 0.0),
        Layer("far", hills_layer(g, m["far"], g.far_y, 30), 0.25),
        Layer("mid", hills_layer(g, m["mid"], g.mid_y, 22), 0.5),
        Layer("near", near_layer(g, m), 0.8),
        Layer("front", front_layer(g, m), 1.0),
    ]
    thx = g.tx - 34
    thy = g.near_y(thx + 11) - 25
    dgx = g.tx + 16
    dgy = g.near_y(dgx + 9) - 7
    snx = g.snail_x
    sny = g.near_y(snx + 8) + 2
    sky_h = g.far[0] + g.far[1] + g.far[2]

    sprites = []
    if night:
        sprites.append(Sprite("stars", star_frames(g, rnd, sky_h), 2, 0, 0, 0.0))
        sx, sy = g.shoot
        sprites.append(Sprite("shooting_star", shooting_star_frames(), 8, sx, sy, 0.0))
    for i, (cx, cy, cw) in enumerate(g.clouds):
        sprites.append(Sprite(f"cloud{i + 1}", cloud_frames(cw, m["cloud"], rnd), (3, 2, 3)[i], cx, cy, 0.0))
    if not night:
        bx, by = g.birds
        sprites.append(Sprite("birds", bird_frames("ink"), 8, bx, by, 0.0))
    mill = [windmill_frame(m, k, 6) for k in range(6)]
    sprites.append(Sprite("windmill", mill, 6, g.mill_x - 18, g.mid_y(g.mill_x) - 37, 0.5))

    sprites.append(Sprite("who", [thinker_frame(m, f == 6) for f in range(8)], 4, thx, thy, 0.8))
    glow = [("white", "sand"), ("sun", "amber"), ("paper", "sand")]
    sprites.append(Sprite("slate", [slate_frame(*c) for c in glow], 2, thx + 5, thy + 16, 0.8))
    sprites.append(Sprite("dog", [dog_frame(t) for t in ((16, 1), (16, 3), (16, 6), (16, 3))], 6, dgx, dgy, 0.8))
    sprites.append(Sprite("snail", [snail_frame(i) for i in range(4)], 3, snx, sny, 0.8))
    for i, (x0, w) in enumerate(g.grass):
        sprites.append(grass_sprite(g, m, "grass" if i == 0 else f"grass{i + 1}", x0, w, 21 + i))
    lw = round(3.4 * g.rc)
    ly = g.cy + g.rc
    sprites.append(Sprite("leaves", leaf_frames(m, rnd, lw, g.base_y + 2 - ly), 5, g.tx - lw // 2, ly, 0.8))
    if night:
        fx, fy = g.fire
        sprites.append(Sprite("fireflies", firefly_frames(rnd), 4, fx, fy, 0.8))

    return Scene(f"countryside-{mood}", variant, g.w, g.h, layers, sprites,
                 {"slate": (thx + 11, thy + 21, 0.8)},  # depth of the slate sprite
                 tags=[("who", thx + 11, thy + 14, 0.8)])


SCENES = {
    "countryside-sunset": lambda v: scene("sunset", v),
    "countryside-night": lambda v: scene("night", v),
}
