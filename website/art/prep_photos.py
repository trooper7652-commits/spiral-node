"""Prepare build-log photos for the website: upright, 4:3, long edge 1600, no metadata (Pillow only).

Run: cd website && python art/prep_photos.py <in_dir> <out_dir>
Writes <stem>.jpg (JPEG quality 85) for each .jpg/.jpeg/.png in <in_dir>, sorted by name.
Small inputs are never upscaled. If two inputs share a stem (a.jpg, a.png) the later one is written as <stem>-<ext>.jpg (a-png.jpg).
"""
import argparse
from pathlib import Path

from PIL import Image, ImageOps

EXTS = {".jpg", ".jpeg", ".png"}
LONG = 1600
QUALITY = 85


def prep(img: Image.Image) -> Image.Image:
    """Return a fresh RGB image: centre-cropped to 4:3 (landscape or portrait), resized, tuned, no metadata."""
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    landscape = w >= h
    ratio = 4 / 3 if landscape else 3 / 4  # width / height of the target
    if w / h > ratio:  # too wide: trim the sides
        nw = round(h * ratio)
        left = (w - nw) // 2
        img = img.crop((left, 0, left + nw, h))
    else:  # too tall: trim top and bottom
        nh = round(w / ratio)
        top = (h - nh) // 2
        img = img.crop((0, top, w, top + nh))
    if max(img.size) > LONG:  # downscale only, never upscale
        size = (LONG, LONG * 3 // 4) if landscape else (LONG * 3 // 4, LONG)
        img = img.resize(size, Image.Resampling.LANCZOS)
    img = ImageOps.autocontrast(img, cutoff=1)
    r, g, b = img.split()
    r = r.point(lambda v: min(255, round(v * 1.03)))
    b = b.point(lambda v: min(255, round(v * 0.97)))
    warm = Image.merge("RGB", (r, g, b))
    # a fresh image: nothing from the source (EXIF, GPS, XMP, ICC) is carried over
    return Image.frombytes("RGB", warm.size, warm.tobytes())


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("in_dir", type=Path)
    parser.add_argument("out_dir", type=Path)
    args = parser.parse_args(argv)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    written: set[Path] = set()
    for src in sorted(args.in_dir.iterdir()):
        if not src.is_file() or src.suffix.lower() not in EXTS:
            continue
        with Image.open(src) as im:
            out = prep(im)
        dest = args.out_dir / f"{src.stem}.jpg"
        if dest in written:
            dest = args.out_dir / f"{src.stem}-{src.suffix.lower().lstrip('.')}.jpg"
        written.add(dest)
        out.save(dest, "JPEG", quality=QUALITY)
        print(f"{src.name} -> {dest} {out.size[0]}x{out.size[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
