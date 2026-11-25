import json
import random
from datetime import date, timedelta
from pathlib import Path

import spiral
from spiral.loader import discover
from spiral.render import page_fits
from spiral.scripts_api import Page, ScriptContext, quiz_page, tally_line
from spiral.storage import Store

BUILTIN = Path(spiral.__file__).parent / "builtin_scripts"
WORST = {"score": 9999, "answered": 9999, "run": 999, "best_run": 999, "streak": 999, "best_streak": 999,
         "last_day": "2026-01-01"}


def make(root, script_id="daily_puzzle", today=lambda: date(2026, 3, 1), seed=1, store=None):
    info = {i.id: i for i in discover(BUILTIN, root / "no-user-scripts")}[script_id]
    assert info.error is None
    store = store or Store(root, lambda: 0.0)
    ctx = ScriptContext(script_id, info.folder, {"interval": 30}, store, random.Random(seed), today)
    return info.module.create(ctx), store


def right_index(s, key):
    return s.raw[key.split("|")[-1]]["answer"]


def test_same_puzzle_all_day(tmp_path):
    s, _ = make(tmp_path)
    pages = [s.next() for _ in range(3)]
    assert {p.title for p in pages} == {"Today's puzzle"}
    assert {p.key for p in pages} == {f"daily|2026-03-01|{s.daily_id(date(2026, 3, 1))}"}


def test_daily_rolls_over_at_midnight(tmp_path):
    day = [date(2026, 3, 1)]
    s, _ = make(tmp_path, today=lambda: day[0])
    page = s.next()
    res = s.choose(page.key, right_index(s, page.key))
    assert res.body.endswith("1-day streak")
    day[0] = date(2026, 3, 2)
    page2 = s.next()
    assert page2.title == "Today's puzzle" and page2.key != page.key and "2026-03-02" in page2.key
    assert s.choose(page2.key, right_index(s, page2.key)).body.endswith("2-day streak")

    from test_app_flow import WALL, boot_to_home, make_app
    app, clock, _ = make_app(tmp_path / "app")
    app.store.set("settings", {"clock_offset_s": 86400})
    boot_to_home(app, clock)
    app.start_script("daily_puzzle", {"interval": 30})
    key = app.history[-1]["key"]
    assert (WALL.date() + timedelta(days=1)).isoformat() in key
    app.choose(right_index(app.runner, key))
    assert app.history[-1]["body"].endswith("1-day streak")
    app.store.set("settings", {"clock_offset_s": 2 * 86400})  # the clock is moved on a day while it runs
    clock.advance(30)
    app.tick()
    assert app.history[-1]["title"] == "Today's puzzle"
    assert (WALL.date() + timedelta(days=2)).isoformat() in app.history[-1]["key"]


def test_practice_after_daily(tmp_path):
    s, _ = make(tmp_path)
    page = s.next()
    s.choose(page.key, right_index(s, page.key))
    today_id = page.key.split("|")[-1]
    for _ in range(5):
        p = s.next()
        assert p.title == "Practice" and p.key.startswith("practice|") and p.key != f"practice|{today_id}"
    res = s.choose(p.key, right_index(s, p.key))
    assert res.body.endswith("Practice: 1/1 right")


def test_streak_counts_daily_only(tmp_path):
    s, _ = make(tmp_path)
    page = s.next()
    s.choose(page.key, right_index(s, page.key))
    for _ in range(3):
        p = s.next()
        s.choose(p.key, right_index(s, p.key))
    assert s.ctx.state()["tally"]["answered"] == 1
    old = f"daily|2026-02-28|{s.ids[0]}"
    s.choose(old, 0)
    assert s.ctx.state()["tally"]["answered"] == 1


def test_yesterdays_key_leaves_today_unanswered(tmp_path):
    s, _ = make(tmp_path)  # today is 2026-03-01
    s.choose(f"daily|2026-02-28|{s.daily_id(date(2026, 2, 28))}", 0)  # a question left over from yesterday
    assert "tally" not in s.ctx.state() and s.ctx.state().get("daily_done") is None
    assert s.next().title == "Today's puzzle"


def test_puzzle_minimums_and_fit():
    rows = json.loads((BUILTIN / "daily_puzzle" / "puzzles.json").read_text(encoding="utf-8"))
    assert len(rows) >= 90 and len({r["id"] for r in rows}) == len(rows)
    topics = ("riddle", "logic", "pattern", "word")
    assert {r["topic"] for r in rows} <= set(topics)
    for t in topics:
        assert sum(r["topic"] == t for r in rows) >= 15, t
    for r in rows:
        i = r["id"]
        assert len(set(r["options"])) == 3 and len(r["options"]) == 3, i
        assert r["answer"] in (0, 1, 2) and r["explain"].strip(), i
        assert r["source"] in ("original puzzle (Helix Velocities)", "classic riddle"), i
        assert quiz_page("Today's puzzle", r["text"], r["options"], "k") is not None, i
        assert quiz_page("Practice", r["text"], r["options"], "k") is not None, i
        assert page_fits(Page("Not quite", f"{r['explain']}\n\n{tally_line(WORST)}")), i


def test_bad_key_does_not_crash(tmp_path):
    s, _ = make(tmp_path)
    for key, idx in (("nope", 0), ("daily|x|dp-001", 7), ("practice|zz", 0)):
        assert s.choose(key, idx).title == "Daily Puzzle"
    assert "tally" not in s.ctx.state()
