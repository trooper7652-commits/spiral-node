import random
from datetime import date
import re
from collections import Counter
from pathlib import Path

import pytest

import spiral
from spiral.library import LibraryExhausted, load_library
from spiral.loader import discover
from spiral.scripts_api import ScriptContext
from spiral.storage import Store

BUILTIN = Path(spiral.__file__).parent / "builtin_scripts"


def make(script_id, root, seed=1):
    info = {i.id: i for i in discover(BUILTIN, root / "no-user-scripts")}[script_id]
    assert info.error is None
    store = Store(root, lambda: 0.0)
    ctx = ScriptContext(script_id, info.folder, {}, store, random.Random(seed), lambda: date(2026, 1, 1))
    return info.module.create(ctx), store


def test_builtin_libraries_valid():
    assert len(load_library(BUILTIN / "quick_story" / "stories.json", "story")) >= 2


def test_story_pages_in_order_then_new_story(tmp_path):
    script, _ = make("quick_story", tmp_path)
    stories = {s.title: s for s in load_library(BUILTIN / "quick_story" / "stories.json", "story")}
    first = script.next()
    story = stories[first.title]
    assert first.body == story.pages[0]
    for text in story.pages[1:]:
        assert script.next().body == text
    nxt = script.next()  # story finished: a different story starts at page 0
    assert nxt.title != story.title
    assert nxt.body == stories[nxt.title].pages[0]


def test_story_position_survives_restart(tmp_path):
    script, store = make("quick_story", tmp_path)
    first = script.next()
    second = script.next()
    store.flush()
    script2, _ = make("quick_story", tmp_path)
    third = script2.next()
    story = next(s for s in load_library(BUILTIN / "quick_story" / "stories.json", "story")
                 if s.title == first.title)
    assert (first.body, second.body) == story.pages[:2]
    assert third.title == first.title
    assert third.body == story.pages[2]


TOPICS = BUILTIN / "connect" / "topics.json"


def connect_pairs(page):
    a, b = page.body.split("\n\n")[0].split("\n+\n")
    return a, b


def test_connect_library_valid():
    topics = load_library(TOPICS)
    cats = Counter(t.topic for t in topics)
    assert len(topics) >= 100 and len(cats) == 8 and min(cats.values()) >= 10
    assert len({t.text for t in topics}) == len(topics)
    assert all(re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", t.id) for t in topics)
    assert all(1 <= len(t.text.split()) <= 4 for t in topics)
    assert all(t.source.startswith("https://en.wikipedia.org/wiki/") for t in topics)


def test_connect_page_format(tmp_path):
    script, _ = make("connect", tmp_path)
    page = script.next()
    assert page.title == "Connect"
    assert re.fullmatch(r".+\n\+\n.+\n\nWhat links these\?", page.body)


def test_connect_categories_differ(tmp_path):
    category = {t.text: t.topic for t in load_library(TOPICS)}
    script, _ = make("connect", tmp_path)
    for _ in range(30):
        a, b = connect_pairs(script.next())
        assert category[a] != category[b]


def test_connect_no_repeat_within_cycle(tmp_path):
    script, _ = make("connect", tmp_path)
    seen = []
    with pytest.raises(LibraryExhausted):
        for _ in range(1000):
            seen.extend(connect_pairs(script.next()))
    assert len(seen) == len(set(seen)) and len(seen) >= 60


def test_connect_exhausts_cleanly(tmp_path):
    script, _ = make("connect", tmp_path)
    cat = script.topics[0].topic
    keep = [t.id for t in script.topics if t.topic == cat][:2]
    for t in script.topics:
        if t.id not in keep:
            script.shown.add(t.id)
    before = script.shown.ids()
    with pytest.raises(LibraryExhausted) as e:  # two left, same category
        script.next()
    assert e.value.library == "topics.json" and script.shown.ids() == before
    script.shown.add(keep[0])
    with pytest.raises(LibraryExhausted):  # one left
        script.next()
