import json
import random
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import pytest

import spiral
from spiral.library import Entry, LibraryExhausted, load_library
from spiral.loader import discover
from spiral.render import page_fits
from spiral.scripts_api import Page, ScriptContext, quiz_page, tally_line
from spiral.storage import Store

PACK = Path(spiral.__file__).parent / "builtin_scripts" / "space_facts"
HOSTS = {"nasa.gov", "science.nasa.gov", "spaceplace.nasa.gov", "earthobservatory.nasa.gov", "www.nasa.gov"}


WORST = {"score": 9999, "answered": 9999, "run": 999, "best_run": 999, "streak": 999, "best_streak": 999,
         "last_day": "2026-01-01"}
QUIZ = {"mode": "Quiz"}


def make(root, prefs=None, seed=1, store=None):
    info = {i.id: i for i in discover(PACK.parent, root / "no-user-scripts")}["space_facts"]
    assert info.error is None
    ctx = ScriptContext("space_facts", info.folder, {"mode": "Read"} if prefs is None else prefs,
                        store or Store(root, lambda: 0.0), random.Random(seed), lambda: date(2026, 1, 1))
    return info.module.create(ctx)


def quiz_raw():
    return {r["id"]: r for r in json.loads((PACK / "quiz.json").read_text(encoding="utf-8"))}


def test_loader_ignores_extra_keys():
    entries = load_library(PACK / "facts.json")
    assert len(entries) == 120 and all(isinstance(e, Entry) and not hasattr(e, "check") for e in entries)


def test_every_fact_has_nasa_source_and_check():
    facts = json.loads((PACK / "facts.json").read_text(encoding="utf-8"))
    questions = json.loads((PACK / "questions.json").read_text(encoding="utf-8"))
    assert len(facts) == 120 and len(questions) == 40
    assert len({f["id"] for f in facts}) == 120
    for f in facts:
        assert urlparse(f["source"]).hostname in HOSTS, f["id"]
        assert f["check"].strip() and len(f["text"]) <= 120 and f["topic"] in ("space", "earth"), f["id"]
    assert sum(f["topic"] == "earth" for f in facts) >= 25


def test_script_returns_fact_and_question(tmp_path):
    page = make(tmp_path).next()
    fact, question = page.body.split("\n\nQ: ")
    assert page.title == "Space fact" and fact in {f["text"] for f in json.loads((PACK / "facts.json").read_text())}
    assert question


def test_longest_fact_with_any_question_fits_without_ellipsis():
    from spiral.config import SCREEN_H, SCREEN_W
    from spiral.render import PAD, _page_top, fit_text
    fact = max((f["text"] for f in json.loads((PACK / "facts.json").read_text(encoding="utf-8"))), key=len)
    for q in json.loads((PACK / "questions.json").read_text(encoding="utf-8")):
        _, lines = fit_text(f"{fact}\n\nQ: {q['text']}", SCREEN_W - 2 * PAD, SCREEN_H - _page_top() - 1)
        assert not lines[-1].endswith("…"), q["id"]


def test_quiz_library_minimums():
    rows = list(quiz_raw().values())
    assert len(rows) >= 40
    assert len(rows) == len(json.loads((PACK / "quiz.json").read_text(encoding="utf-8")))  # ids unique
    for r in rows:
        i = r["id"]
        host = urlparse(r["source"]).hostname or ""
        assert r["topic"] == "space", i
        assert r["source"].startswith("https://") and (host == "nasa.gov" or host.endswith(".nasa.gov")), i
        assert r["check"].strip() and len(r["check"]) <= 60, i
        assert len(set(r["options"])) == 3 and len(r["options"]) == 3, i
        assert r["answer"] in (0, 1, 2), i
        assert r["explain"].strip(), i


def test_every_quiz_page_fits():
    for r in quiz_raw().values():
        assert quiz_page("Space quiz", r["text"], r["options"], r["id"]) is not None, r["id"]
        assert page_fits(Page("Not quite", f"{r['explain']}\n\n{tally_line(WORST)}")), r["id"]


def test_quiz_right_and_wrong(tmp_path):
    s = make(tmp_path, QUIZ)
    page = s.next()
    assert page.choices == ("A", "B", "C")
    r = quiz_raw()[page.key]
    good = s.choose(page.key, r["answer"])
    assert good.title == "Right"
    bad = s.choose(page.key, (r["answer"] + 1) % 3)
    assert bad.title == "Not quite"
    for res in (good, bad):
        assert res.body.startswith(r["explain"]) and "right, run" in res.body.split("\n")[-1]


def test_key_survives_new_runner(tmp_path):
    store = Store(tmp_path, lambda: 0.0)
    page = make(tmp_path, QUIZ, store=store).next()
    r = quiz_raw()[page.key]
    assert make(tmp_path, QUIZ, store=store).choose(page.key, r["answer"]).title == "Right"


def test_read_mode_has_no_choices(tmp_path):
    s = make(tmp_path, {"mode": "Read"})
    pages = [s.next() for _ in range(30)]
    assert not any(p.choices for p in pages) and {p.title for p in pages} == {"Space fact"}


def test_mix_alternates(tmp_path):
    s = make(tmp_path, {"mode": "Mix"})
    pages = [s.next() for _ in range(3)]
    assert [bool(p.choices) for p in pages] == [True, False, True]


def test_bad_key_does_not_crash(tmp_path):
    s = make(tmp_path, QUIZ)
    assert s.choose("nope", 0).title == "Space fact"
    assert s.choose("sq-01", 5).title == "Space fact"
    assert s.choose("sq-01", -1).title == "Space fact"
    assert "tally" not in s.ctx.state()


def test_used_up_quiz(tmp_path):
    s = make(tmp_path, {"mode": "Mix"})
    for e in s.quiz:
        s.shown_quiz.add(e.id)
    assert [bool(s.next().choices) for _ in range(3)] == [False, False, False]  # Mix: facts carry on
    s = make(tmp_path / "quiz", QUIZ)
    for e in s.quiz:
        s.shown_quiz.add(e.id)
    with pytest.raises(LibraryExhausted) as err:
        s.next()
    assert err.value.library == "quiz.json"
