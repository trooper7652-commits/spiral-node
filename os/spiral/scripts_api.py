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
