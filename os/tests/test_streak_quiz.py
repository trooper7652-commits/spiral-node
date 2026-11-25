import json
import random
from datetime import date
from pathlib import Path

import spiral
from spiral.loader import discover
from spiral.render import page_fits
from spiral.scripts_api import Page, ScriptContext, quiz_page
from spiral.storage import Store

BUILTIN = Path(spiral.__file__).parent / "builtin_scripts"
FILES = {"space": "space_facts/quiz.json", "fun": "fun_fact_question/quiz.json",
         "puzzle": "daily_puzzle/puzzles.json"}


def make(root, script_id="streak_quiz", today=lambda: date(2026, 3, 1), seed=1, store=None):
    info = {i.id: i for i in discover(BUILTIN, root / "no-user-scripts")}[script_id]
    assert info.error is None
    store = store or Store(root, lambda: 0.0)
    ctx = ScriptContext(script_id, info.folder, {"interval": 30}, store, random.Random(seed), today)
    return info.module.create(ctx), store


def raw():
    return {n: {r["id"]: r for r in json.loads((BUILTIN / p).read_text(encoding="utf-8"))}
            for n, p in FILES.items()}


def right_index(data, key):
    name, iid = key.split("|")[2:]
    r = data[name][iid]
    return (0 if r["answer"] else 1) if name == "fun" else r["answer"]


def test_round_of_ten_and_best(tmp_path):
    s, _ = make(tmp_path)
    data = raw()
    for n in range(1, 11):
        page = s.next()
        assert page.title == f"Question {n} of 10"
        res = s.choose(page.key, right_index(data, page.key))
    assert res.body.endswith("Round: 10/10. Best: 10/10.")
    for n in range(1, 11):
        page = s.next()
        assert page.title == f"Question {n} of 10"
        res = s.choose(page.key, (right_index(data, page.key) + 1) % len(page.choices))
    assert res.body.endswith("Round: 0/10. Best: 10/10.")


def test_key_survives_new_runner(tmp_path):
    s, store = make(tmp_path)
    page = s.next()
    s2, _ = make(tmp_path, store=store)
    assert s2.choose(page.key, right_index(raw(), page.key)).title == "Right"


def test_every_item_fits():
    for name, rows in raw().items():
        for r in rows.values():
            i = r["id"]
            if name == "fun":
                assert page_fits(Page("Question 10 of 10", r["text"], choices=("True", "False"), key="k")), i
            else:
                assert quiz_page("Question 10 of 10", r["text"], r["options"], "k") is not None, i
            assert page_fits(Page("Not quite", f"{r['explain']}\n\nRound: 10/10. Best: 10/10.")), i
            assert page_fits(Page("Not quite", f"{r['explain']}\n\n9/9 right this round, run 9999")), i


def test_sources_restart_quietly(tmp_path):
    s, _ = make(tmp_path)
    for _ in range(250):
        s.next()
