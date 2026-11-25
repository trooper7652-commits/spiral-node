"""Scene 2: a close-up of Leonardo da Vinci, seen from behind, writing at a wooden desk by the window, a warm evening.

The cast here is drawn natively at the larger size (not scaled from the small cast).
"""
import math
import random
from functools import lru_cache

from ..draw import BAYER, disc, line, new, outline, paste, put, rect
from ..palette import PALETTE
from ..scene import SIZES, Layer, Scene, Sprite
from . import s3_shell
from .s1_countryside import bird_frames, cloud_frames, pick

# fy floor line, pcx page centre x, T back edge of the desk top, dx0/dx1 desk ends,
# ped pedestal x, candle x, ink inkwell x or None, win glass box, dogx, book stack (x, w),
# leg desk leg x or None, pic (x, y, w, h) or None, plant corner, reach of the candle light,
# snailx the snail's x on the sill
GEO = {
    "wide": dict(fy=278, pcx=340, T=212, dx0=172, dx1=472, ped=408, candle=250, ink=186,
                 win=(346, 56, 458, 176), dogx=252, books=(412, 52), leg=230, pic=(104, 64, 44, 56),
                 plant=(506, 296), reach=300, snailx=442),
    "tall": dict(fy=372, pcx=84, T=308, dx0=98, dx1=244, ped=204, candle=205, ink=None,
                 win=(72, 76, 168, 226), dogx=34, books=(208, 34), leg=None, pic=None,
                 plant=(192, 424), reach=270, snailx=150),
}
M = 8  # window frame thickness
LW, LH = 112, 128  # Leonardo's sprite
SHW, SHH = 104, 68  # the sheet on the writing board


class Geo:
    def __init__(self, variant, **kw):
        self.variant = variant
        self.w, self.h = SIZES[variant]
        self.__dict__.update(kw)
        self.pcy = self.T - 39                     # centre of the page
        self.tx, self.ty = self.pcx + 12, self.pcy - 26   # Leonardo's sprite corner
        self.cy0 = self.T + 5 - 46                 # candle sprite top
        self.lx, self.ly = self.candle - 1, self.cy0 + 8   # flame
        self.sill = self.win[3] + M                # first row of the sill
        self.rail = self.T - 14

    def light(self, x, y):
        return max(0.0, 1 - math.hypot(x - self.lx, (y - self.ly) * 1.2) / self.reach)


def box(im, x0, y0, x1, y1, c):
    rect(im, x0, y0, x1, y0, c)
    rect(im, x0, y1, x1, y1, c)
    rect(im, x0, y0, x0, y1, c)
    rect(im, x1, y0, x1, y1, c)


def ell(im, cx, cy, rx, ry, c):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                put(im, x, y, c)


def tline(im, x0, y0, x1, y1, w, c):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / n
        ell(im, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, w / 2, c)


# -------------------------------------------------------------------- layers

def sky_layer(g):
    im = new(g.w, g.h)
    x0, y0, x1, y1 = g.win
    ramp = ["navy", "dusk", "plum", "rust", "orange", "amber"]
    for y in range(y0 - 6, y1 + 7):
        for x in range(x0 - 6, x1 + 7):
            put(im, x, y, pick(ramp, (y - y0) / (y1 - y0), x, y))
    sx, sy = x0 + (x1 - x0) * 35 // 100, y1 - (y1 - y0) * 32 // 100
    disc(im, sx, sy, 15, "amber")
    disc(im, sx, sy, 12, "sun")
    disc(im, sx - 2, sy - 2, 5, "white")
    return im


def view_layer(g):
    """Two dark hills, a cottage with a lit window and pines, seen through the glass."""
    im = new(g.w, g.h)
    x0, y0, x1, y1 = g.win
    W, H = x1 - x0, y1 - y0

    def far(x):
        return y1 - H * 30 // 100 - round(9 * math.sin((x - x0) * 0.05 + 1) + 4 * math.sin((x - x0) * 0.14))

    def near(x):
        return y1 - H * 15 // 100 - round(6 * math.sin((x - x0) * 0.04 + 3) + 3 * math.sin((x - x0) * 0.12))

    for x in range(x0 - 6, x1 + 7):
        t = far(x)
        for y in range(t, y1 + 7):
            put(im, x, y, pick(["plum", "aubergine"], (y - t) / 50, x, y))
        put(im, x, t, "orange")
        put(im, x, t + 1, "rust")
        t = near(x)
        for y in range(t, y1 + 7):
            put(im, x, y, pick(["aubergine", "night"], (y - t) / 30, x, y))
        put(im, x, t, "rust")
    cx = x0 + W * 70 // 100
    yb = near(cx) + 3
    rect(im, cx - 8, yb - 12, cx + 8, yb, "night")
    for i in range(7):                                 # roof
        rect(im, cx - 10 + i, yb - 13 - i, cx + 10 - i, yb - 13 - i, "plum")
    rect(im, cx + 4, yb - 24, cx + 6, yb - 17, "night")   # chimney
    rect(im, cx - 4, yb - 8, cx - 1, yb - 4, "gold")
    rect(im, cx - 3, yb - 7, cx - 2, yb - 5, "sun")
    for px in (x0 + W * 14 // 100, x0 + W * 24 // 100, x0 + W * 90 // 100):
        pb = near(px) + 3
        for i in range(18):
            rect(im, px - i // 3, pb - 18 + i, px + i // 3, pb - 18 + i, "night")
        rect(im, px, pb, px, pb + 1, "night")
    return im


def wall_layer(g):
    im = new(g.w, g.h)
    ramp = ["umber", "bark", "brown", "tan"]
    for y in range(g.fy):
        for x in range(g.w):
            put(im, x, y, pick(ramp, 0.1 + 0.62 * g.light(x, y) + 0.1 * y / g.fy, x, y))
    rect(im, 0, 0, g.w - 1, 2, "umber")            # cornice
    rect(im, 0, 3, g.w - 1, 3, "bark")
    rect(im, 0, 4, g.w - 1, 4, "brown")
    rect(im, 0, 5, g.w - 1, 5, "umber")
    rail = g.rail                                  # wainscot
    rect(im, 0, rail, g.w - 1, rail, "tan")
    rect(im, 0, rail + 1, g.w - 1, rail + 1, "brown")
    rect(im, 0, rail + 2, g.w - 1, rail + 2, "umber")
    for y in range(rail + 3, g.fy - 12):
        for x in range(g.w):
            put(im, x, y, pick(["umber", "bark", "brown"], 0.08 + 0.55 * g.light(x, y), x, y))
    for px in range(6, g.w, 60):
        ya, yb = rail + 10, g.fy - 20
        rect(im, px, ya, px + 48, ya, "umber")
        rect(im, px, ya, px, yb, "umber")
        rect(im, px, yb, px + 48, yb, "brown")
        rect(im, px + 48, ya, px + 48, yb, "brown")
    rect(im, 0, g.fy - 12, g.w - 1, g.fy - 12, "tan")  # baseboard
    rect(im, 0, g.fy - 11, g.w - 1, g.fy - 2, "bark")
    rect(im, 0, g.fy - 1, g.w - 1, g.fy - 1, "umber")

    x0, y0, x1, y1 = g.win                         # window frame, glass cut out
    rect(im, x0 - M, y0 - M, x1 + M, y1 + M, "brown")
    rect(im, x0 - M, y0 - M, x1 + M, y0 - M + 1, "tan")
    rect(im, x0 - M, y0 - M, x0 - M + 1, y1 + M, "tan")
    rect(im, x1 + M - 1, y0 - M + 1, x1 + M, y1 + M, "bark")
    rect(im, x0 - M + 1, y1 + M - 1, x1 + M, y1 + M, "bark")
    box(im, x0 - M - 1, y0 - M - 1, x1 + M + 1, y1 + M + 1, "ink")
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            im.putpixel((x, y), (0, 0, 0, 0))
    box(im, x0 - 1, y0 - 1, x1 + 1, y1 + 1, "ink")
    xm, ym = (x0 + x1) // 2, y0 + (y1 - y0) * 2 // 5
    for d, c in ((-2, "tan"), (-1, "tan"), (0, "brown"), (1, "bark"), (2, "bark")):
        rect(im, xm + d, y0, xm + d, y1, c)
        rect(im, x0, ym + d, x1, ym + d, c)

    s = new(x1 - x0 + 2 * 20, 12)                  # sill
    sw = s.width
    rect(s, 1, 1, sw - 2, 2, "sand")
    rect(s, 1, 3, sw - 2, 6, "tan")
    rect(s, 1, 7, sw - 2, 8, "brown")
    rect(s, 1, 9, sw - 2, 10, "bark")
    paste(im, outline(s), x0 - 20, g.sill - 1)

    r = new(x1 - x0 + 2 * 28, 10)                  # curtain rod with finials
    rw = r.width
    rect(r, 1, 3, rw - 2, 4, "gold")
    rect(r, 1, 5, rw - 2, 5, "brown")
    for fx in (4, rw - 5):
        disc(r, fx, 4, 3, "gold")
        put(r, fx - 1, 3, "sun")
    paste(im, outline(r), x0 - 28, y0 - 24)

    if g.pic:
        draw_picture(im, *g.pic)
    return im


def draw_picture(im, px, py, w, h):
    p = new(w, h)
    rect(p, 1, 1, w - 2, h - 2, "gold")
    rect(p, 3, 3, w - 4, h - 4, "brown")
    rect(p, 6, 6, w - 7, h - 7, "sky_pale")
    rect(p, 6, 6, w - 7, h // 3, "sky")
    disc(p, w - 14, h // 3 + 2, 4, "sun")
    for x in range(6, w - 6):
        hy = h * 55 // 100 + round(4 * math.sin(x * 0.35))
        rect(p, x, hy, x, h - 7, "grass")
        put(p, x, hy, "leaf")
        rect(p, x, hy + 10, x, h - 7, "forest")
    paste(im, outline(p), px - 1, py - 1)


def room_layer(g):
    """Floor, shadows, the desk with its things, and the dog's small rug."""
    im = new(g.w, g.h)
    ramp = ["umber", "bark", "brown", "tan"]
    for y in range(g.fy, g.h):
        dy = y - g.fy
        r = dy // 14
        for x in range(g.w):
            if dy % 14 == 0 or (x + r * 37) % 96 == 0:
                put(im, x, y, "umber")
                continue
            t = 0.15 + 0.7 * g.light(x, y) - 0.15 * dy / (g.h - g.fy) + (0.12 if dy % 14 == 1 else 0)
            put(im, x, y, pick(ramp, t, x, y))
    rect(im, g.tx, g.fy + 1, g.dx1, g.fy + 5, "bark")     # soft shadow under chair and desk
    dcx, dcy = g.dogx + 28, g.fy + 4                      # the dog's small rug
    for y in range(dcy - 10, dcy + 11):
        for x in range(dcx - 42, dcx + 43):
            q = ((x - dcx) / 41) ** 2 + ((y - dcy) / 8) ** 2
            if q <= 1 and y > g.fy:
                put(im, x, y, "gold" if q > 0.78 else "plum")
    draw_desk(im, g)
    return im


def draw_desk(im, g):
    T, x0, x1, fy = g.T, g.dx0, g.dx1, g.fy
    for y in range(T, T + 10):                     # the top, seen from a little above
        for x in range(x0, x1 + 1):
            t = 0.28 + 0.55 * g.light(x, y) + 0.1 * (y - T) / 9
            put(im, x, y, pick(["brown", "tan", "sand"], t, x, y))
    for y, a, b in ((T + 2, 14, 90), (T + 5, 120, 230), (T + 7, 40, 150)):     # grain
        for x in range(x0 + a, min(x1 - 2, x0 + b)):
            if (x * 7 + y) % 5:
                put(im, x, y, "brown")
    rect(im, x0, T + 10, x1, T + 10, "sand")       # front edge
    rect(im, x0, T + 11, x1, T + 12, "tan")
    rect(im, x0, T + 13, x1, T + 21, "brown")
    rect(im, x0, T + 22, x1, T + 23, "bark")
    rect(im, x0, T + 24, x1, T + 24, "umber")
    box(im, x0 - 1, T - 1, x1 + 1, T + 25, "ink")
    rect(im, x0, T + 25, x1, T + 29, "umber")      # shadow over the knee space
    rect(im, x0, T + 25, x1, T + 25, "ink")
    if g.leg:
        lx = g.leg
        rect(im, lx - 1, T + 26, lx + 12, fy, "ink")
        rect(im, lx, T + 26, lx + 11, fy - 1, "bark")
        rect(im, lx, T + 26, lx + 3, fy - 1, "brown")
        rect(im, lx + 10, T + 26, lx + 11, fy - 1, "umber")
    p0 = g.ped                                     # pedestal with two drawers
    rect(im, p0 - 1, T + 25, x1, fy, "ink")
    rect(im, p0, T + 26, x1, fy - 1, "brown")
    rect(im, p0, T + 26, p0 + 2, fy - 1, "tan")
    rect(im, x1 - 3, T + 26, x1, fy - 1, "bark")
    n = (fy - 1 - (T + 30)) // 2
    for k in range(2):
        ya = T + 30 + k * n
        rect(im, p0 + 6, ya, x1 - 7, ya + n - 5, "tan")
        box(im, p0 + 6, ya, x1 - 7, ya + n - 5, "umber")
        rect(im, p0 + 6, ya + 1, x1 - 7, ya + 1, "sand")
        kx = (p0 + x1) // 2
        rect(im, kx - 3, ya + (n - 5) // 2, kx + 3, ya + (n - 5) // 2 + 2, "gold")
        rect(im, kx - 3, ya + (n - 5) // 2, kx - 2, ya + (n - 5) // 2, "sun")
    if g.ink:
        ix = g.ink                                 # inkwell with a spare quill
        rect(im, ix, T - 11, ix + 13, T + 3, "ink")
        rect(im, ix + 1, T - 10, ix + 12, T + 2, "night")
        rect(im, ix + 1, T - 10, ix + 12, T - 9, "navy")
        rect(im, ix + 2, T - 7, ix + 3, T - 4, "sky_pale")
        rect(im, ix + 3, T - 13, ix + 10, T - 12, "gold")
        line(im, ix + 9, T - 13, ix + 22, T - 30, "ink")
        line(im, ix + 10, T - 13, ix + 23, T - 30, "ink")
        line(im, ix + 10, T - 14, ix + 22, T - 30, "paper")
        for i in range(8):
            rect(im, ix + 17 + i // 2, T - 31 - i + 6, ix + 24 + i // 3, T - 31 - i + 6, "white")
    bx, bw = g.books                               # a stack of books on the pedestal end
    y = T + 6
    for k, (col, hh) in enumerate((("teal", 11), ("red", 10))):
        o = (0, 3, -2)[k]
        a, b = bx + o, bx + o + bw - 1 - (k * 4)
        rect(im, a, y - hh, b, y - 1, "ink")
        rect(im, a + 1, y - hh + 1, b - 1, y - 2, col)
        rect(im, a + 1, y - hh + 1, b - 1, y - hh + 1, "sand" if col != "gold" else "paper")
        rect(im, a + 4, y - hh + 3, a + 5, y - 3, "gold" if col != "gold" else "rust")
        rect(im, b - 4, y - hh + 2, b - 1, y - 2, "paper")
        y -= hh


def front_layer(g):
    im = new(g.w, g.h)
    for y in range(g.h):                           # flat umber and bark bands, dithered where they meet
        for x in range(g.w):
            d = min(x, g.w - 1 - x, g.h - 1 - y)
            if d < 3:
                put(im, x, y, "umber")
            elif d < 5:
                put(im, x, y, "umber" if (5 - d) / 2 > (BAYER[y % 4][x % 4] + 0.5) / 16 else "bark")
            elif d < 9:
                put(im, x, y, "bark")
            elif d < 11 and (11 - d) / 2 > (BAYER[y % 4][x % 4] + 0.5) / 16:
                put(im, x, y, "bark")
    px, py = g.plant
    c = new(48, 60)
    for a, ln in ((-70, 20), (-42, 27), (-16, 30), (8, 31), (34, 28), (62, 21)):
        tx = 24 + math.sin(math.radians(a)) * ln
        ty = 34 - math.cos(math.radians(a)) * ln
        line(c, 23, 34, tx - 1, ty, "forest")
        line(c, 24, 34, tx, ty, "grass")
        line(c, 25, 34, tx + 1, ty, "forest")
        put(c, round(tx), round(ty), "leaf")
        put(c, round(tx), round(ty) + 1, "leaf")
    rect(c, 10, 38, 37, 59, "rust")
    rect(c, 31, 38, 37, 59, "plum")
    rect(c, 8, 34, 39, 38, "orange")
    rect(c, 8, 37, 39, 38, "rust")
    paste(im, outline(c), px, py)
    return im


# --------------------------------------------------------------- close-up cast

LTIP = (18, 40)  # where the quill touches the page, in the sprite


def leonardo_big(f):
    """Seen from behind, a little to one side, writing with his left hand: red cap, long grey hair,
    sea-blue robe with a rust belt, on a chair with a high back."""
    b = (0, 0, 1, 0)[f]
    dx = (0, 2, 4, 2)[f]
    dy = (0, 1, 0, -1)[f]
    im = new(LW, LH)
    for px in (30, 101):                            # chair: posts, seat, legs
        rect(im, px, 62, px + 5, 125, "bark")
        rect(im, px, 62, px + 1, 125, "brown")
        rect(im, px + 5, 62, px + 5, 125, "umber")
        disc(im, px + 2, 60, 3, "gold")
        put(im, px + 1, 59, "sun")
    rect(im, 26, 106, 110, 112, "brown")
    rect(im, 26, 106, 110, 107, "tan")
    rect(im, 26, 112, 110, 112, "umber")
    for y in range(50, 108):                        # the robe; the shoulders rise and fall with his breath
        t = y - 50
        round_ = (3, 2, 1)[t] if t < 3 else 0
        l, r = round(41 - t * 0.12) + round_, round(96 + t * 0.12) - round_
        yy = y + (b if y < 90 else 0)
        rect(im, l, yy, r, yy, "sea")
        rect(im, r - 9, yy, r, yy, "navy")
    for fx, y0 in ((52, 66), (76, 62)):             # folds
        for y in range(y0, 108):
            if (y // 3) % 3:
                put(im, fx, y, "navy")
    rect(im, 40, 86, 98, 88, "rust")                # belt and its hanging end
    rect(im, 40, 86, 98, 86, "orange")
    rect(im, 68, 89, 71, 100, "rust")
    tline(im, 94, 58 + b, 101, 80, 11, "sea")       # the other elbow
    tline(im, 97, 58 + b, 103, 80, 4, "navy")
    for y in (70, 71, 72, 73):                      # back rail of the chair
        rect(im, 30, y, 106, y, "brown" if y > 70 else "tan")
    rect(im, 30, 74, 106, 74, "umber")
    # the writing arm: shoulder, elbow, wrist, hand with the quill
    hx, hy = LTIP[0] + dx + 5, LTIP[1] + dy + 8
    tline(im, 48, 58 + b, 38, 78, 12, "sea")
    tline(im, 52, 58 + b, 42, 78, 4, "navy")
    tline(im, 38, 78, hx + 4, hy + 8, 10, "sea")
    tline(im, 41, 78, hx + 7, hy + 8, 3, "navy")
    ell(im, hx + 4, hy + 8, 5, 3, "paper")          # cuff
    tline(im, hx - 3, hy - 4, hx + 8, hy - 20, 2, "white")   # feather
    tline(im, hx + 1, hy - 2, hx + 10, hy - 18, 3, "paper")
    line(im, hx - 3, hy - 4, LTIP[0] + dx, LTIP[1] + dy, "sand")      # shaft to the nib
    put(im, LTIP[0] + dx, LTIP[1] + dy, "ink")
    ell(im, hx, hy, 5, 4, "skin")                   # hand
    rect(im, hx + 1, hy + 2, hx + 4, hy + 4, "tan")
    put(im, hx - 4, hy - 1, "skin")
    # the head from behind: grey hair to the shoulders, the soft red cap
    hx0, hy0 = 65, 33 + b
    for y in range(hy0 - 18, hy0 + 28):
        for x in range(hx0 - 22, hx0 + 23):
            edge = 57 + b + round(2 * math.sin(x * 0.7))
            blob = ((x - hx0) / 15) ** 2 + ((y - hy0) / 15) ** 2 <= 1
            reach = 15 + max(0, y - (hy0 + 2)) * 6 // 20            # the hair spreads over the shoulders
            fall = abs(x - hx0) <= reach and hy0 <= y <= edge
            if blob or fall:
                s = (x * 3 + y // 3) % 7
                put(im, x, y, "white" if s == 0 else "sand" if s == 3 else "slate" if s == 5 and y > hy0 + 8 else "mist")
    ell(im, hx0 - 15, hy0 - 1, 2, 3, "skin")        # an ear on the side he turns to
    ell(im, hx0, hy0 - 15, 15, 9, "red")
    for y in range(hy0 - 20, hy0 - 6):
        for x in range(hx0 + 4, hx0 + 16):
            if ((x - hx0) / 15) ** 2 + ((y - (hy0 - 15)) / 9) ** 2 <= 1:
                put(im, x, y, "rust")
    rect(im, hx0 - 15, hy0 - 10, hx0 + 15, hy0 - 8, "rust")
    tline(im, hx0 - 8, hy0 - 22, hx0 - 20, hy0 - 16, 5, "red")   # the cap flops to one side
    put(im, hx0 - 20, hy0 - 15, "rust")
    rect(im, hx0 - 6, hy0 - 21, hx0 - 3, hy0 - 20, "orange")
    for x in range(LW):
        im.putpixel((x, 0), (0, 0, 0, 0))
        im.putpixel((x, LH - 1), (0, 0, 0, 0))
    return outline(im)


def leonardo_frames():
    return [leonardo_big(f) for f in range(4)]


def dog_big(f):
    """Asleep, curled, facing right: 60x34, drawn natively."""
    im = new(60, 34)
    up = 1 if f in (1, 2) else 0
    cy, ry = 22 - up, 10 + up
    for y in range(cy - ry, cy + ry + 1):
        for x in range(2, 49):
            if ((x - 25) / 23) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                put(im, x, y, "brown" if y < cy - ry * 0.4 else "sand" if y > cy + ry * 0.8 else "tan")
    ell(im, 14, 24, 10, 8, "brown")                 # haunch
    ell(im, 15, 25, 9, 7, "tan")
    ell(im, 20, 31, 6, 2, "sand")
    tline(im, 5, 21, 3, 28, 4, "brown")             # tail curls round to the belly
    tline(im, 3, 28, 11, 31, 4, "brown")
    put(im, 12, 31, "tan")
    ell(im, 46, 24, 9, 8, "tan")                    # head
    ell(im, 42, 21, 3, 6, "brown")                  # ear
    ell(im, 53, 27, 5, 4, "sand")
    rect(im, 56, 25, 57, 26, "ink")                 # nose
    rect(im, 47, 22, 51, 22, "ink")                 # closed eye
    ell(im, 49, 31, 7, 2, "sand")                   # paws
    return outline(im)


def snail_big(f):
    """About 24 px long; the shell spirals orange and gold."""
    im = new(26, 22)
    d = f
    ell(im, 10 + d // 2, 17, 10 + d, 4, "sand")
    rect(im, 4, 14, 14 + d, 14, "paper")
    tline(im, 17 + d, 16, 21 + d, 9, 5, "sand")
    ell(im, 22 + d, 8, 3, 3, "sand")
    for sx, lean in ((21 + d, -1), (24 + d, 1)):
        line(im, sx, 6, sx + lean * f, 2, "sand")
        put(im, sx + lean * f, 1, "ink")
    cx, cy = 9, 9
    for y in range(0, 19):
        for x in range(0, 20):
            dx, dy = x - cx, y - cy
            r = math.hypot(dx, dy)
            if r > 7.6:
                continue
            s = (r / 7.6 * 3.0 + math.atan2(dy, dx) / (2 * math.pi)) % 1
            c = "rust" if r < 1.6 else "orange" if s < 0.55 else "gold"
            if dx + dy > 0.8 * r + 4 and r > 5:
                c = "rust"
            put(im, x, y, c)
    return outline(im)


def candle_frames():
    frames = []
    prof = [0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 2, 2]
    for f in range(4):
        b = new(18, 48)
        rect(b, 5, 16, 12, 38, "white")
        rect(b, 10, 16, 12, 38, "paper")
        rect(b, 12, 16, 12, 38, "sand")
        rect(b, 6, 15, 11, 15, "sun")
        rect(b, 5, 21, 6, 27, "sand")
        rect(b, 11, 26, 11, 31, "sand")
        rect(b, 8, 12, 8, 14, "ink")
        rect(b, 2, 39, 15, 41, "gold")
        rect(b, 2, 39, 15, 39, "sun")
        rect(b, 3, 42, 14, 43, "brown")
        rect(b, 4, 44, 13, 44, "bark")
        b = outline(b)
        for x in range(18):
            b.putpixel((x, 47), (0, 0, 0, 0))
        lean, top = (0, 1, 0, -1)[f], (1, 2, 1, 0)[f]
        for i, hw in enumerate(prof):
            y = top + i
            cx = 8 + round(lean * (11 - i) / 11 * 1.5)
            rect(b, cx - hw, y, cx + hw, y, "orange")
            if hw >= 2:
                rect(b, cx - hw + 1, y, cx + hw - 1, y, "amber")
            if hw >= 3 and i >= 6:
                rect(b, cx - 1, y, cx + 1, y, "sun")
            if i in (8, 9, 10):
                put(b, cx, y, "white")
        frames.append(b)
    return frames


# The join zooms the page SKETCH_ZOOM times onto scene 3's ink picture (MAX_ZOOM in lib/world/joins.ts), so the sheet
# is that picture at 1/SKETCH_ZOOM size, the shell on cell SHELL_CELL of the sheet.
SKETCH_ZOOM = 4
SHELL_CELL = {"wide": (58, 52), "tall": (50, 57)}


@lru_cache(maxsize=None)
def shell_twin(variant):
    """Scene 3's ink picture and where its shell sits: what the sketch copies."""
    s = s3_shell.scene(variant)
    return s.ink, s.anchors["spiral"][:2]


def sketch_cells(variant):
    """The sheet's ink cells (over its paper part): a cell is ink when its block of scene 3's ink holds at least two ink pixels."""
    ink, (sx, sy) = shell_twin(variant)
    ci, cj = SHELL_CELL[variant]
    z = SKETCH_ZOOM
    px = ink.load()
    for j in range(SHH - 3):
        for i in range(SHW - 3):
            x0, y0 = sx + z * (i - ci), sy + z * (j - cj)
            n = sum(px[x, y][:3] == PALETTE["ink"] for y in range(max(0, y0), min(ink.height, y0 + z))
                    for x in range(max(0, x0), min(ink.width, x0 + z)))
            if n >= 2:
                yield i, j


def paper_frames(g):
    """The writing board with its sheet (the centre of the sheet is the page anchor): an ink sketch that is a small
    copy of scene 3's own ink picture (horizon, shoreline, the shell and the things beside it), the same on every frame."""
    im = new(120, 84)
    rect(im, 0, 0, 119, 77, "brown")            # the board and its ledge
    rect(im, 0, 0, 119, 1, "tan")
    rect(im, 0, 0, 1, 77, "tan")
    rect(im, 118, 2, 119, 77, "bark")
    rect(im, 0, 76, 119, 77, "bark")
    rect(im, 0, 78, 119, 83, "brown")
    rect(im, 0, 78, 119, 78, "tan")
    rect(im, 0, 83, 119, 83, "umber")
    rect(im, 6, 4, 113, 75, "ink")
    rect(im, 7, 5, 112, 74, "sand")
    rect(im, 8, 6, 8 + SHW - 1, 6 + SHH - 1, "paper")
    rect(im, 8 + SHW - 3, 6, 8 + SHW - 1, 6 + SHH - 1, "sand")      # the sheet's right and lower edge
    rect(im, 8, 6 + SHH - 3, 8 + SHW - 1, 6 + SHH - 1, "sand")
    for i, j in sketch_cells(g.variant):
        put(im, 8 + i, 6 + j, "ink")
    return [im]


def glow_frames(R):
    frames = []
    for reach in (R - 4, R, R - 7, R - 2):
        im = new(2 * R, 2 * R)
        for y in range(2 * R):
            for x in range(2 * R):
                d = math.hypot(x - R, y - R)
                if d < 6 or d >= reach:
                    continue
                gl = 1 - d / reach
                if gl * 0.9 > (BAYER[y % 4][x % 4] + 0.5) / 16:
                    put(im, x, y, "sun" if gl > 0.55 else "amber")
        frames.append(im)
    return frames


def mote_frames():
    rnd = random.Random(6)
    w, h, n = 110, 90, 8
    motes = [(rnd.randrange(8, w - 8), rnd.randrange(6, h - 6), rnd.randrange(2, 7),
              rnd.randrange(2, 7), rnd.randrange(1, 3), rnd.randrange(n)) for _ in range(12)]
    frames = []
    for f in range(n):
        im = new(w, h)
        for cx, cy, ax, ay, k, ph in motes:
            a = 2 * math.pi * (k * f + ph) / n
            if (f + ph) % 4 != 3:
                put(im, cx + round(ax * math.sin(a)), cy + round(ay * math.cos(a)),
                    "white" if (f + ph) % 4 == 0 else "sun")
        frames.append(im)
    return frames


def curtain_frames(h, flip):
    pleat = ["plum", "rust", "red", "red", "rust", "plum", "plum", "rust", "red", "red", "rust",
             "plum", "plum", "plum"]
    frames = []
    for f in range(4):
        im = new(22, h)
        for y in range(h):
            off = round(3 * (y / h) ** 2 * math.sin(2 * math.pi * f / 4 + (1.3 if flip else 0)))
            for i in range(14):
                if y < 3:
                    c = "bark"
                elif y >= h - 2:
                    c = "aubergine"
                else:
                    c = pleat[i]
                put(im, 4 + off + i, y, c)
        frames.append(outline(im))
    return frames


def star_frames(g):
    x0, y0, x1, y1 = g.win
    w, h = x1 - x0 + 1, (y1 - y0) * 5 // 12
    rnd = random.Random(2)
    stars = [(rnd.randrange(3, w - 3), rnd.randrange(3, h - 3), rnd.randrange(3), rnd.random() < 0.2)
             for _ in range(14)]
    frames = []
    for f in range(3):
        im = new(w, h)
        for x, y, ph, big in stars:
            lvl = (f + ph) % 3
            put(im, x, y, ("slate", "mist", "white")[lvl])
            if big and lvl == 2:
                for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    put(im, x + dx, y + dy, "mist")
        frames.append(im)
    return frames


# --------------------------------------------------------------------- scene

def scene(variant):
    g = Geo(variant, **GEO[variant])
    x0, y0, x1, y1 = g.win
    xm = (x0 + x1) // 2
    layers = [
        Layer("sky", sky_layer(g), 0.0),
        Layer("view", view_layer(g), 0.15),
        Layer("wall", wall_layer(g), 0.35),
        Layer("room", room_layer(g), 0.8),
        Layer("front", front_layer(g), 1.0),
    ]
    rnd = random.Random(8)
    ch = y1 - y0 + 2 * M + 20
    cw = 50 if variant == "wide" else 40
    sprites = [
        Sprite("stars", star_frames(g), 2, x0, y0, 0.0),
        Sprite("cloud", cloud_frames(cw, ["sun", "amber", "orange", "rust"], rnd, 8), 2, x0 + 8, y0 + (y1 - y0) // 5, 0.0),
        Sprite("birds", bird_frames("ink"), 8, x0 + 12, y0 + 40, 0.0),
        Sprite("curtain_l", curtain_frames(ch, False), 3, x0 - M - 12, y0 - 20, 0.35),
        Sprite("curtain_r", curtain_frames(ch, True), 3, x1 + M - 12, y0 - 20, 0.35),
        Sprite("snail", [snail_big(0), snail_big(1)], 2, g.snailx, g.sill - 20, 0.35),
        Sprite("glow", glow_frames(60), 6, g.lx - 60, g.ly - 60, 0.8),
        Sprite("motes", mote_frames(), 4, g.lx - 55, g.ly - 55, 0.8),
        Sprite("paper", paper_frames(g), 4, g.pcx - 60, g.pcy - 40, 0.8),
        Sprite("dog", [dog_big(f) for f in range(4)], 3, g.dogx, g.fy - 34, 0.8),
        Sprite("candle", candle_frames(), 8, g.candle - 9, g.cy0, 0.8),
        Sprite("who", leonardo_frames(), 4, g.tx, g.ty, 0.8),
    ]
    page = (g.pcx, g.pcy, 0.8)
    ci, cj = SHELL_CELL[variant]                    # the sketch's shell: the join zooms in on it and lands on scene 3's shell
    anchors = {"slate": page, "page": page, "centre": (g.lx, g.ly, 0.8), "sketch_shell": (g.pcx - 52 + ci, g.pcy - 34 + cj, 0.8)}
    tags = [("who", g.tx + 66, g.ty + 62, 0.8)]
    return Scene("desk", variant, g.w, g.h, layers, sprites, anchors, tags=tags)


SCENES = {"desk": lambda v: scene(v)}
