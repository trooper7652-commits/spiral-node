import json

from spiral.library import LibraryExhausted, pick_unshown
from spiral.scripts_api import Page, Preference, quiz_page, tally_line

NAME = "Space Facts"
DESCRIPTION = "Sourced facts about space and Earth, with a question to think about, or a quiz."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s"),
               Preference("mode", "Mode", ("Mix", "Quiz", "Read"), "Mix")]


class SpaceFacts:
    def __init__(self, ctx):
        self.rng = ctx.rng
        self.facts = ctx.library("facts.json")
        self.questions = ctx.library("questions.json")
        self.shown_facts = ctx.shown("facts.json")
        self.shown_questions = ctx.shown("questions.json")
        self.ctx = ctx
        self.mode = ctx.prefs.get("mode", "Mix")
        self.turn = 0
        self.quiz = ctx.library("quiz.json")
        self.quiz_raw = {r["id"]: r for r in json.loads((ctx.folder / "quiz.json").read_text(encoding="utf-8"))}
        self.shown_quiz = ctx.shown("quiz.json")

    def next(self):
        quiz = self.mode == "Quiz" or (self.mode == "Mix" and self.turn % 2 == 0)
        self.turn += 1
        if quiz:
            page = self._quiz()
            if page is not None:
                return page
        return self._read()

    def _quiz(self):
        if self.mode == "Mix" and not {e.id for e in self.quiz} - self.shown_quiz.ids():
            return None  # in Mix a used-up quiz just gives read pages; in Quiz mode pick_unshown raises
        e = pick_unshown(self.quiz, self.shown_quiz, self.rng, library="quiz.json")
        r = self.quiz_raw[e.id]
        return quiz_page("Space quiz", r["text"], r["options"], e.id)

    def _read(self):
        # check both first so an exhausted question library never uses up a fact
        for entries, shown, lib in ((self.facts, self.shown_facts, "facts.json"),
                                    (self.questions, self.shown_questions, "questions.json")):
            if not {e.id for e in entries} - shown.ids():
                raise LibraryExhausted(lib)
        fact = pick_unshown(self.facts, self.shown_facts, self.rng, library="facts.json")
        question = pick_unshown(self.questions, self.shown_questions, self.rng, library="questions.json")
        return Page("Space fact", f"{fact.text}\n\nQ: {question.text}")

    def choose(self, key, index):
        r = self.quiz_raw.get(key)
        if r is None or not 0 <= index < 3:
            return Page("Space fact", "That question is no longer here.")
        correct = index == r["answer"]
        t = self.ctx.record(correct)
        return Page("Right" if correct else "Not quite", f"{r['explain']}\n\n{tally_line(t)}")


def create(ctx):
    return SpaceFacts(ctx)
