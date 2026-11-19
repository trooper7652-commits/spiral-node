from spiral.library import pick_unshown
from spiral.scripts_api import Page, Preference

NAME = "Poems"
DESCRIPTION = "Short public-domain poems, one page at a time."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class Poems:
    def __init__(self, ctx):
        self.ctx = ctx
        self.poems = {p.id: p for p in ctx.library("poems.json", "story")}
        self.entries = list(self.poems.values())
        self.shown = ctx.shown("poems.json")

    def next(self):
        state = self.ctx.state()
        poem = self.poems.get(state.get("poem"))
        page = state.get("page")
        if poem is None or not isinstance(page, int) or not 0 <= page < len(poem.pages):
            poem = pick_unshown(self.entries, self.shown, self.ctx.rng, library="poems.json")
            page = 0
        self.ctx.save_state({"poem": poem.id, "page": page + 1})
        return Page(poem.title, poem.pages[page])


def create(ctx):
    return Poems(ctx)
