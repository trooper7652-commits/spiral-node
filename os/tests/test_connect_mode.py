from spiral.input import Action
from spiral.library import ShownLog, load_library
from test_app_flow import boot_to_home, make_app, open_menu


def booted(tmp_path):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    return app


def on(app):
    app.store.set("settings", {"connect_mode": True})


def right(app, n):
    for _ in range(n):
        app.handle(Action.RIGHT)


def titles(app):
    return [h["title"] for h in app.history]


def test_connect_every_fifth_page_when_on(tmp_path):
    app = booted(tmp_path)
    on(app)
    app.start_script("big_questions", {"interval": 30})
    right(app, 9)
    t = titles(app)
    assert t[4] == t[9] == "Connect"
    assert t.count("Connect") == 2


def test_no_connect_when_off(tmp_path):
    app = booted(tmp_path)
    app.start_script("big_questions", {"interval": 30})
    right(app, 9)
    assert "Connect" not in titles(app)


def test_connect_mode_toggle_in_settings(tmp_path):
    app = booted(tmp_path)
    app.store.set("settings", {"clock_offset_s": 60})
    open_menu(app)
    for _ in range(4):
        app.handle(Action.DOWN)
    app.handle(Action.SELECT)
    assert app.screen_name == "settings"
    app.handle(Action.DOWN)
    app.handle(Action.DOWN)
    assert "Selected: Connect mode: Off" in app.screen_text()
    app.handle(Action.SELECT)
    assert "Selected: Connect mode: On" in app.screen_text()
    assert app.store.get("settings", {})["connect_mode"] is True
    assert app.store.get("settings", {})["clock_offset_s"] == 60
    app.handle(Action.SELECT)
    assert "Selected: Connect mode: Off" in app.screen_text()
    assert app.store.get("settings", {})["connect_mode"] is False
    assert app.store.get("settings", {})["clock_offset_s"] == 60


def test_connect_mode_survives_reboot(tmp_path):
    app = booted(tmp_path)
    on(app)
    app.start_script("big_questions", {"interval": 30})
    right(app, 2)
    app.store.flush()
    app2 = booted(tmp_path)
    assert app2.connect_count == 3
    right(app2, 2)
    assert app2.history[-1]["title"] == "Connect"


def test_connect_exhausted_restarts_quietly(tmp_path):
    app = booted(tmp_path)
    on(app)
    ids = [e.id for e in load_library(app.scripts["connect"].folder / "topics.json")]
    app.store.set("shown/connect-mode/topics", {"ids": ids})
    app.start_script("big_questions", {"interval": 30})
    right(app, 4)
    assert app.history[-1]["title"] == "Connect"
    assert app.screen_name == "home"


def test_no_connect_cards_inside_connect(tmp_path):
    app = booted(tmp_path)
    on(app)
    app.start_script("connect", {"interval": 60})
    right(app, 9)
    assert titles(app) == ["Connect"] * 10
    assert app.store.get("shown/connect-mode/topics", None) is None


def test_connect_card_keeps_active_script_shown_log(tmp_path):
    app = booted(tmp_path)
    on(app)
    app.start_script("big_questions", {"interval": 30})
    right(app, 4)
    assert len(ShownLog(app.store, "shown/big_questions/questions").ids()) == 4
    assert len(ShownLog(app.store, "shown/connect-mode/topics").ids()) == 2
