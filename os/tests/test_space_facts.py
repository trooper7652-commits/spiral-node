import json
import random
from pathlib import Path
from urllib.parse import urlparse

import spiral
from spiral.library import Entry, load_library
from spiral.loader import discover
from spiral.scripts_api import ScriptContext
from spiral.storage import Store

PACK = Path(spiral.__file__).parent / "builtin_scripts" / "space_facts"
HOSTS = {"nasa.gov", "science.nasa.gov", "spaceplace.nasa.gov", "earthobservatory.nasa.gov", "www.nasa.gov"}


def make(root):
    info = {i.id: i for i in discover(PACK.parent, root / "no-user-scripts")}["space_facts"]
    assert info.error is None
    ctx = ScriptContext("space_facts", info.folder, {}, Store(root, lambda: 0.0), random.Random(1), lambda: None)
    return info.module.create(ctx)


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
