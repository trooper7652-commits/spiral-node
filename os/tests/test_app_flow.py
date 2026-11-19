import random
from datetime import datetime
from pathlib import Path

from spiral.app import App
from spiral.config import BOOT_FRAME_S, BOOT_FRAMES, BOOT_HOLD_S
from spiral.display import MemoryDisplay
from spiral.input import Action
from spiral.storage import read_json

HERE = Path(__file__).resolve().parent
BUILTIN = HERE.parent / "spiral" / "builtin_scripts"
WELCOME = HERE.parent / "welcome-messages.txt"
WALL = datetime(2026, 11, 11, 2, 47)


class FakeClock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t

    def advance(self, s):
        self.t += s


def make_app(tmp_path, clock=None, display=None, welcome_file=WELCOME):
    clock = clock or FakeClock()
    display = display or MemoryDisplay()
    app = App(display, clock, lambda: WALL, tmp_path, BUILTIN, welcome_file,
              lambda: 87, random.Random(1))
    return app, clock, display


def boot_to_home(app, clock):
    app.boot()
    for _ in range(BOOT_FRAMES):
        app.tick()
        clock.advance(BOOT_FRAME_S)
    clock.advance(BOOT_HOLD_S)
    app.tick()
    assert app.screen_name == "home"


def open_menu(app):
    app.handle(Action.SELECT)
    assert app.screen_name == "menu"


def test_boot_draws_5_spiral_frames_then_home(tmp_path):
    app, clock, display = make_app(tmp_path)
    app.boot()
    assert app.screen_name == "boot"
    for _ in range(BOOT_FRAMES - 1):
        clock.advance(BOOT_FRAME_S)
        app.tick()
    assert len(display.frames) == BOOT_FRAMES
    assert display.frames[0][1] is True
    assert app.screen_name == "boot"
    clock.advance(BOOT_HOLD_S - 0.1)
    app.tick()
    assert app.screen_name == "boot"
    clock.advance(0.1)
    app.tick()
    assert app.screen_name == "home"
    assert len(display.frames) == BOOT_FRAMES + 1


def test_boot_and_home_show_same_welcome(tmp_path):
    app, clock, _ = make_app(tmp_path)
    app.boot()
    boot_text = app.screen_text()
    for _ in range(BOOT_FRAMES):
        clock.advance(BOOT_FRAME_S)
    clock.advance(BOOT_HOLD_S)
    app.tick()
    assert app.screen_name == "home"
    assert boot_text and boot_text == app.screen_text()


def test_select_opens_menu_and_back_returns(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_menu(app)
    assert "Selected: Scripts" in app.screen_text()
    app.handle(Action.BACK)
    assert app.screen_name == "home"


def test_right_opens_left_backs_in_menu(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_menu(app)
    app.handle(Action.DOWN)  # Chat
    app.handle(Action.RIGHT)
    assert app.screen_name == "chat"
    app.handle(Action.LEFT)
    assert app.screen_name == "menu"
    app.handle(Action.LEFT)
    assert app.screen_name == "home"


def test_chat_placeholder(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_menu(app)
    app.handle(Action.DOWN)
    app.handle(Action.SELECT)
    assert app.screen_name == "chat"
    assert "Chat is coming in a later version." in app.screen_text()


def goto_power_off(app):
    open_menu(app)
    for _ in range(4):
        app.handle(Action.DOWN)
    app.handle(Action.SELECT)
    assert app.screen_name == "power_off"


def test_power_off_cancel_default(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    goto_power_off(app)
    assert "Power off?" in app.screen_text()
    app.handle(Action.SELECT)  # Cancel is selected first
    assert app.screen_name == "menu"
    assert not app.powered_off


def test_power_off_ok_flushes_and_shows_off_screen(tmp_path):
    app, clock, display = make_app(tmp_path)
    boot_to_home(app, clock)
    app.store.set("welcome", {"index": 99})  # pending, not yet on disk
    goto_power_off(app)
    app.handle(Action.RIGHT)  # move to OK
    app.handle(Action.SELECT)
    assert app.powered_off and app.screen_name == "off"
    assert app.screen_text() == "Spiral Node\nHelix Velocities"
    assert read_json(tmp_path / "welcome.json", {}) == {"index": 99}
    assert display.frames[-1][1] is True
    n = len(display.frames)
    app.handle(Action.SELECT)
    clock.advance(10)
    app.tick()
    assert len(display.frames) == n and app.screen_name == "off"


def test_full_refresh_every_10th(tmp_path):
    app, clock, display = make_app(tmp_path)
    boot_to_home(app, clock)
    display.frames.clear()
    for _ in range(20):
        app.redraw()
    assert [full for _, full in display.frames].count(True) == 2
    from spiral.display import RefreshPolicy
    p = RefreshPolicy()
    assert [i + 1 for i in range(20) if p.use_full(False)] == [10, 20]


# ---- Task 9: scripts, prefs, Home timer, history, exhaustion, resume ----

FUN, STORY = "Fun Fact + Question", "Quick Story"  # found by name, so new packs never shift them


def open_prefs(app, index):
    open_menu(app)
    app.handle(Action.SELECT)  # Scripts
    assert app.screen_name == "scripts"
    if isinstance(index, str):  # a script name
        index = [i.name for i in app.stack[-1].infos].index(index)
    for _ in range(index):
        app.handle(Action.DOWN)
    app.handle(Action.SELECT)
    assert app.screen_name == "prefs"


def start_script(app, index=FUN):
    open_prefs(app, index)
    app.handle(Action.DOWN)  # focus OK
    app.handle(Action.SELECT)
    assert app.screen_name == "home"


def exhaust_fun_facts(app):
    for _ in range(4):
        app.handle(Action.RIGHT)  # 5 pages seen: facts and questions both used up
    app.handle(Action.RIGHT)
    assert app.screen_name == "exhausted"


def user_script(tmp_path, sid, source, files=None):
    folder = tmp_path / "scripts" / sid
    folder.mkdir(parents=True)
    (folder / "script.py").write_text(source, encoding="utf-8")
    for name, text in (files or {}).items():
        (folder / name).write_text(text, encoding="utf-8")


HEAD = ("from spiral.scripts_api import Page, Preference\n"
        "NAME = 'Boom'\n"
        "PREFERENCES = [Preference('interval', 'Refresh', (15, 30, 60), 30, 's')]\n")


def test_select_script_opens_prefs_with_ok_only(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_prefs(app, FUN)
    assert app.stack[-1].buttons == ["OK"]
    assert app.stack[-1].focus == 0
    assert "Refresh" in app.screen_text()


def test_left_right_change_interval_15_30_60(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_prefs(app, FUN)
    seen = []
    for a in (Action.RIGHT, Action.RIGHT, Action.LEFT, Action.LEFT, Action.LEFT):
        app.handle(a)
        seen.append(app.stack[-1].values["interval"])
    assert seen == [60, 60, 30, 15, 15]


def test_ok_starts_script_and_saves_active(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_prefs(app, FUN)
    app.handle(Action.LEFT)  # 15 s
    app.handle(Action.DOWN)
    app.handle(Action.SELECT)
    assert app.screen_name == "home" and app.active_script_id == "fun_fact_question"
    assert app.screen_text().startswith("Fun fact\n")
    app.store.flush()
    saved = read_json(tmp_path / "active.json", {})
    assert saved["script_id"] == "fun_fact_question"
    assert saved["prefs"] == {"interval": 15}
    assert len(saved["history"]) == 1 and saved["paused"] is False


def test_long_press_cancels_prefs(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_prefs(app, FUN)
    app.handle(Action.BACK)
    assert app.screen_name == "scripts" and app.active_script_id is None


def test_active_script_prefs_show_stop_and_stop_returns_welcome(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app)
    open_prefs(app, FUN)
    assert app.stack[-1].buttons == ["Stop", "OK"]
    app.handle(Action.DOWN)  # on buttons
    app.handle(Action.RIGHT)  # OK
    app.handle(Action.LEFT)  # Stop
    app.handle(Action.SELECT)
    assert app.screen_name == "home" and app.active_script_id is None
    assert app.screen_text() == app.welcome.current
    clock.advance(500)
    app.tick()
    assert app.screen_text() == app.welcome.current


def test_home_refreshes_every_interval_only_while_visible(tmp_path):
    app, clock, display = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app)
    assert len(app.history) == 1
    clock.advance(29)
    app.tick()
    assert len(app.history) == 1
    clock.advance(1)
    n = len(display.frames)
    app.tick()
    assert len(app.history) == 2 and len(display.frames) == n + 1
    open_menu(app)
    clock.advance(500)
    app.tick()
    assert len(app.history) == 2  # menu on top: timer does not run
    app.handle(Action.BACK)
    clock.advance(29)
    app.tick()
    assert len(app.history) == 2  # returning to Home restarts a full interval
    clock.advance(1)
    app.tick()
    assert len(app.history) == 3


def test_right_skips_left_goes_back(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app)
    a = app.screen_text()
    app.handle(Action.RIGHT)
    b = app.screen_text()
    assert b != a and len(app.history) == 2
    app.handle(Action.LEFT)
    assert app.screen_text() == a
    app.handle(Action.LEFT)  # already oldest
    assert app.screen_text() == a
    app.handle(Action.RIGHT)  # forward through history: no new entry used
    assert app.screen_text() == b and len(app.history) == 2
    app.handle(Action.RIGHT)
    assert len(app.history) == 3


def test_quick_story_right_turns_page(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app, STORY)
    assert app.active_script_id == "quick_story"
    first = app.history[-1]
    app.handle(Action.RIGHT)
    second = app.history[-1]
    assert second["title"] == first["title"] and second["body"] != first["body"]
    app.handle(Action.LEFT)
    assert app.screen_text() == f"{first['title']}\n{first['body']}"


def test_exhausted_dialog_start_over_and_no(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app)
    exhaust_fun_facts(app)
    assert "Every entry has been shown. Start over?" in app.screen_text()
    app.handle(Action.RIGHT)  # Start over
    app.handle(Action.SELECT)
    while app.screen_name == "exhausted":  # facts and questions run out together
        app.handle(Action.RIGHT)
        app.handle(Action.SELECT)
    assert app.screen_name == "home" and len(app.history) == 6
    # run dry again, answer No (the default button)
    for _ in range(10):
        if app.screen_name == "exhausted":
            break
        app.handle(Action.RIGHT)
    assert app.screen_name == "exhausted"
    app.handle(Action.SELECT)
    assert app.screen_name == "home" and app.paused
    n = len(app.history)
    clock.advance(500)
    app.tick()
    assert len(app.history) == n  # paused: timer stopped
    app.handle(Action.RIGHT)  # asks again
    assert app.screen_name == "exhausted"


def test_resume_after_reboot_shows_last_page_no_new_entry(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app)
    app.handle(Action.RIGHT)
    text = app.screen_text()
    app.power_off()
    shown = read_json(tmp_path / "shown" / "fun_fact_question" / "facts.json", {})["ids"]
    app2, clock2, _ = make_app(tmp_path)
    boot_to_home(app2, clock2)
    assert app2.active_script_id == "fun_fact_question"
    assert app2.screen_text() == text and len(app2.history) == 2
    app2.power_off()
    assert read_json(tmp_path / "shown" / "fun_fact_question" / "facts.json", {})["ids"] == shown


def test_missing_active_script_falls_back_to_welcome(tmp_path):
    (tmp_path / "active.json").write_text(
        '{"script_id": "gone", "prefs": {}, "history": [{"title": "t", "body": "b"}], "paused": false}')
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    assert app.active_script_id is None
    assert app.screen_text() == app.welcome.current
    assert "gone" in (tmp_path / "logs" / "spiral.log").read_text()


def test_script_exception_shows_error_page(tmp_path):
    user_script(tmp_path, "boom", HEAD + "class R:\n    def next(self):\n        raise RuntimeError('kaput')\n"
                "def create(ctx):\n    return R()\n")
    user_script(tmp_path, "broken", "raise ValueError('bad import')\n")
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app, 0)  # "Boom" sorts first
    assert app.screen_text().startswith("Script error\n")
    assert "Boom: kaput" in app.screen_text()
    assert "Boom: kaput" in (tmp_path / "logs" / "spiral.log").read_text()
    clock.advance(500)
    app.tick()  # timer is stopped, nothing crashes
    assert "Boom: kaput" in app.screen_text()
    app.handle(Action.RIGHT)
    assert "Script error" in app.screen_text()
    # a script that failed to import
    open_menu(app)
    app.handle(Action.SELECT)
    app.handle(Action.DOWN)  # "broken (error)"
    app.handle(Action.SELECT)
    assert app.screen_name == "home" and "broken (error)" in app.screen_text()
    assert "bad import" in app.screen_text()


def test_bad_library_shows_error_page(tmp_path):
    dup = ('[{"id":"a","text":"x","topic":"t","source":"s"},'
           '{"id":"a","text":"y","topic":"t","source":"s"}]')
    user_script(tmp_path, "badlib", HEAD + "class R:\n    def next(self):\n        return Page('t', 'b')\n"
                "def create(ctx):\n    ctx.library('bad.json')\n    return R()\n", {"bad.json": dup})
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app, 0)
    assert app.screen_text().startswith("Script error\n")
    assert "bad.json" in app.screen_text() and "duplicate id" in app.screen_text()
    assert app.active_script_id is None


# ---- Task 10: settings ----

def open_settings(app, index):
    open_menu(app)
    for _ in range(3):
        app.handle(Action.DOWN)
    app.handle(Action.SELECT)
    assert app.screen_name == "settings"
    for _ in range(index):
        app.handle(Action.DOWN)
    app.handle(Action.SELECT)


def test_set_clock_offset_persists_and_shows_in_top_bar(tmp_path):
    from spiral.render import format_clock
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    app.store.set("settings", {"other": 1})
    open_settings(app, 0)
    assert app.screen_name == "clock"
    app.handle(Action.UP)  # hour 2 -> 3
    app.handle(Action.RIGHT)
    app.handle(Action.DOWN)  # minute 47 -> 46
    app.handle(Action.RIGHT)
    app.handle(Action.UP)  # AM -> PM
    app.handle(Action.SELECT)
    assert app.screen_name == "settings"
    app.store.flush()
    saved = read_json(tmp_path / "settings.json", {})
    assert saved["other"] == 1
    assert saved["clock_offset_s"] == (15 * 3600 + 46 * 60) - (2 * 3600 + 47 * 60)
    assert format_clock(app.bar().now) == "3:46PM"


def test_clock_back_cancels(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_settings(app, 0)
    app.handle(Action.UP)
    app.handle(Action.BACK)
    assert app.screen_name == "settings"
    assert "clock_offset_s" not in app.store.get("settings", {})


def test_reset_history_clears_only_chosen_library(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_settings(app, 1)
    assert app.screen_name == "reset_empty"
    assert app.screen_text() == "Nothing to reset."
    for _ in range(3):  # message, settings, menu
        app.handle(Action.BACK)
    assert app.screen_name == "home"
    start_script(app)
    open_settings(app, 1)
    assert app.screen_name == "reset_history"
    assert app.screen_text().startswith("Reset history: Fun Fact + Question / facts.json, "
                                        "Fun Fact + Question / questions.json")
    app.handle(Action.SELECT)
    assert app.screen_name == "reset_confirm"
    assert "Reset? Shown entries can appear again." in app.screen_text()
    app.handle(Action.SELECT)  # default Cancel
    assert app.screen_name == "reset_history"
    app.handle(Action.SELECT)
    app.handle(Action.RIGHT)
    app.handle(Action.SELECT)
    assert app.screen_name == "settings"
    base = "shown/fun_fact_question/"
    assert app.store.get(base + "facts", {"ids": []})["ids"] == []
    assert len(app.store.get(base + "questions", {"ids": []})["ids"]) == 1


def test_about_shows_version_battery_storage(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_settings(app, 2)
    assert app.screen_name == "about"
    lines = app.screen_text().splitlines()
    assert lines[0] == "Spiral OS 0.1.0"
    assert lines[1] == "Battery: 87%"
    assert lines[2].startswith("Free: ") and lines[2].endswith(" MB")
    assert lines[3] == f"Scripts: {len(app.scripts)}"


# ---- review fixes: hand-edited state and bad scripts never crash ----

OK_SCRIPT = HEAD + ("class R:\n    def next(self):\n        return Page('t', 'b')\n"
                    "def create(ctx):\n    return R()\n")


def boot_with_active(tmp_path, active):
    import json
    user_script(tmp_path, "boom", OK_SCRIPT)
    (tmp_path / "active.json").write_text(json.dumps(active))
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    return app, clock


def test_resume_non_string_script_id_is_ignored(tmp_path):
    for n, bad in enumerate([[1], {"a": 1}, 5]):
        d = tmp_path / f"i{n}"
        d.mkdir()
        app, _ = boot_with_active(d, {"script_id": bad, "prefs": {}})
        assert app.active_script_id is None


def test_resume_invalid_interval_falls_back_to_default(tmp_path):
    for n, bad in enumerate(["abc", None, 0, -5, True, 20]):
        d = tmp_path / f"r{n}"
        d.mkdir()
        app, _ = boot_with_active(d, {"script_id": "boom", "prefs": {"interval": bad}})
        assert app.active_script_id == "boom" and app.interval() == 30, bad


def test_resume_keeps_valid_interval(tmp_path):
    app, _ = boot_with_active(tmp_path, {"script_id": "boom", "prefs": {"interval": 60}})
    assert app.interval() == 60


def test_bad_clock_offset_does_not_brick_redraw(tmp_path):
    import json
    for bad in ("x", None, True, 1e30, [1]):
        d = tmp_path / f"o{abs(hash(repr(bad)))}"
        d.mkdir()
        (d / "settings.json").write_text(json.dumps({"clock_offset_s": bad}))
        app, clock, display = make_app(d)
        boot_to_home(app, clock)
        app.redraw()
        assert app.bar().now == WALL


def test_bad_page_from_script_shows_error_page(tmp_path):
    for n, ret in enumerate(["Page(1, 'b')", "Page('t', None)", "'just a string'"]):
        d = tmp_path / f"p{n}"
        d.mkdir()
        user_script(d, "boom", HEAD + f"class R:\n    def next(self):\n        return {ret}\n"
                    "def create(ctx):\n    return R()\n")
        app, clock, _ = make_app(d)
        boot_to_home(app, clock)
        start_script(app, 0)
        assert app.screen_text().startswith("Script error\n"), ret
        assert app.active_script_id is None


PIC_SCRIPT = (HEAD + "class R:\n    def __init__(self, ctx):\n        self.n = 0\n"
              "    def next(self):\n        self.n += 1\n        return Page('P%d' % self.n, 'body', PIC)\n"
              "def create(ctx):\n    return R(ctx)\n")


def test_bad_picture_shows_script_error(tmp_path):
    from spiral.render import picture_max_h
    bad = [("#.", "#"), ("x#",), ("#" * 121,), ("#",) * (picture_max_h() + 1), "not a tuple of rows", (1,)]
    for n, pic in enumerate(bad):
        d = tmp_path / f"p{n}"
        d.mkdir()
        user_script(d, "boom", PIC_SCRIPT.replace("PIC", repr(pic)))
        app, clock, _ = make_app(d)
        boot_to_home(app, clock)
        start_script(app, 0)
        assert app.screen_text().startswith("Script error\n"), pic
        assert app.active_script_id is None


def test_history_keeps_picture(tmp_path):
    user_script(tmp_path, "boom", PIC_SCRIPT.replace("PIC", "('#.', '.#')"))
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app, 0)
    app.handle(Action.RIGHT)
    assert app.history[0]["picture"] == ["#.", ".#"]
    app.handle(Action.LEFT)
    assert app.stack[-1]._page().picture == ("#.", ".#")
    app.store.flush()
    app2, clock2, _ = make_app(tmp_path)
    boot_to_home(app2, clock2)
    assert app2.history[0]["picture"] == ["#.", ".#"]


def test_today_uses_clock_offset(tmp_path):
    from datetime import date
    user_script(tmp_path, "boom", HEAD + "class R:\n    def __init__(self, ctx):\n        self.ctx = ctx\n"
                "    def next(self):\n        return Page('d', self.ctx.today().isoformat())\n"
                "def create(ctx):\n    return R(ctx)\n")
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    app.store.set("settings", {"clock_offset_s": 86400 * 3})
    start_script(app, 0)
    assert app.history[-1]["body"] == date(2026, 11, 14).isoformat()


def test_title_newlines_collapsed(tmp_path):
    user_script(tmp_path, "boom", HEAD + "class R:\n    def next(self):\n        return Page('a\\n  b\\nc', 'body')\n"
                "def create(ctx):\n    return R()\n")
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app, 0)
    assert app.history[-1]["title"] == "a b c"


def test_system_exit_in_script_is_an_error_not_a_crash(tmp_path):
    cases = {
        "next": "class R:\n    def next(self):\n        raise SystemExit(1)\ndef create(ctx):\n    return R()\n",
        "create": "def create(ctx):\n    exit()\n",
    }
    for n, (_, body) in enumerate(cases.items()):
        d = tmp_path / f"s{n}"
        d.mkdir()
        user_script(d, "boom", HEAD + body)
        app, clock, _ = make_app(d)
        boot_to_home(app, clock)
        start_script(app, 0)
        assert app.screen_text().startswith("Script error\n")
    # at import time, and when resuming
    d = tmp_path / "imp"
    d.mkdir()
    user_script(d, "boom", "raise SystemExit(2)\n")
    app, clock, _ = make_app(d)
    boot_to_home(app, clock)
    assert app.scripts["boom"].error
    d = tmp_path / "res"
    d.mkdir()
    user_script(d, "boom", HEAD + cases["create"])
    (d / "active.json").write_text('{"script_id": "boom", "prefs": {}}')
    app, clock, _ = make_app(d)
    boot_to_home(app, clock)
    assert app.active_script_id is None and "Script error" in app.screen_text()


def test_script_list_with_no_scripts_has_text(tmp_path):
    from spiral.screens import ScriptListScreen
    assert isinstance(ScriptListScreen([]).text(None), str)


def test_back_action_from_menu_returns_home(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    open_menu(app)
    app.handle(Action.BACK)
    assert app.screen_name == "home"


def test_home_from_running_script_menu_goes_home(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app)
    open_prefs(app, FUN)
    app.handle(Action.HOME)
    assert app.screen_name == "home" and len(app.stack) == 1
    assert app.active_script_id is not None and app.runner is not None


def test_home_from_exhausted_dialog_goes_home(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    start_script(app)
    exhaust_fun_facts(app)
    app.handle(Action.HOME)
    assert app.screen_name == "home" and len(app.stack) == 1


def test_home_on_home_stays_home(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    app.handle(Action.HOME)
    assert app.screen_name == "home"
    start_script(app)
    app.handle(Action.HOME)
    assert app.screen_name == "home" and app.active_script_id is not None
