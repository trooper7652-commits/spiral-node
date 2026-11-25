import json

import pytest

from . import cast
from .palette import PALETTE

INK = (28, 26, 20, 255)
ORANGE = (240, 118, 46, 255)
GOLD = (233, 168, 32, 255)
SKIN = PALETTE["skin"] + (255,)
COLOURS = set(PALETTE.values())
SCENE_POSE = {"newton": "sit_slate", "leonardo": "write_back", "anning": "crouch",
              "faraday": "turn_wheel", "lovelace": "read", "idrisi": "plant_flag",
              "galileo": "telescope", "socrates": "show_slate"}
FIGURE_POSES = [(n, p) for n in SCENE_POSE for p in ("stand_back", SCENE_POSE[n])]
DOG_POSES = ["lie", "sleep", "sniff", "watch", "tug", "trail", "look_up", "greet", "stand"]


def all_sets():
    for n, p in FIGURE_POSES:
        yield f"{n}/{p}", cast.figure(n, p)
    for p in DOG_POSES:
        yield f"dog/{p}", cast.dog(p)
    yield "snail", cast.snail()
    for n in SCENE_POSE:
        yield f"walker/{n}", cast.walker(n)
    yield "walker_dog", cast.walker_dog()


def pixels(im):
    w, h = im.size
    return [(x, y, im.getpixel((x, y))) for y in range(h) for x in range(w)]


def test_unknown_names_raise():
    with pytest.raises(KeyError):
        cast.figure("newton", "nope")
    with pytest.raises(KeyError):
        cast.figure("nobody", "stand_back")
    with pytest.raises(KeyError):
        cast.walker("nobody")
    with pytest.raises(KeyError):
        cast.dog("nope")


@pytest.mark.parametrize("name,frames", list(all_sets()))
def test_frames_consistent(name, frames):
    assert len(frames) >= 2
    assert len({f.size for f in frames}) == 1
    assert len({f.tobytes() for f in frames}) >= 2, f"{name} never moves"
    for f in frames:
        for _, _, p in pixels(f):
            assert p[3] in (0, 255)
            if p[3]:
                assert p[:3] in COLOURS


@pytest.mark.parametrize("name,frames", list(all_sets()))
def test_outer_edge_is_ink(name, frames):
    for f in frames:
        w, h = f.size
        for x, y, p in pixels(f):
            if p[3] == 0:
                continue
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if not (0 <= nx < w and 0 <= ny < h) or f.getpixel((nx, ny))[3] == 0:
                    assert p == INK, (name, x, y)


def test_figure_list_matches_scenes():
    assert cast.FIGURES == tuple(SCENE_POSE)
    assert set(cast.HAIR) == set(cast.FIGURES)


def opaque(im):
    """Opaque pixels keyed by offset from the bottom-centre of the frame."""
    w, h = im.size
    return {(x - w // 2, y - h): im.getpixel((x, y)) for y in range(h) for x in range(w)
            if im.getpixel((x, y))[3]}


@pytest.mark.parametrize("a,b", [(a, b) for i, a in enumerate(SCENE_POSE) for b in list(SCENE_POSE)[i + 1:]])
def test_figures_differ(a, b):
    pa, pb = opaque(cast.figure(a, "stand_back")[0]), opaque(cast.figure(b, "stand_back")[0])
    union = pa.keys() | pb.keys()
    diff = sum(1 for k in union if pa.get(k) != pb.get(k))
    assert diff >= 0.25 * len(union), (a, b, diff, len(union))


@pytest.mark.parametrize("name,pose", FIGURE_POSES)
def test_faces_are_simple(name, pose):
    allowed = {SKIN} | {PALETTE[c] + (255,) for c in cast.HAIR[name]}
    for i, f in enumerate(cast.figure(name, pose)):
        box = cast.face_box(name, pose, i)
        if pose in ("stand_back", "write_back"):
            assert box is None
            continue
        x0, y0, x1, y1 = box
        cells = [f.getpixel((x, y)) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
        assert len([c for c in cells if c not in allowed]) <= 2, (name, pose, i)
        assert cells.count(SKIN) >= 4, (name, pose, i)  # a face is really there


@pytest.mark.parametrize("name", list(SCENE_POSE))
def test_walkers_fit_cell(name):
    frames = cast.walker(name)
    assert len(frames) == 2
    assert all(f.width <= 12 and f.height <= 12 for f in frames)


def test_snail_colours():
    for f in cast.snail():
        ps = [p for _, _, p in pixels(f)]
        assert ORANGE in ps and GOLD in ps


def test_walker_dog_two_frames():
    assert len(cast.walker_dog()) == 2


def test_write_trail(tmp_path):
    cast.write_trail(tmp_path)
    from PIL import Image
    meta = json.loads((tmp_path / "trail.json").read_text())
    im = Image.open(tmp_path / "trail.png").convert("RGBA")
    w, h = meta["cell"]
    assert (w, h) == (12, 12)
    assert meta["walker"] == [0, 1] and meta["dog"] == [2, 3]
    assert meta["rows"] == {n: i for i, n in enumerate(SCENE_POSE)}
    assert im.size == (4 * w, 8 * h)
    for r in range(8):
        for i in range(4):  # every cell holds a drawn frame
            assert im.crop((i * w, r * h, (i + 1) * w, (r + 1) * h)).getbbox() is not None
