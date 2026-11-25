import json
import random
from datetime import date

import pytest

import spiral
from spiral.library import LibraryExhausted
from spiral.loader import discover
from spiral.render import page_fits, picture_max_h
from spiral.scripts_api import Page, ScriptContext, check_picture
from spiral.storage import Store
from pathlib import Path

BUILTIN = Path(spiral.__file__).parent / "builtin_scripts"
PUZZLES = json.loads((BUILTIN / "chess_puzzles" / "puzzles.json").read_text(encoding="utf-8"))
BY_ID = {p["id"]: p for p in PUZZLES}


def make(root, seed=1):
    info = {i.id: i for i in discover(BUILTIN, root / "no-user-scripts")}["chess_puzzles"]
    assert info.error is None
    store = Store(root, lambda: 0.0)
    ctx = ScriptContext("chess_puzzles", info.folder, {}, store, random.Random(seed), lambda: date(2026, 1, 1))
    return info.module, info.module.create(ctx), store


def test_fen_to_picture_is_88_square():
    mod, _, _ = make(Path("."))
    start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    for flip in (False, True):
        pic = mod.fen_to_picture(start, flip, "e2")
        assert len(pic) == 88 and all(len(r) == 88 for r in pic)
    assert mod.fen_to_picture(start, False, "e4") != mod.fen_to_picture(start, False)


def test_step_through_reaches_solution(tmp_path):
    mod, script, _ = make(tmp_path)
    first = script.next()
    assert first.choices == ("Show",)
    puzzle = BY_ID[first.key.split("|")[0]]
    flip = puzzle["side"] == "Black"
    pages = [script.choose(first.key, 0)]
    while pages[-1].choices == ("Next",):
        pages.append(script.choose(pages[-1].key, 0))
    assert len(pages) == len(puzzle["steps"])
    for page, step in zip(pages, puzzle["steps"]):
        assert page.body.startswith(("You: " if step["by"] == "you" else "Reply: ") + step["san"])
        assert page.picture == mod.fen_to_picture(step["fen"], flip, step["from"])
    last = pages[-1]
    assert not last.choices and "Solved." in last.body
    pos = 0
    for step in puzzle["steps"]:
        pos = last.body.index(step["san"], pos) + 1


def test_chess_timer_does_not_step(tmp_path):
    from test_app_flow import boot_to_home, make_app
    app, clock, _ = make_app(tmp_path)
    boot_to_home(app, clock)
    app.start_script("chess_puzzles", {"interval": 30})
    for _ in range(3):
        clock.advance(30)
        app.tick()
    assert len(app.history) == 1 and app.waiting


def test_key_survives_new_runner(tmp_path):
    p = next(p for p in PUZZLES if len(p["steps"]) >= 3)
    _, script, _ = make(tmp_path)
    p1 = script.choose(f"{p['id']}|0", 0)
    assert p1.choices == ("Next",) and p1.key == f"{p['id']}|1"
    _, script2, _ = make(tmp_path)  # a fresh runner, as after a reboot
    step = p["steps"][1]
    who = "You" if step["by"] == "you" else "Reply"
    assert script2.choose(p1.key, 0).body == f"{who}: {step['san']}"


def test_every_step_page_fits(tmp_path):
    mod, script, _ = make(tmp_path)
    for p in PUZZLES:
        page = Page("Chess Puzzles", f"{p['side']} to move\n{p['goal']}\nRating {p['rating']}",
                    mod.fen_to_picture(p["fen"], p["side"] == "Black"), choices=("Show",), key=f"{p['id']}|0")
        assert page_fits(page), p["id"]
        for n in range(len(p["steps"])):
            assert page_fits(script.choose(f"{p['id']}|{n}", 0)), (p["id"], n)


def test_bad_key_does_not_crash(tmp_path):
    _, script, _ = make(tmp_path)
    for key, index in (("nope", 0), ("lichess-05VUp|99", 0), ("lichess-05VUp|0", 3)):
        page = script.choose(key, index)
        assert page.title == "Chess Puzzles" and not page.choices


def test_exhausted_after_all_puzzles(tmp_path):
    _, script, _ = make(tmp_path)
    for e in script.entries:
        script.shown.add(e.id)
    with pytest.raises(LibraryExhausted):
        script.next()


def test_chess_pack_has_300_unique_ids_with_sources():
    ids = [p["id"] for p in PUZZLES]
    assert len(ids) == 300 and len(set(ids)) == 300
    for p in PUZZLES:
        pid = p["id"].removeprefix("lichess-")
        assert p["source"] == f"https://lichess.org/training/{pid}" and p["topic"] == "chess"
        assert 2 <= sum(s["by"] == "you" for s in p["steps"]) <= 4


def test_every_picture_passes_check_picture(tmp_path):
    mod, _, _ = make(tmp_path)
    for p in PUZZLES:
        flip = p["side"] == "Black"
        check_picture(mod.fen_to_picture(p["fen"], flip), picture_max_h())
        for s in p["steps"]:
            check_picture(mod.fen_to_picture(s["fen"], flip, s["from"]), picture_max_h())
