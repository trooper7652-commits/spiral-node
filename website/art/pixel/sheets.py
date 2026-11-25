"""Contact sheets and loops: python -m art.pixel.sheets [out_dir]

Writes sheet-wide-N.png (3 per sheet, stacked), sheet-tall-N.png (5 per sheet,
side by side) at 3x, cast.png, and <scene>-<variant>.gif (20 frames, 100 ms, 2x).
"""
import json
import sys
from pathlib import Path

from PIL import Image

from . import sheet_cast
from .build import OUT
from .palette import PALETTE

SCENES = [("countryside-sunset", 1), ("countryside-night", 1), ("desk", 2), ("shell", 3),
          ("device", 4), ("scroll", 5), ("map", 6), ("atlas", 7), ("square", 8), ("hill", 9)]
MARGIN, K, LABEL_H = 24, 3, 5 * 3 + 12

_D = ["### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "### ..# ### #.. ###", "### ..# ### ..# ###",
      "#.# #.# ### ..# ..#", "### #.. ### ..# ###", "### #.. ### #.# ###", "### ..# ..# .#. .#.",
      "### #.# ### #.# ###", "### #.# ### ..# ###"]
GLYPHS = dict(sheet_cast.GLYPHS)
GLYPHS.update({str(i): g.replace(" ", "") for i, g in enumerate(_D)})
GLYPHS[" "] = "." * 15


def draw_text(im, x, y, s, k=K):
    ink = PALETTE["ink"] + (255,)
    for i, ch in enumerate(s):
        for j, b in enumerate(GLYPHS.get(ch, "." * 15)):
            if b == "#":
                im.paste(ink, (x + (i * 4 + j % 3) * k, y + (j // 3) * k,
                               x + (i * 4 + j % 3 + 1) * k, y + (j // 3 + 1) * k))


def compose_at(folder, ms):
    """Like preview.compose, but loop sprites follow their own fps."""
    folder = Path(folder)
    m = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    atlas = Image.open(folder / m["atlas"]).convert("RGBA")
    items = [(l["depth"], 0, i, l) for i, l in enumerate(m["layers"])]
    items += [(s["depth"], 1, i, s) for i, s in enumerate(m["sprites"])]
    canvas = Image.new("RGBA", (m["w"], m["h"]), (0, 0, 0, 0))
    for _, kind, _, it in sorted(items, key=lambda a: a[:3]):
        if kind == 0:
            part, pos = Image.open(folder / it["src"]).convert("RGBA"), (0, 0)
        else:
            fps = it.get("fps", 0)
            f = int(ms * fps / 1000) % it["frames"] if it.get("mode") == "loop" and fps else 0
            x0 = it["ax"] + f * it["w"]
            part = atlas.crop((x0, it["ay"], x0 + it["w"], it["ay"] + it["h"]))
            pos = (it["x"], it["y"])
        canvas.paste(part, pos, part)
    return canvas


def scaled(sid, variant, k):
    im = compose_at(OUT / sid / variant, 0)
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def sheets(out_dir, variant, per):
    for n, start in enumerate(range(0, len(SCENES), per), 1):
        group = SCENES[start:start + per]
        ims = [scaled(sid, variant, K) for sid, _ in group]
        w, h = ims[0].size
        wide = variant == "wide"
        cell_w, cell_h = (w, LABEL_H + h + MARGIN) if wide else (w + MARGIN, 0)
        sheet = Image.new("RGBA", (w + 2 * MARGIN, MARGIN + len(ims) * cell_h) if wide
                          else (MARGIN + len(ims) * cell_w, 2 * MARGIN + LABEL_H + h),
                          PALETTE["paper"] + (255,))
        for i, ((sid, num), im) in enumerate(zip(group, ims)):
            x, y = (MARGIN, MARGIN + i * cell_h) if wide else (MARGIN + i * cell_w, MARGIN)
            draw_text(sheet, x, y, f"{num} {sid.replace('-', ' ')}")
            sheet.paste(im, (x, y + LABEL_H), im)
        sheet.save(out_dir / f"sheet-{variant}-{n}.png")


def palette_image():
    flat = [c for rgb in PALETTE.values() for c in rgb[:3]]
    pal = Image.new("P", (1, 1))
    pal.putpalette(flat + [0] * (768 - len(flat)))
    return pal


def main(argv):
    out_dir = Path(argv[0]) if argv else Path(__file__).resolve().parents[4] / "docs" / "launch" / "pixel-shots"
    out_dir.mkdir(parents=True, exist_ok=True)
    sheets(out_dir, "wide", 3)
    sheets(out_dir, "tall", 5)
    sheet_cast.render(out_dir / "cast.png")
    pal = palette_image()
    for sid, _ in SCENES:
        for variant in ("wide", "tall"):
            frames = []
            for i in range(20):
                im = compose_at(OUT / sid / variant, i * 100)
                im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
                frames.append(im.convert("RGB").quantize(palette=pal, dither=Image.Dither.NONE))
            frames[0].save(out_dir / f"{sid}-{variant}.gif", save_all=True,
                           append_images=frames[1:], duration=100, loop=0, optimize=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
