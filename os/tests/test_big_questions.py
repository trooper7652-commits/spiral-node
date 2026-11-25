import json
import random
import re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

import pytest

import spiral
from spiral.library import LibraryExhausted
from spiral.loader import discover
from spiral.scripts_api import ScriptContext
from spiral.storage import Store

PACKS = Path(spiral.__file__).parent / "builtin_scripts"
PACK = PACKS / "big_questions"
TOPICS = {"mind", "ethics", "time", "nature", "society", "self", "knowledge", "creativity"}


def questions(pack="big_questions", name="questions.json"):
    return json.loads((PACKS / pack / name).read_text(encoding="utf-8"))


def make(root):
    info = {i.id: i for i in discover(PACKS, root / "no-user-scripts")}["big_questions"]
    assert info.error is None
    ctx = ScriptContext("big_questions", info.folder, {}, Store(root, lambda: 0.0), random.Random(1), lambda: None)
    return info.module.create(ctx)


def test_questions_rules():
    from spiral.config import SCREEN_H, SCREEN_W
    from spiral.render import PAD, _page_top, fit_text
    qs = questions()
    assert len(qs) == 80 and len({q["id"] for q in qs}) == 80
    counts = Counter(q["topic"] for q in qs)
    assert set(counts) == TOPICS and min(counts.values()) >= 8
    for q in qs:
        i = q["id"]
        assert re.fullmatch(r"bq-\d\d", i), i
        assert re.fullmatch(r"original question \(.+\)", q["source"]), i
        t = q["text"]
        assert t.endswith("?") and len(t) <= 120, i
        assert re.fullmatch(r"[\x20-\x7e]+", t), i
        font, lines = fit_text(t, SCREEN_W - 2 * PAD, SCREEN_H - _page_top() - 1)
        assert font.size >= 12 and not any(l.endswith("…") for l in lines), i


def test_no_overlap_with_other_packs():
    mine = [q["text"].lower() for q in questions()]
    for i, a in enumerate(mine):
        for b in mine[i + 1:]:
            assert SequenceMatcher(None, a, b).ratio() < 0.8, (a, b)
    others = [q["text"].lower() for p in ("fun_fact_question", "space_facts") for q in questions(p)]
    for a in mine:
        for b in others:
            assert SequenceMatcher(None, a, b).ratio() < 0.8, (a, b)


def test_script_shows_one_question(tmp_path):
    info = {i.id: i for i in discover(PACKS, tmp_path / "none")}["big_questions"]
    assert info.module.NAME == "Big Questions"
    assert info.module.DESCRIPTION == "One question worth thinking about."
    page = make(tmp_path).next()
    assert page.title == "Big question"
    assert page.body in {q["text"] for q in questions()}


def test_exhausted_library_raises(tmp_path):
    s = make(tmp_path)
    for _ in range(len(questions())):
        s.next()
    with pytest.raises(LibraryExhausted):
        s.next()
