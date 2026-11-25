from PIL import Image

from spiral.device.buttons import GpioButtons
from spiral.device.eink import EinkDisplay
from spiral.input import Action, Button, LongPress


class FakeEpd:
    def __init__(self):
        self.calls = []

    def display_full(self, buf):
        self.calls.append(("full", buf))

    def display_partial(self, buf):
        self.calls.append(("partial", buf))


def _img(color):
    return Image.new("1", (250, 122), color)


def _kinds(epd):
    return [k for k, _ in epd.calls]


def test_first_frame_is_full():
    epd = FakeEpd()
    EinkDisplay(epd).show(_img(1), False)
    assert _kinds(epd) == ["full"]


def test_partial_after_full():
    epd = FakeEpd()
    d = EinkDisplay(epd)
    d.show(_img(1), False)
    d.show(_img(0), False)
    assert _kinds(epd) == ["full", "partial"]


def test_identical_partial_skipped():
    epd = FakeEpd()
    d = EinkDisplay(epd)
    d.show(_img(1), False)
    d.show(_img(1), False)
    assert _kinds(epd) == ["full"]


def test_full_flag_forces_full():
    epd = FakeEpd()
    d = EinkDisplay(epd)
    d.show(_img(1), False)
    d.show(_img(1), True)
    assert _kinds(epd) == ["full", "full"]


class Script:
    """Line levels by time: {line: [(t_seconds, level), ...]}; the latest entry at or before now."""

    def __init__(self, script):
        self.script = script
        self.now = 0.0

    def read(self, line):
        level = 1
        for t, v in self.script.get(line, []):
            if t <= self.now + 1e-9:
                level = v
        return level

    def close(self):
        pass


def _run(script, times, pins=None):
    reader = Script(script)
    buttons = GpioButtons(reader, pins or {Button.UP: 1})
    out = []
    for t in times:
        reader.now = t
        out.append((t, buttons.poll(t)))
    return out


def test_bounce_gives_one_press():
    times = [0, 0.005, 0.010, 0.015, 0.040]
    script = {1: [(0, 0), (0.005, 1), (0.010, 0)]}
    out = _run(script, times)
    events = [(t, e) for t, evs in out for e in evs]
    assert [e for _, e in events] == [(Button.UP, True)]
    assert events[0][0] >= 0.030 - 1e-9


def test_release_edge():
    times = [i * 0.01 for i in range(0, 12)]
    script = {1: [(0, 0), (0.05, 1)]}
    events = [e for _, evs in _run(script, times) for e in evs]
    assert events == [(Button.UP, True), (Button.UP, False)]


def test_held_button_no_repeats():
    times = [i * 0.01 for i in range(0, 201)]
    events = [e for _, evs in _run({1: [(0, 0)]}, times) for e in evs]
    assert events == [(Button.UP, True)]


def test_held_select_one_back():
    reader = Script({2: [(0, 0), (1.5, 1)]})
    buttons = GpioButtons(reader, {Button.UP: 1, Button.SELECT: 2})
    lp = LongPress()
    actions = []
    for i in range(0, 181):
        t = i * 0.01
        reader.now = t
        for b, pressed in buttons.poll(t):
            a = lp.press(b, t) if pressed else lp.release(b, t)
            if a:
                actions.append(a)
        a = lp.tick(t)
        if a:
            actions.append(a)
    assert actions == [Action.BACK]
