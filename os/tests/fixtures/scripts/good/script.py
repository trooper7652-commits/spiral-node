from spiral.scripts_api import Page, Preference

NAME = "Good"
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class _Good:
    def next(self):
        return Page("Good", "hello")


def create(ctx):
    return _Good()
