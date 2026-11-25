from spiral.scripts_api import Page, Preference

NAME = "Bad choices"
PREFERENCES = [
    Preference("interval", "Refresh", (15, 30, 60), 30, "s"),
    Preference("variant", "Variant", ("five", "long", "nochoose", "nokey"), "five"),
]

PAGES = {
    "five": Page("Bad", "five", choices=("A", "B", "C", "D", "E"), key="k"),
    "long": Page("Bad", "long", choices=("elevenchars",), key="k"),
    "nochoose": Page("Bad", "nochoose", choices=("A",), key="k"),
    "nokey": Page("Bad", "nokey", choices=("A",), key=""),
}


class _NoChoose:
    def __init__(self, page):
        self.page = page

    def next(self):
        return self.page


class _Bad(_NoChoose):
    def choose(self, key, index):
        return Page("Done", "done")


def create(ctx):
    variant = ctx.prefs["variant"]
    return (_NoChoose if variant == "nochoose" else _Bad)(PAGES[variant])
