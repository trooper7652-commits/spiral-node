import calendar

from spiral.scripts_api import Page, Preference

NAME = "On This Day"
DESCRIPTION = "What happened on today's date in history, from Wikipedia."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]


class OnThisDay:
    def __init__(self, ctx):
        self.ctx = ctx
        self.events = ctx.library("events.json")
        self.shown = ctx.shown("events.json")

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
        todo = [e for t in sorted(topics) for e in self.events if e.topic == t and e.id not in done]
        if not todo:
            return Page("On This Day", f"That's all for {day}. More tomorrow.")
        self.shown.add(todo[0].id)
        return Page(f"On This Day: {day}", todo[0].text)


def create(ctx):
    return OnThisDay(ctx)
