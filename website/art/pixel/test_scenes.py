import json
from functools import lru_cache
from pathlib import Path

import pytest

from .build import registry
from .palette import PALETTE
from .scene import SIZES, safe_box, write

COUNTRY = ["countryside-sunset", "countryside-night"]
VARIANTS = ["wide", "tall"]
JOIN_ANCHORS = ["centre", "slate", "spiral", "wheel", "page", "roller", "map", "seam", "cloud", "lantern", "beam"]
ALLOWED = set(PALETTE.values())
SITE_IDS = json.loads(Path(__file__).with_name("site-ids.json").read_text())


@lru_cache(maxsize=None)
def built(sid, variant):
    return registry()[sid](variant)


def sprite_ids(scene):
    return [s.id for s in scene.sprites]


def inside(box, safe):
    return safe[0] <= box[0] and safe[1] <= box[1] and box[2] <= safe[2] and box[3] <= safe[3]


def sprite_box(s):
    return (s.x, s.y, s.x + s.frames[0].width, s.y + s.frames[0].height)


def assert_palette_only(im):
    for _, (r, g, b, a) in im.convert("RGBA").getcolors(1 << 20):
        assert a in (0, 255)
        if a:
            assert (r, g, b) in ALLOWED


@pytest.mark.parametrize("sid", COUNTRY)
@pytest.mark.parametrize("variant", VARIANTS)
def test_countryside_shape(sid, variant):
    s = built(sid, variant)
    assert (s.w, s.h) == SIZES[variant] and s.variant == variant and s.id == sid
    assert len(s.layers) >= 4
    assert len({l.depth for l in s.layers}) == len(s.layers)
    assert all(len(sp.frames) >= 2 for sp in s.sprites)
    assert [t[0] for t in s.tags] == ["who"]


@pytest.mark.parametrize("sid", COUNTRY)
@pytest.mark.parametrize("variant", VARIANTS)
def test_countryside_sprites_present(sid, variant):
    ids = sprite_ids(built(sid, variant))
    for need in ("who", "slate", "dog", "snail", "windmill", "grass", "leaves"):
        assert need in ids
    assert any(i.startswith("cloud") for i in ids)
    if sid.endswith("sunset"):
        assert "birds" in ids or "butterflies" in ids
    else:
        for need in ("fireflies", "stars", "shooting_star"):
            assert need in ids


@pytest.mark.parametrize("sid", COUNTRY)
@pytest.mark.parametrize("variant", VARIANTS)
def test_cast_and_slate_anchor_inside_safe_area(sid, variant):
    s, safe = built(sid, variant), safe_box(variant)
    for sp in s.sprites:
        if sp.id in ("who", "dog", "snail"):
            assert inside(sprite_box(sp), safe), sp.id
    x, y, *_ = s.anchors["slate"]
    assert safe[0] <= x <= safe[2] and safe[1] <= y <= safe[3]


@pytest.mark.parametrize("sid", COUNTRY)
@pytest.mark.parametrize("variant", VARIANTS)
def test_slate_anchor_carries_the_slate_depth(sid, variant):
    s = built(sid, variant)
    assert s.anchors["slate"][2] == next(sp.depth for sp in s.sprites if sp.id == "slate")


@pytest.mark.parametrize("sid", COUNTRY)
@pytest.mark.parametrize("variant", VARIANTS)
def test_countryside_uses_palette_colours_only(sid, variant):
    s = built(sid, variant)
    for layer in s.layers:
        assert_palette_only(layer.image)
    for sp in s.sprites:
        for f in sp.frames:
            assert_palette_only(f)


@pytest.mark.parametrize("sid", COUNTRY)
@pytest.mark.parametrize("variant", VARIANTS)
def test_countryside_png_total_is_small(sid, variant, tmp_path):
    write(built(sid, variant), tmp_path)
    assert sum(p.stat().st_size for p in tmp_path.glob("*.png")) <= 300 * 1024


@pytest.mark.parametrize("sid", COUNTRY)
@pytest.mark.parametrize("variant", VARIANTS)
def test_atlas_width_limit(sid, variant):
    for sp in built(sid, variant).sprites:
        assert sp.frames[0].width * len(sp.frames) <= 2048, sp.id


def test_countryside_is_deterministic():
    a, b = registry()["countryside-night"]("tall"), registry()["countryside-night"]("tall")
    assert [l.image.tobytes() for l in a.layers] == [l.image.tobytes() for l in b.layers]
    assert [[f.tobytes() for f in s.frames] for s in a.sprites] == [[f.tobytes() for f in s.frames] for s in b.sprites]


