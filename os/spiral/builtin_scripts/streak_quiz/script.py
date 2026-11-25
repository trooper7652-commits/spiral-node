import json

from spiral.library import Entry, pick_unshown
from spiral.scripts_api import Page, Preference, quiz_page

NAME = "Streak Quiz"
DESCRIPTION = "Rounds of ten questions from the space, fun fact and puzzle quizzes. Beat your best round."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]
SOURCES = {"space": "space_facts/quiz.json", "fun": "fun_fact_question/quiz.json",
           "puzzle": "daily_puzzle/puzzles.json"}


def _int(st, key, default):
    v = st.get(key, default)
    return v if type(v) is int and v >= 0 else default


def _values(st):
    return _int(st, "round", 1) or 1, _int(st, "asked", 0), _int(st, "right", 0), _int(st, "best", 0)


class StreakQuiz:
    def __init__(self, ctx):
        self.ctx = ctx
        self.items = {name: {r["id"]: r for r in json.loads((ctx.folder.parent / path).read_text(encoding="utf-8"))}
                      for name, path in SOURCES.items()}
        self.entries = {name: [Entry(r["id"], r["text"], name, "quiz") for r in raws.values()]
                        for name, raws in self.items.items()}
        self.shown = {name: ctx.shown(f"{name}.json") for name in SOURCES}

    def _options(self, name, r):
        return ("True", "False") if name == "fun" else tuple(r["options"])

    def _right(self, name, r):
        return (0 if r["answer"] else 1) if name == "fun" else r["answer"]

    def next(self):
        st = self.ctx.state()
        rnd, asked, right, best = _values(st)
        if asked >= 10:
            rnd, asked, right = rnd + 1, 0, 0
        name = self.ctx.rng.choice(sorted(SOURCES))
        if not {e.id for e in self.entries[name]} - self.shown[name].ids():
            self.shown[name].reset()
        e = pick_unshown(self.entries[name], self.shown[name], self.ctx.rng, library=f"{name}.json")
        r = self.items[name][e.id]
        asked += 1
        st.update(round=rnd, asked=asked, right=right, best=best)
        self.ctx.save_state(st)
        title = f"Question {asked} of 10"
        key = f"{rnd}|{asked}|{name}|{e.id}"
        if name == "fun":
            return Page(title, r["text"], choices=("True", "False"), key=key)
        return quiz_page(title, r["text"], r["options"], key)

    def choose(self, key, index):
        try:
            rnd, n, name, iid = key.split("|")
            rnd, n = int(rnd), int(n)
            r = self.items[name][iid]
            if not 0 <= index < len(self._options(name, r)):
                raise IndexError(index)
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            return Page(NAME, "That question is no longer here.")
        correct = index == self._right(name, r)
        t = self.ctx.record(correct)
        st = self.ctx.state()
        cur, asked, right, best = _values(st)
        if rnd == cur:
            right += bool(correct)
            if n == 10:
                best = max(best, right)
            st.update(round=cur, asked=asked, right=right, best=best)
            self.ctx.save_state(st)
        if n == 10 and rnd == cur:
            body = f"{r['explain']}\n\nRound: {right}/10. Best: {best}/10."
        else:
            body = f"{r['explain']}\n\n{right}/{n} right this round, run {t['run']}"
        return Page("Right" if correct else "Not quite", body)


def create(ctx):
    return StreakQuiz(ctx)
