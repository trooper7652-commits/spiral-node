import json

from spiral.library import pick_unshown
from spiral.scripts_api import Page, Preference, quiz_page, tally_line

NAME = "Daily Puzzle"
DESCRIPTION = "A new puzzle every day, then practice puzzles. Keep your daily streak going."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class DailyPuzzle:
    def __init__(self, ctx):
        self.ctx = ctx
        self.entries = ctx.library("puzzles.json")
        self.raw = {r["id"]: r for r in json.loads((ctx.folder / "puzzles.json").read_text(encoding="utf-8"))}
        self.ids = sorted(self.raw)
        self.shown = ctx.shown("puzzles.json")

    def daily_id(self, day):
        return self.ids[day.toordinal() % len(self.ids)]

    def next(self):
        day = self.ctx.today()
        pid = self.daily_id(day)
        if self.ctx.state().get("daily_done") != day.isoformat():
            return self._page("Today's puzzle", pid, f"daily|{day.isoformat()}|{pid}")
        e = pick_unshown([x for x in self.entries if x.id != pid], self.shown, self.ctx.rng,
                         library="puzzles.json")
        return self._page("Practice", e.id, f"practice|{e.id}")

    def _page(self, title, pid, key):
        r = self.raw[pid]
        return quiz_page(title, r["text"], r["options"], key)

    def choose(self, key, index):
        try:
            parts = key.split("|")
            if parts[0] == "daily" and len(parts) == 3:
                iso, pid = parts[1], parts[2]
            elif parts[0] == "practice" and len(parts) == 2:
                iso, pid = None, parts[1]
            else:
                raise ValueError(key)
            r = self.raw[pid]
            if not 0 <= index < 3:
                raise IndexError(index)
        except (ValueError, KeyError, IndexError, TypeError, AttributeError):
            return Page(NAME, "That question is no longer here.")
        correct = index == r["answer"]
        if iso is not None and iso == self.ctx.today().isoformat() and self.ctx.state().get("daily_done") != iso:
            t = self.ctx.record(correct)
            state = self.ctx.state()
            state["daily_done"] = iso
            self.ctx.save_state(state)
            tail = tally_line(t)
        else:
            state = self.ctx.state()
            p = state.get("practice") if isinstance(state.get("practice"), dict) else {}
            p = {"score": int(p.get("score", 0)) + bool(correct), "answered": int(p.get("answered", 0)) + 1}
            state["practice"] = p
            self.ctx.save_state(state)
            tail = f"Practice: {p['score']}/{p['answered']} right"
        return Page("Right" if correct else "Not quite", f"{r['explain']}\n\n{tail}")


def create(ctx):
    return DailyPuzzle(ctx)
