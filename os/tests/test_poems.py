import json
import random
from datetime import date
from pathlib import Path

import spiral
from spiral.loader import discover
from spiral.scripts_api import ScriptContext
from spiral.storage import Store

BUILTIN = Path(spiral.__file__).parent / "builtin_scripts"
POEMS = json.loads((BUILTIN / "poems" / "poems.json").read_text(encoding="utf-8"))


def make(root, seed=1):
    info = {i.id: i for i in discover(BUILTIN, root / "no-user-scripts")}["poems"]
    assert info.error is None
    store = Store(root, lambda: 0.0)
    ctx = ScriptContext("poems", info.folder, {}, store, random.Random(seed), lambda: date(2026, 1, 1))
    return info.module, info.module.create(ctx)


def test_poems_pack_has_60_unique_ids():
    ids = [p["id"] for p in POEMS]
    assert len(ids) == 60 and len(set(ids)) == 60
    assert all(p["source"] and p["pages"] for p in POEMS)


def test_poems_page_by_page_then_author(tmp_path):
    mod, script = make(tmp_path)
    assert mod.NAME == "Poems" and mod.DESCRIPTION == "Short public-domain poems, one page at a time."
    first = script.next()
    poem = {p["id"]: p for p in POEMS}[script.ctx.state()["poem"]]
    assert first.title == poem["title"] and first.body == poem["pages"][0]
    rest = [script.next() for _ in poem["pages"][1:]]
    assert [p.body for p in rest] == poem["pages"][1:] and all(p.title == poem["title"] for p in rest)
    assert rest[-1].body.endswith("\n- " + poem["author"]) or rest[-1].body == "- " + poem["author"]
    assert script.next().title != poem["title"]  # then a new poem


def test_poems_never_repeat_until_exhausted(tmp_path):
    _, script = make(tmp_path)
    by_id = {p["id"]: p for p in POEMS}
    order = []
    for _ in range(sum(len(p["pages"]) for p in POEMS)):
        script.next()
        pid = script.ctx.state()["poem"]
        if not order or order[-1] != pid:
            order.append(pid)
    assert sorted(order) == sorted(by_id)  # every poem exactly once, none twice
