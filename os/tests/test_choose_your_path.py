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


def make(root, script_id="choose_your_path", today=lambda: date(2026, 3, 1), seed=1, store=None):
    info = {i.id: i for i in discover(BUILTIN, root / "no-user-scripts")}[script_id]
    assert info.error is None
    store = store or Store(root, lambda: 0.0)
    ctx = ScriptContext(script_id, info.folder, {"interval": 30}, store, random.Random(seed), today)
    return info.module.create(ctx), store


def stories():
    return json.loads((BUILTIN / "choose_your_path" / "stories.json").read_text(encoding="utf-8"))


def test_story_graphs_valid():
    rows = stories()
    assert len(rows) >= 8 and len({s["id"] for s in rows}) == len(rows)
    for s in rows:
        i, nodes = s["id"], s["nodes"]
        assert "https://" in s["source"], i
        assert "start" in nodes, i
        for nid, n in nodes.items():
            for o in n["options"]:
                assert o["to"] in nodes, (i, nid)
            if n["options"]:
                assert 2 <= len(n["options"]) <= 3, (i, nid)
            else:
                assert n["text"].endswith("The end."), (i, nid)
        assert sum(not n["options"] for n in nodes.values()) >= 3, i

        seen, longest = set(), {}

        def walk(nid, path):
            assert nid not in path, (i, "cycle", nid)
            seen.add(nid)
            opts = nodes[nid]["options"]
            depth = 0 if not opts else 1 + max(walk(o["to"], path | {nid}) for o in opts)
            longest[nid] = depth
            return depth

        assert walk("start", frozenset()) >= 3, i
        assert seen == set(nodes), (i, set(nodes) - seen)


def test_every_node_page_fits():
    for s in stories():
        for nid, n in s["nodes"].items():
            if n["options"]:
                assert quiz_page(s["title"], n["text"], [o["label"] for o in n["options"]], "k") is not None, (s["id"], nid)
            else:
                assert page_fits(Page(s["title"], n["text"])), (s["id"], nid)


def test_walk_to_an_ending(tmp_path):
    s, _ = make(tmp_path)
    page = s.next()
    for _ in range(20):
        if not page.choices:
            break
        page = s.choose(page.key, 0)
    assert not page.choices and page.body.endswith("The end.")


def test_key_survives_new_runner(tmp_path):
    s, store = make(tmp_path)
    page = s.next()
    s2, _ = make(tmp_path, store=store)
    assert s2.choose(page.key, 0).title == page.title


def test_bad_key_does_not_crash(tmp_path):
    s, _ = make(tmp_path)
    sid = stories()[0]["id"]
    for key, idx in (("nope", 0), (f"{sid}|start", 9)):
        assert s.choose(key, idx).title == "Choose Your Path"
