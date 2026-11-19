"""A minimal Spiral Node script in one file: one fact per page. Copy this folder to scripts/<your_id>/ and make it yours."""
from spiral.library import pick_unshown
from spiral.scripts_api import Page, Preference

NAME = "Template"  # shown in the Scripts list
DESCRIPTION = "One fact per page from a list inside the script. Copy it to start your own script."
AUTHOR = "Spiral Node"  # your GitHub username
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]
LIBRARY = "facts"  # names the "shown" log
FACTS = [
    {"id": "wombat-cubes", "text": "Wombat droppings are cube-shaped.", "topic": "sample", "source": "https://en.wikipedia.org/wiki/Wombat"},
    {"id": "flamingo-group", "text": "A group of flamingos is called a flamboyance.", "topic": "sample", "source": "https://en.wikipedia.org/wiki/Flamingo"},
    {"id": "sharks-before-trees", "text": "Sharks lived on Earth before the first trees grew.", "topic": "sample", "source": "https://en.wikipedia.org/wiki/Shark"},
]


class Template:
    def __init__(self, ctx):
        self.rng = ctx.rng
        self.facts = ctx.entries(FACTS)
        self.shown = ctx.shown(LIBRARY)

    def next(self):
        # raises LibraryExhausted when every fact was shown; the OS then offers to start over
        fact = pick_unshown(self.facts, self.shown, self.rng, library=LIBRARY)
        return Page("Fact", fact.text)  # add picture=("#.#", ".#.") to draw a small image


def create(ctx):
    return Template(ctx)
