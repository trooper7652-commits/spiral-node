import json
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

from .palette import PALETTE

SIZES = {"wide": (576, 360), "tall": (240, 480)}
# Centre box that real windows always show (laptop with browser bars, small phones, tablets in portrait).
SAFE = {"wide": (400, 200), "tall": (180, 270)}
_COLOURS = set(PALETTE.values())


@dataclass
class Layer:
    id: str
    image: Image.Image
    depth: float


@dataclass
class Sprite:
    id: str
    frames: list[Image.Image]
    fps: float
    x: int
    y: int
    depth: float
    mode: str = "loop"  # "loop" (timed) or "scrub" (follows scroll)


@dataclass
class Scene:
    id: str
    variant: str  # "wide" or "tall"
    w: int
    h: int
    layers: list[Layer]
    sprites: list[Sprite]
    # (x, y), or (x, y, depth) when the anchor sits on something that is not at depth 1
    anchors: dict[str, tuple] = field(default_factory=dict)
    # (id, x, y), or (id, x, y, depth) for a tag pinned to something at its own depth (a figure)
    tags: list[tuple] = field(default_factory=list)
    # the depth of what the tags sit on; None: the front layer
    tag_depth: float | None = None
    # the whole scene as ink lines on paper (scene 3, for the join from the desk page)
    ink: Image.Image | None = None


def safe_box(variant):
    (w, h), (sw, sh) = SIZES[variant], SAFE[variant]
    x0, y0 = (w - sw) // 2, (h - sh) // 2
    return (x0, y0, x0 + sw, y0 + sh)


def check_palette(what, ident, im):
    for _, (r, g, b, a) in im.convert("RGBA").getcolors(1 << 20):
        if a not in (0, 255) or (a and (r, g, b) not in _COLOURS):
            raise ValueError(f"{what} {ident} has a pixel that is not a palette colour with alpha 0 or 255")


def validate(scene):
    if scene.variant not in SIZES:
        raise ValueError(f"unknown variant: {scene.variant}")
    if (scene.w, scene.h) != SIZES[scene.variant]:
        raise ValueError(f"{scene.variant} scenes are {SIZES[scene.variant]}, got {(scene.w, scene.h)}")
    for layer in scene.layers:
        if layer.image.size != (scene.w, scene.h):
            raise ValueError(f"layer {layer.id} is {layer.image.size}, expected {(scene.w, scene.h)}")
        check_palette("layer", layer.id, layer.image)
    if scene.ink is not None:
        if scene.ink.size != (scene.w, scene.h):
            raise ValueError(f"ink image is {scene.ink.size}, expected {(scene.w, scene.h)}")
        check_palette("ink", "image", scene.ink)
    for s in scene.sprites:
        if not s.frames:
            raise ValueError(f"sprite {s.id} has no frames")
        if len({f.size for f in s.frames}) > 1:
            raise ValueError(f"sprite {s.id} frames differ in size")
        if s.mode not in ("loop", "scrub"):
            raise ValueError(f"sprite {s.id} has bad mode: {s.mode}")
        for f in s.frames:
            check_palette("sprite", s.id, f)
    for what, items in (("layer", scene.layers), ("sprite", scene.sprites)):
        ids = [i.id for i in items]
        if len(set(ids)) != len(ids):
            raise ValueError(f"duplicate {what} ids")


def write(scene, out: Path):
    validate(scene)
    out.mkdir(parents=True, exist_ok=True)
    named = {f"layer-{l.id}.png" for l in scene.layers}
    for old in out.glob("layer-*.png"):
        if old.name not in named:
            old.unlink()
    for layer in scene.layers:
        layer.image.save(out / f"layer-{layer.id}.png", optimize=True)

    aw = max((s.frames[0].width * len(s.frames) for s in scene.sprites), default=1)
    ah = max(sum(s.frames[0].height for s in scene.sprites), 1)
    atlas = Image.new("RGBA", (aw, ah), (0, 0, 0, 0))
    sprites, ay = [], 0
    for s in scene.sprites:
        fw, fh = s.frames[0].size
        for i, f in enumerate(s.frames):
            atlas.paste(f, (i * fw, ay))
        sprites.append({"id": s.id, "x": s.x, "y": s.y, "w": fw, "h": fh, "frames": len(s.frames),
                        "fps": s.fps, "depth": s.depth, "mode": s.mode, "ax": 0, "ay": ay})
        ay += fh
    atlas.save(out / "atlas.png", optimize=True)

    m = {
        "id": scene.id, "variant": scene.variant, "w": scene.w, "h": scene.h,
        "layers": [{"id": l.id, "src": f"layer-{l.id}.png", "depth": l.depth} for l in scene.layers],
        "atlas": "atlas.png",
        "sprites": sprites,
        "anchors": {k: {"x": a[0], "y": a[1], **({"depth": a[2]} if len(a) > 2 else {})}
                    for k, a in scene.anchors.items()},
        "tags": [{"id": t[0], "x": t[1], "y": t[2], **({"depth": d} if d is not None else {})}
                 for t in scene.tags for d in [t[3] if len(t) > 3 else scene.tag_depth]],
    }
    if scene.ink is not None:
        scene.ink.save(out / "ink.png", optimize=True)
        m["ink"] = "ink.png"
    elif (out / "ink.png").exists():
        (out / "ink.png").unlink()
    (out / "manifest.json").write_text(json.dumps(m, indent=1) + "\n", encoding="utf-8")
    return m
