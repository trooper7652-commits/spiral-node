from PIL import Image

from .palette import rgba

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def new(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def put(im, x, y, c):
    if 0 <= x < im.width and 0 <= y < im.height:
        im.putpixel((x, y), rgba(c))


def rect(im, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(im, x, y, c)


def disc(im, cx, cy, r, c):
    for y in range(cy - r - 1, cy + r + 2):
        for x in range(cx - r - 1, cx + r + 2):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6:
                put(im, x, y, c)


def line(im, x0, y0, x1, y1, c):
    x0, y0, x1, y1 = round(x0), round(y0), round(x1), round(y1)
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        put(im, x0, y0, c)
        if x0 == x1 and y0 == y1:
            return
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def dither(im, box, ramp, t):
    x0, y0, x1, y1 = box
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = max(0.0, min(0.99999, t(x, y))) * (len(ramp) - 1)
            i = int(p)
            up = p - i > (BAYER[y % 4][x % 4] + 0.5) / 16
            put(im, x, y, ramp[i + 1] if up else ramp[i])


def sprite(rows, key):
    width = len(rows[0])
    if any(len(r) != width for r in rows):
        raise ValueError(f"Ragged rows: expected width {width}")
    im = new(width, len(rows))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in key:
                put(im, x, y, key[ch])
    return im


def outline(im):
    out = im.copy()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            if im.getpixel((x, y))[3] == 0 and any(
                0 <= nx < w and 0 <= ny < h and im.getpixel((nx, ny))[3] > 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            ):
                out.putpixel((x, y), (28, 26, 20, 255))
    return out


def paste(dst, src, x, y):
    dst.paste(src, (x, y), src.getchannel("A").point(lambda a: 255 if a else 0))
