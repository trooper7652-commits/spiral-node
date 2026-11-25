from spiral.scripts_api import Page, Preference

NAME = "Alpha Notes"
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class _Alpha:
    def next(self):
        return Page("Alpha", "hello")


def create(ctx):
    return _Alpha()
