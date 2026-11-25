"""Scene 0, the opening: the Spiral Node device lying on a sheet of paper. Scrolling plays its screen powering on."""
import math
import random

from .. import cast
from ..draw import BAYER, new, outline, paste, put, rect
from ..scene import SIZES, Layer, Scene, Sprite
from .s1_countryside import pick, rng_hash
from .s4_device import LIGHT_DX, WHEEL_R, Geo, device_layer, rrect, wheel_frame

# Device top-left and body size (the same device as scene 4), then the paper sheet (x0, y0, x1, y1), the sticky note,
# the pencil, the snail, the coffee ring and the spiral doodle. Everything stays out of the way of the centre.
GEO = {
    "wide": dict(x0=198, y0=82, bw=180, bh=184, paper=(44, 24, 532, 336), note=(92, 44), pencil=(402, 276),
                 snail=(150, 250), ring=(470, 96), doodle=(84, 300)),
    "tall": dict(x0=45, y0=150, bw=150, bh=184, paper=(10, 60, 230, 420), note=(22, 72), pencil=(112, 372),
                 snail=(40, 350), ring=(190, 104), doodle=(46, 392)),
}
SCREEN_H = 74
FRAMES = 13  # the screen: 2 off, a blink, a flash, blank, the first line, a rule, then six lines of text


# ------------------------------------------------------------------- layers

def table_layer(g):
    im = new(g.w, g.h)
    cx, cy = g.w / 2, g.h / 2
    for y in range(g.h):
        p = y // 24
        for x in range(g.w):
            if y % 24 == 0:
                put(im, x, y, "ink")
            elif (x + 61 * p) % 170 == 0:
                put(im, x, y, "umber")  # the plank's end joint
            else:
                d = math.hypot((x - cx) / cx, (y - cy) / cy) / 1.4  # lighter in the middle of the table
                t = 0.15 + 0.7 * d + (rng_hash(p, x // 31) - 0.5) * 0.25
                put(im, x, y, pick(["brown", "bark", "umber"], t, x, y))
    return im


def paper_layer(g):
    x0, y0, x1, y1 = g.paper
    sw, sh = x1 - x0 + 1, y1 - y0 + 1
    im = new(g.w, g.h)
    rect(im, x0 + 5, y0 + 6, x1 + 5, y1 + 6, "umber")  # the sheet's shadow on the table
    sheet = new(sw + 2, sh + 2)
    rect(sheet, 1, 1, sw, sh, "paper")
    for y in range(1, sh + 1):  # a faint warm shade toward the lower right, dithered
        for x in range(1, sw + 1):
            t = (x / sw + y / sh) / 2 - 0.55
            if t > 0 and t * 0.9 > (BAYER[y % 4][x % 4] + 0.5) / 16:
                put(sheet, x, y, "sand")
    dev = (g.x0 - 14 - x0, g.y0 - 10 - y0, g.x0 + g.bw + 14 - x0, g.y0 + g.bh + 20 - y0)  # in sheet coordinates
    rows = list(range(22, sh - 6, 12))
    for ry in rows:
        rect(sheet, 3, ry, sw - 2, ry, "sky_pale")
    rect(sheet, 26, 3, 26, sh - 3, "rust")  # the margin line
    for i, ry in enumerate(rows):  # pencil notes along the lines, clear of the device
        rnd = random.Random(40 + i)
        x = 32
        while x < sw - 14:
            wl = rnd.randrange(5, 17)
            hit = dev[1] <= ry - 3 <= dev[3] and x + wl >= dev[0] and x <= dev[2]
            if not hit and rnd.random() < 0.8 and i % 5 != 4:
                rect(sheet, x, ry - 3, min(x + wl, sw - 8), ry - 3, "slate")
            x += wl + 4
    t = 0.0  # a spiral doodle
    ox, oy = g.doodle[0] - x0, g.doodle[1] - y0
    while t < 4 * math.pi:
        r = 1.2 + t * 0.62
        put(sheet, round(ox + r * math.cos(t)), round(oy + r * math.sin(t)), "slate")
        t += 0.08
    ox, oy = g.ring[0] - x0, g.ring[1] - y0  # a coffee ring with a gap
    for k in range(360):
        a = math.radians(k)
        if 40 < k < 80:
            continue
        for r in (12, 13):
            put(sheet, round(ox + r * math.cos(a)), round(oy + r * math.sin(a)), "tan")
    paste(im, outline(sheet), x0 - 1, y0 - 1)
    return im


def pencil_img():
    pw, ph = 60, 7
    p = new(pw, ph + 6)
    rect(p, 0, 0, 5, ph - 1, "red")
    rect(p, 0, 0, 5, 0, "rust")
    rect(p, 6, 0, 8, ph - 1, "mist")
    rect(p, 7, 0, 7, ph - 1, "slate")
    for j, c in enumerate(["sun", "gold", "gold", "gold", "gold", "orange", "rust"]):
        rect(p, 9, j, 48, j, c)
    for x in range(49, 59):
        half = 3 - (x - 49) * 3 // 10
        for j in range(3 - half, 4 + half):
            put(p, x, j, "ink" if x >= 55 else "sand")
    out = new(pw, ph + 6)
    for x in range(pw):  # lies at a slant: each column sits a little lower than the last
        for y in range(ph):
            out.putpixel((x, y + x // 12), p.getpixel((x, y)))
    return outline(out)


def note_img():
    n = new(36, 34)
    rect(n, 0, 0, 35, 33, "sun")
    rect(n, 0, 0, 35, 1, "white")
    rect(n, 0, 30, 35, 33, "amber")
    for y, wl in ((8, 24), (13, 18), (18, 22), (23, 12)):
        rect(n, 5, y, 5 + wl, y, "rust")
    return outline(n)


def props_layer(g):
    im = new(g.w, g.h)
    paste(im, note_img(), *g.note)
    paste(im, pencil_img(), *g.pencil)
    return im


def shadow_layer(g):
    im = new(g.w, g.h)
    for dx, dy, c in ((7, 8, "tan"), (4, 5, "brown")):  # the lower right of the device, in two steps
        rrect(im, g.x0 + dx, g.y0 + dy, g.bw, g.bh, 14, c)
    return im


def device_img(g):
    im = device_layer(g, stool=False)
    paste(im, wheel_frame(0), g.wcx - WHEEL_R - 1, g.wcy - WHEEL_R - 1)  # the wheel at rest
    return im


def front_layer(g):
    im = new(g.w, g.h)
    cx, cy = g.w / 2, g.h / 2
    for y in range(g.h):
        for x in range(g.w):
            t = (math.hypot((x - cx) / cx, (y - cy) / cy) / 1.414 - 0.62) / 0.38  # a dithered dark vignette
            if t > 0 and t > (BAYER[y % 4][x % 4] + 0.5) / 16:
                put(im, x, y, "ink" if t > 0.6 else "umber")
    return im


# ------------------------------------------------------------------- sprites

def _row(im, y, w, seed):
    rnd = random.Random(seed)
    x, end = 6, w - 8 - (rnd.randrange(0, 40) if rnd.random() < 0.3 else 0)
    while True:
        wl = rnd.randrange(5, 20)
        if x + wl > end:
            return
        rect(im, x, y, x + wl - 1, y + 1, "ink")
        x += wl + 3


def screen_frames(w, h):
    rnd = random.Random(5)

    def flat(c):
        im = new(w, h)
        rect(im, 0, 0, w - 1, h - 1, c)
        return im

    off = flat("mist")  # an e-ink screen with no power: dull grey
    for y in range(h):
        for x in range(w):
            if (BAYER[y % 4][x % 4]) < 3:
                put(off, x, y, "slate")
    blink, flash = flat("ink"), flat("white")
    for _ in range(w * h // 12):
        x, y = rnd.randrange(w), rnd.randrange(h)
        put(blink, x, y, "slate")
        if rnd.random() < 0.3:
            put(flash, x, y, "mist")
    page = flat("paper")
    frames = [off, off, blink, flash, page]
    title = page.copy()
    rect(title, 6, 6, 6 + random.Random(1).randrange(30, 56), 8, "ink")
    frames.append(title)
    rule = title.copy()
    rect(rule, 6, 11, w - 7, 11, "mist")
    frames.append(rule)
    ys = list(range(17, h - 12, 8))
    cur = rule
    for i, y in enumerate(ys):
        cur = cur.copy()
        _row(cur, y, w, 200 + i)
        frames.append(cur)
    rect(cur, w - 22, h - 7, w - 8, h - 6, "slate")  # the last frame also has the page mark
    assert len(frames) == FRAMES, len(frames)
    return frames


def led_frames():
    out = []
    for hi in ("sun", "white"):
        im = new(2, 2)
        rect(im, 0, 0, 1, 1, "orange")
        put(im, 0, 0, hi)
        out.append(im)
    return out


# --------------------------------------------------------------------- scene

def scene(variant):
    w, h = SIZES[variant]
    g = Geo(variant, **GEO[variant])
    layers = [
        Layer("table", table_layer(g), 0.0),
        Layer("paper", paper_layer(g), 0.35),
        Layer("props", props_layer(g), 0.5),
        Layer("shadow", shadow_layer(g), 0.85),
        Layer("device", device_img(g), 0.9),
        Layer("front", front_layer(g), 1.0),
    ]
    sprites = [
        Sprite("led", led_frames(), 1.5, g.x0 + g.bw // 2 + LIGHT_DX + 1, g.y0, 0.9),  # over the top edge's charge light
        Sprite("screen", screen_frames(g.bw - 36, SCREEN_H), 1, g.x0 + 18, g.y0 + 18, 0.9, "scrub"),
        Sprite("snail", cast.snail(), 3, g.snail[0], g.snail[1], 0.35),
    ]
    # the screen's middle (the camera pushes through it into scene 1) and the middle of the scene
    anchors = {"screen": (g.x0 + g.bw // 2, g.y0 + 18 + SCREEN_H // 2, 0.9), "centre": (w // 2, h // 2)}
    return Scene("opening", variant, w, h, layers, sprites, anchors, [])


SCENES = {"opening": scene}
