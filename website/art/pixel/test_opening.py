import json
from functools import lru_cache

import pytest

from .build import registry
from .palette import PALETTE
from .scene import SIZES, safe_box, validate, write

VARIANTS = ["wide", "tall"]
INK = PALETTE["ink"]


@lru_cache(maxsize=None)
def built(variant):
    return registry()["opening"](variant)


def inside(box, p):
    return box[0] <= p[0] <= box[2] and box[1] <= p[1] <= box[3]


def test_registered_as_opening():
    assert "opening" in registry()


@pytest.mark.parametrize("variant", VARIANTS)
def test_shape_and_palette(variant):
    s = built(variant)
    assert (s.id, s.variant, (s.w, s.h)) == ("opening", variant, SIZES[variant])
    depths = [ly.depth for ly in s.layers]
    assert len(s.layers) >= 4 and len(set(depths)) == len(depths)
    validate(s)  # every pixel a palette colour with alpha 0 or 255


@pytest.mark.parametrize("variant", VARIANTS)
def test_dark_ink_outlines(variant):
    s = built(variant)
    for lid in ("paper", "props", "device"):
        layer = next(ly for ly in s.layers if ly.id == lid)
        assert any(c[:3] == INK and c[3] == 255 for _, c in layer.image.getcolors(1 << 20)), lid
    assert any(c[:3] == INK for sp in s.sprites if sp.id == "snail" for f in sp.frames for _, c in f.getcolors(1 << 20))


@pytest.mark.parametrize("variant", VARIANTS)
def test_anchors_in_the_safe_box(variant):
    s = built(variant)
    box = safe_box(variant)
    assert set(s.anchors) == {"screen", "centre"}
    for name in s.anchors:
        assert inside(box, s.anchors[name][:2]), name


@pytest.mark.parametrize("variant", VARIANTS)
def test_screen_is_a_scrub_sprite_over_the_device_screen(variant):
    s = built(variant)
    sp = next(x for x in s.sprites if x.id == "screen")
    assert sp.mode == "scrub" and len(sp.frames) >= 8
    assert len({f.tobytes() for f in sp.frames}) >= len(sp.frames) - 1  # it changes along the shot (only the two "off" frames repeat)
    ax, ay = s.anchors["screen"][:2]
    assert sp.x < ax < sp.x + sp.frames[0].width and sp.y < ay < sp.y + sp.frames[0].height
    assert abs(sp.x + sp.frames[0].width / 2 - ax) <= 1 and abs(sp.y + sp.frames[0].height / 2 - ay) <= 1  # the anchor is the middle of the screen


@pytest.mark.parametrize("variant", VARIANTS)
def test_snail_is_the_only_cast_and_sits_in_the_safe_box(variant):
    s = built(variant)
    assert {x.id for x in s.sprites if x.id in ("who", "dog", "snail")} == {"snail"}
    sp = next(x for x in s.sprites if x.id == "snail")
    box = safe_box(variant)
    assert inside(box, (sp.x, sp.y)) and inside(box, (sp.x + sp.frames[0].width, sp.y + sp.frames[0].height))


@pytest.mark.parametrize("variant", VARIANTS)
def test_small_and_written_to_its_own_folder(variant, tmp_path):
    s = built(variant)
    m = write(s, tmp_path)
    assert sum(p.stat().st_size for p in tmp_path.rglob("*.png")) <= 300 * 1024
    assert all(sp["w"] * sp["frames"] <= 2048 for sp in m["sprites"])
    assert json.loads((tmp_path / "manifest.json").read_text())["anchors"]["screen"]["depth"] == 0.9


def test_deterministic():
    a, b = registry()["opening"]("tall"), registry()["opening"]("tall")
    assert [ly.image.tobytes() for ly in a.layers] == [ly.image.tobytes() for ly in b.layers]
    assert [[f.tobytes() for f in sp.frames] for sp in a.sprites] == [[f.tobytes() for f in sp.frames] for sp in b.sprites]
