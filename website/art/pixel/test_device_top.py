"""The device's top edge carries two USB-C ports, the charge light and the power button; its left edge is bare.
Checked on the device layer of scene 4 ("device") and of the opening ("opening"), which draw the same device."""
from functools import lru_cache

import pytest

from .build import registry
from .palette import PALETTE
from .scenes import s0_opening, s4_device

GEOS = {"device": s4_device.GEO, "opening": s0_opening.GEO}
VARIANTS = ["wide", "tall"]


@lru_cache(maxsize=None)
def device(sid, variant):
    s = registry()[sid](variant)
    return next(ly for ly in s.layers if ly.id == "device").image, GEOS[sid][variant]


def runs(im, colour, xs, ys):
    """The x-runs of `colour` in the given columns and rows, as (first, last) pairs."""
    hit = sorted({x for y in ys for x in xs if im.getpixel((x, y))[:3] == PALETTE[colour] and im.getpixel((x, y))[3] == 255})
    out = []
    for x in hit:
        if out and x == out[-1][1] + 1:
            out[-1][1] = x
        else:
            out.append([x, x])
    return out


def check_top_face(im, g):
    x0, y0, bw, bh = g["x0"], g["y0"], g["bw"], g["bh"]
    cols = range(x0, x0 + bw)
    ports = runs(im, "night", cols, range(y0, y0 + 4))
    assert len(ports) == 2, f"two USB-C ports on the top edge, got {ports}"
    mid = x0 + bw / 2
    assert all(abs((a + b) / 2 - mid) < bw / 4 for a, b in ports), "the ports sit near the middle"
    light = runs(im, "amber", cols, range(y0 - 1, y0 + 5))
    assert len(light) == 1 and light[0][0] > ports[1][1], "the charge light is just right of the ports"
    button = runs(im, "paper", cols, range(y0 - 3, y0))
    assert len(button) == 1 and button[0][0] > light[0][1], "the power button is right of the light, above the edge"
    assert button[0][1] > x0 + bw * 0.6, "the power button is toward the right end"
    # the left edge has nothing: no port opening in the strip along it
    assert not runs(im, "night", range(x0 - 2, x0 + 8), range(y0 + 20, y0 + bh - 20))


@pytest.mark.parametrize("variant", VARIANTS)
def test_scene_4_top_face(variant):
    check_top_face(*device("device", variant))


@pytest.mark.parametrize("variant", VARIANTS)
def test_opening_top_face(variant):
    check_top_face(*device("opening", variant))


@pytest.mark.parametrize("variant", VARIANTS)
def test_port_tag_is_on_the_top_edge(variant):
    s = registry()["device"](variant)
    g = s4_device.GEO[variant]
    _, tx, ty = next(t for t in s.tags if t[0] == "port")[:3]
    assert abs(ty - g["y0"]) <= 6 and abs(tx - (g["x0"] + g["bw"] / 2)) <= g["bw"] / 4


@pytest.mark.parametrize("sid", ["device", "opening"])
@pytest.mark.parametrize("variant", VARIANTS)
def test_no_orange_light_on_the_front_face(sid, variant):
    im, g = device(sid, variant)
    x0, y0, bw, bh = g["x0"], g["y0"], g["bw"], g["bh"]
    assert not runs(im, "orange", range(x0 + 4, x0 + bw - 4), range(y0 + 6, y0 + 100)), "no light on the bezel"


@pytest.mark.parametrize("variant", VARIANTS)
def test_opening_led_blinks_on_the_top_light(variant):
    s = registry()["opening"](variant)
    g = s0_opening.GEO[variant]
    sp = next(x for x in s.sprites if x.id == "led")
    light = runs(device("opening", variant)[0], "amber", range(g["x0"], g["x0"] + g["bw"]), range(g["y0"] - 1, g["y0"] + 5))[0]
    assert light[0] <= sp.x and sp.x + 2 - 1 <= light[1], "the led is over the top light, left to right"
    assert g["y0"] - 1 <= sp.y and sp.y + 1 <= g["y0"] + 3, "and on the top edge"
