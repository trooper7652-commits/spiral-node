"""Contact image: python -m art.pixel.preview <scene-id> <variant> <out.png> [t]

Reads public/world/<id>/<variant>/manifest.json only. Layers and sprites are
stacked by depth (layers first at equal depth), sprites drawn at frame t, then x3.
"""
import json
import sys
from pathlib import Path

from PIL import Image

from .build import OUT


def compose(folder, t=0):
    folder = Path(folder)
    m = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    atlas = Image.open(folder / m["atlas"]).convert("RGBA")
    items = [(l["depth"], 0, i, l) for i, l in enumerate(m["layers"])]
    items += [(s["depth"], 1, i, s) for i, s in enumerate(m["sprites"])]
    canvas = Image.new("RGBA", (m["w"], m["h"]), (0, 0, 0, 255))
    for _, kind, _, it in sorted(items, key=lambda a: a[:3]):
        if kind == 0:
            part, pos = Image.open(folder / it["src"]).convert("RGBA"), (0, 0)
        else:
            f = t % it["frames"]
            x0 = it["ax"] + f * it["w"]
            part = atlas.crop((x0, it["ay"], x0 + it["w"], it["ay"] + it["h"]))
            pos = (it["x"], it["y"])
        canvas.paste(part, pos, part)
    return canvas


def main(argv):
    if len(argv) < 3:
        print("usage: python -m art.pixel.preview <scene-id> <variant> <out.png> [t]")
        return 2
    sid, variant, out = argv[:3]
    t = int(argv[3]) if len(argv) > 3 else 0
    im = compose(OUT / sid / variant, t)
    im.convert("RGB").resize((im.width * 3, im.height * 3), Image.NEAREST).save(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
