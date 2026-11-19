from spiral.library import pick_unshown
from spiral.scripts_api import Page, Preference

NAME = "Quick Story"
DESCRIPTION = "Short stories, told one page at a time."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class QuickStory:
    def __init__(self, ctx):
        self.ctx = ctx
        self.stories = {s.id: s for s in ctx.library("stories.json", "story")}
        self.entries = list(self.stories.values())
        self.shown = ctx.shown("stories.json")

    def next(self):
        state = self.ctx.state()
        story = self.stories.get(state.get("story"))
        page = state.get("page")
        if story is None or not isinstance(page, int) or not 0 <= page < len(story.pages):
            story = pick_unshown(self.entries, self.shown, self.ctx.rng, library="stories.json")
            page = 0
        self.ctx.save_state({"story": story.id, "page": page + 1})
        return Page(story.title, story.pages[page])


def create(ctx):
    return QuickStory(ctx)
