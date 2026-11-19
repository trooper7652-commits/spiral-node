import json
import random
from datetime import date
from pathlib import Path

import spiral
from spiral.loader import discover
from spiral.scripts_api import ScriptContext
from spiral.storage import Store

BUILTIN = Path(spiral.__file__).parent / "builtin_scripts"
EVENTS = json.loads((BUILTIN / "on_this_day" / "events.json").read_text(encoding="utf-8"))


def make(root, today):
    info = {i.id: i for i in discover(BUILTIN, root / "no-user-scripts")}["on_this_day"]
    assert info.error is None
    ctx = ScriptContext("on_this_day", info.folder, {}, Store(root, lambda: 0.0), random.Random(1), lambda: today)
    return info.module, info.module.create(ctx)


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
