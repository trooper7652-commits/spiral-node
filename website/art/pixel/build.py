import importlib
import json
import sys
from pathlib import Path

from .palette import css_list
from .scene import write

SITE = Path(__file__).resolve().parents[2]
OUT = SITE / "public" / "world"


def registry():
    scenes = {}
    for f in sorted((Path(__file__).parent / "scenes").glob("*.py")):
        if f.name == "__init__.py":
            continue
        for sid, fn in importlib.import_module(f".scenes.{f.stem}", __package__).SCENES.items():
            if sid in scenes:
                raise ValueError(f"duplicate scene id: {sid}")
            scenes[sid] = fn
    return scenes


def main(argv):
    reg = registry()
    ids = argv or sorted(reg)
    for sid in ids:
        if sid not in reg:
            print(f"unknown scene: {sid}")
            return 2
    for sid in ids:
        for variant in ("wide", "tall"):
            write(reg[sid](variant), OUT / sid / variant)
            print(f"wrote {sid}/{variant}")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "palette.json").write_text(json.dumps(css_list()) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
