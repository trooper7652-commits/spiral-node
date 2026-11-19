"""Build os/spiral/builtin_scripts/chess_puzzles/puzzles.json from the Lichess puzzle database (CC0).

Needs `pip install -r requirements-dev.txt`. Run: python build_chess.py [--db path/to/lichess_db_puzzle.csv.zst]
"""
import argparse
import csv
import io
import json
import re
import sys
import urllib.request
from pathlib import Path

import chess
import zstandard

URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
UA = "SpiralNodeBuildTool/1.0 (+https://github.com/trooper7652-commits/spiral-node)"
THEMES = {"mateIn2", "mateIn3", "mateIn4", "fork", "pin", "skewer", "discoveredAttack", "hangingPiece"}
BANDS = [(lo, lo + 199) for lo in range(600, 1800, 200)]
PER_BAND = 50
OUT = Path(__file__).resolve().parents[2] / "os/spiral/builtin_scripts/chess_puzzles/puzzles.json"


def to_entry(r):
    """One CSV row as a puzzle dict, or None when a filter rejects it."""
    moves = r["Moves"].split()
    themes = set(r["Themes"].split())
    if (int(r["Popularity"]) < 90 or int(r["NbPlays"]) < 2000 or int(r["RatingDeviation"]) > 80
            or not 2 <= len(moves) // 2 <= 4 or not themes & THEMES):
        return None
    board = chess.Board(r["FEN"])
    board.push_uci(moves[0])  # Lichess FENs are before the opponent's move
    start = board.fen()
    side = "White" if board.turn else "Black"
    steps = []
    for i, m in enumerate(moves[1:]):
        mv = chess.Move.from_uci(m)
        san = board.san(mv)
        board.push(mv)
        steps.append({"fen": board.fen(), "san": san, "by": "you" if i % 2 == 0 else "them",
                      "from": chess.square_name(mv.from_square)})
    mate = next((t for t in sorted(themes) if re.fullmatch(r"mateIn[234]", t)), None)
    goal = f"Find mate in {mate[-1]}" if mate else "Find the best move"
    return {"id": f"lichess-{r['PuzzleId']}", "text": goal, "topic": "chess",
            "source": f"https://lichess.org/training/{r['PuzzleId']}", "fen": start, "side": side,
            "goal": goal, "rating": int(r["Rating"]), "steps": steps}


def build(rows):
    kept = {b: [] for b in BANDS}
    for r in rows:
        band = next((b for b in BANDS if b[0] <= int(r["Rating"]) <= b[1]), None)
        if band and len(kept[band]) < PER_BAND:
            e = to_entry(r)
            if e:
                kept[band].append(e)
        if all(len(v) == PER_BAND for v in kept.values()):
            break
    return [e for b in BANDS for e in kept[b]]


def read_rows(path):
    with open(path, "rb") as f, zstandard.ZstdDecompressor().stream_reader(f) as z:
        yield from csv.DictReader(io.TextIOWrapper(z, encoding="utf-8", newline=""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="lichess_db_puzzle.csv.zst")
    path = Path(ap.parse_args().db)
    if not path.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req) as resp, open(path, "wb") as f:
            while chunk := resp.read(1 << 20):
                f.write(chunk)
    puzzles = build(read_rows(path))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("[\n" + ",\n".join(json.dumps(p, separators=(",", ":")) for p in puzzles) + "\n]\n", encoding="utf-8")
    print(f"wrote {len(puzzles)} puzzles to {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
