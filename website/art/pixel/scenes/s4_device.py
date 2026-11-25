"""Scene 4: the workshop, a giant Spiral Node device and the scene's figure turning its wheel."""
import math
import random

from PIL import ImageOps

from .. import cast
from ..draw import BAYER, disc, line, new, outline, paste, put, rect
from ..scene import SIZES, Layer, Scene, Sprite
from .s1_countryside import pick, rng_hash

WHEEL_R = 22
SKIN = (242, 180, 138, 255)

# Device top-left (x0, y0), body size, lamp x, pegboard (x, y, w, h), shelf, bench span, cast spots.
GEO = {
    "wide": dict(x0=236, y0=78, bw=180, bh=184, lamp_x=326, peg=(84, 92, 104, 84), shelf=(448, 152),
                 glow_r=330, halo=118, bx=(40, 536), dog_x=210, gear_x=130, tin_x=76, jar_x=466),
    "tall": dict(x0=44, y0=100, bw=150, bh=184, lamp_x=119, peg=None, shelf=None,
                 glow_r=290, halo=100, bx=(6, 234), dog_x=52, gear_x=14, tin_x=None, jar_x=206),
}


class Geo:
    def __init__(self, variant, **kw):
        self.w, self.h = SIZES[variant]
        self.__dict__.update(kw)
        self.B = self.y0 + self.bh            # bench top edge, the device stands on it
        self.fy = self.B + 44                 # floor line
        self.wcx = self.x0 + self.bw - 52     # wheel centre
        self.wcy = self.y0 + 154
        self.bulb_y = 67


# ---------------------------------------------------------------- helpers

def inside_rr(x, y, w, h, r):
    cx = min(max(x, r), w - 1 - r)
    cy = min(max(y, r), h - 1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6


def rrect(im, x, y, w, h, r, fill):
    for j in range(h):
        for i in range(w):
            if inside_rr(i, j, w, h, r):
                put(im, x + i, y + j, fill(i, j) if callable(fill) else fill)


def border(im, x, y, w, h, r, c):
    for j in range(h):
        for i in range(w):
            if inside_rr(i, j, w, h, r) and not all(
                    inside_rr(i + a, j + b, w, h, r) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                put(im, x + i, y + j, c)


# ------------------------------------------------------------------- layers

def wall_layer(g):
    im = new(g.w, g.h)
    cx, cy = g.lamp_x, g.y0 + g.bh * 0.4
    ramp = ["amber", "tan", "brown", "bark"]
    for y in range(g.h):
        for x in range(g.w):
            d = math.hypot((x - cx) * 0.8, y - cy) / g.glow_r
            seam = x % 26 == 0
            if d < 0.5:  # dither only inside the lamp's light
                put(im, x, y, "umber" if seam else pick(ramp, d * 2, x, y))
            else:  # two flat steps by distance from the lamp
                put(im, x, y, "umber" if seam else "bark")
    fy = g.fy
    rect(im, 0, fy - 6, g.w - 1, fy - 1, "bark")
    rect(im, 0, fy - 6, g.w - 1, fy - 6, "brown")
    rect(im, 0, fy - 1, g.w - 1, fy - 1, "ink")
    for y in range(fy, g.h):  # flat dark boards in two tones
        band = (y - fy) // 10
        for x in range(g.w):
            seam = (y - fy) % 10 == 0 or (x + 37 * band) % 90 == 0
            put(im, x, y, "ink" if seam else "umber" if band % 2 == 0 else "bark")
    return im


def tool_board(g):
    px, py, pw, ph = g.peg
    bd = new(pw + 2, ph + 2)
    for j in range(ph):
        for i in range(pw):
            t = 0.3 + 0.5 * abs(px + i - g.lamp_x) / 250 + (rng_hash(i, j) - .5) * .1
            c = pick(["tan", "brown", "bark"], t, i, j)
            if i < 2 or j < 2 or i >= pw - 2 or j >= ph - 2:
                c = "bark"
            elif i % 6 == 3 and j % 6 == 3:
                c = "umber"
            put(bd, 1 + i, 1 + j, c)
    tl = new(pw + 2, ph + 2)
    hx = 1 + pw // 5
    rect(tl, hx - 1, 22, hx, 52, "brown")
    rect(tl, hx - 1, 22, hx - 1, 52, "tan")
    rect(tl, hx - 6, 14, hx + 5, 21, "slate")
    rect(tl, hx - 6, 14, hx + 5, 15, "mist")
    rect(tl, hx - 6, 20, hx + 5, 21, "dusk")
    qx = 1 + pw // 2
    for a, c in ((0, "red"), (1, "rust")):
        line(tl, qx - 5 + a, 58, qx - 1 + a, 40, c)
        line(tl, qx + 6 - a, 58, qx + 2 - a, 40, c)
    line(tl, qx, 40, qx - 1, 28, "mist")
    line(tl, qx + 2, 40, qx + 3, 28, "slate")
    rect(tl, qx, 39, qx + 1, 41, "gold")
    rule_end = pw - pw // 4
    rect(tl, 6, ph - 14, rule_end, ph - 9, "gold")
    rect(tl, 6, ph - 14, rule_end, ph - 14, "sun")
    for tx in range(8, rule_end, 5):
        rect(tl, tx, ph - 13, tx, ph - 11, "ink")
    hk, hy = 1 + int(pw * 0.82), 11
    rect(tl, hk - 1, hy - 1, hk + 1, hy + 1, "mist")
    paste(bd, outline(tl), 0, 0)
    return outline(bd), (px + hk - 1, py + hy - 1)


def shelf_img():
    sh = new(94, 32)
    rect(sh, 1, 22, 92, 25, "brown")
    rect(sh, 1, 22, 92, 22, "tan")
    rect(sh, 1, 25, 92, 25, "bark")
    for bx in (10, 78):
        rect(sh, bx, 26, bx + 2, 30, "bark")
    for i, content in enumerate(("gold", "leaf", "red")):
        jx = 8 + i * 28
        rect(sh, jx, 7, jx + 11, 21, "sky_pale")
        rect(sh, jx + 1, 11, jx + 10, 21, content)
        rect(sh, jx, 5, jx + 11, 6, "mist")
        rect(sh, jx + 2, 8, jx + 2, 18, "white")
    return outline(sh)


def back_layer(g):
    im = new(g.w, g.h)
    if g.peg is None:  # no room for a board: one hook for the wrench
        hk = new(5, 5)
        rect(hk, 1, 1, 3, 3, "mist")
        paste(im, outline(hk), 32, 44)
        return im, (34, 46)
    bd, hook = tool_board(g)
    px, py = g.peg[0], g.peg[1]
    paste(im, bd, px - 1, py - 1)  # (peg is set here)
    if g.shelf:
        sx, sy = g.shelf
        paste(im, shelf_img(), sx - 1, sy - 22)
    return im, hook


def lamp_layer(g):
    im = new(g.w, g.h)
    lx = g.lamp_x
    rect(im, lx, 0, lx + 1, 41, "umber")
    rect(im, lx - 1, 0, lx - 1, 41, "ink")
    rect(im, lx + 2, 0, lx + 2, 41, "ink")
    lp = new(60, 32)
    cx = 30
    rect(lp, cx - 2, 0, cx + 2, 2, "mist")
    for y in range(20):
        half = 6 + y * 20 // 19
        for x in range(cx - half, cx + half + 1):
            t = (x - (cx - half)) / (2 * half + 1)
            c = "orange" if t < .2 else "red" if t < .45 else "rust" if t < .8 else "plum"
            put(lp, x, 3 + y, c)
    rect(lp, cx - 26, 22, cx + 26, 22, "gold")
    disc(lp, cx, 26, 3, "sun")
    disc(lp, cx, 26, 2, "white")
    paste(im, outline(lp), lx - 30, 41)
    return im


def bench_layer(g):
    xl, xr = g.bx
    B, fy = g.B, g.fy
    y_top = B - 1
    w, h = xr - xl, fy + 16 - y_top + 1
    b = new(w, h)
    for x in range(xl, xr):
        k = abs(x - g.lamp_x) / (g.w * 0.6)
        for j in range(17):
            t = 0.1 + 0.75 * k + 0.25 * j / 17 + (rng_hash(x // 7, B + j) - .5) * .18
            put(b, x - xl, B + j - y_top, pick(["sun", "sand", "tan", "brown", "bark"], t, x, B + j))
        for j in range(17):
            t = 0.15 + 0.7 * k + 0.4 * j / 17
            c = "tan" if j == 0 else "umber" if j == 16 else pick(["brown", "bark", "umber"], t, x, B + 17 + j)
            put(b, x - xl, B + 17 + j - y_top, c)
    n = 3
    dw = (w - 40) // n
    for i in range(n):
        d0, d1 = xl + 20 + i * dw + 6 - xl, xl + 20 + (i + 1) * dw - 6 - xl
        rect(b, d0, B + 21 - y_top, d1, B + 30 - y_top, "bark")
        rect(b, d0 + 1, B + 22 - y_top, d1 - 1, B + 29 - y_top, "brown")
        m = (d0 + d1) // 2
        rect(b, m - 1, B + 25 - y_top, m + 1, B + 26 - y_top, "gold")
        put(b, m - 1, B + 25 - y_top, "sun")
    for l0 in (10, w - 24):
        for y in range(B + 34, fy + 15):
            for i in range(14):
                put(b, l0 + i, y - y_top, "brown" if i == 0 else "bark" if i < 9 else "umber")
    out = new(g.w, g.h)
    paste(out, outline(b), xl, y_top)

    it = new(w, 30)  # props on the bench top, local origin (xl, B - 18)
    ground = 26
    if g.tin_x is not None:
        tx = g.tin_x - xl
        rect(it, tx, ground - 13, tx + 15, ground, "mist")
        rect(it, tx + 12, ground - 13, tx + 15, ground, "slate")
        rect(it, tx, ground - 9, tx + 15, ground - 4, "red")
        rect(it, tx, ground - 7, tx + 15, ground - 6, "paper")
        rect(it, tx, ground - 13, tx + 15, ground - 12, "sky_pale")
        rect(it, tx + 1, ground - 11, tx + 1, ground - 1, "white")
        rect(it, tx + 20, ground - 2, tx + 25, ground - 1, "red")
        rect(it, tx + 26, ground - 2, tx + 36, ground - 2, "mist")
    jx = g.jar_x - xl
    rect(it, jx, ground - 12, jx + 11, ground, "sky_pale")
    rect(it, jx + 1, ground - 8, jx + 10, ground, "gold")
    rect(it, jx, ground - 14, jx + 11, ground - 13, "mist")
    rect(it, jx + 2, ground - 11, jx + 2, ground - 3, "white")
    paste(out, outline(it), xl, B - 18)
    return out


PORT_DX = (-20, 6)  # the two USB-C openings, left x of each from the middle of the top edge
LIGHT_DX, POWER_DX = 27, 48  # the charge light (just right of the ports) and the power button (toward the right end)


def top_edge(im, pad, bw):
    """Two USB-C openings, the charge light and the power button, on the device's top edge (y = pad)."""
    mid = pad + bw // 2
    for dx in PORT_DX:
        x = mid + dx
        rect(im, x, pad - 1, x + 13, pad + 3, "ink")
        rect(im, x + 1, pad, x + 12, pad + 2, "night")
        rect(im, x + 3, pad + 1, x + 10, pad + 1, "mist")  # the tongue
    x = mid + LIGHT_DX
    rect(im, x, pad - 1, x + 4, pad + 3, "ink")
    rect(im, x + 1, pad, x + 3, pad + 2, "amber")
    put(im, x + 1, pad, "sun")
    x = mid + POWER_DX  # a key standing a little above the edge
    rect(im, x, pad - 4, x + 13, pad, "ink")
    rect(im, x + 1, pad - 3, x + 12, pad - 3, "white")
    rect(im, x + 1, pad - 2, x + 12, pad - 2, "paper")
    rect(im, x + 1, pad - 1, x + 12, pad - 1, "sand")


def device_layer(g, stool=True):
    pad, bw, bh, R = 4, g.bw, g.bh, 14
    im = new(bw + 2 * pad, bh + 2 * pad + 6)

    def inb(i, j):
        return inside_rr(i, j, bw, bh, R)

    def body(i, j):
        if any(not inb(i - k, j) or not inb(i, j - k) for k in (1, 2)):
            return "leaf"  # 2 px lit rim, top-left
        k = next((k for k in range(1, 6) if not inb(i + k, j) or not inb(i, j + k)), 9)
        if k <= 3:
            return "olive_deep"  # flat shade, right and bottom
        if k == 4:  # the one dithered step
            return "olive_deep" if (BAYER[j % 4][i % 4] + 0.5) / 16 < 0.5 else "olive"
        return "olive"

    rrect(im, pad, pad, bw, bh, R, body)
    for fx in (16, bw - 38):  # rubber feet
        rect(im, pad + fx, pad + bh, pad + fx + 21, pad + bh + 2, "olive_deep")
    im = outline(im)
    rect(im, pad + 10, pad + 106, pad + bw - 11, pad + 106, "olive_deep")

    rrect(im, pad + 10, pad + 10, bw - 20, 91, 5, "olive_deep")  # bezel and screen well
    border(im, pad + 10, pad + 10, bw - 20, 91, 5, "ink")
    sx0, sy0, sw, sh = pad + 18, pad + 18, bw - 36, 74
    rect(im, sx0 - 1, sy0 - 1, sx0 + sw, sy0 + sh, "mist")
    rect(im, sx0 - 1, sy0 - 1, sx0 + sw, sy0 - 1, "slate")
    rect(im, sx0 - 1, sy0 - 1, sx0 - 1, sy0 + sh, "slate")
    rect(im, sx0, sy0, sx0 + sw - 1, sy0 + sh - 1, "paper")

    def key(kx, ky):
        rrect(im, kx, ky, 24, 14, 3,
              lambda i, j: "white" if j == 1 else "tan" if j == 11 else "sand" if j == 10 else "paper")
        border(im, kx, ky, 24, 14, 3, "ink")
        rect(im, kx + 2, ky + 14, kx + 21, ky + 14, "olive_deep")

    kx, ky = pad + 18, pad + 112
    key(kx, ky)  # Back
    line(im, kx + 14, ky + 4, kx + 9, ky + 7, "ink")
    line(im, kx + 9, ky + 7, kx + 14, ky + 10, "ink")
    kx2 = pad + 47
    key(kx2, ky)  # Home
    line(im, kx2 + 12, ky + 3, kx2 + 7, ky + 7, "ink")
    line(im, kx2 + 12, ky + 3, kx2 + 17, ky + 7, "ink")
    line(im, kx2 + 8, ky + 7, kx2 + 8, ky + 10, "ink")
    line(im, kx2 + 16, ky + 7, kx2 + 16, ky + 10, "ink")
    line(im, kx2 + 8, ky + 10, kx2 + 16, ky + 10, "ink")

    wx, wy = pad + bw - 52, pad + 154  # wheel well
    disc(im, wx, wy, R + 3, "ink")
    for y in range(wy - R - 3, wy + R + 4):
        for x in range(wx - R - 3, wx + R + 4):
            dx, dy = x - wx, y - wy
            if dx * dx + dy * dy <= (R + 2) ** 2 + (R + 2) * 0.6:
                put(im, x, y, "forest" if dx + dy < 0 else "olive_deep")

    lx, ly = pad + 44, pad + 154  # spiral logo
    t = 0.0
    while t < 4 * math.pi:
        r = 1.2 + t * 0.62
        put(im, round(lx + r * math.cos(t)), round(ly + r * math.sin(t)), "sun")
        t += 0.08

    top_edge(im, pad, bw)  # the left edge is bare: everything is on top

    if stool:  # a step stool for the figure (the opening scene leaves it out)
        st = new(26, 22)
        rect(st, 1, 1, 24, 4, "tan")
        rect(st, 1, 1, 24, 1, "sand")
        rect(st, 2, 5, 23, 9, "brown")
        rect(st, 2, 9, 23, 9, "bark")
        for l0 in (3, 20):
            rect(st, l0, 10, l0 + 2, 20, "brown")
            rect(st, l0 + 2, 10, l0 + 2, 20, "bark")
        rect(st, 6, 15, 19, 16, "bark")
        paste(im, outline(st), pad + bw - 39 - 1, pad + 168 - 1)

    out = new(g.w, g.h)
    paste(out, im, g.x0 - pad, g.y0 - pad)
    return out


def front_layer(g):
    im = new(g.w, g.h)
    for y in range(g.h):
        for x in range(g.w):
            if min(x, y, g.w - 1 - x, g.h - 1 - y) < 8:  # thin dark frame, wood tone
                put(im, x, y, "ink")
    return im


# ------------------------------------------------------------------- sprites

def thinker_frames():
    out = []
    for f in cast.figure("faraday", "turn_wheel"):
        im = f.copy()
        for y in range(im.height):  # drop the pose's own small wheel and table, keep the hand
            for x in range(14, im.width):
                if im.getpixel((x, y)) != SKIN:
                    im.putpixel((x, y), (0, 0, 0, 0))
        out.append(ImageOps.mirror(outline(im)))
    return out


def wheel_frame(k):
    R = WHEEL_R
    s, c = 2 * R + 3, R + 1
    ph = k * math.pi / 16
    im = new(s, s)
    for y in range(s):
        for x in range(s):
            dx, dy = x - c, y - c
            r = math.hypot(dx, dy)
            if r > R + 0.3:
                continue
            if r > R - 6:
                col = "orange" if math.sin(8 * (math.atan2(dy, dx) - ph)) > 0.35 else "gold"
                if dx + dy < -R * 0.6:
                    col = "amber" if col == "gold" else "gold"
                elif dx + dy > R * 0.8:
                    col = "rust" if col == "orange" else "orange"
            else:
                col = pick(["olive", "olive_deep"], 0.5 + (dx + dy) / (1.6 * R), x, y)
            put(im, x, y, col)
    for j in range(8):
        a = ph + j * math.pi / 4
        put(im, c + round(10 * math.cos(a)), c + round(10 * math.sin(a)), "gold")
    disc(im, c, c, 4, "gold")
    put(im, c - 1, c - 1, "sun")
    put(im, c, c, "ink")
    return outline(im)


def screen_text(w, h, seed):
    im = new(w, h)
    rect(im, 0, 0, w - 1, h - 1, "paper")
    rnd = random.Random(seed)
    rect(im, 6, 6, 6 + rnd.randrange(30, 56), 8, "ink")
    rect(im, 6, 11, w - 7, 11, "mist")
    for y in range(17, h - 12, 8):
        x, end = 6, w - 8 - (rnd.randrange(0, 40) if rnd.random() < .3 else 0)
        while True:
            wl = rnd.randrange(5, 20)
            if x + wl > end:
                break
            rect(im, x, y, x + wl - 1, y + 1, "ink")
            x += wl + 3
    rect(im, w - 22, h - 7, w - 8, h - 6, "slate")
    return im


def screen_frames(w, h):
    rnd = random.Random(5)
    dark = new(w, h)
    rect(dark, 0, 0, w - 1, h - 1, "ink")
    light = new(w, h)
    rect(light, 0, 0, w - 1, h - 1, "white")
    for _ in range(w * h // 12):
        x, y = rnd.randrange(w), rnd.randrange(h)
        put(dark, x, y, "slate")
        if rnd.random() < .3:
            put(light, x, y, "mist")
    a, b = screen_text(w, h, 1), screen_text(w, h, 2)
    return [a, a, a, dark, light, b, b, b, dark, light]


def dust_frames(w, h, n=8):
    rnd = random.Random(31)
    motes = [(rnd.randrange(6, w - 6), rnd.randrange(6, h - 6), rnd.randrange(2, 6), rnd.randrange(2, 6),
              rnd.randrange(n), rnd.randrange(n), rnd.choice(["sun", "white", "amber"])) for _ in range(16)]
    frames = []
    for f in range(n):
        im = new(w, h)
        for cx, cy, ax, ay, ph, bp, col in motes:
            if (f + bp) % n < 5:
                a = 2 * math.pi * (f + ph) / n
                put(im, cx + round(ax * math.sin(a)), cy + round(ay * math.cos(a)), col)
        frames.append(im)
    return frames


def glow_frames(g):
    R0 = g.halo
    c = R0 + 8
    sw, sh = 2 * c + 1, c + 4
    frames = []
    for dr in (0, 5, -3, 8):
        rf = R0 + dr
        im = new(sw, sh)
        for y in range(sh):
            for x in range(sw):
                d = math.hypot(x - c, y - 3)  # light falls below the shade only
                if d < 7 or d >= rf:
                    continue
                lit = 1 - d / rf
                if lit * 0.8 > (BAYER[y % 4][x % 4] + 0.5) / 16:
                    put(im, x, y, "sun" if lit > 0.55 else "amber")
        frames.append(im)
    return frames


def gear_frame(k):
    s, c = 21, 10
    im = new(s, s)
    ph = k * math.pi / 16
    for y in range(s):
        for x in range(s):
            dx, dy = x - c, y - c
            r = math.hypot(dx, dy)
            tooth = (math.atan2(dy, dx) - ph) % (math.pi / 4) < math.pi / 8
            if 2.5 < r <= (9.3 if tooth else 7):
                col = "sun" if dx + dy < -3 else "orange" if dx + dy > 4 else "gold"
                if r < 4.6:
                    col = "brown"
                put(im, x, y, col)
    return outline(im)


def wrench_frames():
    frames = []
    for a in (-14, -8, 0, 8, 14, 8, 0, -8):
        im = new(28, 38)
        t = math.radians(a)
        ex, ey = 14 + 26 * math.sin(t), 3 + 26 * math.cos(t)
        line(im, 14, 3, ex, ey, "mist")
        line(im, 15, 3, ex + 1, ey, "slate")
        disc(im, round(ex), round(ey), 4, "mist")
        for y in range(round(ey) - 2, round(ey) + 3):
            for x in range(round(ex) - 2, round(ex) + 3):
                if (x - ex) ** 2 + (y - ey) ** 2 <= 3:
                    im.putpixel((x, y), (0, 0, 0, 0))
        disc(im, 14, 3, 2, "gold")
        frames.append(outline(im))
    return frames


# --------------------------------------------------------------------- scene

def scene(variant):
    g = Geo(variant, **GEO[variant])
    back, hook = back_layer(g)
    layers = [
        Layer("wall", wall_layer(g), 0.0),
        Layer("back", back, 0.3),
        Layer("lamp", lamp_layer(g), 0.5),
        Layer("bench", bench_layer(g), 0.8),
        Layer("device", device_layer(g), 0.9),
        Layer("front", front_layer(g), 1.0),
    ]
    x0, y0, bw, B = g.x0, g.y0, g.bw, g.B
    R = WHEEL_R
    hc = g.halo + 8
    wf = thinker_frames()
    who = Sprite("who", wf, 5, g.wcx + R - 4 - 11, g.wcy - 11, 0.9)
    sprites = [
        Sprite("wrench", wrench_frames(), 8, hook[0] - 14, hook[1] - 3, 0.3),
        Sprite("glow", glow_frames(g), 6, g.lamp_x - hc, g.bulb_y - 3, 0.5),
        Sprite("screen", screen_frames(bw - 36, 74), 2.5, x0 + 18, y0 + 18, 0.9),
        Sprite("wheel_spin", [wheel_frame(k) for k in range(4)], 5, g.wcx - R - 1, g.wcy - R - 1, 0.9),
        Sprite("dust", dust_frames(bw + 40, 150), 4, x0 - 20, y0 - 30, 0.9),
        Sprite("gear", [gear_frame(k) for k in range(4)], 4, g.gear_x, B - 10, 0.9),
        who,
        Sprite("dog", cast.dog("watch"), 4, g.dog_x, B - 2, 0.9),
        Sprite("snail", cast.snail(), 3, x0 + 86, B + 2, 0.9),
    ]
    anchors = {"wheel": (g.wcx, g.wcy, 0.9), "page": (x0 + bw // 2, y0 + 55, 0.9)}
    tags = [
        ("screen", x0 + bw - 44, y0 + 78),
        ("wheel", g.wcx - 6, g.wcy),
        ("keys", x0 + 44, y0 + 119),
        ("body", x0 + 30, y0 + 170),
        ("port", x0 + bw // 2 - 1, y0 + 6),  # just under the gap between the two USB-C openings (inside the safe box)
        ("who", who.x + wf[0].width // 2, who.y + wf[0].height // 3, who.depth),
    ]
    return Scene("device", variant, g.w, g.h, layers, sprites, anchors, tags, tag_depth=0.9)  # the parts are on the device layer


SCENES = {"device": scene}
