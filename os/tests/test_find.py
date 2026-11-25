import shutil
from pathlib import Path

from spiral import find
from spiral.input import Action
from test_app_flow import boot_to_home, make_app, open_menu
from test_picker import goto

FIND = Path(__file__).parent / "fixtures" / "find"


def app_with(tmp_path, *names):
    for n in names:
        shutil.copytree(FIND / n, tmp_path / "scripts" / n)
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    return app


def open_find(app):
    open_menu(app)
    app.handle(Action.DOWN)  # Find
    app.handle(Action.SELECT)
    assert app.screen_name == "picker"


def test_find_all_words_match(tmp_path):
    app = app_with(tmp_path, "alpha", "beta")
    assert [h.text for h in find.search(app, "quokkaplum glows")] == [
        "The quokkaplum glows blue at night.", "The quokkaplum glows blue at night, they said."]
    assert [h.text for h in find.search(app, "QUOKKAPLUM")] == [
        "A quokkaplum seed floats on water.", "The quokkaplum glows blue at night.",
        "Once a quokkaplum tree grew by the sea.", "The quokkaplum glows blue at night, they said."]
    assert [h.text for h in find.search(app, "zorbish gleebnut")] == ["Gleebnut shells are green."]


def test_find_short_query_empty(tmp_path):
    app = app_with(tmp_path, "alpha")
    assert find.search(app, "q") == [] and find.search(app, "  ") == []
    from spiral.screens import _find_done
    _find_done(app, " q ")
    assert app.screen_name == "find_empty" and app.screen_text() == "Type at least 2 letters."


def test_find_limit(tmp_path):
    app = app_with(tmp_path, "alpha", "beta")
    assert len(find.search(app, "quokkaplum", limit=2)) == 2


def test_find_no_hits_message(tmp_path):
    app = app_with(tmp_path, "alpha")
    open_find(app)
    app.stack[-1].typed = "QQXQ"  # built-in libraries are searched too, so pick letters no word has
    goto(app, "OK")
    app.handle(Action.SELECT)
    assert app.screen_name == "find_empty"
    assert 'Nothing found for "QQXQ".' in app.screen_text()
    app.handle(Action.BACK)
    assert app.screen_name == "picker"


def test_find_hit_shows_source(tmp_path):
    app = app_with(tmp_path, "alpha", "beta")
    open_find(app)
    app.stack[-1].typed = "gleebnut"
    goto(app, "OK")
    app.handle(Action.SELECT)
    assert app.screen_name == "find_results"
    app.handle(Action.SELECT)
    assert app.screen_name == "find_hit"
    assert app.screen_text() == "Gleebnut shells are green."
    app.handle(Action.SELECT)  # closing the text shows where it came from
    assert app.screen_name == "find_source"
    assert app.screen_text() == "Source: https://example.org/a3"
    app.handle(Action.BACK)
    assert app.screen_name == "find_results"
    app.handle(Action.BACK)
    assert app.screen_name == "picker"
    app.handle(Action.BACK)
    assert app.screen_name == "menu"


def test_every_builtin_find_hit_fits(tmp_path):
    from spiral.config import FONT_SIZES, SCREEN_H, SCREEN_W
    from spiral.render import BODY_TOP, PAD, _font, _line_h, _wrap
    app = app_with(tmp_path)
    f = _font(FONT_SIZES[-1])

    def fits(s):
        return len(_wrap(s, f, SCREEN_W - 2 * PAD)) * _line_h(f) <= SCREEN_H - BODY_TOP

    hits = 0
    for info in app.scripts.values():
        for eid, title, text, topic, source in find._entries(info.folder):
            assert fits(text or title) and fits(f"Source: {source}"), (info.id, eid)  # the two hit screens
            hits += 1
    assert hits > 1000  # the built-in libraries really were searched


def test_find_story_hit_uses_first_page(tmp_path):
    app = app_with(tmp_path, "beta")
    hit = find.search(app, "quokkaplum tree")[0]
    assert hit.text == "Once a quokkaplum tree grew by the sea."
    assert hit.title == "The Quokkaplum Tree"
    open_find(app)
    app.stack[-1].typed = "quokkaplum tree"
    goto(app, "OK")
    app.handle(Action.SELECT)
    assert app.stack[-1].items == ["The Quokkaplum Tree"]
