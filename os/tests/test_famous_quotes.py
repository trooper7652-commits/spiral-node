import json
import random
import re
from datetime import date
from pathlib import Path

import pytest

import spiral
from spiral.library import LibraryExhausted, load_library
from spiral.loader import discover
from spiral.render import page_fits
from spiral.scripts_api import ScriptContext
from spiral.storage import Store

PACK = Path(spiral.__file__).parent / "builtin_scripts" / "famous_quotes"


def quotes():
    return json.loads((PACK / "quotes.json").read_text(encoding="utf-8"))


def make(root, prefs=None, seed=1, store=None):
    info = {i.id: i for i in discover(PACK.parent, root / "no-user-scripts")}["famous_quotes"]
    assert info.error is None
    prefs = {"mode": "Read"} if prefs is None else prefs
    ctx = ScriptContext("famous_quotes", info.folder, prefs, store or Store(root, lambda: 0.0),
                        random.Random(seed), lambda: date(2026, 1, 1))
    return info.module.create(ctx)


def test_quotes_rules():
    from spiral.config import SCREEN_H, SCREEN_W
    from spiral.render import PAD, _page_top, fit_text
    qs = quotes()
    assert len(qs) == 100 and len({q["id"] for q in qs}) == 100
    assert len({q["topic"] for q in qs}) >= 30
    assert sum(q["woman"] for q in qs) >= 25 and all(isinstance(q["woman"], bool) for q in qs)
    for q in qs:
        i = q["id"]
        assert isinstance(q["year"], int) and q["year"] < 1931, i
        assert isinstance(q["author_died"], int) and q["author_died"] < 1956, i
        assert "translator" not in q, i
        assert q["source"].startswith("https://en.wikiquote.org/wiki/"), i
        assert len(q["check"].split()) >= 4 and q["check"] in q["text"], i
        body = f"“{q['text']}”\n\n- {q['topic']}"
        assert re.fullmatch(r"[\x20-\x7e\n‘’“”]+", body), i
        font, lines = fit_text(body, SCREEN_W - 2 * PAD, SCREEN_H - _page_top() - 1)
        assert font.size >= 12 and not any(l.endswith("…") for l in lines), i


def test_loader_reads_quotes():
    assert len(load_library(PACK / "quotes.json")) == 100


def test_script_shows_quote_and_author(tmp_path):
    page = make(tmp_path).next()
    assert page.title == "Quote"
    assert page.body in {f"“{q['text']}”\n\n- {q['topic']}" for q in quotes()}


def test_exhausted_library_raises(tmp_path):
    s = make(tmp_path)
    for _ in range(100):
        s.next()
    with pytest.raises(LibraryExhausted):
        s.next()


QUIZ = {"mode": "Quiz"}


def right_letter(page):
    author = {q["id"]: q["topic"] for q in quotes()}[page.key.split("|")[0]]
    hits = [i for i, l in enumerate("ABC") if re.search(rf"{l}: {re.escape(author)}(\n|  |$)", page.body)]
    assert len(hits) == 1
    return hits[0]


def test_quiz_right_and_wrong(tmp_path):
    s = make(tmp_path, QUIZ)
    page = s.next()
    assert page.choices == ("A", "B", "C")
    right = right_letter(page)
    good = s.choose(page.key, right)
    assert good.title == "Right"
    assert "right, run" in good.body.split("\n")[-1]
    bad = s.choose(page.key, (right + 1) % 3)
    assert bad.title == "Not quite"
    assert "right, run" in bad.body.split("\n")[-1]


def test_key_survives_new_runner(tmp_path):
    store = Store(tmp_path, lambda: 0.0)
    page = make(tmp_path, QUIZ, store=store).next()
    assert make(tmp_path, QUIZ, store=store).choose(page.key, right_letter(page)).title == "Right"


def test_every_quiz_page_fits(tmp_path):
    s = make(tmp_path, QUIZ)
    quizzes = 0
    for _ in range(300):
        try:
            page = s.next()
        except LibraryExhausted:
            s.shown.reset()
            page = s.next()
        assert page_fits(page)
        if page.choices:
            quizzes += 1
            assert all(page_fits(s.choose(page.key, i)) for i in range(3))
    assert quizzes >= 60


def test_read_mode_has_no_choices(tmp_path):
    s = make(tmp_path, {"mode": "Read"})
    assert not any(s.next().choices for _ in range(100))


def test_mix_alternates(tmp_path):
    s = make(tmp_path, {"mode": "Mix"})
    pages = [s.next() for _ in range(20)]
    assert not pages[1].choices
    assert sum(bool(p.choices) for p in pages) >= 5


def test_bad_key_does_not_crash(tmp_path):
    s = make(tmp_path, QUIZ)
    assert s.choose("nope", 0).title == "Quote"
    assert s.choose("fq-001|0,1,2", 7).title == "Quote"
    assert s.choose("gone|0,1,2", 0).title == "Quote"
    assert "tally" not in s.ctx.state()  # a bad key is never counted
