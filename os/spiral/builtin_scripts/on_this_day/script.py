import calendar
import re

from spiral.render import page_fits
from spiral.scripts_api import Page, Preference, tally_line

NAME = "On This Day"
DESCRIPTION = "What happened on today's date in history, from Wikipedia."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s"), Preference("mode", "Mode", ("Mix", "Quiz", "Read"), "Mix")]

_YEAR = re.compile(r"^(\d+)( BC)?: ")


def _year(text) -> int:
    m = _YEAR.match(text)
    return -int(m.group(1)) if m.group(2) else int(m.group(1))


def _label(y: int) -> str:
    return f"{-y} BC" if y < 0 else str(y)


def _strip(text) -> str:
    return _YEAR.sub("", text, count=1)


class OnThisDay:
    def __init__(self, ctx):
        self.ctx = ctx
        self.events = ctx.library("events.json")
        self.shown = ctx.shown("events.json")
        self.by_id = {e.id: e for e in self.events}
        self.mode = ctx.prefs.get("mode", "Mix")
        self.turn = 0

    def next(self):
        today = self.ctx.today()
        topics = {f"{today.month:02d}-{today.day:02d}"}
        if (today.month, today.day) == (2, 28) and not calendar.isleap(today.year):
            topics.add("02-29")  # no Feb 29 this year, so its events show on Feb 28
        state = self.ctx.state()
        if state.get("date") != today.isoformat():
            self.shown.reset()  # a new day (or year) starts the log afresh
            self.ctx.save_state({"date": today.isoformat()})
        day = f"{today:%B} {today.day}"
        done = self.shown.ids()
        # events.json is in date then year order, so the earliest year comes first
        today_events = [e for t in sorted(topics) for e in self.events if e.topic == t]
        todo = [e for e in today_events if e.id not in done]
        if not todo:
            return Page("On This Day", f"That's all for {day}. More tomorrow.")
        quiz = self.mode == "Quiz" or (self.mode == "Mix" and self.turn % 2 == 0)
        self.turn += 1
        if quiz:
            for e in todo:
                y = _year(e.text)
                others = [o for o in sorted({_year(o.text) for o in today_events} - {y}) if abs(o - y) >= 10]
                if len(others) < 2:
                    continue
                years = sorted([y, *self.ctx.rng.sample(others, 2)])
                page = Page(f"What year? {day}", _strip(e.text), choices=tuple(_label(v) for v in years),
                            key=f"{e.id}|{years[0]},{years[1]},{years[2]}")
                if page_fits(page):
                    self.shown.add(e.id)
                    return page
        self.shown.add(todo[0].id)
        return Page(f"On This Day: {day}", todo[0].text)

    def choose(self, key, index):
        try:
            eid, rest = key.split("|")
            years = [int(x) for x in rest.split(",")]
            if len(years) != 3 or not 0 <= index < 3:
                raise ValueError("bad key")
            e = self.by_id[eid]
            y = _year(e.text)
        except (ValueError, KeyError, IndexError):
            return Page("On This Day", "That question is no longer here.")
        correct = years[index] == y
        t = self.ctx.record(correct)
        return Page("Right" if correct else "Not quite", f"It was {_label(y)}.\n\n{tally_line(t)}")


def create(ctx):
    return OnThisDay(ctx)
