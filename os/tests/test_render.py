from datetime import datetime

from spiral import render
from spiral.config import SCREEN_H, SCREEN_W, TOP_BAR_H
from spiral.render import TopBar
from spiral.scripts_api import Page

NOW = datetime(2026, 11, 11, 2, 47)
BAR = TopBar(now=NOW, saving=False, battery=80)


def test_format_clock():
    assert render.format_clock(datetime(2026, 1, 1, 2, 47)) == "2:47AM"
    assert render.format_clock(datetime(2026, 1, 1, 0, 5)) == "12:05AM"
    assert render.format_clock(datetime(2026, 1, 1, 13, 30)) == "1:30PM"


def test_all_screens_are_250x122_1bit():
    screens = [
        render.page_screen(Page("Fact", "Snails have teeth.\n\nReally?"), BAR),
        render.message_screen("Hello", BAR),
        render.list_screen(["Scripts", "Chat"], 0, BAR),
        render.prefs_screen("Fun Fact", [("Refresh", "30 s")], ["OK"], 0, BAR),
        render.dialog_screen("Power off?", ["Cancel", "OK"], 1, BAR),
        render.clock_set_screen(14, 5, 2, BAR),
        render.boot_frame(0, 5, None),
        render.boot_frame(4, 5, "Welcome."),
        render.off_screen(),
        render.message_screen("x", TopBar(NOW, True, None)),
    ]
    for im in screens:
        assert im.mode == "1" and im.size == (SCREEN_W, SCREEN_H)


def test_picture_page_draws_left_and_wraps_text():
    rows = tuple("".join("#" if (x + y) % 2 else "." for x in range(30)) for y in range(20))
    plain = render.page_screen(Page("T", "word " * 12), BAR)
    im = render.page_screen(Page("T", "word " * 12, rows), BAR)
    ty = render.BODY_TOP + render._line_h(render._font(12)) + 1 + 3
    for y, row in enumerate(rows):
        for x, c in enumerate(row):
            assert im.getpixel((render.PAD + x, ty + y)) == (0 if c == "#" else 1)
    right = render.PAD * 2 + 30
    # text sits right of the picture box, and differs from the no-picture page
    assert any(im.getpixel((x, y)) == 0 for x in range(right, SCREEN_W) for y in range(ty, SCREEN_H))
    assert im.tobytes() != plain.tobytes()
    assert render.picture_max_h() == SCREEN_H - ty - 1


def test_long_text_shrinks_then_ellipsis():
    w, h = SCREEN_W, SCREEN_H - TOP_BAR_H
    font, lines = render.fit_text("word " * 120, w, h)
    assert len(lines) > 0 and lines[-1].endswith("…")
    assert font.size == 10
    assert all(font.getlength(line) <= w for line in lines)


def test_short_text_uses_16px():
    font, lines = render.fit_text("Hello there", SCREEN_W, 100)
    assert font.size == 16 and lines == ["Hello there"]


def test_saving_icon_differs_from_saved():
    a = render.message_screen("x", TopBar(NOW, False, 50)).crop((0, 0, SCREEN_W, TOP_BAR_H))
    b = render.message_screen("x", TopBar(NOW, True, 50)).crop((0, 0, SCREEN_W, TOP_BAR_H))
    assert a.tobytes() != b.tobytes()


def test_list_scrolls_to_highlight():
    items = [f"item {i}" for i in range(30)]
    top = render.list_screen(items, 0, BAR)
    low = render.list_screen(items, 29, BAR)
    assert top.tobytes() != low.tobytes()
    def inverted_y(im):  # the full-width inverted row is black at the right edge
        return [y for y in range(TOP_BAR_H + 1, SCREEN_H) if im.getpixel((SCREEN_W - 2, y)) == 0]

    assert inverted_y(top)[0] == TOP_BAR_H + 1
    assert inverted_y(low)[0] > SCREEN_H // 2


def test_off_screen_draws_logo_and_two_lines():
    im = render.off_screen()
    rows = [y for y in range(SCREEN_H) if any(im.getpixel((x, y)) == 0 for x in range(SCREEN_W))]
    bands = 1 + sum(1 for a, b in zip(rows, rows[1:]) if b > a + 1)
    assert bands == 3  # logo, "Spiral Node", "Helix Velocities"
