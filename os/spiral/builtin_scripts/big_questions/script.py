from spiral.library import pick_unshown
from spiral.scripts_api import Page, Preference

NAME = "Big Questions"
DESCRIPTION = "One question worth thinking about."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class BigQuestions:
    def __init__(self, ctx):
        self.rng = ctx.rng
        self.questions = ctx.library("questions.json")
        self.shown = ctx.shown("questions.json")

    def next(self):
        q = pick_unshown(self.questions, self.shown, self.rng, library="questions.json")
        return Page("Big question", q.text)


def create(ctx):
    return BigQuestions(ctx)
