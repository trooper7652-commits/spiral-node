import json
import random
from datetime import date
from pathlib import Path

import pytest

import spiral
from spiral.library import LibraryExhausted
from spiral.loader import discover
from spiral.render import page_fits
from spiral.scripts_api import Page, ScriptContext, tally_line
from spiral.storage import Store

PACK = Path(spiral.__file__).parent / "builtin_scripts" / "fun_fact_question"
WORST = {"score": 9999, "answered": 9999, "run": 999, "best_run": 999, "streak": 999, "best_streak": 999,
         "last_day": "2026-01-01"}
QUIZ = {"mode": "Quiz"}


def load(name):
    return json.loads((PACK / name).read_text(encoding="utf-8"))


def make(root, prefs=None, seed=1, store=None):
    info = {i.id: i for i in discover(PACK.parent, root / "no-user-scripts")}["fun_fact_question"]
    assert info.error is None
    ctx = ScriptContext("fun_fact_question", info.folder, {"mode": "Read"} if prefs is None else prefs,
                        store or Store(root, lambda: 0.0), random.Random(seed), lambda: date(2026, 1, 1))
    return info.module.create(ctx)


def test_ffq_page_has_fact_and_question(tmp_path):
    page = make(tmp_path).next()
    assert page.title == "Fun fact"
    fact, question = page.body.split("\n\nQ: ")
    assert fact and question


def test_ffq_exhausts_after_all_facts(tmp_path):
    s = make(tmp_path)
    ids = [f["id"] for f in load("facts.json")]
    for i in ids[1:]:
        s.shown_facts.add(i)
    s.next()
    with pytest.raises(LibraryExhausted) as e:
        s.next()
    assert e.value.library == "facts.json"


def test_ffq_exhausted_questions_do_not_use_up_a_fact(tmp_path):
    s = make(tmp_path)
    for q in load("questions.json"):
        s.shown_questions.add(q["id"])
    with pytest.raises(LibraryExhausted) as e:
        s.next()
    assert e.value.library == "questions.json"
    assert s.shown_facts.ids() == set()


def test_library_minimums():
    facts, questions, quiz = load("facts.json"), load("questions.json"), load("quiz.json")
    ids = {f["id"] for f in facts}
    assert len(facts) >= 150 and len(ids) == len(facts)
    assert {"octo" "pus-hearts", "honey-tombs", "venus-day", "banana-berry", "snail-coil"} <= ids  # first id split in two on purpose
    assert not any(f["topic"].startswith("sample") for f in facts)
    per_topic = {}
    for f in facts:
        per_topic[f["topic"]] = per_topic.get(f["topic"], 0) + 1
    assert len([t for t, n in per_topic.items() if n >= 10]) >= 8
    for f in facts:
        assert f["source"].startswith("https://") and 1 <= len(f["check"]) <= 60, f["id"]
    qids = {q["id"] for q in questions}
    assert len(questions) >= 60 and len(qids) == len(questions)
    assert {"q-borrowed", "q-boring", "q-small", "q-wrong", "q-combine"} <= qids
    assert all(q["source"] == "original question (Helix Velocities)" for q in questions)
    assert len(quiz) >= 60 and len({t["id"] for t in quiz}) == len(quiz)
    assert all(isinstance(t["answer"], bool) for t in quiz)
    assert 0.4 <= sum(not t["answer"] for t in quiz) / len(quiz) <= 0.6
    for t in quiz:
        assert t["source"].startswith("https://") and 1 <= len(t["check"]) <= 60, t["id"]
        assert t["explain"].strip(), t["id"]


def test_every_page_fits():
    facts, questions = load("facts.json"), load("questions.json")
    lq = max((q["text"] for q in questions), key=len)
    lf = max((f["text"] for f in facts), key=len)
    for f in facts:
        assert page_fits(Page("Fun fact", f"{f['text']}\n\nQ: {lq}")), f["id"]
    for q in questions:
        assert page_fits(Page("Fun fact", f"{lf}\n\nQ: {q['text']}")), q["id"]
    for t in load("quiz.json"):
        assert page_fits(Page("True or false?", t["text"], choices=("True", "False"), key=t["id"])), t["id"]
        assert page_fits(Page("Not quite", f"{t['explain']}\n\n{tally_line(WORST)}")), t["id"]


def right_index(r):
    return 0 if r["answer"] else 1


def test_quiz_right_and_wrong(tmp_path):
    s = make(tmp_path, QUIZ)
    page = s.next()
    assert page.title == "True or false?" and page.choices == ("True", "False")
    r = {t["id"]: t for t in load("quiz.json")}[page.key]
    good = s.choose(page.key, right_index(r))
    bad = s.choose(page.key, 1 - right_index(r))
    assert (good.title, bad.title) == ("Right", "Not quite")
    for res in (good, bad):
        assert res.body.startswith(r["explain"]) and "right, run" in res.body.split("\n")[-1]


def test_key_survives_new_runner(tmp_path):
    store = Store(tmp_path, lambda: 0.0)
    page = make(tmp_path, QUIZ, store=store).next()
    r = {t["id"]: t for t in load("quiz.json")}[page.key]
    assert make(tmp_path, QUIZ, store=store).choose(page.key, right_index(r)).title == "Right"


def test_read_mode_has_no_choices(tmp_path):
    s = make(tmp_path, {"mode": "Read"})
    pages = [s.next() for _ in range(30)]
    assert not any(p.choices for p in pages) and {p.title for p in pages} == {"Fun fact"}


def test_mix_alternates(tmp_path):
    s = make(tmp_path, {"mode": "Mix"})
    pages = [s.next() for _ in range(3)]
    assert [bool(p.choices) for p in pages] == [True, False, True]


def test_bad_key_does_not_crash(tmp_path):
    s = make(tmp_path, QUIZ)
    assert s.choose("nope", 0).title == "Fun fact"
    assert s.choose("tf-01", 2).title == "Fun fact"
    assert s.choose("tf-01", -1).title == "Fun fact"
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
