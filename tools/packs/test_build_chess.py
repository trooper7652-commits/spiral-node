import chess

import build_chess as b

START = chess.STARTING_FEN
LINE = "e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5"  # 9 legal moves


def row(pid, moves, rating=700, dev=75, pop=95, plays=5000, themes="fork short", fen=START):
    return {"PuzzleId": pid, "FEN": fen, "Moves": moves, "Rating": str(rating), "RatingDeviation": str(dev),
            "Popularity": str(pop), "NbPlays": str(plays), "Themes": themes}


def uci(n):
    return " ".join(LINE.split()[:n])


def test_filters_and_bands():
    rows = [row("ok1", uci(4), 700),
            row("lowpop", uci(4), 700, pop=89),
            row("fewplays", uci(4), 700, plays=1999),
            row("baddev", uci(4), 700, dev=81),
            row("notheme", uci(4), 700, themes="endgame short"),
            row("toolong", uci(9) + " d8d5", 700),  # 5 player moves
            row("low", uci(4), 599),
            row("high", uci(4), 1800)]
    rows += [row(f"b{i}", uci(4), 800) for i in range(60)]
    out = b.build(rows)
    ids = [p["id"] for p in out]
    assert ids[0] == "lichess-ok1" and len(out) == 51
    assert not {"lichess-lowpop", "lichess-fewplays", "lichess-baddev", "lichess-notheme",
                "lichess-toolong", "lichess-low", "lichess-high"} & set(ids)
    assert ids[1:] == [f"lichess-b{i}" for i in range(50)]  # first 50 in file order


def test_first_move_is_applied():
    p = b.build([row("x", uci(4))])[0]
    board = chess.Board(START)
    board.push_uci("e2e4")
    assert p["fen"] == board.fen() and p["side"] == "Black"
    assert p["steps"][0]["from"] == "e7" and p["steps"][0]["by"] == "you"
    assert [s["by"] for s in p["steps"]] == ["you", "them", "you"][: len(p["steps"])]
    assert p["source"] == "https://lichess.org/training/x" and p["topic"] == "chess"


def test_steps_replay_to_final_position():
    p = b.build([row("x", uci(9), themes="mateIn4 short")])[0]
    assert p["goal"] == "Find mate in 4" and p["text"] == p["goal"] and p["rating"] == 700
    board = chess.Board(p["fen"])
    for s in p["steps"]:
        board.push_san(s["san"])
        assert board.fen() == s["fen"]
    assert len(p["steps"]) == 8


def test_no_mate_in_one():
    assert b.build([row("m1", uci(2), themes="mateIn1 short")]) == []
    assert b.build([row("m2", uci(4), themes="mateIn2 short")])[0]["goal"] == "Find mate in 2"
    assert b.build([row("f", uci(4), themes="fork")])[0]["goal"] == "Find the best move"
