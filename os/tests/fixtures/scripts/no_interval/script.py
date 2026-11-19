from spiral.scripts_api import Preference

NAME = "No Interval"
PREFERENCES = [Preference("size", "Size", (1, 2), 1)]


def create(ctx):
    raise AssertionError("never called")
