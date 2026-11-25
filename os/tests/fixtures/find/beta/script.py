from spiral.scripts_api import Page, Preference

NAME = "Beta Tales"
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class _Beta:
    def next(self):
        return Page("Beta", "hello")


def create(ctx):
    return _Beta()
