import json
import random
from dataclasses import dataclass
from pathlib import Path

from .storage import Store


@dataclass(frozen=True)
class Entry:
    id: str
    text: str
    topic: str
    source: str
    title: str = ""
    pages: tuple[str, ...] = ()


class LibraryError(Exception):
    pass


class LibraryExhausted(Exception):
    def __init__(self, library: str = ""):
        super().__init__(library)
        self.library = library


_REQUIRED = {
    "fact": ("id", "text", "topic", "source"),
    "story": ("id", "title", "topic", "source"),
}


def load_library(path: Path, kind: str = "fact") -> list[Entry]:
    path = Path(path)
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as e:
        raise LibraryError(f"{path.name}: cannot read or parse JSON ({e})") from e
    return parse_library(data, path.name, kind)


def parse_library(data, name: str, kind: str = "fact") -> list[Entry]:
    def fail(problem):
        return LibraryError(f"{name}: {problem}")

    if not isinstance(data, list):
        raise fail("top level must be a list")
    if not data:
        raise fail("library is empty")

    entries, seen = [], set()
    for i, raw in enumerate(data):
        if not isinstance(raw, dict):
            raise fail(f"entry {i} is not an object")
        who = f"entry {i}" + (f" (id {raw['id']!r})" if isinstance(raw.get("id"), str) and raw["id"] else "")
        for field in _REQUIRED[kind]:
            v = raw.get(field)
            if not isinstance(v, str) or not v.strip():
                raise fail(f"{who} is missing '{field}'")
        pages = ()
        if kind == "story":
            p = raw.get("pages")
            if not isinstance(p, list) or not p or not all(isinstance(s, str) and s.strip() for s in p):
                raise fail(f"{who} needs 'pages' as a non-empty list of strings")
            pages = tuple(p)
        if raw["id"] in seen:
            raise fail(f"duplicate id {raw['id']!r}")
        seen.add(raw["id"])
        entries.append(Entry(id=raw["id"], text=raw.get("text", ""), topic=raw["topic"],
                             source=raw["source"], title=raw.get("title", ""), pages=pages))
    return entries


class ShownLog:
    def __init__(self, store: Store, key: str):
        self.store = store
        self.key = key

    def ids(self) -> set[str]:
        ids = self.store.get(self.key, {"ids": []}).get("ids", [])
        return {i for i in ids if isinstance(i, str)} if isinstance(ids, list) else set()

    def add(self, id: str) -> None:
        self.store.set(self.key, {"ids": sorted(self.ids() | {id})})

    def reset(self) -> None:
        self.store.set(self.key, {"ids": []})


def pick_unshown(entries, shown: ShownLog, rng: random.Random, library: str = "") -> Entry:
    done = shown.ids()
    candidates = [e for e in entries if e.id not in done]
    if not candidates:
        raise LibraryExhausted(library)
    entry = rng.choice(candidates)
    shown.add(entry.id)
    return entry
