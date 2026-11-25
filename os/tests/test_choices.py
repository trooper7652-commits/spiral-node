import random
import shutil
from datetime import date, timedelta
from pathlib import Path

import pytest

from spiral.input import Action
from spiral.render import BTN_H, PAD, SCREEN_H, SCREEN_W, _font, _line_h, _page_top, _w, page_fits, page_screen, picture_max_h
from spiral.scripts_api import Page, ScriptContext, check_choices, tally_line, quiz_page
from spiral.storage import Store
from test_app_flow import FakeClock, boot_to_home, make_app

FIX = Path(__file__).parent / "fixtures" / "scripts"
PREFS = {"interval": 30}


def start(tmp_path, name="quiz", prefs=PREFS):
    shutil.copytree(FIX / name, tmp_path / "scripts" / name)
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    app.start_script(name, prefs)
    return app, clock


def interval(app, clock, s=30):
    clock.advance(s)
    app.tick()


def calls(app):
    return app.scripts["quiz"].module.CALLS


def test_waiting_page_holds_timer(tmp_path):
    app, clock = start(tmp_path)
    assert app.waiting
    for _ in range(3):
        interval(app, clock)
    assert len(app.history) == 1


def test_left_right_move_cursor_and_select_picks(tmp_path):
    app, clock = start(tmp_path)
    app.handle(Action.RIGHT)
    assert app.cursor == 1 and "Choices: A, [B]" in app.screen_text()
    app.handle(Action.SELECT)
    assert app.history[-2]["picked"] == 1
    assert app.history[-1]["title"] == "Not quite"
    assert calls(app) == [("q1", 1)]


def test_left_is_clamped_and_right_past_last_skips(tmp_path):
    app, clock = start(tmp_path)
    app.handle(Action.LEFT)
    assert app.cursor == 0 and len(app.history) == 1
    app.handle(Action.RIGHT)
    app.handle(Action.RIGHT)
    assert len(app.history) == 2 and app.history[0]["picked"] is None and app.cursor == 0


def test_after_answer_timer_resumes(tmp_path):
    app, clock = start(tmp_path)
    app.handle(Action.SELECT)
    interval(app, clock, 29)
    assert len(app.history) == 2
    interval(app, clock, 1)
    assert len(app.history) == 3 and app.history[-1]["title"] == "Q1"


def test_down_skips_question(tmp_path):
    app, clock = start(tmp_path)
    app.handle(Action.DOWN)
    assert len(app.history) == 2 and app.history[0]["picked"] is None


def test_old_question_select_opens_menu(tmp_path):
    app, clock = start(tmp_path)
    app.handle(Action.DOWN)
    app.handle(Action.UP)
    assert app.hpos == 0
    app.handle(Action.SELECT)
    assert app.screen_name == "menu" and calls(app) == []


def test_back_on_home_opens_menu(tmp_path):
    app, clock = start(tmp_path)
    app.handle(Action.BACK)
    assert app.screen_name == "menu"
    app.handle(Action.BACK)
    app.handle(Action.SELECT)  # answer; now a plain page is shown
    app.handle(Action.BACK)
    assert app.screen_name == "menu"


def test_reboot_keeps_question_answerable(tmp_path):
    app, clock = start(tmp_path)
    app.store.flush()
    app2, clock2, _ = make_app(tmp_path)
    boot_to_home(app2, clock2)
    assert app2.waiting and app2.history[-1]["key"] == "q1"
    assert "Choices: [A], B" in app2.screen_text()
    app2.handle(Action.SELECT)
    assert app2.history[-1]["body"] == "key q1"


@pytest.mark.parametrize("variant", ["five", "long", "nochoose", "nokey"])
def test_bad_choices_is_script_error(tmp_path, variant):
    app, clock = start(tmp_path, "bad_choices", {"interval": 30, "variant": variant})
    assert app.error_page.title == "Script error"


def test_check_choices_rules():
    check_choices(Page("t", "b"))
    check_choices(Page("t", "b", choices=["A", "B"], key="k"))
    for bad in (("A", "A"), ("",), ("  ",), (1,), "AB"):
        with pytest.raises(ValueError):
            check_choices(Page("t", "b", choices=bad, key="k"))
    with pytest.raises(ValueError):
        check_choices(Page("t", "b", choices=("A",), key="k" * 201))


def test_record_tally(tmp_path):
    day = [date(2026, 3, 1)]
    ctx = ScriptContext("s", tmp_path, {}, Store(tmp_path / "d", FakeClock()), random.Random(1), lambda: day[0])
    streaks = []
    for gap in (0, 0, 1, 3):
        day[0] += timedelta(days=gap)
        streaks.append(ctx.record(True)["streak"])
    assert streaks == [1, 1, 2, 1]
    t = ctx.record(False)
    assert (t["run"], t["best_run"], t["score"], t["answered"]) == (0, 4, 4, 5)
    assert t["last_day"] == day[0].isoformat() and t["best_streak"] == 2
    assert tally_line(t) == "4/5 right, run 0, 1-day streak"


def test_page_fits():
    assert not page_fits(Page("t", "word " * 200))
    assert page_fits(Page("t", "one\ntwo", choices=("A", "B", "C"), key="k"))
    lines = (SCREEN_H - _page_top() - 1) // _line_h(_font(10))
    body = "\n".join("x" * lines)
    assert page_fits(Page("t", body))
    assert not page_fits(Page("t", body, choices=("A",), key="k"))
    assert not page_fits(Page("t", "b", choices=("WWWWWWWWWW",) * 1 + ("MMMMMMMMMM", "WWWWWWWWWV", "WWWWWWWWVV"), key="k"))
    assert not page_fits(Page("t" * 80, "b"))
    assert not page_fits(Page("t", "x" * 60))
    pic = ("." * 88,) * picture_max_h()
    body = "White to move\nFind mate in 2\nRating 779"
    assert page_fits(Page("t", body, pic, ("Show",), "k"))
    assert not page_fits(Page("t", body, pic, ("WWWWWWWWWW", "MMMMMMMMMM", "WWWWWWWWWV", "WWWWWWWWVV"), "k"))


def test_skip_then_timer_runs_and_old_question_stays_unanswerable(tmp_path):
    app, clock = start(tmp_path, prefs={"interval": 30, "mode": "alternate"})
    app.handle(Action.DOWN)
    assert app.history[-1]["title"] == "Plain" and not app.waiting and app.next_due is not None
    interval(app, clock)
    assert len(app.history) == 3 and app.history[0]["picked"] is None
    app.handle(Action.UP)
    app.handle(Action.LEFT)  # Up does nothing on a plain page
    assert app.hpos == 0
    app.handle(Action.SELECT)
    assert app.screen_name == "menu" and calls(app) == []


def _boxes(page, cursor, picked):
    """Per button: (outline pixel, interior pixel) as drawn; geometry mirrors _buttons."""
    im = page_screen(page, None, cursor, picked)
    f, x, out = _font(12), SCREEN_W - PAD, []
    for label in reversed(page.choices):
        w = int(_w(f, label)) + 12
        out.insert(0, (im.getpixel((x - w, SCREEN_H - 2 - BTN_H + 1 + 5)), im.getpixel((x - w + 2, SCREEN_H - 2 - BTN_H + 1 + 2))))
        x -= w + 4
    return out


def test_button_states_render_differently():
    page = Page("t", "b", choices=("A", "B"), key="k")
    assert _boxes(page, 1, None) == [(0, 1), (0, 0)]  # boxed; cursor button filled
    assert _boxes(page, None, 0) == [(0, 1), (1, 1)]  # only the picked one boxed
    assert _boxes(page, None, None) == [(1, 1), (1, 1)]  # old, unpicked: plain


def test_quiz_page_layouts():
    p = quiz_page("Q", "Which planet is red?", ["Mars", "Venus", "Jupiter"], "k")
    assert p.choices == ("A", "B", "C") and p.body == "Which planet is red?\nA: Mars\nB: Venus\nC: Jupiter"
    long_q = "This question is long enough to take up two full lines of the screen at the small size."
    p = quiz_page("Q", long_q, ["Mars", "Venus", "Jupiter"], "k")
    assert p.body == f"{long_q}\nA: Mars / B: Venus / C: Jupiter" and page_fits(p)
    assert quiz_page("Q", "word " * 60, ["Mars", "Venus", "Jupiter"], "k") is None
