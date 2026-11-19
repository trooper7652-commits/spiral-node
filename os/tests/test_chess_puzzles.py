import json
import random
from datetime import date

import pytest

import spiral
from spiral.library import LibraryExhausted
from spiral.loader import discover
from spiral.render import picture_max_h
from spiral.scripts_api import ScriptContext, check_picture
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


def test_puzzle_page_then_one_move_per_refresh(tmp_path):
    mod, script, store = make(tmp_path)
    first = script.next()
    puzzle = BY_ID[script.ctx.state()["puzzle"]]
    assert first.title == "Chess Puzzles"
    assert first.body == f"{puzzle['side']} to move\n{puzzle['goal']}\nRating {puzzle['rating']}"
    flip = puzzle["side"] == "Black"
    assert first.picture == mod.fen_to_picture(puzzle["fen"], flip)
    for i, step in enumerate(puzzle["steps"]):
        page = script.next()
        assert page.body.split("\n")[0].endswith(step["san"])
        assert page.picture == mod.fen_to_picture(step["fen"], flip, step["from"])
        white_moved = (step["by"] == "you") == (puzzle["side"] == "White")
        assert page.body.split()[0].endswith("." if white_moved else "…")


def test_last_step_says_solved_then_new_puzzle(tmp_path):
    _, script, store = make(tmp_path)
    script.next()
    first_id = script.ctx.state()["puzzle"]
    steps = BY_ID[first_id]["steps"]
    pages = [script.next() for _ in steps]
    assert all("Solved." not in p.body for p in pages[:-1])
    assert pages[-1].body.endswith("\nSolved.")
    nxt = script.next()
    assert "to move" in nxt.body and script.ctx.state()["puzzle"] != first_id


def test_puzzle_position_survives_restart(tmp_path):
    _, script, store = make(tmp_path)
    script.next()
    second = script.next()
    store.flush()
    _, script2, _ = make(tmp_path)
    third = script2.next()
    puzzle = BY_ID[script2.ctx.state()["puzzle"]]
    assert second.body.split("\n")[0].endswith(puzzle["steps"][0]["san"])
    assert third.body.split("\n")[0].endswith(puzzle["steps"][1]["san"]) or len(puzzle["steps"]) == 1


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
