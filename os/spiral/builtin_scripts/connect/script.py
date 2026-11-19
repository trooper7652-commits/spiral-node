from spiral.library import LibraryExhausted, pick_unshown
from spiral.scripts_api import Page, Preference

NAME = "Connect"
DESCRIPTION = "Two random topics from different categories. What links them? The connection is yours to make."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 60, "s")]
LIBRARY = "topics.json"


class Connect:
    def __init__(self, ctx):
        self.rng = ctx.rng
        self.topics = ctx.library(LIBRARY)
        self.shown = ctx.shown(LIBRARY)

    def next(self):
        done = self.shown.ids()
        unshown = [t for t in self.topics if t.id not in done]
        # check before marking anything: fewer than two categories left means no valid pair
        if len({t.topic for t in unshown}) < 2:
            raise LibraryExhausted(LIBRARY)
        a = pick_unshown(self.topics, self.shown, self.rng, library=LIBRARY)
        b = self.rng.choice([t for t in unshown if t.topic != a.topic])
        self.shown.add(b.id)
        return Page("Connect", f"{a.text}\n+\n{b.text}\n\nWhat links these?")


def create(ctx):
    return Connect(ctx)