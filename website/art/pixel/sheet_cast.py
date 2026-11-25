"""Render frame 0 of every pose at 6x on a paper sheet: python -m art.pixel.sheet_cast out.png"""
import sys

from PIL import Image

from . import cast
from .draw import paste
from .palette import PALETTE

SCALE = 6
COLS = 5

def _g(*rows):
    return "".join(rows)


GLYPHS = {
    "a": _g(".#.", "#.#", "###", "#.#", "#.#"), "b": _g("##.", "#.#", "##.", "#.#", "##."),
    "c": _g(".##", "#..", "#..", "#..", ".##"), "d": _g("##.", "#.#", "#.#", "#.#", "##."),
    "e": _g("###", "#..", "##.", "#..", "###"), "f": _g("###", "#..", "##.", "#..", "#.."),
    "g": _g(".##", "#..", "#.#", "#.#", ".##"), "h": _g("#.#", "#.#", "###", "#.#", "#.#"),
    "i": _g("###", ".#.", ".#.", ".#.", "###"), "j": _g("..#", "..#", "..#", "#.#", ".#."),
    "k": _g("#.#", "#.#", "##.", "#.#", "#.#"), "l": _g("#..", "#..", "#..", "#..", "###"),
    "m": _g("#.#", "###", "###", "#.#", "#.#"), "n": _g("##.", "#.#", "#.#", "#.#", "#.#"),
    "o": _g(".#.", "#.#", "#.#", "#.#", ".#."), "p": _g("##.", "#.#", "##.", "#..", "#.."),
    "q": _g(".#.", "#.#", "#.#", "##.", ".##"), "r": _g("##.", "#.#", "##.", "#.#", "#.#"),
    "s": _g(".##", "#..", ".#.", "..#", "##."), "t": _g("###", ".#.", ".#.", ".#.", ".#."),
    "u": _g("#.#", "#.#", "#.#", "#.#", "###"), "v": _g("#.#", "#.#", "#.#", "#.#", ".#."),
    "w": _g("#.#", "#.#", "###", "###", "#.#"), "x": _g("#.#", "#.#", ".#.", "#.#", "#.#"),
    "y": _g("#.#", "#.#", ".#.", ".#.", ".#."), "z": _g("###", "..#", ".#.", "#..", "###"),
    "_": _g("...", "...", "...", "...", "###"), "/": _g("..#", "..#", ".#.", "#..", "#.."),
}

def text_width(s, k=2):
    return len(s) * 4 * k - k


def draw_text(im, x, y, s, k=2):
    ink = PALETTE["ink"] + (255,)
    for i, ch in enumerate(s):
        bits = GLYPHS.get(ch, "." * 15)
        for j, b in enumerate(bits):
            if b == "#":
                px, py = x + (i * 4 + j % 3) * k, y + (j // 3) * k
                for dy in range(k):
                    for dx in range(k):
                        im.putpixel((px + dx, py + dy), ink)


def items():
    out = []
    for n in cast.FIGURES:
        for p in ("stand_back", cast._OWN[n]):
            out.append((f"{n}_{p}", cast.figure(n, p)[0]))
    for p in cast.DOG:
        out.append((f"dog_{p}", cast.dog(p)[0]))
    out.append(("snail", cast.snail()[0]))
    for n in cast.FIGURES:
        out.append((f"walk_{n}", cast.walker(n)[0]))
    out.append(("walker_dog", cast.walker_dog()[0]))
    return out


def render(out_path):
    its = items()
    cw = max(max(im.width * SCALE for _, im in its), max(text_width(n) for n, _ in its)) + 16
    ih = max(im.height * SCALE for _, im in its)
    ch = ih + 36
    rows = (len(its) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (cw * COLS, ch * rows), PALETTE["paper"] + (255,))
    for i, (name, im) in enumerate(its):
        cx, cy = (i % COLS) * cw, (i // COLS) * ch
        big = im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)
        paste(sheet, big, cx + (cw - big.width) // 2, cy + 8 + ih - big.height)
        draw_text(sheet, cx + (cw - text_width(name)) // 2, cy + ih + 16, name)
    sheet.save(out_path)


if __name__ == "__main__":
    render(sys.argv[1])
