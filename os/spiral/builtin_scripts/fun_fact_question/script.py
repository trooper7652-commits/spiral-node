from spiral.library import LibraryExhausted, pick_unshown
from spiral.scripts_api import Page, Preference

NAME = "Fun Fact + Question"
DESCRIPTION = "One sourced fun fact and one question to think about."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class FunFactQuestion:
    def __init__(self, ctx):
        self.rng = ctx.rng
        self.facts = ctx.library("facts.json")
        self.questions = ctx.library("questions.json")
        self.shown_facts = ctx.shown("facts.json")
        self.shown_questions = ctx.shown("questions.json")

    def next(self):
        # check both first so an exhausted question library never uses up a fact
        for entries, shown, lib in ((self.facts, self.shown_facts, "facts.json"),
                                    (self.questions, self.shown_questions, "questions.json")):
            if not {e.id for e in entries} - shown.ids():
                raise LibraryExhausted(lib)
        fact = pick_unshown(self.facts, self.shown_facts, self.rng, library="facts.json")
        question = pick_unshown(self.questions, self.shown_questions, self.rng, library="questions.json")
        return Page("Fun fact", f"{fact.text}\n\nQ: {question.text}")


def create(ctx):
    return FunFactQuestion(ctx)
