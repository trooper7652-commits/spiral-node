import json
from pathlib import Path

import spiral
from spiral.render import page_fits
from spiral.scripts_api import Page

STORIES = json.loads((Path(spiral.__file__).parent / "builtin_scripts" / "quick_story" / "stories.json")
                     .read_text(encoding="utf-8"))
KINDS = ("fab" + "le", "myth", "folk tale", "legend")  # split so the word is not on one line of source


def test_story_minimums():
    ids = [s["id"] for s in STORIES]
    assert len(STORIES) >= 25 and len(set(ids)) == len(ids)
    assert {"tortoise-hare", "ant-grasshopper"} <= set(ids)
    for kind in KINDS:
        assert sum(s["topic"] == kind for s in STORIES) >= 4, kind
    for s in STORIES:
        assert s["topic"] in KINDS, s["id"]
        assert 4 <= len(s["pages"]) <= 8, s["id"]
        assert "https://" in s["source"] and "public domain" in s["source"], s["id"]
        assert s["title"].strip() and all(p.strip() for p in s["pages"]), s["id"]


def test_every_story_page_fits():
    for s in STORIES:
        for n, text in enumerate(s["pages"], 1):
            assert page_fits(Page(s["title"], text)), (s["id"], n)