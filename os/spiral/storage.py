import json
import logging
import os
from pathlib import Path
from typing import Callable

from .config import SAVE_DEBOUNCE_S

log = logging.getLogger("spiral")


def write_json_atomic(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f)
        f.flush()
        try:
            os.fsync(f.fileno())
        except (OSError, AttributeError):  # Pyodide's file system may lack fsync
            pass
    os.replace(tmp, path)


def read_json(path: Path, default):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        # valid JSON of the wrong shape (hand-edited) is as bad as corrupt JSON
        if default is not None and not isinstance(data, type(default)):
            raise ValueError(f"expected {type(default).__name__}, got {type(data).__name__}")
        return data
    except FileNotFoundError:
        return default
    except ValueError as e:  # JSONDecodeError and UnicodeDecodeError are both ValueErrors
        bad = path.with_name(path.name + ".corrupt")
        os.replace(path, bad)
        log.warning("corrupt file %s (%s); moved to %s, using defaults", path, e, bad)
        return default


class Store:
    def __init__(self, root: Path, clock: Callable[[], float]):
        self.root = Path(root)
        self.clock = clock
        self._cache = {}
        self._dirty = {}
        self._last_set = 0.0
        self.writes = 0  # counts flushes that hit the disk (the web host persists on change)

    def _path(self, key: str) -> Path:
        return self.root / (key + ".json")

    def get(self, key: str, default):
        if key in self._dirty:
            return self._dirty[key]
        if key not in self._cache:
            self._cache[key] = read_json(self._path(key), default)
        return self._cache[key]

    def set(self, key: str, value) -> None:
        self._cache[key] = value
        self._dirty[key] = value
        self._last_set = self.clock()

    @property
    def saving(self) -> bool:
        return bool(self._dirty)

    def flush_if_due(self) -> bool:
        if self._dirty and self.clock() - self._last_set >= SAVE_DEBOUNCE_S:
            self.flush()
            return True
        return False

    def flush(self) -> None:
        if self._dirty:
            self.writes += 1
        for key, value in self._dirty.items():
            write_json_atomic(self._path(key), value)
        self._dirty.clear()
