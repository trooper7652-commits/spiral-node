import json
import math
from pathlib import Path
from functools import lru_cache
import pytest

from art.pixel.build import registry
from art.pixel.scene import SIZES, safe_box, write
from art.pixel.palette import PALETTE

# Table definitions
SCENES = {
    "countryside-sunset": (["slate"], None),
    "countryside-night": (["slate"], None),
    "desk": (["slate", "centre", "page", "sketch_shell"], None),
    "shell": (["centre", "spiral"], "s3"),
    "device": (["wheel", "page"], "s4"),
    "scroll": (["page", "roller", "screen1", "screen2", "screen3"], None),
    "map": (["map", "seam"] + [f"m{i}" for i in range(1, 13)], "s6"),
    "atlas": (["seam", "cloud", "star"], "s7"),
    "square": (["cloud", "lantern", "lantern_up"], None),
    "hill": (["lantern", "beam", "sun"], None),
}
FIGURES = ("newton", "leonardo", "anning", "faraday", "lovelace", "idrisi", "galileo", "socrates")
def who_ids(sid):
    return [f"who-{n}" for n in FIGURES] if sid == "hill" else ["who"]


def is_cast(sp_id):
    return sp_id in ("who", "dog", "snail") or sp_id.startswith("who-")
VARIANTS = ["wide", "tall"]

# Load site‑ids once
SITE_IDS = json.loads(Path(__file__).with_name("site-ids.json").read_text())

def _scene_exists(sid: str, variant: str):
    reg = registry()
    return sid in reg

@lru_cache(maxsize=None)
def built(sid: str, variant: str):
    """Return a built Scene or raise KeyError if not present."""
    reg = registry()
    if sid not in reg:
        raise KeyError(sid)
    # registry maps id -> function(variant) -> Scene
    return reg[sid](variant)

def assert_palette_only(scene):
    # layers
    for layer in scene.layers:
        im = layer.image
        for count, color in im.getcolors(1 << 20) or []:
            if color[3] not in (0, 255):
                pytest.fail("non‑binary alpha in layer")
            if color[3] == 255 and color[:3] not in PALETTE.values():
                pytest.fail("color not in PALETTE")
    # sprites
    for spr in scene.sprites:
        for frame in spr.frames:
            for count, color in frame.getcolors(1 << 20) or []:
                if color[3] not in (0, 255):
                    pytest.fail("non‑binary alpha in sprite frame")
                if color[3] == 255 and color[:3] not in PALETTE.values():
                    pytest.fail("color not in PALETTE")

def inside(box, point):
    x0, y0, x1, y1 = box
    x, y = point
    return x0 <= x <= x1 and y0 <= y <= y1

def sprite_box(sprite, idx=0):
    frm = sprite.frames[idx]
    x, y = sprite.x, sprite.y
    return (x, y, x + frm.width, y + frm.height)

# ---------- Tests ----------

@pytest.mark.parametrize("sid", list(SCENES.keys()))
def test_scene_exists(sid):
    assert _scene_exists(sid, "wide") or _scene_exists(sid, "tall")

@pytest.mark.parametrize("sid,variant", [(sid, var) for sid in SCENES for var in VARIANTS])
def test_shape(sid, variant):
    try:
        s = built(sid, variant)
    except KeyError:
        pytest.fail(f"scene {sid} is not drawn yet")
    assert (s.w, s.h) == SIZES[variant]
    assert s.id == sid
    assert s.variant == variant
    assert len(s.layers) >= 4
    depths = [ly.depth for ly in s.layers]
    assert len(set(depths)) == len(depths)

@pytest.mark.parametrize("sid,variant", [(sid, var) for sid in SCENES for var in VARIANTS])
def test_animated_sprites(sid, variant):
    try:
        s = built(sid, variant)
    except KeyError:
        pytest.fail(f"scene {sid} is not drawn yet")
    animated = [sp for sp in s.sprites if not is_cast(sp.id) and len(sp.frames) >= 2]
    assert len(animated) >= 5
    for sp in s.sprites:
        w, h = sp.frames[0].size
        for fr in sp.frames:
            assert fr.size == (w, h)
        assert sp.mode in ("loop", "scrub")

@pytest.mark.parametrize("sid,variant", [(sid, var) for sid in SCENES for var in VARIANTS])
def test_cast_inside_safe_area(sid, variant):
    try:
        s = built(sid, variant)
    except KeyError:
        pytest.fail(f"scene {sid} is not drawn yet")
    safe = safe_box(variant)
    for cid in ("dog", "snail", *who_ids(sid)):
        matches = [sp for sp in s.sprites if sp.id == cid]
        assert len(matches) == 1
        sp = matches[0]
        box = sprite_box(sp)
        assert inside(safe, (box[0], box[1])) and inside(safe, (box[2], box[3]))

@pytest.mark.parametrize("sid,variant", [(sid, var) for sid in SCENES for var in VARIANTS])
def test_anchors(sid, variant):
    try:
        s = built(sid, variant)
    except KeyError:
        pytest.fail(f"scene {sid} is not drawn yet")
    safe = safe_box(variant)
    expected_anchors, _ = SCENES[sid]
    for name in expected_anchors:
        assert name in s.anchors
        assert inside(safe, s.anchors[name][:2])

@pytest.mark.parametrize("sid,variant", [(sid, var) for sid in SCENES for var in VARIANTS])
def test_tags(sid, variant):
    try:
        s = built(sid, variant)
    except KeyError:
        pytest.fail(f"scene {sid} is not drawn yet")
    _, tag_key = SCENES[sid]
    expected_ids = (SITE_IDS[tag_key] if tag_key else []) + who_ids(sid)
    actual_ids = [t[0] for t in s.tags]
    assert actual_ids == expected_ids
    safe = safe_box(variant)
    for t in s.tags:
        assert inside(safe, (t[1], t[2]))


@pytest.mark.parametrize("sid,variant", [(sid, var) for sid in SCENES for var in VARIANTS])
def test_who_tag_sits_on_its_figure(sid, variant):
    s = built(sid, variant)
    for t in s.tags:
        if not t[0].startswith("who"):
            continue
        sp = next(sp for sp in s.sprites if sp.id == t[0])
        assert inside(sprite_box(sp), (t[1], t[2])), t
        assert len(t) == 4 and t[3] == sp.depth, "a figure's tag carries the figure's depth"

@pytest.mark.parametrize("variant", VARIANTS)
def test_atlas_stars_are_spread(variant):
    sid = "atlas"
    try:
        s = built(sid, variant)
    except KeyError:
        pytest.fail(f"scene {sid} is not drawn yet")
    _, _ = SCENES[sid]
    points = [(t[1], t[2]) for t in s.tags if t[0].startswith("q")]
    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            dx = points[i][0] - points[j][0]
            dy = points[i][1] - points[j][1]
            assert math.hypot(dx, dy) >= 12

def test_atlas_wide_stars_clear_of_the_right_panel():
    pts = [(t[1], t[2]) for t in built("atlas", "wide").tags if t[0].startswith("q")]
    assert all(x <= 285 for x, _ in pts)
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            assert math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) >= 14

@pytest.mark.parametrize("sid,variant", [(sid, var) for sid in SCENES for var in VARIANTS])
def test_palette_only(sid, variant):
    try:
        s = built(sid, variant)
    except KeyError:
        pytest.fail(f"scene {sid} is not drawn yet")
    assert_palette_only(s)

@pytest.mark.parametrize("sid,variant", [(sid, var) for sid in SCENES for var in VARIANTS])
def test_small(sid, variant, tmp_path):
    try:
        s = built(sid, variant)
    except KeyError:
        pytest.fail(f"scene {sid} is not drawn yet")
    manifest = write(s, tmp_path)
    total = sum(p.stat().st_size for p in tmp_path.rglob("*.png"))
    assert total <= 300 * 1024
    for sp in s.sprites:
        first = sp.frames[0]
        assert first.width * len(sp.frames) <= 2048

def test_deterministic(tmp_path):
    variant = "tall"
    for sid in SCENES:
        if sid not in registry():
            pytest.fail(f"scene {sid} is not drawn yet")
        s1, s2 = registry()[sid](variant), registry()[sid](variant)  # two fresh builds, not the cached one
        # compare layers
        for l1, l2 in zip(s1.layers, s2.layers):
            assert l1.image.tobytes() == l2.image.tobytes()
        # compare sprites frames
        for sp1, sp2 in zip(s1.sprites, s2.sprites):
            for f1, f2 in zip(sp1.frames, sp2.frames):
                assert f1.tobytes() == f2.tobytes()


@pytest.mark.parametrize("sid", [s for s, (_, sec) in SCENES.items() if sec])
@pytest.mark.parametrize("variant", VARIANTS)
def test_tags_sit_at_a_depth_something_is_drawn_at(sid, variant):
    s = built(sid, variant)
    assert s.tag_depth is not None and s.tag_depth in {l.depth for l in s.layers} | {sp.depth for sp in s.sprites}


# ---------- round 2: the new props ----------

def flat(s):
    """The scene's layers and first sprite frames painted back to front."""
    from PIL import Image
    canvas = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0))
    items = [(l.depth, 0, l.image, (0, 0)) for l in s.layers] + [(sp.depth, 1, sp.frames[0], (sp.x, sp.y)) for sp in s.sprites]
    for _, _, im, pos in sorted(items, key=lambda a: (a[0], a[1])):
        canvas.paste(im, pos, im)
    return canvas


@pytest.mark.parametrize("variant", VARIANTS)
def test_desk_page_holds_an_ink_sketch(variant):
    s = built("desk", variant)
    assert s.anchors["page"][:2] == s.anchors["slate"][:2]
    x, y = s.anchors["page"][:2]
    im = flat(s).crop((x - 48, y - 30, x + 48, y + 30))
    cols = [c[:3] for _, c in im.getcolors(1 << 16)]
    counts = {c[:3]: n for n, c in im.getcolors(1 << 16)}
    paper, ink = PALETTE["paper"], PALETTE["ink"]
    assert counts.get(paper, 0) >= 0.5 * 96 * 60, "the page is at least 96x60 of paper"
    assert counts.get(ink, 0) >= 120, "with an ink sketch on it"
    assert counts.get(paper, 0) + counts.get(ink, 0) >= 0.85 * 96 * 60, cols


@pytest.mark.parametrize("variant", VARIANTS)
def test_desk_sketch_is_a_quarter_size_copy_of_the_shell_ink(variant):
    """The join zooms the page 4x onto scene 3's ink: each sketch cell is the 4x4 block of scene 3's ink round the shell."""
    d, sh = built("desk", variant), built("shell", variant)
    sx, sy = sh.anchors["spiral"][:2]
    ax, ay = d.anchors["sketch_shell"][:2]
    paper = next(sp for sp in d.sprites if sp.id == "paper")
    assert len({f.tobytes() for f in paper.frames}) == 1, "the sketch is the same on every frame (the hand-over can fall on any)"
    page = paper.frames[0].convert("RGBA")
    ink = sh.ink.convert("RGBA")
    ci, cj = ax - paper.x - 8, ay - paper.y - 6          # the shell's cell on the 104x68 sheet
    wrong = seen = 0
    for j in range(65):
        for i in range(101):
            x0, y0 = sx + 4 * (i - ci), sy + 4 * (j - cj)
            if not (0 <= x0 and x0 + 4 <= sh.w and 0 <= y0 and y0 + 4 <= sh.h):
                continue
            n = sum(ink.getpixel((x0 + a, y0 + b))[:3] == PALETTE["ink"] for a in range(4) for b in range(4))
            on = page.getpixel((8 + i, 6 + j))[:3] == PALETTE["ink"]
            seen += 1
            wrong += (on and n == 0) or (not on and n >= 8)
    assert seen > 2000 and wrong == 0, (seen, wrong)


@pytest.mark.parametrize("variant", VARIANTS)
def test_shell_has_an_ink_twin(variant):
    s = built("shell", variant)
    assert s.ink is not None and s.ink.size == (s.w, s.h)
    cols = {c[:3] for _, c in s.ink.convert("RGBA").getcolors(1 << 16) if c[3]}
    assert cols == {PALETTE["ink"], PALETTE["paper"]}
    assert all(c[3] == 255 for _, c in s.ink.convert("RGBA").getcolors(1 << 16)), "the sketch is opaque paper"


@pytest.mark.parametrize("variant", VARIANTS)
def test_shell_objects_bob_and_glint(variant):
    s = built("shell", variant)
    ids = {sp.id: sp for sp in s.sprites}
    for fid in SITE_IDS["s3"]:
        assert len(ids[f"feat-{fid}"].frames) == 2, fid
        assert len(ids[f"glint-{fid}"].frames) == 3, fid
        tag = next(t for t in s.tags if t[0] == fid)
        assert inside(sprite_box(ids[f"feat-{fid}"]), (tag[1], tag[2])), fid


@pytest.mark.parametrize("sid,sprite,anchor", [("atlas", "falling_star", "star"), ("square", "lantern_rise", "lantern_up")])
@pytest.mark.parametrize("variant", VARIANTS)
def test_light_carriers(sid, sprite, anchor, variant):
    s = built(sid, variant)
    sp = next(sp for sp in s.sprites if sp.id == sprite)
    assert sp.mode == "scrub" and len(sp.frames) >= 5
    n = len(sp.frames)
    early = sp.frames[: int(n * 0.8)]
    assert len({f.tobytes() for f in early}) == 1, "nothing moves before the last fifth of the shot"
    assert sp.frames[-1].tobytes() != sp.frames[0].tobytes()
    x, y = s.anchors[anchor][:2]
    assert (s.anchors[anchor][2:] or (1.0,))[0] == sp.depth, "the anchor sits at its sprite's depth"
    assert inside(sprite_box(sp, n - 1), (x, y))
    assert sp.frames[-1].getpixel((x - sp.x, y - sp.y))[3] == 255, "the last frame's light is at the anchor"


KINDS = ("visionary", "artisan", "crafter", "maker", "doer", "designer", "innovator", "operator")


def _overlap(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


@pytest.mark.parametrize("variant", VARIANTS)
def test_square_holds_the_eight_kinds_of_people(variant):
    s = built("square", variant)
    safe = safe_box(variant)
    by_id = {sp.id: sp for sp in s.sprites}
    keep_clear = [sprite_box(by_id[i]) for i in ("who", "dog", "dog2", "snail")]
    for kind in KINDS:
        sp = by_id[f"folk-{kind}"]
        assert len(sp.frames) >= 2 and len({f.tobytes() for f in sp.frames}) >= 2, kind
        box = sprite_box(sp)
        assert inside(safe, box[:2]) and inside(safe, box[2:]), kind
        for other in keep_clear:
            assert not _overlap(box, other), kind
    assert not any(t[0].startswith("folk") for t in s.tags)
