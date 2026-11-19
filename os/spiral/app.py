from datetime import timedelta
from pathlib import Path

from .config import BOOT_FRAME_S, BOOT_FRAMES, BOOT_HOLD_S, HISTORY_MAX
from .input import Action
from .display import RefreshPolicy
from .library import LibraryExhausted, ShownLog
from .loader import discover
from .render import TopBar, picture_max_h
from .screens import BootScreen, ExhaustedDialog, HomeScreen, OffScreen
from .scripts_api import Page, ScriptContext, check_picture, valid_prefs
from .storage import Store
from .welcome import Welcome, load_messages


class App:
    def __init__(self, display, clock, wall, data_dir: Path, builtin_dir: Path,
                 welcome_file: Path, battery, rng):
        self.display = display
        self.clock = clock
        self.wall = wall
        self.data_dir = Path(data_dir)
        self.builtin_dir = Path(builtin_dir)
        self.welcome_file = Path(welcome_file)
        self.battery = battery
        self.rng = rng
        self.store = Store(self.data_dir, clock)
        self.welcome = None
        self.policy = RefreshPolicy()
        self.stack = []
        self.powered_off = False
        self._boot_t0 = 0.0
        self._last_saving = False
        self.scripts = {}
        self.script_id = None
        self.runner = None
        self.history = []  # [{"title", "body"}], newest last, max HISTORY_MAX
        self.hpos = -1
        self.paused = False
        self.next_due = None
        self.error_page = None
        self._prefs = {}

    # -- helpers ---------------------------------------------------------
    @property
    def screen_name(self) -> str:
        return self.stack[-1].name if self.stack else ""

    def screen_text(self) -> str:
        return self.stack[-1].text(self) if self.stack else ""

    def log(self, msg: str) -> None:
        folder = self.data_dir / "logs"
        folder.mkdir(parents=True, exist_ok=True)
        with open(folder / "spiral.log", "a", encoding="utf-8") as f:
            f.write(f"{self.wall().isoformat(timespec='seconds')} {msg}\n")

    def bar(self) -> TopBar:
        settings = self.store.get("settings", {})
        offset = settings.get("clock_offset_s", 0) if isinstance(settings, dict) else 0
        if type(offset) not in (int, float) or not abs(offset) <= 1e9:
            offset = 0
        return TopBar(self.wall() + timedelta(seconds=offset), self.store.saving, self.battery())

    def redraw(self, full=None) -> None:
        if full is None:
            full = self.policy.use_full(False)
        self._last_saving = self.store.saving
        self.display.show(self.stack[-1].render(self.bar()), full)

    def push(self, screen) -> None:
        self.stack.append(screen)

    def pop(self) -> None:
        if len(self.stack) > 1:
            self.stack.pop()
        if self.screen_name == "home":
            self._arm()

    def home(self) -> None:
        self.stack = [HomeScreen(self)]
        self._arm()

    # -- scripts ---------------------------------------------------------
    @property
    def active_script_id(self):
        return self.script_id

    def interval(self) -> int:
        return self._prefs.get("interval", 30)

    def _arm(self) -> None:
        """(Re)start a full interval; only runs while Home is shown, a script is active and not paused."""
        self.next_due = self.clock() + self.interval() if self.runner and not self.paused else None

    def _save(self) -> None:
        self.store.set("active", {"script_id": self.script_id, "prefs": self._prefs,
                                  "history": self.history, "paused": self.paused})

    def _clear(self) -> None:
        self.script_id = self.runner = self.next_due = None
        self._prefs = {}
        self.history, self.hpos, self.paused = [], -1, False

    def _create(self, script_id, prefs):
        info = self.scripts[script_id]
        ctx = ScriptContext(script_id, info.folder, prefs, self.store, self.rng,
                            lambda: self.bar().now.date())
        return info.module.create(ctx)

    def start_script(self, script_id, prefs) -> None:
        info = self.scripts[script_id]
        self.error_page = None
        self._clear()
        try:
            runner = self._create(script_id, prefs)
        except (Exception, SystemExit) as e:
            self.script_error(info.name, str(e) or type(e).__name__)
            return
        self.script_id, self._prefs, self.runner = script_id, dict(prefs), runner
        self._save()
        self.home()
        self.advance()

    def stop_script(self) -> None:
        self.error_page = None
        self._clear()
        self.store.set("active", {})
        self.home()

    def advance(self) -> None:
        """Ask the script for a new page and make it the current one."""
        try:
            page = self.runner.next()
            if not (isinstance(page, Page) and isinstance(page.title, str) and isinstance(page.body, str)):
                raise TypeError("script returned something that is not a Page of text")
            check_picture(page.picture, picture_max_h())
            entry = {"title": " ".join(page.title.split()), "body": page.body, "picture": list(page.picture)}
        except LibraryExhausted as e:
            self.paused = True
            self._save()
            self.push(ExhaustedDialog(e.library))
            return
        except (Exception, SystemExit) as e:
            self.script_error(self.scripts[self.script_id].name, str(e) or type(e).__name__)
            return
        self.history = (self.history + [entry])[-HISTORY_MAX:]
        self.hpos = len(self.history) - 1
        self._save()

    def restart_library(self, library: str) -> None:
        ShownLog(self.store, f"shown/{self.script_id}/{Path(library).stem}").reset()
        self.paused = False
        self.pop()
        self.advance()
        self._arm()

    def page_forward(self) -> None:
        if self.hpos < len(self.history) - 1:
            self.hpos += 1
        else:
            self.advance()
        self._arm()

    def page_back(self) -> None:
        self.hpos = max(0, self.hpos - 1)
        self._arm()

    def script_error(self, name: str, msg: str) -> None:
        self.log(f"{name}: {msg}")
        self._clear()
        self.store.set("active", {})
        self.error_page = Page("Script error", f"{name}: {msg}")
        self.home()

    @staticmethod
    def _saved_picture(h) -> list:
        """The saved picture if it is still valid (old saves have none), else no picture."""
        pic = h.get("picture", [])
        try:
            check_picture(pic, picture_max_h())
        except ValueError:
            return []
        return list(pic)

    def _resume(self) -> None:
        saved = self.store.get("active", {})
        sid = saved.get("script_id") if isinstance(saved, dict) else None
        if not isinstance(sid, str) or not sid:
            if sid:
                self.log(f"active script id {sid!r} is invalid; cleared")
                self.store.set("active", {})
            return
        info = self.scripts.get(sid)
        if info is None or info.error:
            self.log(f"active script {sid} is missing or broken; cleared")
            self.store.set("active", {})
            return
        prefs = valid_prefs(info.preferences, saved.get("prefs") if isinstance(saved.get("prefs"), dict) else {})
        try:
            runner = self._create(sid, prefs)
        except (Exception, SystemExit) as e:
            self.script_error(info.name, str(e) or type(e).__name__)
            return
        hist = saved.get("history")
        self.history = [{"title": h["title"], "body": h["body"], "picture": self._saved_picture(h)}
                        for h in hist if isinstance(h, dict) and isinstance(h.get("title"), str)
                        and isinstance(h.get("body"), str)][-HISTORY_MAX:] if isinstance(hist, list) else []
        self.hpos = len(self.history) - 1
        self.script_id, self._prefs, self.runner = sid, prefs, runner
        self.paused = bool(saved.get("paused"))
        self._arm()

    # -- lifecycle -------------------------------------------------------
    def boot(self) -> None:
        self.scripts = {i.id: i for i in discover(self.builtin_dir, self.data_dir / "scripts")}
        self.welcome = Welcome(load_messages(self.welcome_file), self.store)
        message = self.welcome.advance()
        self.stack = [BootScreen(message)]
        self._boot_t0 = self.clock()
        self.redraw(full=True)

    @property
    def booting(self) -> bool:
        return self.screen_name == "boot"

    def tick(self) -> None:
        if self.powered_off or not self.stack:
            return
        if self.booting:
            boot = self.stack[-1]
            elapsed = self.clock() - self._boot_t0 + 1e-6  # float slack
            frame = min(int(elapsed / BOOT_FRAME_S), BOOT_FRAMES - 1)
            if frame > boot.i:
                boot.i = frame
                self.redraw()
            if boot.i == BOOT_FRAMES - 1 and elapsed >= (BOOT_FRAMES - 1) * BOOT_FRAME_S + BOOT_HOLD_S:
                self.home()
                self._resume()
                self.redraw()
            return
        if (self.screen_name == "home" and self.next_due is not None
                and not self.paused and self.clock() >= self.next_due):
            self.advance()
            self._arm()
            self.redraw()
        self.store.flush_if_due()
        if self.store.saving != self._last_saving:
            self.redraw()

    def handle(self, action) -> None:
        if self.powered_off or self.booting or not self.stack:
            return
        if action is Action.HOME:
            if len(self.stack) > 1 or self.screen_name != "home":
                self.home()  # a running script keeps running; only the screen stack is dropped
        else:
            self.stack[-1].handle(action, self)
        if not self.powered_off:
            self.redraw()

    def power_off(self) -> None:
        self.store.flush()
        self.stack = [OffScreen()]
        self.powered_off = True
        self.redraw(full=True)
