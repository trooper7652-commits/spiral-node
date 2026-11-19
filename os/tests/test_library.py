import json
import random

import pytest

from spiral.library import (Entry, LibraryError, LibraryExhausted, ShownLog,
                            load_library, pick_unshown)
from spiral.storage import Store


def fact(i, **kw):
    d = {"id": f"f{i}", "text": f"text {i}", "topic": "t", "source": "s"}
    d.update(kw)
    return d


def write(tmp_path, data, name="facts.json"):
    p = tmp_path / name
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


def make_entries(n=5):
    return [Entry(id=f"f{i}", text="x", topic="t", source="s") for i in range(n)]


def test_loads_valid_facts(tmp_path):
    entries = load_library(write(tmp_path, [fact(1), fact(2)]))
    assert [e.id for e in entries] == ["f1", "f2"]
    assert entries[0].text == "text 1"


def test_entries_validates_like_library():
    from spiral.scripts_api import ScriptContext
    ctx = ScriptContext("s", "/tmp", {}, None, random.Random(1), lambda: None)
    assert [e.id for e in ctx.entries([fact(1), fact(2)])] == ["f1", "f2"]
    with pytest.raises(LibraryError) as e:
        ctx.entries([fact(1), fact(1)])
    assert "inline" in str(e.value) and "duplicate id" in str(e.value)
    with pytest.raises(LibraryError):
        ctx.entries([{"id": "s", "title": "T", "topic": "t", "source": "x", "pages": []}], kind="story", name="mine")


def test_loader_ignores_extra_keys(tmp_path):
    entries = load_library(write(tmp_path, [fact(1, mood="happy", n=3)]))
    assert [e.id for e in entries] == ["f1"]


def test_duplicate_id_raises(tmp_path):
    p = write(tmp_path, [fact(1), fact(1)])
    with pytest.raises(LibraryError) as e:
        load_library(p)
    assert "facts.json" in str(e.value) and "duplicate id" in str(e.value)


def test_missing_field_raises(tmp_path):
    bad = fact(1)
    del bad["topic"]
    with pytest.raises(LibraryError) as e:
        load_library(write(tmp_path, [bad]))
    assert "topic" in str(e.value) and "facts.json" in str(e.value)


def test_empty_library_raises(tmp_path):
    with pytest.raises(LibraryError):
        load_library(write(tmp_path, []))


def test_story_requires_pages(tmp_path):
    story = {"id": "s1", "title": "T", "topic": "t", "source": "Aesop", "pages": ["a", "b"]}
    entries = load_library(write(tmp_path, [story], "stories.json"), kind="story")
    assert entries[0].pages == ("a", "b")
    for pages in ([], "abc", [1]):
        story["pages"] = pages
        with pytest.raises(LibraryError) as e:
            load_library(write(tmp_path, [story], "stories.json"), kind="story")
        assert "pages" in str(e.value)


def test_pick_never_repeats(tmp_path):
    shown = ShownLog(Store(tmp_path, lambda: 0.0), "shown/x/facts")
    entries = make_entries()
    rng = random.Random(0)
    ids = [pick_unshown(entries, shown, rng).id for _ in range(5)]
    assert len(set(ids)) == 5
    with pytest.raises(LibraryExhausted):
        pick_unshown(entries, shown, rng, library="facts.json")


def test_pick_is_seeded_random(tmp_path):
    entries = make_entries()

    def order(seed, sub):
        shown = ShownLog(Store(tmp_path / sub, lambda: 0.0), "k")
        rng = random.Random(seed)
        return [pick_unshown(entries, shown, rng).id for _ in range(5)]

    assert order(1, "a") == order(1, "b")
    assert order(1, "c") != [e.id for e in entries]


def test_reset_allows_reuse(tmp_path):
    shown = ShownLog(Store(tmp_path, lambda: 0.0), "k")
    entries = make_entries(2)
    rng = random.Random(0)
    pick_unshown(entries, shown, rng)
    pick_unshown(entries, shown, rng)
    shown.reset()
    assert shown.ids() == set()
    pick_unshown(entries, shown, rng)


def test_shown_persists_across_store_restart(tmp_path):
    store = Store(tmp_path, lambda: 0.0)
    ShownLog(store, "shown/x/facts").add("f1")
    store.flush()
    assert ShownLog(Store(tmp_path, lambda: 0.0), "shown/x/facts").ids() == {"f1"}
