"""Scene 3: the shell shore at midday. A big spiral shell and eight small things washed up."""
import math
import random

from PIL import Image

from ..cast import dog, figure, snail
from ..draw import dither, disc, line, new, outline, paste, put, rect
from ..palette import PALETTE
from ..scene import SIZES, Layer, Scene, Sprite
from .s1_countryside import cloud_frames, draw_glow, pick

# Quiet side for text on wide: the right third (x > 384). On tall: the bottom 35 % (y > 312).
GEO = {
    "wide": dict(
        hz=72, shore=104, sun=(480, 36), isl=(450, 40, 14),
        shell=(300, 268), who=(346, 250), snail=(228, 268), dog=(382, 260), crab=(404, 269),
        centre=(288, 180),
        clouds=[(40, 14, 84), (330, 40, 64), (385, 10, 56)], gulls=(290, 10),
        tufts=[(430, 232), (60, 290)],
        # id: (centre x, bottom y); two columns of four, room for a card beside each
        pos=dict(offline=(104, 152), eink=(104, 184), scripts=(104, 216), connect=(104, 248),
                 norepeats=(240, 152), sourced=(240, 184), wheel=(240, 216), opensource=(240, 248)),
    ),
    "tall": dict(
        hz=70, shore=100, sun=(196, 26), isl=(150, 36, 10),
        shell=(112, 346), who=(40, 334), snail=(182, 338), dog=(148, 340), crab=(146, 362),
        centre=(120, 240),
        clouds=[(14, 12, 70), (120, 40, 56)], gulls=(70, 20),
        tufts=[(14, 214), (196, 236)],
        pos=dict(offline=(48, 150), eink=(48, 200), scripts=(48, 250), connect=(48, 300),
                 norepeats=(140, 150), sourced=(140, 200), wheel=(140, 250), opensource=(140, 300)),
    ),
}


def shore_y(g, x):
    return g["shore"] + round(4 * math.sin(x * 0.02 + 1) + 2 * math.sin(x * 0.07))


def pad(im):
    """Add a clear 1 px margin, then the ink edge."""
    out = new(im.width + 2, im.height + 2)
    paste(out, im, 1, 1)
    return outline(out)


# -------------------------------------------------------------------- layers

def sky_layer(g):
    im = new(g["w"], g["h"])
    hz = g["hz"]
    dither(im, (0, 0, g["w"] - 1, hz), ["sky", "sky_pale", "white"], lambda x, y: y / hz)
    sx, sy = g["sun"]
    draw_glow(im, sx, sy, 12, "white", "sky_pale")
    disc(im, sx, sy, 12, "sun")
    disc(im, sx, sy, 9, "white")
    return im


def sea_layer(g):
    w, h, hz = g["w"], g["h"], g["hz"]
    im = new(w, h)
    bottom = g["shore"] + 8
    dither(im, (0, hz, w - 1, h - 1), ["sea", "teal", "sky_pale"], lambda x, y: (y - hz) / (bottom - hz))
    rect(im, 0, hz, w - 1, hz, "dusk")
    xc, hw, ih = g["isl"]  # a far green island on the horizon
    for x in range(xc - hw, xc + hw):
        d = (x - xc) / hw
        top = hz - int(ih * (1 - d * d))
        for y in range(top, hz + 1):
            put(im, x, y, "forest" if y > top + 3 else "grass")
    rnd = random.Random(4)
    for _ in range(w * (g["shore"] - hz) // 90):
        x = rnd.randrange(w - 7)
        y = rnd.randrange(hz + 3, g["shore"] - 6)
        rect(im, x, y, x + rnd.randrange(3, 7), y, "sky" if y < hz + (g["shore"] - hz) * 0.5 else "white")
    return im


def sand_layer(g):
    w, h = g["w"], g["h"]
    im = new(w, h)
    for x in range(w):
        sy = shore_y(g, x)
        for y in range(sy, h):
            d = y - sy
            if d < 2:
                c = "white"
            elif d < 4:
                c = "white" if (x + y) % 2 == 0 else "sky_pale"
            elif d < 14:
                c = pick(["tan", "sand"], (d - 4) / 10, x, y)  # wet band: the one dithered edge
            else:
                c = "sand"
            put(im, x, y, c)
    rnd = random.Random(3)
    for _ in range(w * h // 4000):  # sparse 2-3 px pebble and shell clusters
        x, y = rnd.randrange(w - 4), rnd.randrange(h - 4)
        if y < shore_y(g, x) + 18:
            continue
        a, b = ("mist", "slate") if rnd.random() < 0.5 else ("paper", "tan")
        put(im, x, y, a)
        put(im, x + 1, y, a)
        put(im, x + 1, y + 1, b)
        if rnd.random() < 0.5:
            put(im, x + 3, y + 1, b)
    for _ in range(w * h // 9000):  # pebbles
        x, y = rnd.randrange(w - 6), rnd.randrange(g["shore"] + 24, h - 6)
        st = new(4, 2)
        rect(st, 0, 0, 3, 1, "mist")
        rect(st, 0, 1, 3, 1, "slate")
        paste(im, pad(st), x, y)
    return im


def shadow(im, cx, cy, rx, ry):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if q <= 1 and (q < 0.45 or (x + y) % 2 == 0):
                put(im, x, y, "tan")


def front_layer(g):
    w, h = g["w"], g["h"]
    im = new(w, h)
    rnd = random.Random(9)
    rect(im, 0, h - 2, w - 1, h - 1, "forest")
    x = 0
    while x < w:
        hg = 4 + rnd.randrange(8)
        for i in range(hg):
            c = "forest" if i < hg * 0.35 else "grass" if i < hg * 0.75 else "leaf"
            put(im, x, h - 1 - i, c)
            put(im, x + 1, h - 1 - i, c)
        x += 3 + rnd.randrange(5)
    for _ in range(6):
        st = new(5, 3)
        rect(st, 0, 0, 4, 2, "mist")
        rect(st, 0, 2, 4, 2, "slate")
        put(st, 1, 0, "paper")
        paste(im, pad(st), rnd.randrange(4, w - 10), rnd.randrange(h - 60, h - 16))
    return im


# --------------------------------------------------------------------- props

def big_shell(R=26):
    """A nautilus-like spiral: grooves wind out from the centre pixel, orange growth stripes."""
    # One log spiral winds out from the centre pixel for K turns to the lip; the opening
    # (aperture) is the end of the last whorl, lower right, where the shell rests on the sand.
    n = 2 * R + 3
    c = R + 1
    im = new(n, n)
    K, g, seam = 3, 1.65, 0.55
    r0 = R / g ** K
    lng = math.log(g)
    ramp = ["paper", "sand", "orange", "rust"]  # outer (light) to inner (dark)
    for y in range(n):
        for x in range(n):
            dx, dy = x - c, y - c
            r = math.hypot(dx, dy)
            if r < 0.5:
                put(im, x, y, "umber")
                continue
            t = (math.atan2(dy, dx) - seam) % (2 * math.pi)
            k = math.log(r / r0) / lng + t / (2 * math.pi)
            if k > K + 1.0 / (r * lng):
                continue
            fr = k % 1.0
            d_line = min(fr, 1 - fr) * r * lng
            if d_line < 1.0 and k > -1.0 / (r * lng):
                put(im, x, y, "umber")
                continue
            if k < 0:
                put(im, x, y, "bark")
                continue
            if k >= K - 1 and t < 0.5:  # the opening, dark inside
                put(im, x, y, "umber" if fr < 0.55 else "bark")
                continue
            if k >= K - 1 and t < 0.62:  # its pale lip
                put(im, x, y, "white")
                continue
            tone = max(0.0, min(0.999, 0.85 * (1 - k / K) + 0.15 * (1 - fr)))
            idx = int(tone * 4)
            col = ramp[idx]
            if idx == 0 and dx * 0.6 + dy * 0.8 < -6:
                col = "white"
            u = t + 0.4 * math.log(r / r0)  # thin growth lines across the band
            if r > 9 and d_line > 1.8 and (u % 0.28) * r < 0.9:
                col = ramp[idx + 1] if idx < 3 else "plum"
            put(im, x, y, col)
    return outline(im)


def lamp():
    im = new(16, 20)
    rect(im, 3, 17, 12, 19, "brown")
    rect(im, 3, 19, 12, 19, "bark")
    rect(im, 6, 15, 9, 16, "gold")
    rect(im, 2, 10, 13, 14, "gold")
    rect(im, 2, 13, 13, 14, "brown")
    rect(im, 3, 11, 5, 11, "sun")
    rect(im, 6, 8, 9, 9, "brown")
    rect(im, 5, 1, 10, 7, "sky_pale")
    rect(im, 9, 1, 10, 7, "mist")
    rect(im, 7, 3, 8, 6, "amber")
    rect(im, 7, 4, 8, 5, "sun")
    rect(im, 14, 11, 15, 12, "brown")
    rect(im, 14, 13, 14, 14, "brown")
    return pad(im)


def quill():
    im = new(18, 20)
    rect(im, 3, 12, 12, 19, "navy")
    rect(im, 10, 12, 12, 19, "night")
    rect(im, 4, 13, 4, 17, "sky")
    rect(im, 4, 10, 11, 11, "mist")
    rect(im, 5, 10, 10, 10, "night")
    line(im, 10, 10, 17, 5, "sand")
    line(im, 9, 9, 16, 3, "paper")
    line(im, 8, 9, 15, 1, "white")
    line(im, 7, 10, 15, 2, "bark")
    return pad(im)


def scroll():
    im = new(22, 10)
    rect(im, 2, 1, 19, 8, "paper")
    rect(im, 2, 1, 19, 1, "white")
    rect(im, 2, 7, 19, 8, "sand")
    rect(im, 0, 2, 1, 7, "tan")
    rect(im, 20, 2, 21, 7, "tan")
    put(im, 1, 4, "bark")
    put(im, 20, 4, "bark")
    rect(im, 9, 1, 11, 8, "red")
    rect(im, 11, 1, 11, 8, "rust")
    rect(im, 13, 3, 18, 3, "mist")
    rect(im, 13, 5, 17, 5, "mist")
    rect(im, 3, 3, 7, 3, "mist")
    rect(im, 3, 5, 6, 5, "mist")
    return pad(im)


def bridge():
    im = new(36, 18)
    rect(im, 0, 3, 35, 5, "sand")
    rect(im, 0, 3, 35, 3, "white")
    rect(im, 0, 6, 35, 17, "mist")
    rect(im, 0, 6, 35, 6, "sand")
    rect(im, 31, 6, 35, 17, "slate")
    for y in (9, 12, 15):
        for x in range(0, 36, 5):
            put(im, x + (y % 2) * 2, y, "slate")
    for x in range(8, 29):  # arch ring, then the stream under it
        d = (x - 18) / 10.5
        for y in range(17 - int(10 * math.sqrt(max(0, 1 - d * d))), 18):
            put(im, x, y, "sand")
    for x in range(9, 28):
        d = (x - 18) / 9.5
        top = 17 - int(9 * math.sqrt(max(0, 1 - d * d)))
        for y in range(top, 18):
            put(im, x, y, "navy" if y <= top + 1 else "sea")
    return pad(im)


def sundial():
    im = new(22, 18)
    rect(im, 6, 13, 15, 17, "mist")
    rect(im, 13, 13, 15, 17, "slate")
    rect(im, 4, 16, 17, 17, "mist")
    rect(im, 14, 16, 17, 17, "slate")
    rect(im, 3, 9, 18, 12, "sand")
    rect(im, 3, 9, 18, 10, "paper")
    rect(im, 3, 12, 18, 12, "tan")
    for x in (5, 8, 13, 16):
        put(im, x, 10, "bark")
    line(im, 10, 9, 10, 2, "gold")
    line(im, 11, 9, 11, 4, "brown")
    line(im, 12, 10, 17, 11, "tan")
    return pad(im)


def book():
    im = new(24, 16)
    rect(im, 0, 11, 23, 13, "rust")
    rect(im, 0, 13, 23, 13, "plum")
    rect(im, 1, 3, 11, 10, "paper")
    rect(im, 12, 3, 22, 10, "paper")
    rect(im, 1, 3, 22, 3, "white")
    rect(im, 1, 10, 22, 10, "sand")
    rect(im, 11, 3, 12, 10, "sand")
    for x0, x1, y in ((2, 9, 5), (2, 8, 7), (13, 20, 5), (13, 19, 7)):
        rect(im, x0, y, x1, y, "mist")
    line(im, 16, 9, 15, 15, "gold")
    line(im, 18, 9, 19, 15, "gold")
    disc(im, 17, 8, 2, "red")
    put(im, 17, 8, "rust")
    return pad(im)


def wheel_prop():
    im = new(20, 20)
    rect(im, 9, 16, 10, 19, "bark")
    rect(im, 5, 19, 14, 19, "bark")
    disc(im, 10, 9, 8, "orange")
    disc(im, 10, 9, 6, "gold")
    for i in range(56):
        t = i * 0.2
        put(im, round(10 + 0.5 * t * math.cos(t)), round(9 + 0.5 * t * math.sin(t)), "rust")
    put(im, 10, 9, "bark")
    put(im, 4, 4, "sun")
    return pad(im)


def gate():
    im = new(30, 22)
    rect(im, 6, 8, 23, 20, "leaf")
    rect(im, 6, 8, 23, 10, "lime")
    rect(im, 12, 12, 17, 20, "sand")
    for x, y, c in ((8, 14, "white"), (21, 16, "gold"), (9, 18, "red"), (20, 12, "orange")):
        put(im, x, y, c)
    for x0 in (0, 25):
        rect(im, x0, 2, x0 + 4, 21, "bark")
        rect(im, x0, 2, x0 + 1, 21, "brown")
        rect(im, x0, 0, x0 + 4, 1, "tan")
    for x0 in (5, 22):  # the two leaves, swung open and seen edge-on
        rect(im, x0, 7, x0 + 2, 20, "tan")
        rect(im, x0, 9, x0 + 2, 9, "bark")
        rect(im, x0, 17, x0 + 2, 17, "bark")
    return pad(im)


PROPS = [("offline", lamp), ("eink", quill), ("scripts", scroll), ("connect", bridge),
         ("norepeats", sundial), ("sourced", book), ("wheel", wheel_prop), ("opensource", gate)]


def big(fn):
    """A prop drawn larger: scaled up to about 26 px on its long side, then re-inked."""
    im = fn()
    k = max(1.0, min(2.0, 26 / max(im.size)))
    return pad(im.resize((round(im.width * k), round(im.height * k)), Image.NEAREST)) if k > 1 else im


def props_layer(g, shell_img):
    im = new(g["w"], g["h"])
    cx, cy = g["shell"]
    shadow(im, cx + 3, cy + 25, 28, 6)
    imgs = [(pid, big(fn)) for pid, fn in PROPS]
    for pid, img in imgs:
        px, base = g["pos"][pid]
        shadow(im, px, base - 1, img.width // 2 + 2, 3)  # a little sandbar under each
    c = shell_img.width // 2
    paste(im, shell_img, cx - c, cy - c)
    return im, imgs


def feature_sprites(g, imgs):
    """Each object bobs 1 px; a glint travels across it. Tags sit inside the object."""
    sprites, tags = [], []
    for pid, img in imgs:
        px, base = g["pos"][pid]
        x, y = px - img.width // 2, base - img.height
        bob = [new(img.width, img.height + 1) for _ in range(2)]
        for f, fr in enumerate(bob):
            paste(fr, img, 0, f)
        gl = []
        for f in range(3):
            fr = new(img.width, img.height + 1)
            t = (f + 0.5) / 3
            gx, gy = 2 + round(t * (img.width - 5)), 2 + round(t * (img.height - 4))
            put(fr, gx, gy, "white")
            for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                put(fr, gx + dx, gy + dy, "sun")
            gl.append(fr)
        sprites.append(Sprite(f"feat-{pid}", bob, 2, x, y, 0.8))
        sprites.append(Sprite(f"glint-{pid}", gl, 4, x, y, 0.81))
        tags.append((pid, px, y + img.height // 2))
    return sprites, tags


def ink_twin(scene, g):
    """The scene as a pen sketch: ink where neighbouring colours differ strongly, else paper."""
    w, h = scene.w, scene.h
    flat = new(w, h)  # flat sky, sea and sand (no dither), then the island, sun and everything drawn on top
    sea = next(l.image for l in scene.layers if l.id == "sea")
    for x in range(w):
        for y in range(h):
            if y < g["hz"]:
                c = "sky"
            elif y < shore_y(g, x):
                c = "forest" if sea.getpixel((x, y))[:3] in (PALETTE["grass"], PALETTE["forest"]) else "sea"
            else:
                c = "sand"
            put(flat, x, y, c)
    sx, sy = g["sun"]
    disc(flat, sx, sy, 12, "sun")
    disc(flat, sx, sy, 9, "white")
    for l in scene.layers:
        if l.id in ("props", "front"):
            flat.paste(l.image, (0, 0), l.image)
    for sp in sorted(scene.sprites, key=lambda a: a.depth):
        if not sp.id.startswith(("glint", "sparkles", "waves")):
            flat.paste(sp.frames[0], (sp.x, sp.y), sp.frames[0])
    px = flat.load()
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    w, h = scene.w, scene.h
    edge = [[False] * w for _ in range(h)]
    for y in range(h - 1):
        for x in range(w - 1):
            c = px[x, y]
            edge[y][x] = any(abs(lum(c) - lum(px[x + dx, y + dy])) >= INK_STEP for dx, dy in ((1, 0), (0, 1)))
    out = new(w, h)
    rect(out, 0, 0, w - 1, h - 1, "paper")
    for y in range(h):
        for x in range(w):
            near = sum(edge[y + dy][x + dx] for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (1, -1), (-1, 1))
                       if 0 <= x + dx < w and 0 <= y + dy < h)
            if edge[y][x] and near:  # drop isolated single ink pixels
                put(out, x, y, "ink")
    for x in range(w):  # one clear horizon line and one clear shoreline, full width
        put(out, x, g["hz"], "ink")
        put(out, x, shore_y(g, x), "ink")
    return out


# ------------------------------------------------------------------- sprites

def wave_sprites(g):
    out = []
    segw = 288
    for s in range(-(-g["w"] // segw)):
        x0, x1 = s * segw, min(g["w"], s * segw + segw)
        ys = [shore_y(g, x) for x in range(x0, x1)]
        top = min(ys) - 1
        hh = max(ys) + 8 - top
        frames = []
        for f in range(6):
            im = new(x1 - x0, hh)
            for x in range(x0, x1):
                sy = shore_y(g, x)
                off = round(2 + 2 * math.sin(2 * math.pi * f / 6 + x * 0.045))
                for y in range(sy, sy + off + 1):
                    if y == sy + off or (y == sy + off - 1 and x % 2 == 0):
                        c = "white"
                    else:
                        c = "sky_pale"
                    put(im, x - x0, y - top, c)
                if off >= 2 and x % 5 == 0:
                    put(im, x - x0, sy + off + 2 - top, "white")
            frames.append(im)
        out.append(Sprite(f"waves{s + 1}", frames, 5, x0, top, 0.6))
    return out


def sparkle_frames(w, h, seed, count):
    rnd = random.Random(seed)
    pts = [(rnd.randrange(3, w - 3), rnd.randrange(3, h - 3), rnd.randrange(3)) for _ in range(count)]
    frames = []
    for f in range(3):
        im = new(w, h)
        for x, y, ph in pts:
            lvl = (f + ph) % 3
            if lvl == 1:
                put(im, x, y, "sky_pale")
            elif lvl == 2:
                put(im, x, y, "white")
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    put(im, x + dx, y + dy, "sky_pale")
        frames.append(im)
    return frames


def crab_frames():
    seq = (0, 3, 6, 9, 12, 9, 6, 3)
    frames = []
    for f, ox in enumerate(seq):
        cr = new(12, 8)
        rect(cr, 3, 3, 8, 5, "orange")
        rect(cr, 4, 2, 7, 2, "orange")
        rect(cr, 3, 5, 8, 5, "rust")
        put(cr, 5, 3, "sun")
        put(cr, 4, 1, "white")
        put(cr, 7, 1, "white")
        cy = 1 if f % 2 == 0 else 2
        rect(cr, 1, cy, 2, cy + 1, "red")
        rect(cr, 9, 3 - cy + 1, 10, 3 - cy + 2, "red")
        for lx in ((3, 5, 6, 8) if f % 2 == 0 else (4, 5, 7, 8)):
            put(cr, lx, 6, "rust")
        im = new(26, 8)
        paste(im, outline(cr), ox, 0)
        frames.append(im)
    return frames


def gull_frames():
    n, w, h = 8, 90, 34
    birds = [(30, 14, 22, 6, 0.0), (62, 22, 14, 5, 0.4)]
    up = ((-4, -2), (-3, -1), (-2, 0), (-1, 0), (0, 1), (1, 0), (2, 0), (3, -1), (4, -2))
    down = ((-4, 1), (-3, 1), (-2, 0), (-1, 0), (0, 1), (1, 0), (2, 0), (3, 1), (4, 1))
    frames = []
    for f in range(n):
        im = new(w, h)
        for k, (cx, cy, ax, ay, ph) in enumerate(birds):
            a = 2 * math.pi * (f / n + ph)
            x, y = round(cx + ax * math.cos(a)), round(cy + ay * math.sin(a))
            wing = up if ((f + k) // 2) % 2 == 0 else down
            for dx, dy in wing:
                put(im, x + dx, y + dy + 1, "mist")
            for dx, dy in wing:
                put(im, x + dx, y + dy, "slate" if abs(dx) == 4 else "white")
            put(im, x, y + 2, "mist")
        frames.append(im)
    return frames


def tuft_frames(seed):
    rnd = random.Random(seed)
    blades = [(3 + i * 3 + rnd.randrange(2), 8 + rnd.randrange(7), rnd.choice((-2, -1, 0, 1, 2))) for i in range(6)]
    frames = []
    for f in range(4):
        im = new(22, 16)
        for k, (bx, bh, lean) in enumerate(blades):
            tx = bx + lean + (0, 1, 0, -1)[(f + k) % 4]
            ty = 15 - bh
            line(im, bx, 15, tx, ty, "grass")
            put(im, tx, ty, "lime")
            put(im, tx, ty + 1, "leaf")
        frames.append(im)
    return frames


def glint_frames():
    frames = []
    for arm in (-1, 1, 3, 1):
        im = new(9, 9)
        if arm >= 0:
            put(im, 4, 4, "white")
            for k in range(1, arm + 1):
                for dx, dy in ((-k, 0), (k, 0), (0, -k), (0, k)):
                    put(im, 4 + dx, 4 + dy, "white" if k == 1 else "sun")
        frames.append(im)
    return frames


INK_STEP = 60  # brightness step that counts as an edge


# --------------------------------------------------------------------- scene

def scene(variant):
    w, h = SIZES[variant]
    g = dict(GEO[variant], w=w, h=h)
    shell_img = big_shell()
    props, imgs = props_layer(g, shell_img)
    feats, tags = feature_sprites(g, imgs)
    layers = [
        Layer("sky", sky_layer(g), 0.0),
        Layer("sea", sea_layer(g), 0.2),
        Layer("sand", sand_layer(g), 0.6),
        Layer("props", props, 0.8),
        Layer("front", front_layer(g), 1.0),
    ]
    rnd = random.Random(7)
    sprites = []
    for i, (cx, cy, cw) in enumerate(g["clouds"]):
        sprites.append(Sprite(f"cloud{i + 1}", cloud_frames(cw, ["white", "paper", "sky_pale"], rnd, 8),
                              (3, 2, 3)[i % 3], cx, cy, 0.0))
    gx, gy = g["gulls"]
    sprites.append(Sprite("gulls", gull_frames(), 6, gx, gy, 0.0))
    sh = g["shore"] - g["hz"] - 14
    sprites.append(Sprite("sparkles", sparkle_frames(w, sh, 11, w // 20), 3, 0, g["hz"] + 4, 0.2))
    sprites += wave_sprites(g)
    for i, (tx, ty) in enumerate(g["tufts"]):
        sprites.append(Sprite(f"tuft{i + 1}", tuft_frames(21 + i), 4, tx, ty, 0.8))
    scx, scy = g["shell"]
    sprites.append(Sprite("glint", glint_frames(), 3, scx - 15, scy - 16, 0.8))
    sprites += feats
    sprites.append(Sprite("who", figure("anning", "crouch"), 4, *g["who"], 0.8))
    sprites.append(Sprite("dog", dog("sniff"), 6, *g["dog"], 0.8))
    sprites.append(Sprite("crab", crab_frames(), 5, *g["crab"], 0.8))
    sprites.append(Sprite("snail", snail(), 3, *g["snail"], 0.8))
    wx, wy = g["who"]
    tags.append(("who", wx + 11, wy + 8, 0.8))
    sc = Scene("shell", variant, w, h, layers, sprites,
                 {"centre": (*g["centre"], 0.2 if variant == "wide" else 0.8),  # wide: on the sea layer
                  "spiral": (*g["shell"], 0.8)}, tags, tag_depth=0.8)  # props layer
    sc.ink = ink_twin(sc, g)
    return sc


SCENES = {"shell": scene}
