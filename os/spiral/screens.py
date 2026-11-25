import shutil

from . import VERSION, find
from .config import BOOT_FRAMES
from .input import Action
from .library import ShownLog
from .render import (boot_frame, clock_set_screen, dialog_screen, list_screen, message_screen, off_screen,
                     page_screen, picker_screen, prefs_screen)
from .scripts_api import Page, valid_prefs


def connect_mode_on(app) -> bool:
    s = app.store.get("settings", {})
    return isinstance(s, dict) and s.get("connect_mode") is True


class Screen:
    name = ""

    def render(self, bar):
        raise NotImplementedError

    def handle(self, action, app):
        pass

    def text(self, app) -> str:
        """Plain-text version of what is shown (screen-reader text for the web host)."""
        return ""


class BootScreen(Screen):
    name = "boot"

    def __init__(self, message):
        self.message = message
        self.i = 0

    def render(self, bar):
        return boot_frame(self.i, BOOT_FRAMES, self.message)

    def text(self, app):
        return self.message


class HomeScreen(Screen):
    name = "home"

    def __init__(self, app):
        self.app = app

    def _page(self):
        a = self.app
        if a.error_page:
            return a.error_page
        if 0 <= a.hpos < len(a.history):
            h = a.history[a.hpos]
            return Page(h["title"], h["body"], tuple(h.get("picture", ())), tuple(h.get("choices", ())), h.get("key", ""))
        return None

    def _state(self):
        """(cursor, picked) of the shown page: cursor only on the waiting page, picked only once answered."""
        a = self.app
        if a.error_page or not 0 <= a.hpos < len(a.history):
            return None, None
        picked = a.history[a.hpos].get("picked")
        return (a.cursor if a.waiting and a.hpos == len(a.history) - 1 else None), picked

    def render(self, bar):
        page = self._page()
        return page_screen(page, bar, *self._state()) if page else message_screen(self.app.welcome.current, bar)

    def handle(self, action, app):
        cursor, _ = self._state()
        if action is Action.BACK:
            app.push(MenuScreen())
        elif cursor is not None:
            self._answer(action, app)
        elif action is Action.SELECT:
            app.push(MenuScreen())
        elif app.runner and action is Action.RIGHT:
            app.page_forward()
        elif app.runner and action is Action.LEFT:
            app.page_back()

    @staticmethod
    def _answer(action, app):
        """Buttons on the waiting question: Left/Right pick a choice (Right past the last skips), Select answers."""
        if action is Action.LEFT:
            app.cursor = max(0, app.cursor - 1)
        elif action is Action.RIGHT and app.cursor < len(app.history[-1]["choices"]) - 1:
            app.cursor += 1
        elif action in (Action.RIGHT, Action.DOWN):
            app.page_forward()
        elif action is Action.SELECT:
            app.choose(app.cursor)
        elif action is Action.UP:
            app.page_back()

    def text(self, app):
        page = self._page()
        if not page:
            return self.app.welcome.current
        cursor, picked = self._state()
        mark = cursor if cursor is not None else picked
        labels = [f"[{c}]" if i == mark else c for i, c in enumerate(page.choices)]
        return f"{page.title}\n{page.body}" + (f"\nChoices: {', '.join(labels)}" if labels else "")


class MessageScreen(Screen):
    def __init__(self, name, text):
        self.name = name
        self._text = text

    def render(self, bar):
        return message_screen(self._text, bar)

    def handle(self, action, app):
        if action in (Action.BACK, Action.LEFT, Action.SELECT):
            app.pop()

    def text(self, app):
        return self._text


class ListScreen(Screen):
    """Vertical list: up/down move (clamped), select/right open, left/back pop."""
    title = ""

    def __init__(self, items):
        self.items = items
        self.sel = 0

    def render(self, bar):
        return list_screen(self.items, self.sel, bar)

    def choose(self, app):
        pass

    def handle(self, action, app):
        if action is Action.UP:
            self.sel = max(0, self.sel - 1)
        elif action is Action.DOWN:
            self.sel = min(len(self.items) - 1, self.sel + 1)
        elif action in (Action.SELECT, Action.RIGHT):
            self.choose(app)
        elif action in (Action.LEFT, Action.BACK):
            app.pop()

    def text(self, app):
        selected = self.items[self.sel] if self.items else "nothing"
        return f"{self.title}: {', '.join(self.items)}. Selected: {selected}"


class MenuScreen(ListScreen):
    name = "menu"
    title = "Menu"

    def __init__(self):
        super().__init__(["Scripts", "Find", "Chat", "Quick Story", "Settings", "Power off"])

    def choose(self, app):
        item = self.items[self.sel]
        if item == "Scripts":
            app.push(ScriptListScreen(list(app.scripts.values())))
        elif item == "Quick Story":
            open_script(app, app.scripts.get("quick_story"))
        elif item == "Chat":
            app.push(MessageScreen("chat", "Chat is coming in a later version."))
        elif item == "Power off":
            app.push(PowerOffDialog())
        elif item == "Find":
            app.push(LetterPickerScreen("Find", _find_done))
        elif item == "Settings":
            app.push(SettingsScreen(app))


def open_script(app, info):
    if info is None:
        app.script_error("Quick Story", "script not installed")
    elif info.error:
        app.script_error(info.name, info.error)
    else:
        app.push(PrefsScreen(info, app))


class ScriptListScreen(ListScreen):
    name = "scripts"
    title = "Scripts"

    def __init__(self, infos):
        super().__init__([i.name for i in infos])
        self.infos = infos

    def choose(self, app):
        if self.infos:
            open_script(app, self.infos[self.sel])


class PrefsScreen(Screen):
    name = "prefs"

    def __init__(self, info, app):
        self.info = info
        self.active = app.script_id == info.id
        saved = app._prefs if self.active else {}
        self.values = valid_prefs(info.preferences, saved)
        self.buttons = ["Stop", "OK"] if self.active else ["OK"]
        self.focus = 0

    def _rows(self):
        return [(p.label, f"{self.values[p.key]}{' ' + p.suffix if p.suffix else ''}")
                for p in self.info.preferences]

    def render(self, bar):
        return prefs_screen(self.info.name, self._rows(), self.buttons, self.focus, bar)

    def handle(self, action, app):
        rows = len(self.info.preferences)
        last = rows + len(self.buttons) - 1
        if action is Action.UP:
            self.focus = max(0, self.focus - 1)
        elif action is Action.DOWN:
            self.focus = min(last, self.focus + 1)
        elif action in (Action.LEFT, Action.RIGHT):
            step = -1 if action is Action.LEFT else 1
            if self.focus < rows:
                p = self.info.preferences[self.focus]
                i = p.choices.index(self.values[p.key]) + step
                self.values[p.key] = p.choices[max(0, min(len(p.choices) - 1, i))]
            else:
                self.focus = max(rows, min(last, self.focus + step))
        elif action is Action.SELECT:
            if self.focus < rows:  # shortcut: select on a value just moves down
                self.focus += 1
            elif self.buttons[self.focus - rows] == "Stop":
                app.stop_script()
            else:
                app.start_script(self.info.id, dict(self.values))
        elif action is Action.BACK:
            app.pop()

    def text(self, app):
        rows = "; ".join(f"{k}: {v}" for k, v in self._rows())
        focus = (self._rows()[self.focus][0] if self.focus < len(self._rows())
                 else self.buttons[self.focus - len(self._rows())])
        return f"{self.info.name}. {rows}. Buttons: {', '.join(self.buttons)}. Focus: {focus}"


class DialogScreen(Screen):
    """left/right/up/down move between buttons, select chooses, back cancels."""

    def __init__(self, name, text, buttons, selected, on_choose):
        self.name = name
        self._text = text
        self.buttons = buttons
        self.selected = selected
        self.on_choose = on_choose  # (app, index)

    def render(self, bar):
        return dialog_screen(self._text, self.buttons, self.selected, bar)

    def handle(self, action, app):
        if action in (Action.LEFT, Action.UP):
            self.selected = max(0, self.selected - 1)
        elif action in (Action.RIGHT, Action.DOWN):
            self.selected = min(len(self.buttons) - 1, self.selected + 1)
        elif action is Action.SELECT:
            self.on_choose(app, self.selected)
        elif action is Action.BACK:
            app.pop()

    def text(self, app):
        return f"{self._text} Buttons: {', '.join(self.buttons)}. Selected: {self.buttons[self.selected]}"


def _power_choice(app, i):
    if i == 1:
        app.power_off()
    else:
        app.pop()


class ExhaustedDialog(DialogScreen):  # default is No, to guard against a stray press
    def __init__(self, library):
        super().__init__("exhausted", "Every entry has been shown. Start over?", ["No", "Start over"], 0,
                         lambda app, i: app.restart_library(library) if i == 1 else app.pop())


class PowerOffDialog(DialogScreen):
    def __init__(self):
        super().__init__("power_off", "Power off?", ["Cancel", "OK"], 0, _power_choice)


PICKER_ROWS = [list("ABCDEFGHIJ"), list("KLMNOPQRST"), list("UVWXYZ") + [" ", "Del", "OK"]]


class LetterPickerScreen(Screen):
    """Type a short text: arrows move over the letters (clamped), Select types, Del deletes, OK finishes, Back cancels."""
    name = "picker"

    def __init__(self, title, on_done, max_len=20):
        self.title = title
        self.on_done = on_done  # (app, typed)
        self.max_len = max_len
        self.typed = ""
        self.r = self.c = 0

    def cell(self):
        return PICKER_ROWS[self.r][self.c]

    def render(self, bar):
        return picker_screen(self.title, self.typed, PICKER_ROWS, self.r, self.c, bar)

    def handle(self, action, app):
        if action in (Action.UP, Action.DOWN):
            self.r = max(0, min(len(PICKER_ROWS) - 1, self.r + (1 if action is Action.DOWN else -1)))
            self.c = min(self.c, len(PICKER_ROWS[self.r]) - 1)
        elif action in (Action.LEFT, Action.RIGHT):
            self.c = max(0, min(len(PICKER_ROWS[self.r]) - 1, self.c + (1 if action is Action.RIGHT else -1)))
        elif action is Action.SELECT:
            cell = self.cell()
            if cell == "Del":
                self.typed = self.typed[:-1]
            elif cell == "OK":
                self.on_done(app, self.typed)
            elif len(self.typed) < self.max_len:
                self.typed += cell
        elif action is Action.BACK:
            app.pop()

    def text(self, app):
        cell = "Space" if self.cell() == " " else self.cell()
        return f"{self.title}: {self.typed}. Selected: {cell}"


class FindResultsScreen(ListScreen):
    name = "find_results"
    title = "Find"

    def __init__(self, hits):
        super().__init__([h.title or h.text[:30] for h in hits])
        self.hits = hits

    def choose(self, app):
        h = self.hits[self.sel]
        # two screens so each fits: closing the text shows its source, and one more press returns to the list
        app.push(MessageScreen("find_source", f"Source: {h.source}"))
        app.push(MessageScreen("find_hit", h.text))


def _find_done(app, typed):
    if len(typed.strip()) < 2:
        app.push(MessageScreen("find_empty", "Type at least 2 letters."))
        return
    hits = find.search(app, typed)
    if hits:
        app.push(FindResultsScreen(hits))
    else:
        app.push(MessageScreen("find_empty", f'Nothing found for "{typed.strip()}".'))


class OffScreen(Screen):
    name = "off"

    def render(self, bar):
        return off_screen()

    def text(self, app):
        return "Spiral Node\nHelix Velocities"


class SettingsScreen(ListScreen):
    name = "settings"
    title = "Settings"

    def __init__(self, app):
        super().__init__(["Set clock", "Reset history", self._connect_label(app), "About"])

    @staticmethod
    def _connect_label(app):
        return "Connect mode: On" if connect_mode_on(app) else "Connect mode: Off"

    def choose(self, app):
        item = self.items[self.sel]
        if item == "Set clock":
            app.push(ClockSetScreen(app))
        elif item == "Reset history":
            app.push(ResetHistoryScreen.create(app))
        elif item.startswith("Connect mode"):
            settings = dict(s) if isinstance(s := app.store.get("settings", {}), dict) else {}
            settings["connect_mode"] = not connect_mode_on(app)
            app.store.set("settings", settings)
            self.items[self.sel] = self._connect_label(app)
        elif item == "About":
            app.push(AboutScreen(app))


class ClockSetScreen(Screen):
    name = "clock"

    def __init__(self, app):
        now = app.bar().now
        self.hh, self.mm, self.field = now.hour, now.minute, 0

    def render(self, bar):
        return clock_set_screen(self.hh, self.mm, self.field, bar)

    def handle(self, action, app):
        step = 1 if action is Action.UP else -1
        if action in (Action.UP, Action.DOWN):
            if self.field == 0:  # hour wraps inside its AM/PM half
                self.hh = (self.hh + step) % 12 + 12 * (self.hh >= 12)
            elif self.field == 1:
                self.mm = (self.mm + step) % 60
            else:
                self.hh = (self.hh + 12) % 24
        elif action is Action.LEFT:
            self.field = max(0, self.field - 1)
        elif action is Action.RIGHT:
            self.field = min(2, self.field + 1)
        elif action is Action.SELECT:
            wall = app.wall()
            chosen = wall.replace(hour=self.hh, minute=self.mm, second=0, microsecond=0)
            settings = dict(app.store.get("settings", {}))
            settings["clock_offset_s"] = (chosen - wall).total_seconds()
            app.store.set("settings", settings)
            app.pop()
        elif action is Action.BACK:
            app.pop()

    def text(self, app):
        return (f"Set clock: {self.hh % 12 or 12}:{self.mm:02d} {'AM' if self.hh < 12 else 'PM'}. "
                f"Focus: {('hour', 'minute', 'AM/PM')[self.field]}")


class ResetHistoryScreen(ListScreen):
    name = "reset_history"
    title = "Reset history"

    @classmethod
    def create(cls, app):
        app.store.flush()  # shortcut: lists shown logs from disk, so flush first; fine at this size
        pairs = []
        for f in sorted((app.data_dir / "shown").glob("*/*.json")):
            info = app.scripts.get(f.parent.name)
            pairs.append((f"{info.name if info else f.parent.name} / {f.name}",
                          f"shown/{f.parent.name}/{f.stem}"))
        if not pairs:
            return MessageScreen("reset_empty", "Nothing to reset.")
        screen = cls([label for label, _ in pairs])
        screen.keys = [key for _, key in pairs]
        return screen

    def choose(self, app):
        key = self.keys[self.sel]

        def done(app, i):
            if i == 1:
                ShownLog(app.store, key).reset()
                app.pop()
            app.pop()

        app.push(DialogScreen("reset_confirm", "Reset? Shown entries can appear again.",
                              ["Cancel", "Reset"], 0, done))


class AboutScreen(Screen):
    name = "about"

    def __init__(self, app):
        battery = app.battery()
        self.lines = [f"Spiral OS {VERSION}",
                      f"Battery: {battery}%" if battery is not None else "Battery: --",
                      f"Free: {shutil.disk_usage(app.data_dir).free // 2**20} MB",
                      f"Scripts: {len(app.scripts)}"]

    def render(self, bar):
        return message_screen("\n".join(self.lines), bar)

    def handle(self, action, app):
        if action in (Action.BACK, Action.LEFT, Action.SELECT):
            app.pop()

    def text(self, app):
        return "\n".join(self.lines)
