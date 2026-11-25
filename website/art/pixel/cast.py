"""The cast: eight historical figures on one body rig, the dog and the snail, drawn in code (all deterministic)."""
import json
import math
from pathlib import Path

from .draw import line, new, outline, paste, put, rect, sprite

_CTX = {"late": None, "box": None}


def _fin(im):
    """Add the late head details, keep a clear 1 px margin, then add the ink edge."""
    late, _CTX["late"] = _CTX["late"], None
    if late:
        late(im)
    w, h = im.size
    for x in range(w):
        im.putpixel((x, 0), (0, 0, 0, 0))
        im.putpixel((x, h - 1), (0, 0, 0, 0))
    for y in range(h):
        im.putpixel((0, y), (0, 0, 0, 0))
        im.putpixel((w - 1, y), (0, 0, 0, 0))
    return outline(im)


# ------------------------------------------------------------------ figures
# c/cs: coat and its shade, l/ls: legs (or the skirt of a long robe), hair/hl: hair and its light.

_SPECS = {
    "newton": dict(c="dusk", cs="navy", l="navy", ls="night", shoe="umber", belt="night",
                   hair="sand", hl="white", long=False),
    "leonardo": dict(c="sea", cs="navy", l="sea", ls="navy", shoe="bark", belt="rust",
                     hair="mist", hl="white", long=True),
    "anning": dict(c="grass", cs="forest", l="grass", ls="forest", shoe="bark", belt="forest",
                   hair="sand", hl="paper", long=True),
    "faraday": dict(c="umber", cs="night", l="umber", ls="night", shoe="bark", belt="night",
                    hair="umber", hl="bark", long=False),
    "lovelace": dict(c="plum", cs="aubergine", l="plum", ls="aubergine", shoe="umber", belt="aubergine",
                     hair="bark", hl="brown", long=True),
    "idrisi": dict(c="teal", cs="forest", l="teal", ls="forest", shoe="bark", belt="gold",
                   hair="umber", hl="bark", long=True),
    "galileo": dict(c="olive", cs="olive_deep", l="bark", ls="umber", shoe="umber", belt="umber",
                    hair="mist", hl="white", long=False),
    "socrates": dict(c="paper", cs="mist", l="paper", ls="mist", shoe="tan", belt="mist",
                     hair="white", hl="mist", long=True),
}
FIG = {n: dict(s, name=n) for n, s in _SPECS.items()}
FIGURES = tuple(FIG)
# Colours that count as hair, beard or headwear at the face (the rest of a face is skin).
HAIR = {
    "newton": {"sand", "white", "paper"},
    "leonardo": {"mist", "white", "red", "rust"},
    "anning": {"sand", "paper", "rust"},
    "faraday": {"umber", "bark"},
    "lovelace": {"bark", "brown"},
    "idrisi": {"white", "paper", "mist", "umber", "bark"},
    "galileo": {"night", "navy", "white", "mist"},
    "socrates": {"white", "mist"},
}


def _fill(im, x0, y0, x1, y1, base, a, b):
    """A textured block (curls, folds): base colour with a and b scattered through it."""
    rect(im, x0, y0, x1, y1, base)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            m = (x + 2 * y) % 5
            if m in (0, 1):
                put(im, x, y, (a, b)[m])


def _newton(im, x, y, k):
    if k == "f":
        _fill(im, x - 1, y + 2, x, y + 8, "sand", "white", "paper")
        _fill(im, x + 7, y + 2, x + 8, y + 8, "sand", "white", "paper")
    elif k == "r":
        _fill(im, x - 1, y + 1, x + 2, y + 8, "sand", "white", "paper")
    else:
        _fill(im, x - 1, y + 1, x + 8, y + 8, "sand", "white", "paper")
        for i in range(x - 1, x + 8, 2):
            put(im, i, y + 9, "sand")


def _leonardo(im, x, y, k):
    if k == "f":
        rect(im, x + 2, y, x + 5, y + 1, "red")
        rect(im, x + 1, y + 1, x + 6, y + 1, "red")
        rect(im, x, y + 2, x + 7, y + 2, "rust")
        rect(im, x, y + 3, x, y + 7, "mist")
        rect(im, x + 7, y + 3, x + 7, y + 7, "mist")
        rect(im, x + 1, y + 5, x + 6, y + 6, "mist")
        rect(im, x + 2, y + 7, x + 5, y + 9, "mist")
        for p in ((3, 6), (4, 6), (3, 8), (4, 9)):
            put(im, x + p[0], y + p[1], "white")
    elif k == "r":
        rect(im, x + 1, y, x + 5, y, "red")
        rect(im, x, y + 1, x + 6, y + 1, "red")
        rect(im, x, y + 2, x + 6, y + 2, "rust")
        put(im, x - 1, y + 2, "red")
        put(im, x - 1, y + 3, "rust")
        rect(im, x, y + 3, x + 2, y + 6, "mist")
        rect(im, x + 3, y + 5, x + 6, y + 6, "mist")
        rect(im, x + 3, y + 7, x + 5, y + 9, "mist")
        put(im, x + 4, y + 6, "white")
        put(im, x + 4, y + 8, "white")
    else:
        rect(im, x + 2, y, x + 5, y, "red")
        rect(im, x + 1, y + 1, x + 6, y + 1, "red")
        rect(im, x, y + 2, x + 7, y + 2, "rust")
        rect(im, x, y + 3, x + 7, y + 8, "mist")  # plain long hair, two shading streaks
        rect(im, x + 2, y + 3, x + 2, y + 7, "white")
        rect(im, x + 5, y + 4, x + 5, y + 8, "sand")


def _anning(im, x, y, k):
    if k == "f":
        rect(im, x + 2, y, x + 5, y, "sand")
        rect(im, x + 1, y + 1, x + 6, y + 1, "sand")
        rect(im, x, y + 2, x + 7, y + 2, "sand")
        rect(im, x + 2, y + 2, x + 5, y + 2, "paper")
        rect(im, x + 3, y + 1, x + 4, y + 1, "paper")
        rect(im, x, y + 3, x, y + 6, "sand")
        rect(im, x + 7, y + 3, x + 7, y + 6, "sand")
        put(im, x + 2, y + 6, "rust")
        put(im, x + 5, y + 6, "rust")
    elif k == "r":
        rect(im, x + 1, y, x + 5, y, "sand")
        rect(im, x, y + 1, x + 6, y + 2, "sand")
        rect(im, x + 3, y + 1, x + 4, y + 1, "paper")
        rect(im, x + 7, y + 1, x + 7, y + 3, "paper")
        rect(im, x, y + 3, x + 2, y + 5, "sand")
        put(im, x + 2, y + 6, "rust")
    else:
        rect(im, x + 2, y, x + 5, y, "sand")
        rect(im, x + 1, y + 1, x + 6, y + 1, "sand")
        rect(im, x, y + 2, x + 7, y + 5, "sand")
        rect(im, x + 3, y + 1, x + 4, y + 2, "paper")  # crown of the bonnet
        rect(im, x + 3, y + 5, x + 4, y + 5, "rust")  # the bow
        rect(im, x + 2, y + 6, x + 2, y + 8, "rust")  # the ribbon tails
        rect(im, x + 5, y + 6, x + 5, y + 8, "rust")


def _faraday(im, x, y, k):
    if k == "f":
        put(im, x + 2, y + 1, "skin")  # the side parting
        put(im, x + 2, y + 7, "white")
        put(im, x + 5, y + 7, "white")
        rect(im, x + 1, y + 8, x + 6, y + 8, "white")
        rect(im, x + 3, y + 9, x + 4, y + 9, "ink")  # bow tie
        put(im, x + 2, y + 9, "white")
        put(im, x + 5, y + 9, "white")
    elif k == "r":
        rect(im, x + 3, y + 7, x + 4, y + 7, "white")
        rect(im, x + 2, y + 8, x + 4, y + 8, "white")
        rect(im, x + 4, y + 9, x + 5, y + 9, "ink")
    else:
        rect(im, x + 2, y + 7, x + 5, y + 7, "white")


def _lovelace(im, x, y, k):
    if k == "f":
        rect(im, x, y + 3, x, y + 6, "bark")
        rect(im, x + 7, y + 3, x + 7, y + 6, "bark")
        put(im, x, y + 5, "brown")
        put(im, x + 7, y + 4, "brown")
        put(im, x + 5, y, "gold")  # a hairpin
        rect(im, x + 2, y + 8, x + 5, y + 8, "skin")
    elif k == "r":
        rect(im, x - 1, y + 1, x + 1, y + 3, "bark")  # the bun
        put(im, x, y + 2, "brown")
        put(im, x - 1, y + 1, "gold")
        rect(im, x + 3, y + 8, x + 4, y + 8, "skin")
    else:
        rect(im, x + 2, y + 1, x + 5, y + 3, "brown")
        for px, py in ((2, 1), (5, 1), (2, 3), (5, 3)):
            put(im, x + px, y + py, "bark")
        put(im, x + 4, y + 2, "gold")
        rect(im, x + 2, y + 8, x + 5, y + 8, "skin")


def _idrisi(im, x, y, k):
    if k == "f":
        rect(im, x + 2, y, x + 5, y, "white")
        rect(im, x, y + 1, x + 7, y + 1, "white")
        rect(im, x - 1, y + 2, x + 8, y + 2, "paper")
        for px, py in ((1, 1), (4, 1), (2, 2), (6, 2)):
            put(im, x + px, y + py, "mist")
        rect(im, x + 1, y + 5, x + 6, y + 5, "umber")
        rect(im, x + 2, y + 6, x + 5, y + 6, "umber")
        rect(im, x + 3, y + 7, x + 4, y + 7, "umber")
    elif k == "r":
        rect(im, x + 1, y, x + 5, y, "white")
        rect(im, x, y + 1, x + 7, y + 1, "white")
        rect(im, x - 1, y + 2, x + 7, y + 2, "paper")
        for px, py in ((1, 1), (4, 1), (2, 2), (6, 2)):
            put(im, x + px, y + py, "mist")
        rect(im, x + 3, y + 5, x + 6, y + 6, "umber")
        rect(im, x + 3, y + 7, x + 5, y + 7, "umber")
    else:
        rect(im, x + 2, y, x + 5, y, "white")
        rect(im, x, y + 1, x + 7, y + 5, "white")  # the turban, its tail down the back
        rect(im, x - 1, y + 2, x + 8, y + 2, "paper")
        for px, py in ((1, 1), (4, 1), (2, 2), (6, 2), (3, 3), (5, 3), (4, 4), (3, 5)):
            put(im, x + px, y + py, "mist")
        for px, py in ((0, 4), (7, 4), (0, 5), (7, 5), (1, 6), (6, 6)):
            put(im, x + px, y + py, "umber")  # the beard edge at each side of the jaw
        rect(im, x + 2, y + 6, x + 5, y + 6, "white")


def _frill(im, x0, x1, y):
    rect(im, x0, y, x1, y, "white")
    for i in range(x0 + 1, x1 + 1, 2):
        put(im, i, y, "mist")


def _galileo(im, x, y, k):
    if k == "f":
        rect(im, x + 2, y, x + 5, y, "night")
        rect(im, x + 1, y + 1, x + 6, y + 1, "night")
        rect(im, x, y + 2, x + 7, y + 2, "navy")
        rect(im, x + 1, y + 5, x + 6, y + 6, "white")
        rect(im, x + 2, y + 7, x + 5, y + 7, "white")
        put(im, x + 2, y + 6, "mist")
        put(im, x + 5, y + 7, "mist")
        _frill(im, x, x + 7, y + 8)
        _frill(im, x + 1, x + 6, y + 9)
    elif k == "r":
        rect(im, x + 1, y, x + 5, y, "night")
        rect(im, x, y + 1, x + 6, y + 1, "night")
        rect(im, x, y + 2, x + 7, y + 2, "navy")
        rect(im, x + 3, y + 5, x + 6, y + 6, "white")
        rect(im, x + 3, y + 7, x + 5, y + 7, "white")
        put(im, x + 4, y + 6, "mist")
        _frill(im, x + 1, x + 6, y + 8)
        _frill(im, x + 2, x + 6, y + 9)
    else:
        rect(im, x + 2, y, x + 5, y, "night")
        rect(im, x + 1, y + 1, x + 6, y + 1, "night")
        rect(im, x, y + 2, x + 7, y + 3, "navy")
        rect(im, x + 1, y + 3, x + 6, y + 3, "night")
        rect(im, x, y + 4, x, y + 5, "white")  # white hair and beard edge at the sides
        rect(im, x + 7, y + 4, x + 7, y + 5, "white")
        rect(im, x + 1, y + 6, x + 1, y + 6, "white")
        rect(im, x + 6, y + 6, x + 6, y + 6, "white")
        rect(im, x + 1, y + 4, x + 6, y + 6, "mist")  # white hair at the back
        rect(im, x + 3, y + 4, x + 3, y + 6, "white")
        _frill(im, x + 1, x + 6, y + 7)
        _frill(im, x, x + 7, y + 8)


def _socrates(im, x, y, k):
    if k == "f":
        rect(im, x + 2, y, x + 5, y, "skin")
        rect(im, x + 1, y + 1, x + 6, y + 1, "skin")
        rect(im, x, y + 2, x + 7, y + 2, "skin")
        put(im, x + 2, y + 1, "sand")
        rect(im, x + 1, y + 5, x + 6, y + 6, "white")
        rect(im, x + 2, y + 7, x + 5, y + 9, "white")
        for px, py in ((2, 6), (5, 8), (3, 9)):
            put(im, x + px, y + py, "mist")
    elif k == "r":
        rect(im, x + 1, y, x + 5, y, "skin")
        rect(im, x, y + 1, x + 6, y + 2, "skin")
        put(im, x + 2, y + 1, "sand")
        rect(im, x, y + 3, x + 1, y + 4, "white")
        rect(im, x + 3, y + 5, x + 6, y + 6, "white")
        rect(im, x + 3, y + 7, x + 5, y + 9, "white")
        put(im, x + 4, y + 7, "mist")
    else:
        rect(im, x + 2, y, x + 5, y, "skin")
        rect(im, x + 1, y + 1, x + 6, y + 1, "skin")
        rect(im, x, y + 2, x + 7, y + 5, "skin")  # bald back of the head
        put(im, x + 2, y + 1, "sand")
        rect(im, x, y + 4, x + 7, y + 5, "white")  # the fringe low at the back
        rect(im, x + 1, y + 6, x + 6, y + 6, "white")
        rect(im, x + 4, y + 4, x + 4, y + 6, "mist")


_DECO = {"newton": _newton, "leonardo": _leonardo, "anning": _anning, "faraday": _faraday,
         "lovelace": _lovelace, "idrisi": _idrisi, "galileo": _galileo, "socrates": _socrates}


def _head(im, x, y, kind, blink, F):
    """8 wide, 8 tall including the neck. kind: f front, r facing right, b back.
    Records the skin box of the face; the per-figure hair and headwear go on last, in _fin."""
    h, hl = F["hair"], F["hl"]
    eye = "tan" if blink else "ink"
    if kind == "b":
        rect(im, x + 2, y, x + 5, y, h)
        rect(im, x + 1, y + 1, x + 6, y + 1, h)
        rect(im, x + 2, y + 1, x + 5, y + 1, hl)
        rect(im, x, y + 2, x + 7, y + 5, h)
        put(im, x, y + 4, "skin")
        put(im, x + 7, y + 4, "skin")
        rect(im, x + 2, y + 6, x + 5, y + 6, h)
        rect(im, x + 2, y + 7, x + 5, y + 7, "skin")
        box = None
    elif kind == "r":
        rect(im, x + 1, y, x + 5, y, h)
        rect(im, x, y + 1, x + 6, y + 2, h)
        put(im, x + 2, y + 1, hl)
        put(im, x + 3, y + 1, hl)
        rect(im, x, y + 3, x + 2, y + 4, h)
        rect(im, x + 3, y + 3, x + 6, y + 6, "skin")
        put(im, x + 5, y + 4, eye)
        rect(im, x + 1, y + 5, x + 2, y + 5, h)
        rect(im, x + 3, y + 7, x + 4, y + 7, "tan")
        box = (x + 3, y + 3, x + 6, y + 5)
    else:
        rect(im, x + 2, y, x + 5, y, h)
        rect(im, x + 1, y + 1, x + 6, y + 1, h)
        put(im, x + 2, y + 1, hl)
        put(im, x + 3, y + 1, hl)
        rect(im, x, y + 2, x + 7, y + 2, h)
        rect(im, x, y + 3, x, y + 5, h)
        rect(im, x + 7, y + 3, x + 7, y + 5, h)
        rect(im, x + 1, y + 3, x + 6, y + 6, "skin")
        put(im, x + 2, y + 4, eye)
        put(im, x + 5, y + 4, eye)
        rect(im, x + 3, y + 7, x + 4, y + 7, "tan")
        box = (x + 1, y + 3, x + 6, y + 5)
    _CTX["box"] = box
    _CTX["late"] = lambda im: _DECO[F["name"]](im, x, y, kind)


def _legs_front(im, F):
    l, ls, shoe = F["l"], F["ls"], F["shoe"]
    if F["long"]:
        rect(im, 6, 17, 13, 19, l)
        rect(im, 5, 20, 14, 23, l)
        rect(im, 12, 17, 13, 19, ls)
        rect(im, 13, 20, 14, 23, ls)
        rect(im, 9, 19, 9, 23, ls)
        rect(im, 5, 23, 14, 23, ls)
        rect(im, 7, 24, 9, 24, shoe)
        rect(im, 10, 24, 12, 24, shoe)
        return
    rect(im, 6, 17, 9, 23, l)
    rect(im, 10, 17, 13, 23, l)
    rect(im, 9, 17, 9, 23, ls)
    rect(im, 13, 17, 13, 23, ls)
    rect(im, 5, 24, 9, 24, shoe)
    rect(im, 10, 24, 14, 24, shoe)


def _torso(im, F, b, arms=True, kind="f"):
    rect(im, 6, 9 + b, 13, 16, F["c"])
    rect(im, 12, 9 + b, 13, 16, F["cs"])
    rect(im, 6, 16, 13, 16, F["belt"])
    if F["name"] == "socrates":
        line(im, 6, 10 + b, 12, 15, "mist")  # the fold of the wrap
        if kind == "b":
            rect(im, 6, 12 + b, 13, 12 + b, "mist")  # a fold across the back
    if F["name"] == "newton" and kind == "f":
        for y in (11, 13, 15):
            put(im, 9, y + b, "gold")
    if arms:
        rect(im, 4, 10 + b, 5, 15, F["c"])
        rect(im, 14, 10 + b, 15, 15, F["cs"])
        rect(im, 4, 16, 5, 17, "skin")
        rect(im, 14, 16, 15, 17, "skin")


def _stand(im, F, b=0, kind="f", blink=False, arms=True):
    """Front (or back) standing figure on a 20x26 canvas; b is the breathing offset."""
    _head(im, 6, 1 + b, kind, blink, F)
    _torso(im, F, b, arms, kind)
    _legs_front(im, F)


def _anning_basket(im, x, y):
    rect(im, x, y + 1, x + 3, y + 4, "tan")
    rect(im, x, y + 1, x + 3, y + 1, "brown")
    put(im, x + 1, y + 3, "brown")
    put(im, x + 2, y + 2, "brown")
    rect(im, x, y - 1, x + 3, y - 1, "brown")  # the handle
    put(im, x, y, "brown")
    put(im, x + 3, y, "brown")


def _hammer(im, x, y):
    rect(im, x, y, x, y + 2, "bark")
    rect(im, x - 1, y + 2, x + 1, y + 3, "mist")


def _sit_slate(F, f):
    b, blink, glint = [(0, 0, 0), (1, 0, 0), (0, 0, 1), (1, 1, 0)][f]
    im = new(20, 22)
    _head(im, 6, 1 + b, "f", bool(blink), F)
    rect(im, 6, 9 + b, 13, 15, F["c"])
    rect(im, 12, 9 + b, 13, 15, F["cs"])
    rect(im, 4, 10 + b, 5, 14, F["c"])
    rect(im, 14, 10 + b, 15, 14, F["cs"])
    rect(im, 6, 16, 13, 18, F["l"])
    rect(im, 12, 16, 13, 18, F["ls"])
    rect(im, 5, 19, 8, 19, F["l"])
    rect(im, 11, 19, 14, 19, F["l"])
    rect(im, 4, 20, 8, 20, F["shoe"])
    rect(im, 11, 20, 15, 20, F["shoe"])
    rect(im, 7, 14, 12, 18, "slate")
    rect(im, 8, 15, 11, 17, "white" if glint else "paper")
    rect(im, 8, 15, 10, 15, "mist")
    rect(im, 8, 17, 9, 17, "mist")
    rect(im, 5, 15, 6, 16, "skin")
    rect(im, 13, 15, 14, 16, "skin")
    return _fin(im)


def _write_back(F, f):
    """Writing at a desk, seen from behind over the shoulder: no face."""
    hx = (15, 16, 17, 16)[f]
    b = (0, 0, 1, 0)[f]
    im = new(26, 24)
    rect(im, 1, 12, 24, 12, "sand")
    rect(im, 1, 13, 24, 13, "tan")
    rect(im, 1, 14, 24, 14, "brown")
    rect(im, 2, 15, 3, 22, "bark")
    rect(im, 22, 15, 23, 22, "bark")
    rect(im, 15, 12, 22, 13, "paper")
    for x in range(16, hx + 2):
        put(im, x, 13, "slate")
    _head(im, 6, 1 + b, "b", False, F)
    rect(im, 5, 9 + b, 14, 19, F["c"])
    rect(im, 13, 9 + b, 14, 19, F["cs"])
    rect(im, 5, 16, 14, 16, F["belt"])
    rect(im, 5, 19, 14, 19, F["cs"])
    rect(im, 4, 20, 15, 20, "bark")
    rect(im, 5, 21, 6, 22, "bark")
    rect(im, 13, 21, 14, 22, "bark")
    rect(im, 3, 11, 5, 12, F["c"])
    rect(im, 2, 12, 3, 12, "skin")
    line(im, 13, 10 + b, hx, 12, F["c"])
    line(im, 13, 11 + b, hx, 13, F["cs"])
    rect(im, hx, 12, hx + 1, 13, "skin")
    put(im, hx + 2, 12, "gold")
    put(im, hx + 3, 13, "ink")
    return _fin(im)


def _crouch(F, f):
    b = (0, 1, 0, 1)[f]
    hx, hy = [(16, 15), (17, 15), (17, 16), (16, 15)][f]
    im = new(22, 21)
    _head(im, 8, 2 + b, "r", f == 2, F)
    rect(im, 6, 10 + b, 12, 15, F["c"])
    rect(im, 6, 10 + b, 7, 15, F["cs"])
    rect(im, 7, 16, 14, 17, F["l"])
    rect(im, 7, 17, 14, 17, F["ls"])
    rect(im, 13, 18, 14, 18, F["l"])
    rect(im, 12, 19, 16, 19, F["shoe"])
    rect(im, 6, 18, 8, 18, F["shoe"])
    line(im, 11, 11, hx - 1, hy - 1, F["c"])
    line(im, 11, 12, hx - 1, hy, F["cs"])
    rect(im, hx, hy, hx + 1, hy + 1, "skin")
    if F["name"] == "anning":
        _hammer(im, hx + 1, hy - 1)
        _anning_basket(im, 1, 15)
    return _fin(im)


def _turn_wheel(F, f):
    hy = (10, 11, 12, 11)[f]
    b = (0, 0, 1, 0)[f]
    im = new(27, 26)
    rect(im, 14, 17, 25, 17, "sand")
    rect(im, 14, 18, 25, 18, "tan")
    rect(im, 15, 19, 16, 24, "bark")
    rect(im, 23, 19, 24, 24, "bark")
    cx, cy = 20, 11
    for y in range(cy - 6, cy + 7):
        for x in range(cx - 6, cx + 7):
            if 3.6 <= math.hypot(x - cx, y - cy) <= 5.4:
                put(im, x, y, "brown")
    for j in range(2):
        a = f * math.pi / 8 + j * math.pi / 2
        dx, dy = 4 * math.cos(a), 4 * math.sin(a)
        line(im, cx - dx, cy - dy, cx + dx, cy + dy, "gold")
    rect(im, cx - 1, cy - 1, cx + 1, cy + 1, "bark")
    _head(im, 3, 1 + b, "r", f == 3, F)
    rect(im, 4, 9 + b, 9, 16, F["c"])
    rect(im, 4, 9 + b, 5, 16, F["cs"])
    rect(im, 4, 16, 9, 16, F["belt"])
    rect(im, 5, 17, 9, 23, F["l"])
    rect(im, 5, 17, 6, 23, F["ls"])
    rect(im, 5, 24, 11, 24, F["shoe"])
    line(im, 9, 10, 14, hy, F["c"])
    line(im, 9, 11, 14, hy + 1, F["cs"])
    rect(im, 14, hy, 15, hy + 1, "skin")
    return _fin(im)


def _read(F, f):
    b = (0, 1, 0, 1)[f]
    lens = ((6, 4, 5), (6, 5, 3), (5, 6, 4), (6, 3, 6))[f]
    im = new(20, 26)
    _stand(im, F, b, "f", f == 3, arms=False)
    rect(im, 4, 10 + b, 5, 14, F["c"])
    rect(im, 14, 10 + b, 15, 14, F["cs"])
    rect(im, 6, 12, 13, 18, "paper")
    rect(im, 5, 11, 14, 11, "sand")
    rect(im, 5, 19, 14, 19, "sand")
    for x, y in ((5, 11), (14, 11), (5, 19), (14, 19)):
        put(im, x, y, "gold")
    for row, n in zip((13, 15, 17), lens):
        rect(im, 7, row, 6 + n, row, "bark")
    rect(im, 4, 15, 5, 16, "skin")
    rect(im, 14, 15, 15, 16, "skin")
    return _fin(im)


def _plant_flag(F, f):
    d = (0, 1, 2, 1)[f]
    b = (0, 0, 1, 0)[f]
    ty = 12 + d
    im = new(22, 24)
    rect(im, 15, ty, 15, 22, "bark")
    rect(im, 16, ty, 20, ty + 3, "red")
    rect(im, 16, ty + 3, 20, ty + 3, "rust")
    _head(im, 4, 2 + b, "r", f == 3, F)
    rect(im, 5, 10 + b, 10, 16, F["c"])
    rect(im, 5, 10 + b, 6, 16, F["cs"])
    rect(im, 5, 16, 10, 16, F["belt"])
    rect(im, 5, 17, 7, 21, F["ls"])
    rect(im, 8, 17, 10, 21, F["l"])
    rect(im, 4, 22, 7, 22, F["shoe"])
    rect(im, 8, 22, 12, 22, F["shoe"])
    line(im, 10, 11, 13, ty - 1, F["c"])
    line(im, 10, 12, 13, ty, F["cs"])
    rect(im, 14, ty - 1, 15, ty, "skin")
    return _fin(im)


def _telescope(F, f):
    ey = (3, 4, 3, 2)[f]
    b = (0, 1, 0, 1)[f]
    im = new(26, 26)
    line(im, 16, 9, 13, 24, "bark")
    line(im, 16, 9, 19, 24, "bark")
    line(im, 16, 9, 16, 24, "umber")
    line(im, 16, 7, 16, 9, "bark")
    line(im, 11, 7, 23, ey, "gold")
    line(im, 11, 8, 23, ey + 1, "brown")
    put(im, 23, ey, "sky_pale")
    put(im, 23, ey + 1, "sky_pale")
    _head(im, 3, 2 + b, "r", f == 2, F)
    rect(im, 4, 10 + b, 9, 17, F["c"])
    rect(im, 4, 10 + b, 5, 17, F["cs"])
    rect(im, 4, 17, 9, 17, F["belt"])
    rect(im, 5, 18, 9, 23, F["l"])
    rect(im, 5, 18, 6, 23, F["ls"])
    rect(im, 5, 24, 11, 24, F["shoe"])
    line(im, 9, 11, 13, 9, F["c"])
    line(im, 9, 12, 13, 10, F["cs"])
    rect(im, 13, 8, 14, 9, "skin")
    return _fin(im)


def _show_slate(F, f):
    s, b, blink, glint = [(0, 0, 0, 0), (0, 1, 0, 0), (1, 0, 0, 1), (0, 1, 1, 0)][f]
    im = new(24, 26)
    _stand(im, F, b, "f", bool(blink), arms=False)
    rect(im, 4, 10 + b, 5, 15, F["c"])
    rect(im, 4, 16, 5, 17, "skin")
    rect(im, 14, 10 + b, 15, 12, F["cs"])
    rect(im, 16, 10, 17, 11, "skin")
    rect(im, 15, 2 + s, 22, 8 + s, "slate")
    rect(im, 16, 3 + s, 21, 7 + s, "paper")
    rect(im, 17, 4 + s, 20, 4 + s, "bark")
    rect(im, 17, 6 + s, 19, 6 + s, "bark")
    if glint:
        rect(im, 16, 3 + s, 17, 3 + s, "white")
    return _fin(im)


def _stand_back(F, f):
    im = new(20, 26)
    _stand(im, F, f % 2, "b")
    if F["name"] == "anning":
        _anning_basket(im, 1, 18)
        _hammer(im, 17, 14)
    return _fin(im)


_POSES = {"stand_back": (_stand_back, 2), "sit_slate": (_sit_slate, 4), "write_back": (_write_back, 4),
          "crouch": (_crouch, 4), "turn_wheel": (_turn_wheel, 4), "read": (_read, 4),
          "plant_flag": (_plant_flag, 4), "telescope": (_telescope, 4), "show_slate": (_show_slate, 4)}
_OWN = dict(zip(FIGURES, ("sit_slate", "write_back", "crouch", "turn_wheel", "read",
                          "plant_flag", "telescope", "show_slate")))


def _make(name, pose, f):
    if pose != "stand_back" and pose != _OWN[name]:
        raise KeyError(pose)
    _CTX["late"] = _CTX["box"] = None
    im = _POSES[pose][0](FIG[name], f)
    return im, _CTX["box"]


def figure(name, pose):
    """The frames of one figure in one pose: stand_back, or the pose of its own scene."""
    return [_make(name, pose, f)[0] for f in range(_POSES[pose][1])]


def face_box(name, pose, frame=0):
    """(x0, y0, x1, y1) of the face skin in that frame, or None when seen from behind."""
    return _make(name, pose, frame)[1]


def _simple(pose_fn, n):
    return lambda: [pose_fn(f) for f in range(n)]


# --------------------------------------------------------------------- dog
# Every dog faces right; the scene can mirror it.

def _head_r(im, x, y, eye="open"):
    rect(im, x, y, x + 4, y + 4, "tan")
    rect(im, x + 4, y + 2, x + 6, y + 4, "sand")
    put(im, x + 6, y + 2, "ink")
    rect(im, x + 1, y, x + 2, y + 3, "brown")
    if eye == "open":
        put(im, x + 3, y + 1, "ink")
    else:
        put(im, x + 2, y + 2, "ink")
        put(im, x + 3, y + 2, "ink")


def _head_down(im, x, y, eye="open"):
    rect(im, x, y, x + 4, y + 4, "tan")
    rect(im, x + 3, y + 3, x + 5, y + 6, "sand")
    put(im, x + 5, y + 6, "ink")
    rect(im, x + 1, y, x + 2, y + 3, "brown")
    put(im, x + 3, y + 1, "ink" if eye == "open" else "tan")


def _head_up(im, x, y, eye="open", ear=0):
    rect(im, x, y, x + 4, y + 4, "tan")
    rect(im, x + 4, y, x + 6, y + 2, "sand")
    put(im, x + 6, y, "ink")
    rect(im, x + 1, y + 1 + ear, x + 2, y + 4 + ear, "brown")
    put(im, x + 3, y + 2, "ink" if eye == "open" else "tan")


def _head_sky(im, x, y, eye="open", ear=0):
    rect(im, x, y, x + 4, y + 4, "tan")
    rect(im, x + 3, y - 3, x + 5, y, "sand")
    put(im, x + 4, y - 3, "ink")
    rect(im, x, y + 1 + ear, x + 1, y + 4 + ear, "brown")
    put(im, x + 3, y + 1, "ink" if eye == "open" else "tan")


def _body(im, x, y, w=10, h=6):
    rect(im, x, y, x + w - 1, y + h - 1, "tan")
    rect(im, x, y, x + w - 1, y + 1, "brown")
    rect(im, x, y + h - 1, x + w - 1, y + h - 1, "brown")


def _legs(im, y, h, far, near):
    for x in far:
        rect(im, x, y, x + 1, y + h - 1, "brown")
    for x in near:
        rect(im, x, y, x + 1, y + h - 1, "tan")
        rect(im, x, y + h - 1, x + 1, y + h - 1, "sand")


def _tail(im, x, y, tip):
    line(im, x, y, tip[0], tip[1], "brown")
    put(im, tip[0], tip[1], "tan")


def _dog_stand(f):
    im = new(24, 14)
    _body(im, 5, 3)
    _legs(im, 9, 4, (8, 11), (5, 13))
    _head_r(im, 14, 1, "shut" if f == 2 else "open")
    _tail(im, 5, 4, [(3, 1), (3, 2), (2, 2), (3, 2)][f])
    return _fin(im)


def _dog_greet(f):
    im = new(24, 14)
    rect(im, 5, 3, 10, 8, "tan")
    rect(im, 5, 3, 10, 4, "brown")
    rect(im, 10, 5, 16, 9, "tan")
    rect(im, 10, 5, 16, 5, "brown")
    _legs(im, 9, 4, (9,), (6,))
    _legs(im, 10, 3, (16,), (13,))
    _head_r(im, 15, 5 + (f == 1), "shut" if f == 3 else "open")
    _tail(im, 5, 4, [(3, 1), (2, 2), (4, 1), (2, 2)][f])
    return _fin(im)


def _dog_lie(f):
    im = new(22, 12)
    _body(im, 4, 5, 10, 5)
    rect(im, 4, 9, 7, 9, "sand")
    rect(im, 14, 8, 19, 9, "tan")
    rect(im, 14, 9, 19, 9, "sand")
    _head_r(im, 13, 2 + (f == 1), "shut" if f == 2 else "open")
    _tail(im, 4, 7, [(1, 8), (1, 9), (2, 9), (1, 9)][f])
    return _fin(im)


def _dog_sleep(f):
    im = new(22, 12)
    rows = {5: (5, 12), 6: (4, 13), 7: (3, 14), 8: (3, 14), 9: (3, 14), 10: (4, 14)}
    for y, (x0, x1) in rows.items():
        rect(im, x0, y, x1, y, "brown" if y in (5, 6) else "tan")
    if f in (1, 2):
        rect(im, 6, 4, 11, 4, "brown")
    rect(im, 2, 8, 3, 10, "brown")  # tail curls round the belly to the nose
    rect(im, 4, 10, 12, 10, "brown")
    put(im, 13, 10, "tan")
    rect(im, 14, 10, 20, 10, "sand")  # paws
    _head_r(im, 14, 5, "shut")
    return _fin(im)


def _dog_sniff(f):
    dy = (0, -1, 0, 1)[f]
    im = new(24, 14)
    _body(im, 5, 3)
    _legs(im, 9, 4, (8, 11), (5, 13))
    _head_down(im, 14, 5 + dy)
    _tail(im, 5, 4, [(3, 2), (3, 3), (2, 3), (3, 3)][f])
    return _fin(im)


def _sit_body(im):
    rect(im, 4, 8, 11, 12, "tan")
    rect(im, 4, 8, 11, 9, "brown")
    rect(im, 4, 12, 8, 12, "sand")
    rect(im, 10, 5, 14, 12, "tan")
    rect(im, 13, 7, 14, 11, "sand")
    rect(im, 11, 12, 14, 12, "sand")


def _dog_watch(f):
    im = new(20, 14)
    _sit_body(im)
    _head_up(im, 11, 1, "shut" if f == 2 else "open", 1 if f == 3 else 0)
    _tail(im, 4, 12, [(1, 12), (1, 11), (2, 11), (1, 11)][f])
    return _fin(im)


def _dog_look_up(f):
    im = new(20, 14)
    _sit_body(im)
    _head_sky(im, 11, 4, "shut" if f == 2 else "open", 1 if f == 3 else 0)
    _tail(im, 4, 12, [(1, 12), (1, 11), (2, 11), (1, 11)][f])
    return _fin(im)


def _dog_tug(f):
    r = (0, -1, 0, 1)[f]
    im = new(30, 14)
    _body(im, 4, 4)
    _legs(im, 10, 3, (7, 11), (4, 14))
    _head_r(im, 14, 6)
    for x in range(20, 28):
        y = 9 + round(r * (x - 20) / 7)
        put(im, x, y, "sand" if x % 2 else "brown")
        put(im, x, y + 1, "tan")
    _tail(im, 4, 5, [(2, 7), (2, 8), (1, 7), (2, 8)][f])
    return _fin(im)


def _dog_trail(f):
    legs = [((4, 14), (8, 11)), ((6, 12), (7, 13)), ((8, 11), (4, 14)), ((6, 12), (7, 13))][f]
    im = new(24, 14)
    _body(im, 5, 3)
    _legs(im, 9, 4, *legs)
    _head_down(im, 14, 5 + (f % 2))
    _tail(im, 5, 4, [(3, 5), (3, 4), (3, 5), (3, 4)][f])
    return _fin(im)


DOG = {
    "stand": _simple(_dog_stand, 4),
    "greet": _simple(_dog_greet, 4),
    "lie": _simple(_dog_lie, 4),
    "sleep": _simple(_dog_sleep, 4),
    "sniff": _simple(_dog_sniff, 4),
    "watch": _simple(_dog_watch, 4),
    "look_up": _simple(_dog_look_up, 4),
    "tug": _simple(_dog_tug, 4),
    "trail": _simple(_dog_trail, 4),
}


def dog(pose):
    return DOG[pose]()


# ------------------------------------------------------------------- snail

SHELL = [
    ".ooooo.",
    "ogggggo",
    "ooooogo",
    "ooggggo",
    "oogoogo",
    "ooggggo",
    ".orrro.",
]
SHELL_KEY = {"o": "orange", "g": "gold", "r": "rust"}


def _snail(f):
    dx = (0, 1)[f]
    im = new(14, 12)
    rect(im, 1, 8, 10 + dx, 9, "sand")
    rect(im, 2, 8, 9 + dx, 8, "paper")
    rect(im, 8 + dx, 6, 10 + dx, 7, "sand")
    put(im, 8 + dx, 6, "paper")
    for sx in (8 + dx, 10 + dx):
        rect(im, sx, 4, sx, 5, "sand")
        put(im, sx + f, 3, "ink")
    paste(im, sprite(SHELL, SHELL_KEY), 1, 1)
    return _fin(im)


def snail():
    return [_snail(0), _snail(1)]



# ----------------------------------------------------------------- walkers

def _wdeco(name, im):
    """Per-figure hair, headwear and clothes on the 12x12 side walker (facing right)."""
    if name == "newton":
        _fill(im, 3, 2, 4, 6, "sand", "white", "paper")
        put(im, 6, 5, "gold")
    elif name == "leonardo":
        rect(im, 4, 1, 7, 1, "red")
        put(im, 3, 2, "rust")
        rect(im, 6, 3, 7, 3, "mist")
        rect(im, 6, 4, 7, 4, "white")
        rect(im, 6, 5, 7, 5, "mist")
    elif name == "anning":
        rect(im, 3, 1, 7, 1, "sand")
        rect(im, 3, 2, 4, 3, "sand")
        put(im, 8, 2, "paper")
        put(im, 5, 3, "rust")
        rect(im, 8, 6, 9, 7, "tan")
        put(im, 8, 5, "brown")
    elif name == "faraday":
        put(im, 5, 1, "skin")
        rect(im, 5, 4, 7, 4, "white")
        put(im, 7, 5, "ink")
    elif name == "lovelace":
        rect(im, 3, 1, 4, 3, "bark")
        put(im, 4, 2, "brown")
        put(im, 3, 1, "gold")
        put(im, 6, 4, "skin")
    elif name == "idrisi":
        rect(im, 3, 1, 8, 2, "white")
        for p in ((5, 1), (7, 1), (4, 2), (6, 2)):
            put(im, *p, "mist")
        rect(im, 6, 3, 7, 3, "skin")
        put(im, 7, 3, "ink")
        rect(im, 6, 4, 7, 5, "umber")
    elif name == "galileo":
        rect(im, 4, 1, 8, 1, "night")
        put(im, 8, 2, "navy")
        rect(im, 6, 3, 7, 3, "white")
        rect(im, 5, 4, 8, 4, "white")
        put(im, 6, 4, "mist")
        put(im, 8, 4, "mist")
    elif name == "socrates":
        rect(im, 4, 1, 7, 2, "skin")
        rect(im, 4, 3, 5, 3, "white")
        rect(im, 6, 3, 8, 5, "white")
        put(im, 7, 4, "mist")


def _walker(name, f):
    F = FIG[name]
    im = new(12, 12)
    rect(im, 4, 1, 7, 1, F["hair"])
    rect(im, 4, 2, 5, 3, F["hair"])
    rect(im, 6, 2, 7, 3, "skin")
    put(im, 7, 2, "ink")
    rect(im, 4, 4, 7, 7, F["c"])
    rect(im, 4, 4, 4, 7, F["cs"])
    put(im, 6 + f, 5 + f, "skin")  # the swinging hand
    if F["long"]:
        rect(im, 4 - (1 - f), 8, 7 + (1 - f), 9, F["c"])
        rect(im, 4 - (1 - f), 8, 4 - (1 - f), 9, F["cs"])
        for x in ((4, 7), (5, 6))[f]:
            put(im, x, 10, F["shoe"])
    elif f == 0:
        line(im, 4, 8, 3, 10, F["ls"])
        line(im, 6, 8, 7, 10, F["l"])
        put(im, 3, 10, F["shoe"])
        put(im, 7, 10, F["shoe"])
    else:
        rect(im, 5, 8, 5, 10, F["ls"])
        rect(im, 6, 8, 6, 10, F["l"])
        put(im, 5, 10, F["shoe"])
        put(im, 6, 10, F["shoe"])
    _wdeco(name, im)
    return _fin(im)


def walker(name):
    return [_walker(name, 0), _walker(name, 1)]


def _walker_dog(f):
    im = new(12, 9)
    rect(im, 2, 2, 6, 4, "tan")
    rect(im, 2, 2, 6, 2, "brown")
    rect(im, 6, 1, 8, 3, "tan")
    rect(im, 8, 2, 9, 3, "sand")
    put(im, 9, 2, "ink")
    put(im, 7, 2, "ink")
    put(im, 6, 1, "brown")
    line(im, 2, 2, 1, 1, "brown")
    near, far = [((2, 6), (4, 7)), ((4, 7), (2, 6))][f]
    for x in far:
        rect(im, x, 5, x, 6, "brown")
    for x in near:
        rect(im, x, 5, x, 6, "tan")
    return _fin(im)


def walker_dog():
    return [_walker_dog(0), _walker_dog(1)]



def write_trail(out_dir=None):
    """One row per figure: its two walker frames then the dog's two, written with a json index."""
    from PIL import Image
    out = Path(out_dir) if out_dir else Path(__file__).resolve().parents[2] / "public" / "world"
    out.mkdir(parents=True, exist_ok=True)
    cw = ch = 12
    sheet = Image.new("RGBA", (cw * 4, ch * len(FIGURES)), (0, 0, 0, 0))
    for r, name in enumerate(FIGURES):
        for i, f in enumerate(walker(name) + walker_dog()):
            paste(sheet, f, i * cw + (cw - f.width) // 2, r * ch + ch - f.height)
    sheet.save(out / "trail.png")
    (out / "trail.json").write_text(json.dumps(
        {"cell": [cw, ch], "walker": [0, 1], "dog": [2, 3], "rows": {n: i for i, n in enumerate(FIGURES)}}),
        encoding="utf-8")


if __name__ == "__main__":
    write_trail()
