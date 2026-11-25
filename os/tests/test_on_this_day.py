import json
import random
import re
from datetime import date, timedelta
from pathlib import Path

import spiral
from spiral.loader import discover
from spiral.render import page_fits
from spiral.scripts_api import ScriptContext
from spiral.storage import Store

BUILTIN = Path(spiral.__file__).parent / "builtin_scripts"
EVENTS = json.loads((BUILTIN / "on_this_day" / "events.json").read_text(encoding="utf-8"))


READ = {"mode": "Read"}
QUIZ = {"mode": "Quiz"}


def make(root, today, prefs=READ, seed=1, store=None):
    info = {i.id: i for i in discover(BUILTIN, root / "no-user-scripts")}["on_this_day"]
    assert info.error is None
    ctx = ScriptContext("on_this_day", info.folder, prefs, store or Store(root, lambda: 0.0),
                        random.Random(seed), lambda: today)
    return info.module, info.module.create(ctx)


def year_label(key):
    text = next(e["text"] for e in EVENTS if e["id"] == key.split("|")[0])
    return text.split(": ", 1)[0]


def year_number(label):
    return -int(label[:-3]) if label.endswith(" BC") else int(label)


def test_shows_only_todays_events(tmp_path):
    mod, script = make(tmp_path, date(2026, 7, 4))
    assert mod.NAME == "On This Day" and mod.DESCRIPTION == "What happened on today's date in history, from Wikipedia."
    want = [e["text"] for e in EVENTS if e["topic"] == "07-04"]
    pages = [script.next() for _ in want]
    assert [p.body for p in pages] == want and all(p.title == "On This Day: July 4" for p in pages)


def test_feb_28_includes_feb_29_in_non_leap_year(tmp_path):
    want = [e["text"] for e in EVENTS if e["topic"] in ("02-28", "02-29")]
    for year, expect in ((2026, want), (2028, [e["text"] for e in EVENTS if e["topic"] == "02-28"])):
        _, script = make(tmp_path / str(year), date(year, 2, 28))
        assert sorted(script.next().body for _ in expect) == sorted(expect)
    _, leap = make(tmp_path / "feb29", date(2028, 2, 29))
    assert leap.next().body in [e["text"] for e in EVENTS if e["topic"] == "02-29"]


def test_done_for_today_message(tmp_path):
    _, script = make(tmp_path, date(2026, 3, 1))
    for _ in [e for e in EVENTS if e["topic"] == "03-01"]:
        script.next()
    page = script.next()  # no LibraryExhausted
    assert (page.title, page.body) == ("On This Day", "That's all for March 1. More tomorrow.")


def test_events_show_again_next_year(tmp_path):
    _, script = make(tmp_path, date(2026, 7, 4))
    want = [e["text"] for e in EVENTS if e["topic"] == "07-04"]
    for _ in want:
        script.next()
    assert script.next().title == "On This Day"  # done message
    script.ctx.today = lambda: date(2027, 7, 4)
    assert [script.next().body for _ in want] == want


def test_quiz_right_and_wrong(tmp_path):
    _, s = make(tmp_path, date(2026, 7, 4), QUIZ)
    page = s.next()
    assert len(page.choices) == 3 and page.title.startswith("What year?")
    label = year_label(page.key)
    right = page.choices.index(label)
    good = s.choose(page.key, right)
    assert good.title == "Right" and good.body.split("\n")[0] == f"It was {label}."
    bad = s.choose(page.key, (right + 1) % 3)
    assert bad.title == "Not quite" and bad.body.split("\n")[0] == f"It was {label}."


def test_key_survives_new_runner(tmp_path):
    store = Store(tmp_path, lambda: 0.0)
    _, s = make(tmp_path, date(2026, 7, 4), QUIZ, store=store)
    page = s.next()
    _, s2 = make(tmp_path, date(2026, 7, 4), QUIZ, store=store)
    assert s2.choose(page.key, page.choices.index(year_label(page.key))).title == "Right"


def test_every_quiz_page_fits(tmp_path):
    quizzes = 0
    for k in range(40):
        day = date(2026, 1, 1) + timedelta(days=9 * k)
        _, s = make(tmp_path / str(k), day, QUIZ)
        for _ in range(4):
            page = s.next()
            assert page_fits(page)
            if page.choices:
                quizzes += 1
                assert all(page_fits(s.choose(page.key, i)) for i in range(3))
    assert quizzes >= 100


def test_read_mode_has_no_choices(tmp_path):
    for k, day in enumerate((date(2026, 7, 4), date(2026, 3, 1), date(2026, 12, 25))):
        _, s = make(tmp_path / str(k), day, READ)
        assert not any(s.next().choices for _ in range(10))


def test_bad_key_does_not_crash(tmp_path):
    _, s = make(tmp_path, date(2026, 7, 4), QUIZ)
    eid = EVENTS[0]["id"]
    for key, index in (("nope", 0), ("gone|1,2,3", 0), (f"{eid}|1,2", 0), (f"{eid}|1,2,3", 5)):
        assert s.choose(key, index).title == "On This Day"
    assert "tally" not in s.ctx.state()  # a bad key is never counted


def test_year_options(tmp_path):
    seen = 0
    for k in range(10):
        _, s = make(tmp_path / str(k), date(2026, 1, 1) + timedelta(days=37 * k), QUIZ)
        for _ in range(3):
            page = s.next()
            if not page.choices:
                continue
            seen += 1
            years = [year_number(c) for c in page.choices]
            own = year_number(year_label(page.key))
            assert len(set(page.choices)) == 3 and own in years and years == sorted(years)
            assert all(abs(y - own) >= 10 for y in years if y != own)
            assert not re.match(r"^\d+( BC)?: ", page.body)
    assert seen >= 20
