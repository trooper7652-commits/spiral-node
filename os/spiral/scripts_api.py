import random
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .config import PICTURE_MAX_W
from .library import Entry, ShownLog, load_library, parse_library
from .storage import Store


@dataclass(frozen=True)
class Preference:
    key: str
    label: str
    choices: tuple
    default: object
    suffix: str = ""


def valid_prefs(preferences, saved) -> dict:
    """Saved values that are a real choice of the right type; defaults for the rest."""
    out = {}
    for p in preferences:
        v = saved.get(p.key)
        out[p.key] = v if v in p.choices and type(v) is type(p.default) else p.default
    return out


@dataclass(frozen=True)
class Page:
    title: str
    body: str
    picture: tuple[str, ...] = ()  # rows of "#" (ink) and "." (paper), all the same length
    choices: tuple[str, ...] = ()  # up to 4 button labels; the script then needs choose(key, index)
    key: str = ""  # tells choose() which question was answered; required with choices


def check_choices(page: Page) -> None:
    """Raise ValueError unless the page's choices (if any) are 1-4 distinct short labels and it has a key."""
    c = page.choices
    if not isinstance(c, (tuple, list)) or not all(isinstance(s, str) for s in c):
        raise ValueError("choices must be a tuple of strings")
    if not c:
        return
    if len(c) > 4:
        raise ValueError("a page can have at most 4 choices")
    if any(not s.strip() or len(s) > 10 for s in c):
        raise ValueError("each choice must be 1 to 10 characters")
    if len(set(c)) != len(c):
        raise ValueError("choices must be different from each other")
    if not isinstance(page.key, str) or not 0 < len(page.key) <= 200:
        raise ValueError("a page with choices needs a key of 1 to 200 characters")


def tally_line(t: dict) -> str:
    return f"{t['score']}/{t['answered']} right, run {t['run']}, {t['streak']}-day streak"


LETTERS = ("A", "B", "C", "D")


def quiz_page(title: str, question: str, options, key: str):
    """A multiple-choice Page with letter buttons, or None when it cannot fit the screen.

    Options go one per line ("A: ...") when that fits, else on one line ("A: ... / B: ...")."""
    from .render import page_fits
    letters = LETTERS[:len(options)]
    lines = [f"{l}: {o}" for l, o in zip(letters, options)]
    # a visible separator: wrapping collapses spaces, which would run "A: No B: Yes" together
    for body in ("\n".join([question, *lines]), "\n".join([question, " / ".join(lines)])):
        page = Page(title, body, choices=letters, key=key)
        if page_fits(page):
            return page
    return None


def check_picture(picture, max_h: int) -> None:
    """Raise ValueError unless picture is a rectangle of '#'/'.' rows that fits the screen."""
    if not isinstance(picture, (tuple, list)) or not all(isinstance(r, str) for r in picture):
        raise ValueError("picture must be a tuple of strings")
    if not picture:
        return
    if len(picture) > max_h:
        raise ValueError(f"picture is taller than {max_h} rows")
    w = len(picture[0])
    if not 0 < w <= PICTURE_MAX_W:
        raise ValueError(f"picture must be 1 to {PICTURE_MAX_W} columns wide")
    if any(len(r) != w or set(r) - {"#", "."} for r in picture):
        raise ValueError("picture rows must be the same length and use only # and .")


class ScriptContext:
    def __init__(self, script_id: str, folder: Path, prefs: dict, store: Store, rng: random.Random,
                 today: Callable[[], date]):
        self.script_id = script_id
        self.folder = Path(folder)
        self.prefs = prefs
        self.store = store
        self.rng = rng
        self.today = today

    def library(self, filename: str, kind: str = "fact") -> list[Entry]:
        return load_library(self.folder / filename, kind)

    def entries(self, raw: list[dict], kind: str = "fact", name: str = "inline") -> list[Entry]:
        return parse_library(raw, name, kind)

    def shown(self, filename: str) -> ShownLog:
        return ShownLog(self.store, f"shown/{self.script_id}/{Path(filename).stem}")

    def state(self) -> dict:
        return dict(self.store.get(f"script-state/{self.script_id}", {}))

    def save_state(self, d: dict) -> None:
        self.store.set(f"script-state/{self.script_id}", d)

    def record(self, correct: bool) -> dict:
        """Count one answer in the script's saved tally and return it; the streak counts days with an answer."""
        state = self.state()
        old = state.get("tally") if isinstance(state.get("tally"), dict) else {}

        def num(k):
            return old[k] if type(old.get(k)) is int and old[k] > 0 else 0

        try:
            last = date.fromisoformat(old.get("last_day"))
        except (TypeError, ValueError):
            last = None
        today = self.today()
        gap = (today - last).days if last else None
        streak = max(num("streak"), 1) if gap == 0 else num("streak") + 1 if gap == 1 else 1
        run = num("run") + 1 if correct else 0
        t = {"score": num("score") + bool(correct), "answered": num("answered") + 1, "run": run,
             "best_run": max(num("best_run"), run), "streak": streak,
             "best_streak": max(num("best_streak"), streak), "last_day": today.isoformat()}
        state["tally"] = t
        self.save_state(state)
        return dict(t)
