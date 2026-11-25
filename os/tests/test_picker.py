from spiral import render
from spiral.input import Action
from spiral.render import PAD, _font, _w
from spiral.screens import PICKER_ROWS, LetterPickerScreen
from test_app_flow import boot_to_home, make_app
from test_render import BAR


def goto(app, cell):
    for _ in range(3):
        app.handle(Action.UP)
    for _ in range(10):
        app.handle(Action.LEFT)
    r, c = next((r, row.index(cell)) for r, row in enumerate(PICKER_ROWS) if cell in row)
    for _ in range(r):
        app.handle(Action.DOWN)
    for _ in range(c):
        app.handle(Action.RIGHT)
    assert app.stack[-1].cell() == cell


def type_cell(app, cell):
    goto(app, cell)
    app.handle(Action.SELECT)


def picker_app(tmp_path, got, **kw):
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    app.push(LetterPickerScreen("Find", lambda app, s: got.append(s), **kw))
    return app


def test_picker_types_deletes_and_ok(tmp_path):
    got = []
    app = picker_app(tmp_path, got)
    for ch in "OWL":
        type_cell(app, ch)
    type_cell(app, "Del")
    assert "Find: OW." in app.screen_text()
    type_cell(app, "OK")
    assert got == ["OW"]


def test_picker_back_cancels(tmp_path):
    got = []
    app = picker_app(tmp_path, got)
    type_cell(app, "A")
    app.handle(Action.BACK)
    assert got == [] and app.screen_name == "home"


def test_picker_moves_are_clamped(tmp_path):
    app = picker_app(tmp_path, [])
    app.handle(Action.LEFT)
    app.handle(Action.UP)
    assert "Selected: A" in app.screen_text()
    app.handle(Action.DOWN)
    app.handle(Action.DOWN)
    for _ in range(20):
        app.handle(Action.RIGHT)
    assert app.stack[-1].cell() == "OK"
    app.handle(Action.UP)
    assert (app.stack[-1].r, app.stack[-1].c) == (1, 8) and app.stack[-1].cell() == "S"
    app.handle(Action.RIGHT)  # T, the last cell of the middle row
    app.handle(Action.DOWN)  # the bottom row is one cell shorter
    assert app.stack[-1].cell() == "OK"


def test_picker_space_and_max_len(tmp_path):
    app = picker_app(tmp_path, [])
    type_cell(app, " ")
    assert app.stack[-1].typed == " " and "Selected: Space" in app.screen_text()
    app = picker_app(tmp_path, [], max_len=3)
    for _ in range(4):
        type_cell(app, "A")
    assert app.stack[-1].typed == "AAA"


def test_picker_screen_renders_and_labels_fit():
    im = render.picker_screen("Find", "OW", PICKER_ROWS, 2, 8, BAR)
    assert im.size == (250, 122)
    for row in PICKER_ROWS:
        for cell in row:
            label = "Spc" if cell == " " else cell
            assert _w(_font(12), label) <= (250 - 2 * PAD) // 10 - 1, label
