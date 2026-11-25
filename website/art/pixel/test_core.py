import pytest
from PIL import Image

from .build import main
from .draw import dither, disc, line, new, outline, put, sprite
from .palette import PALETTE, ramp
from .scene import Layer, Scene, Sprite, safe_box, write


def sample_scene():
    bg = new(576, 360)
    dither(bg, (0, 0, 575, 359), ramp("paper", "sun", "sky"), lambda x, y: y / 360)
    fx = new(576, 360)
    disc(fx, 300, 180, 20, "red")
    key = {"#": "paper", "o": "gold"}
    a = [outline(sprite(["........", "..####..", "..#oo#..", "..####..", "..#..#..", "........"], key))
         for _ in range(3)]
    b = [sprite(["..#..", ".###.", "#####", ".###.", "..#.."], key) for _ in range(2)]
    return Scene("sample", "wide", 576, 360,
                 [Layer("sky", bg, 0.1), Layer("fx", fx, 0.5)],
                 [Sprite("walker", a, 6, 100, 200, 0.5), Sprite("star", b, 2, 50, 40, 0.2, "scrub")],
                 {"slate": (100, 200)}, [("t1", 120, 210)])


def test_palette_is_small_and_has_ink_and_paper():
    assert len(PALETTE) <= 32 and PALETTE["ink"] == (28, 26, 20) and PALETTE["paper"] == (241, 231, 204)


def test_outline_adds_ink_only_outside_the_shape():
    im = new(5, 5); put(im, 2, 2, PALETTE["paper"])
    out = outline(im)
    assert out.getpixel((2, 2))[:3] == PALETTE["paper"]
    assert all(out.getpixel(p)[:3] == PALETTE["ink"] for p in [(1, 2), (3, 2), (2, 1), (2, 3)])
    assert out.getpixel((0, 0))[3] == 0


def test_write_is_deterministic_and_palette_only(tmp_path):
    a = write(sample_scene(), tmp_path / "a"); b = write(sample_scene(), tmp_path / "b")
    assert a == b and (tmp_path / "a/atlas.png").read_bytes() == (tmp_path / "b/atlas.png").read_bytes()
    allowed = set(PALETTE.values())
    for png in (tmp_path / "a").glob("*.png"):
        assert {c[:3] for _, c in Image.open(png).convert("RGBA").getcolors(1 << 20) if c[3]} <= allowed


def test_manifest_lists_every_sprite_inside_the_atlas(tmp_path):
    m = write(sample_scene(), tmp_path); aw, ah = Image.open(tmp_path / "atlas.png").size
    assert all(s["ax"] + s["w"] * s["frames"] <= aw and s["ay"] + s["h"] <= ah for s in m["sprites"])


def test_manifest_has_the_exact_shape_the_site_reads(tmp_path):
    m = write(sample_scene(), tmp_path)
    assert list(m) == ["id", "variant", "w", "h", "layers", "atlas", "sprites", "anchors", "tags"]
    assert m["layers"][0] == {"id": "sky", "src": "layer-sky.png", "depth": 0.1}
    assert [list(s) for s in m["sprites"]] == [["id", "x", "y", "w", "h", "frames", "fps", "depth", "mode", "ax", "ay"]] * 2
    assert [(s["ax"], s["ay"], s["frames"]) for s in m["sprites"]] == [(0, 0, 3), (0, 6, 2)]
    assert m["anchors"] == {"slate": {"x": 100, "y": 200}} and m["tags"] == [{"id": "t1", "x": 120, "y": 210}]



def test_tags_carry_the_depth_of_what_they_sit_on(tmp_path):
    s = sample_scene(); s.tag_depth = 0.5
    assert write(s, tmp_path)["tags"] == [{"id": "t1", "x": 120, "y": 210, "depth": 0.5}]

def test_write_rejects_a_scene_of_the_wrong_size(tmp_path):
    s = sample_scene(); s.w = 500
    with pytest.raises(ValueError):
        write(s, tmp_path)


def test_outline_reaches_the_border():
    im = new(3, 3); put(im, 0, 0, "paper")
    out = outline(im)
    assert out.getpixel((1, 0))[:3] == PALETTE["ink"]
    assert out.getpixel((0, 1))[:3] == PALETTE["ink"]
    assert out.getpixel((0, 0))[:3] == PALETTE["paper"]
    assert out.getpixel((2, 2))[3] == 0


def test_line_draws_both_ends():
    im = new(6, 6); line(im, 0, 0, 5, 3, "ink")
    assert im.getpixel((0, 0))[:3] == PALETTE["ink"] and im.getpixel((5, 3))[:3] == PALETTE["ink"]
    line(im, 2, 5, 2, 5, "gold")
    assert im.getpixel((2, 5))[:3] == PALETTE["gold"]


def test_put_clips():
    put(new(2, 2), 5, 5, "ink")


def test_build_unknown_id_returns_2():
    assert main(["no-such-scene"]) == 2


def test_dither_one_colour_ramp():
    im = new(8, 8); dither(im, (0, 0, 7, 7), ["gold"], lambda x, y: 0.7)
    assert {im.getpixel((x, y))[:3] for x in range(8) for y in range(8)} == {PALETTE["gold"]}


def test_sprite_raises_on_ragged_rows():
    with pytest.raises(ValueError, match="Ragged rows"):
        sprite(["ab", "a"], {})


def test_write_raises_on_wrong_layer_size(tmp_path):
    s = Scene("bad", "wide", 576, 360, [Layer("x", new(10, 10), 0)], [])
    with pytest.raises(ValueError):
        write(s, tmp_path)


def test_write_without_sprites_still_makes_atlas(tmp_path):
    write(Scene("e", "tall", 240, 480, [], []), tmp_path)
    assert Image.open(tmp_path / "atlas.png").size == (1, 1)


def test_safe_box_values():
    assert safe_box("wide") == (88, 80, 488, 280)
    assert safe_box("tall") == (30, 105, 210, 375)


def test_anchor_depth_is_written_only_when_given(tmp_path):
    s = sample_scene(); s.anchors = {"a": (1, 2), "b": (3, 4, 0.8)}
    assert write(s, tmp_path)["anchors"] == {"a": {"x": 1, "y": 2}, "b": {"x": 3, "y": 4, "depth": 0.8}}


def test_write_rejects_colours_outside_the_palette_and_soft_alpha(tmp_path):
    s = sample_scene(); s.layers[1].image.putpixel((0, 0), (1, 2, 3, 255))
    with pytest.raises(ValueError, match="layer fx"):
        write(s, tmp_path)
    s = sample_scene(); s.sprites[1].frames[0].putpixel((0, 0), (*PALETTE["ink"], 128))
    with pytest.raises(ValueError, match="sprite star"):
        write(s, tmp_path)


def test_write_deletes_layer_files_the_scene_no_longer_names(tmp_path):
    write(sample_scene(), tmp_path)
    s = sample_scene(); s.layers = s.layers[:1]
    write(s, tmp_path)
    assert sorted(p.name for p in tmp_path.glob("layer-*.png")) == ["layer-sky.png"]
