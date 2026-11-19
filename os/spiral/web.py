"""Facade the browser (Pyodide) talks to. All times are now_ms floats from JavaScript."""
import random
import re
import shutil
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps

import spiral
from .app import App
from .display import MemoryDisplay
from .input import Button, LongPress
from .loader import discover
from .scripts_api import valid_prefs

# The browser build unpacks the zip so this layout holds: spiral/ and welcome-messages.txt side by side.
WELCOME_FILE = Path(spiral.__file__).parent.parent / "welcome-messages.txt"
BUILTIN_DIR = Path(spiral.__file__).parent / "builtin_scripts"


def pack_bits(img: Image.Image) -> bytes:
    """250x122 frame, 1 bit per pixel, row-major, MSB first, 1 = black, padding bits 0."""
    return ImageOps.invert(img.convert("L")).convert("1").tobytes()


class WebHost:
    def __init__(self, data_dir: str = "/data", seed: int | None = None, battery: int = 100):
        self.data_dir = Path(data_dir)
        self.seed = seed
        self.battery = battery
        self.display = MemoryDisplay()
        self.longpress = LongPress()
        self.app = None
        self.last_img = None
        self._now = 0.0
        self._writes_seen = 0

    def _set_now(self, now_ms) -> None:
        self._now = now_ms / 1000

    def power_on(self, now_ms) -> None:
        self._set_now(now_ms)
        if self.app is not None and not self.app.powered_off:
            return
        self.display.frames.clear()
        self.longpress = LongPress()
        self.app = App(self.display, lambda: self._now, datetime.now, self.data_dir, BUILTIN_DIR,
                       WELCOME_FILE, lambda: self.battery, random.Random(self.seed))
        self.app.boot()

    def _feed(self, action) -> None:
        if action is not None and self.app:
            self.app.handle(action)

    def press(self, button: str, now_ms) -> None:
        self._set_now(now_ms)
        self._feed(self.longpress.press(Button(button), self._now))

    def release(self, button: str, now_ms) -> None:
        self._set_now(now_ms)
        self._feed(self.longpress.release(Button(button), self._now))

    def start(self, script_id: str, now_ms) -> bool:
        """Start a script with its default preferences and show Home (the gallery's "Run in simulator").
        Unknown or broken ids, and calls before Home is reached, change nothing."""
        self._set_now(now_ms)
        app = self.app
        info = app.scripts.get(script_id) if app and not app.powered_off and not app.booting else None
        if info is None or info.error:
            return False
        app.start_script(script_id, valid_prefs(info.preferences, {}))
        app.redraw()
        return True

    def install_script(self, script_id: str, source: str) -> str | None:
        """Save a script under <data>/scripts/<id>/ and rediscover scripts. Returns an error text, or None."""
        if not re.fullmatch(r"[a-z0-9_]{1,40}", script_id):
            return "Script id must be 1-40 characters: lowercase letters, digits or _."
        folder = self.data_dir / "scripts" / script_id
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "script.py").write_text(source, encoding="utf-8")
        if self.app is None:
            return None
        self.app.scripts = {i.id: i for i in discover(BUILTIN_DIR, self.data_dir / "scripts")}
        return self.app.scripts[script_id].error

    def tick(self, now_ms) -> dict | None:
        self._set_now(now_ms)
        if self.app is None:
            return None
        self._feed(self.longpress.tick(self._now))
        self.app.tick()
        frames, self.display.frames = self.display.frames, []
        if not frames:
            return None
        self.last_img = frames[-1][0]
        return {"bits": pack_bits(self.last_img), "full": any(f for _, f in frames),
                "screen": self.app.screen_name, "text": self.app.screen_text(),
                "saving": self.app.store.saving, "powered_off": self.app.powered_off}

    def flushed_since_last_call(self) -> bool:
        writes = self.app.store.writes if self.app else 0
        changed = writes != self._writes_seen
        self._writes_seen = writes
        return changed

    def reset(self) -> None:
        """Factory reset: empty the data folder (it may be a mount point, so keep the folder itself)."""
        self.app = None
        self._writes_seen = 0
        for p in self.data_dir.iterdir():
            shutil.rmtree(p) if p.is_dir() else p.unlink()
