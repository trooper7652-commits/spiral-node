from typing import Protocol

from PIL import Image

from .config import FULL_REFRESH_EVERY


class Display(Protocol):
    def show(self, img: Image.Image, full: bool) -> None: ...


class MemoryDisplay:
    def __init__(self):
        self.frames: list[tuple[Image.Image, bool]] = []

    def show(self, img, full):
        self.frames.append((img, full))

    @property
    def last(self):
        return self.frames[-1][0] if self.frames else None


class RefreshPolicy:
    """Counts ordinary refreshes; every `every`-th one is a full refresh.
    Boot and off screens are forced full by the App and are not counted here."""

    def __init__(self, every: int = FULL_REFRESH_EVERY):
        self.every = every
        self.count = 0

    def use_full(self, screen_changed: bool = False) -> bool:
        self.count += 1
        return self.count % self.every == 0
