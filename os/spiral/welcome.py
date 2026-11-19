from pathlib import Path

from .storage import Store

FALLBACK = "Welcome."


def load_messages(path: Path) -> list[str]:
    try:
        text = Path(path).read_text(encoding="utf-8")
    except (OSError, ValueError):
        return [FALLBACK]
    lines = [ln.strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln and not ln.startswith("#")] or [FALLBACK]


class Welcome:
    def __init__(self, messages: list[str], store: Store):
        self.messages = messages
        self.store = store
        self._current = None

    def _index(self) -> int:
        index = self.store.get("welcome", {"index": 0}).get("index", 0)
        return index if isinstance(index, int) and not isinstance(index, bool) else 0

    def advance(self) -> str:
        index = self._index()
        self.store.set("welcome", {"index": index + 1})
        self._current = self.messages[index % len(self.messages)]
        return self._current

    @property
    def current(self) -> str:
        if self._current is None:
            return self.messages[self._index() % len(self.messages)]
        return self._current
