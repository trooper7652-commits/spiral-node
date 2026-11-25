import json

from spiral.library import pick_unshown
from spiral.scripts_api import Page, Preference, quiz_page, tally_line

NAME = "Famous Quotes"
DESCRIPTION = "A sourced quote and who said it, or guess who said it."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s"), Preference("mode", "Mode", ("Mix", "Quiz", "Read"), "Mix")]


class FamousQuotes:
    def __init__(self, ctx):
        self.ctx = ctx
        self.rng = ctx.rng
        self.quotes = ctx.library("quotes.json")
        self.shown = ctx.shown("quotes.json")
        self.mode = ctx.prefs.get("mode", "Mix")
        self.turn = 0
        self.authors = sorted({q.topic for q in self.quotes})
        self.by_id = {q.id: q for q in self.quotes}
        self.years = {r["id"]: r["year"] for r in json.loads((ctx.folder / "quotes.json").read_text(encoding="utf-8"))}

    def next(self):
        q = pick_unshown(self.quotes, self.shown, self.rng, library="quotes.json")
        is_quiz = self.mode == "Quiz" or (self.mode == "Mix" and self.turn % 2 == 0)
        self.turn += 1
        if is_quiz:
            others = [a for a in self.authors if a != q.topic]
            if len(others) >= 2:
                names = [q.topic] + self.rng.sample(others, 2)
                self.rng.shuffle(names)
                idx = [self.authors.index(name) for name in names]
                page = quiz_page("Who said it?", f"“{q.text}”", names, f"{q.id}|{idx[0]},{idx[1]},{idx[2]}")
                if page is not None:
                    return page
        return Page("Quote", f"“{q.text}”\n\n- {q.topic}")  # read mode, or the quiz does not fit

    def choose(self, key, index):
        try:
            qid, rest = key.split("|")
            idx = [int(x) for x in rest.split(",")]
            if len(idx) != 3 or not 0 <= index < 3:
                raise ValueError("bad key")
            q, year = self.by_id[qid], self.years[qid]
            picked = self.authors[idx[index]]
        except (ValueError, KeyError, IndexError):
            return Page("Quote", "That question is no longer here.")
        t = self.ctx.record(picked == q.topic)
        return Page("Right" if picked == q.topic else "Not quite", f"- {q.topic}, {year}\n\n{tally_line(t)}")


def create(ctx):
    return FamousQuotes(ctx)
