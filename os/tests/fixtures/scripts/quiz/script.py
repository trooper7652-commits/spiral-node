from spiral.scripts_api import Page, Preference

NAME = "Quiz"
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s"),
               Preference("mode", "Mode", ("same", "alternate"), "same")]
CALLS = []  # every choose() call, as (key, index)


class _Quiz:
    def __init__(self, alternate):
        self.alternate, self.n = alternate, 0

    def next(self):
        self.n += 1
        if self.alternate and self.n % 2 == 0:
            return Page("Plain", "p")
        return Page("Q1", "A: one\nB: two", choices=("A", "B"), key="q1")

    def choose(self, key, index):
        CALLS.append((key, index))
        return Page("Correct" if index == 0 else "Not quite", f"key {key}")


def create(ctx):
    return _Quiz(ctx.prefs.get("mode") == "alternate")
