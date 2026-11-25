"""Every screen drawn as a 250x122 1-bit image (1 = white, 0 = black ink)."""
import math
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from .config import FONT_SIZES, SCREEN_H, SCREEN_W, TOP_BAR_H
from .scripts_api import Page

ASSETS = Path(__file__).parent / "assets"
PAD = 4
ROW_H = 14
PICKER_ROW_H = 20
BTN_H = 16
BODY_TOP = TOP_BAR_H + 1


@dataclass
class TopBar:
    now: datetime
    saving: bool
    battery: int | None


@lru_cache(maxsize=None)
def _font(size: int):
    return ImageFont.load_default(size=size)


_MEASURE = ImageDraw.Draw(Image.new("1", (1, 1)))


def _w(font, text: str) -> int:
    """Ink width as actually drawn in 1-bit mode (font.getlength underestimates it)."""
    return _MEASURE.textbbox((0, 0), text, font=font)[2]


def _line_h(font) -> int:
    a, d = font.getmetrics()
    return a + d + 1


def format_clock(t: datetime) -> str:
    h = t.hour % 12 or 12
    return f"{h}:{t.minute:02d}{'PM' if t.hour >= 12 else 'AM'}"


def _wrap(text: str, font, width: int) -> list[str]:
    lines: list[str] = []
    for para in text.split("\n"):
        cur = ""
        for word in para.split():
            while _w(font, word) > width:  # hard-break an over-long word
                n = len(word)
                while n > 1 and _w(font, word[:n]) > width:
                    n -= 1
                if cur:
                    lines.append(cur)
                    cur = ""
                lines.append(word[:n])
                word = word[n:]
            trial = f"{cur} {word}" if cur else word
            if cur and _w(font, trial) > width:
                lines.append(cur)
                cur = word
            else:
                cur = trial
        lines.append(cur)  # empty for blank paragraphs
    return lines


def _ellipsize(line: str, font, width: int) -> str:
    line = line.rstrip()
    while line and _w(font, line + "…") > width:
        line = line[:-1].rstrip()
    return line + "…"


def fit_text(text: str, width: int, height: int):
    for size in FONT_SIZES:
        font = _font(size)
        lines = _wrap(text, font, width)
        if len(lines) * _line_h(font) <= height:
            return font, lines
    n = max(0, height // _line_h(font))
    lines = lines[:n]
    if lines:
        lines[-1] = _ellipsize(lines[-1], font, width)
    return font, lines


def _spiral_points(cx, cy, r, turns, n):
    return [
        (cx + r * (k / n) * math.cos(turns * 2 * math.pi * k / n),
         cy + r * (k / n) * math.sin(turns * 2 * math.pi * k / n))
        for k in range(n + 1)
    ]


def _asset(name: str):
    p = ASSETS / name
    return Image.open(p).convert("1") if p.exists() else None


def _logo(im, cx, cy, r, frac=1.0, width=1):
    """Draw the logo centred at (cx, cy) with radius r; frac < 1 draws part of it."""
    png = _asset("logo-12.png" if r <= 8 else "logo-large.png")
    if png:
        w = max(1, int(png.width * frac))
        im.paste(png.crop((0, 0, w, png.height)), (cx - png.width // 2, cy - png.height // 2))
        return
    pts = _spiral_points(cx, cy, r, 3 if r > 8 else 2.5, 200 if r > 8 else 40)
    ImageDraw.Draw(im).line(pts[: max(2, int(len(pts) * frac))], fill=0, width=width)


def _new():
    im = Image.new("1", (SCREEN_W, SCREEN_H), 1)
    return im, ImageDraw.Draw(im)


def _save_icon(d, x, y, saving):
    """11x11 icon at (x, y): check mark, or a circle with two arrowheads."""
    if saving:
        d.arc((x, y, x + 10, y + 10), 0, 360, fill=0)
        d.polygon([(x + 5, y - 1), (x + 5, y + 3), (x + 8, y + 1)], fill=0)
        d.polygon([(x + 5, y + 11), (x + 5, y + 7), (x + 2, y + 9)], fill=0)
    else:
        d.line([(x, y + 5), (x + 3, y + 9), (x + 10, y + 1)], fill=0, width=2)


def _top_bar(im, d, bar: TopBar):
    _logo(im, 6, 5, 6)
    f = _font(10)
    t = format_clock(bar.now)
    d.text(((SCREEN_W - _w(f, t)) / 2, 0), t, font=f, fill=0)
    right = SCREEN_W - 1
    if bar.battery is not None:
        s = f"{bar.battery}%"
        right -= int(_w(f, s))
        d.text((right, 0), s, font=f, fill=0)
        right -= 3
    _save_icon(d, right - 11, 0, bar.saving)
    d.line([(0, TOP_BAR_H - 1), (SCREEN_W, TOP_BAR_H - 1)], fill=0)


def _screen(bar):
    im, d = _new()
    if bar:
        _top_bar(im, d, bar)
    return im, d


def _centered(d, lines, font, top, height):
    lh = _line_h(font)
    y = top + max(0, (height - len(lines) * lh) // 2)
    for line in lines:
        d.text(((SCREEN_W - _w(font, line)) / 2, y), line, font=font, fill=0)
        y += lh


def _draw_lines(d, lines, font, x, y):
    for line in lines:
        d.text((x, y), line, font=font, fill=0)
        y += _line_h(font)


def _inverted_text(d, x0, y0, x1, y1, text, font, invert, outline=False):
    """Text centred in a box; black fill with white ink when inverted."""
    if invert:
        d.rectangle((x0, y0, x1, y1), fill=0)
    elif outline:
        d.rectangle((x0, y0, x1, y1), outline=0)
    w = _w(font, text)
    h = _line_h(font) - 1
    d.text((x0 + (x1 - x0 + 1 - w) / 2, y0 + (y1 - y0 + 1 - h) / 2 - 1), text, font=font, fill=1 if invert else 0)


def _buttons(d, labels, selected, y_bottom, outlined=None):
    """Right-aligned button row; selected index is inverted, outlined (default all) get a box."""
    f = _font(12)
    x = SCREEN_W - PAD
    for i in range(len(labels) - 1, -1, -1):
        w = int(_w(f, labels[i])) + 12
        _inverted_text(d, x - w, y_bottom - BTN_H + 1, x, y_bottom, labels[i], f, i == selected,
                       outline=outlined is None or i in outlined)
        x -= w + 4


def _page_top() -> int:
    """Y of the first body row, under the title rule."""
    return BODY_TOP + _line_h(_font(12)) + 1 + 3


def picture_max_h() -> int:
    return SCREEN_H - _page_top() - 1


def _row_w(labels) -> int:
    """Width of the button row as _buttons lays it out."""
    return sum(int(_w(_font(12), c)) + 12 for c in labels) + 4 * max(0, len(labels) - 1)


def _page_box(page: Page):
    """(top, x, width, height, pic_h): body area and the tallest picture, shared by page_screen and page_fits."""
    top = _page_top()
    x, width = PAD, SCREEN_W - 2 * PAD
    height = SCREEN_H - top - 1 - (BTN_H + 5 if page.choices else 0)
    pic_h = height
    if page.picture:
        x = 2 * PAD + len(page.picture[0])
        width = SCREEN_W - 3 * PAD - len(page.picture[0])
        if SCREEN_W - PAD - _row_w(page.choices) > x:  # the button row stays right of the picture
            pic_h = SCREEN_H - top - 1
    return top, x, width, height, pic_h


def page_fits(page: Page) -> bool:
    """True when page_screen draws the whole page: no ellipsis, no cut-off word or picture, buttons inside the screen."""
    top, x, width, height, pic_h = _page_box(page)
    title = " ".join(page.title.split())
    if not (_w(_font(12), title) <= SCREEN_W - 2 * PAD and len(page.picture) <= pic_h
            and _row_w(page.choices) <= SCREEN_W - 2 * PAD):
        return False
    for size in FONT_SIZES:  # the size fit_text picks: the first that fits the height
        font = _font(size)
        if len(_wrap(page.body, font, width)) * _line_h(font) <= height:
            return all(_w(font, word) <= width for word in page.body.split())
    return False


def page_screen(page: Page, bar: TopBar, cursor=None, picked=None):
    """cursor: waiting page, that button inverted and the rest boxed; picked: only that button boxed; else plain."""
    im, d = _screen(bar)
    tf = _font(12)
    d.text((PAD, BODY_TOP + 1), _ellipsize(page.title, tf, SCREEN_W - 2 * PAD) if _w(tf, page.title) > SCREEN_W - 2 * PAD else page.title, font=tf, fill=0)
    ty = BODY_TOP + _line_h(tf) + 1
    d.line([(PAD, ty), (SCREEN_W - PAD, ty)], fill=0)
    top, x, width, height, _ = _page_box(page)
    for y, row in enumerate(page.picture):
        for px, c in enumerate(row):
            if c == "#":
                im.putpixel((PAD + px, top + y), 0)
    font, lines = fit_text(page.body, width, height)
    _draw_lines(d, lines, font, x, top)
    if page.choices:
        _buttons(d, page.choices, cursor, SCREEN_H - 2, None if cursor is not None else {picked})
    return im


def message_screen(text: str, bar: TopBar):
    im, d = _screen(bar)
    h = SCREEN_H - BODY_TOP
    font, lines = fit_text(text, SCREEN_W - 2 * PAD, h)
    _centered(d, lines, font, BODY_TOP, h)
    return im


def list_screen(items, highlight: int, bar: TopBar):
    im, d = _screen(bar)
    f = _font(12)
    rows = (SCREEN_H - BODY_TOP) // ROW_H
    first = max(0, highlight - rows + 1)
    for r, item in enumerate(items[first : first + rows]):
        y = BODY_TOP + r * ROW_H
        on = first + r == highlight
        if on:
            d.rectangle((0, y, SCREEN_W - 1, y + ROW_H - 1), fill=0)
        d.text((PAD, y + 1), _ellipsize(item, f, SCREEN_W - 2 * PAD) if _w(f, item) > SCREEN_W - 2 * PAD else item, font=f, fill=1 if on else 0)
    return im


def prefs_screen(name: str, rows, buttons, focus: int, bar: TopBar):
    """rows are (label, value); the value is drawn as "< value >"."""
    im, d = _screen(bar)
    f = _font(12)
    d.text((PAD, BODY_TOP + 1), name, font=f, fill=0)
    d.line([(PAD, BODY_TOP + 15), (SCREEN_W - PAD, BODY_TOP + 15)], fill=0)
    y = BODY_TOP + 18
    for i, (label, value) in enumerate(rows):
        on = i == focus
        if on:
            d.rectangle((0, y, SCREEN_W - 1, y + ROW_H - 1), fill=0)
        ink = 1 if on else 0
        v = f"< {value} >"
        d.text((PAD, y + 1), label, font=f, fill=ink)
        d.text((SCREEN_W - PAD - _w(f, v), y + 1), v, font=f, fill=ink)
        y += ROW_H
    _buttons(d, buttons, focus - len(rows), SCREEN_H - 2)
    return im


def dialog_screen(text: str, buttons, selected: int, bar: TopBar):
    im, d = _screen(bar)
    h = SCREEN_H - BODY_TOP - BTN_H - 6
    font, lines = fit_text(text, SCREEN_W - 2 * PAD, h)
    _centered(d, lines, font, BODY_TOP, h)
    _buttons(d, buttons, selected, SCREEN_H - 2)
    return im


def picker_screen(title: str, typed: str, rows, r: int, c: int, bar: TopBar):
    """Letter grid: the title and what is typed so far, then the rows of cells; cell (r, c) inverted."""
    im, d = _screen(bar)
    f = _font(12)
    head = f"{title}: {typed}_"
    d.text((PAD, BODY_TOP + 1), _ellipsize(head, f, SCREEN_W - 2 * PAD) if _w(f, head) > SCREEN_W - 2 * PAD else head,
           font=f, fill=0)
    ty = BODY_TOP + _line_h(f) + 1
    d.line([(PAD, ty), (SCREEN_W - PAD, ty)], fill=0)
    cw = (SCREEN_W - 2 * PAD) // max(len(row) for row in rows)
    for ri, row in enumerate(rows):
        y = ty + 4 + ri * PICKER_ROW_H
        for ci, cell in enumerate(row):
            x = PAD + ci * cw
            _inverted_text(d, x, y, x + cw - 2, y + PICKER_ROW_H - 3, "Spc" if cell == " " else cell, f,
                           ri == r and ci == c)
    return im


def clock_set_screen(hh: int, mm: int, field: int, bar: TopBar):
    """hh is 0-23, shown in 12h; field 0 = hour, 1 = minute, 2 = AM/PM."""
    im, d = _screen(bar)
    f = _font(16)
    parts = [str(hh % 12 or 12), ":", f"{mm:02d}", "AM" if hh < 12 else "PM"]
    gaps = [0, 3, 3, 12]
    widths = [int(_w(f, p)) for p in parts]
    x = (SCREEN_W - sum(widths) - sum(gaps)) // 2
    y = BODY_TOP + 40
    focus = {0: 0, 1: 2, 2: 3}[field]
    for i, p in enumerate(parts):
        x += gaps[i]
        if i == focus:
            d.rectangle((x - 3, y - 2, x + widths[i] + 2, y + _line_h(f) + 1), fill=0)
        d.text((x, y), p, font=f, fill=1 if i == focus else 0)
        x += widths[i]
    return im


def boot_frame(i: int, total: int, message: str | None):
    im, d = _new()
    _logo(im, SCREEN_W // 2, 44, 40, frac=(i + 1) / total, width=2)
    if message:
        font, lines = fit_text(message, SCREEN_W - 2 * PAD, SCREEN_H - 90)
        _centered(d, lines, font, 88, SCREEN_H - 90)
    return im


def off_screen():
    """Only the logo, then "Spiral Node", then "Helix Velocities"; e-ink keeps it while off."""
    im, d = _new()
    _logo(im, SCREEN_W // 2, 32, 28, width=2)
    _centered(d, ["Spiral Node"], _font(14), 68, 0)
    _centered(d, ["Helix Velocities"], _font(12), 92, 0)
    return im
