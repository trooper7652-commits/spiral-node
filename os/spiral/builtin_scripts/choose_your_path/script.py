import json

from spiral.library import Entry, pick_unshown
from spiral.scripts_api import Page, Preference, quiz_page

NAME = "Choose Your Path"
DESCRIPTION = "Old tales where you choose what happens next. Find all the endings."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class ChooseYourPath:
    def __init__(self, ctx):
        self.ctx = ctx
        self.raw = {s["id"]: s for s in json.loads((ctx.folder / "stories.json").read_text(encoding="utf-8"))}
        self.entries = [Entry(s["id"], s["title"], s["topic"], s["source"], s["title"])
                        for s in self.raw.values()]
        self.shown = ctx.shown("stories.json")

    def next(self):
        s = pick_unshown(self.entries, self.shown, self.ctx.rng, library="stories.json")
        return self._node(s.id, "start")

    def _node(self, sid, nid):
        story = self.raw[sid]
        node = story["nodes"][nid]
        if not node["options"]:
            return Page(story["title"], node["text"])
        page = quiz_page(story["title"], node["text"], [o["label"] for o in node["options"]], f"{sid}|{nid}")
        return page if page is not None else Page(story["title"], node["text"])

    def choose(self, key, index):
        try:
            sid, nid = key.split("|")
            opts = self.raw[sid]["nodes"][nid]["options"]
            if not 0 <= index < len(opts):
                raise IndexError(index)
            return self._node(sid, opts[index]["to"])
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            return Page(NAME, "That question is no longer here.")


def create(ctx):
    return ChooseYourPath(ctx)
