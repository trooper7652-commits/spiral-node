import json

from spiral.library import pick_unshown
from spiral.scripts_api import Page, Preference

NAME = "Chess Puzzles"
DESCRIPTION = "A chess puzzle, then its solution one move at a time. From the Lichess puzzle database (CC0)."
PREFERENCES = [Preference("interval", "Refresh", (15, 30, 60), 30, "s")]

SQ = 11  # square size in pixels; 8 squares make the 88x88 picture

# Solid 9x9 silhouettes. Black pieces are drawn filled; white pieces keep only the outline.
SHAPES = {
    "p": (
        ".........",
        "....#....",
        "...###...",
        "...###...",
        "....#....",
        "...###...",
        "..#####..",
        "..#####..",
        ".#######."),
    "r": (
        "#.#.#.#.#",
        "#########",
        ".#######.",
        "..#####..",
        "..#####..",
        "..#####..",
        ".#######.",
        ".#######.",
        "#########"),
    "n": (
        "...##....",
        "..####...",
        ".######..",
        "########.",
        "#.#####..",
        "..#####..",
        "...#####.",
        "..#######",
        ".########"),
    "b": (
        "....#....",
        "...###...",
        "...###...",
        "..#####..",
        "..#####..",
        "...###...",
        "..#####..",
        ".#######.",
        "#########"),
    "q": (
        "..#.#.#..",
        "#.#.#.#.#",
        "#.#.#.#.#",
        "##.###.##",
        ".#######.",
        "..#####..",
        "...###...",
        ".#######.",
        "#########"),
    "k": (
        "....#....",
        "..#####..",
        "....#....",
        "..#####..",
        ".#######.",
        "..#####..",
        "..#####..",
        ".#######.",
        "#########"),
}


def _outline(rows):
    """Silhouette to its 1-px outline: keep ink that touches paper or the edge."""
    h, w = len(rows), len(rows[0])

    def ink(y, x):
        return 0 <= y < h and 0 <= x < w and rows[y][x] == "#"

    return tuple("".join("#" if ink(y, x) and not all(ink(y + dy, x + dx) for dy, dx in
                         ((1, 0), (-1, 0), (0, 1), (0, -1))) else "." for x in range(w))
                 for y in range(h))


# (piece letter, is_white) -> 9x9 rows
PIECES = {(k, True): _outline(v) for k, v in SHAPES.items()}
PIECES.update({(k, False): v for k, v in SHAPES.items()})


def fen_to_picture(fen: str, flip: bool = False, mark: str | None = None) -> tuple[str, ...]:
    """88x88 rows of '#'/'.' for a FEN. flip puts Black at the bottom; mark is a square like 'e2'."""
    grid = [[0] * (8 * SQ) for _ in range(8 * SQ)]  # 1 = ink
    placement = fen.split()[0].split("/")

    def at(rank_idx, file_idx):
        col = 0
        for ch in placement[rank_idx]:
            if ch.isdigit():
                col += int(ch)
                continue
            if col == file_idx:
                return ch
            col += 1
        return None

    def put(sx, sy, bitmap, off, halo):
        """Draw bitmap with its top-left at pixel (sx+off, sy+off); halo clears a 1-px ring first."""
        for y, row in enumerate(bitmap):
            for x, c in enumerate(row):
                if c == "#":
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            grid[sy + off + y + dy][sx + off + x + dx] = 0
        for y, row in enumerate(bitmap):
            for x, c in enumerate(row):
                if c == "#":
                    grid[sy + off + y][sx + off + x] = 1

    for r in range(8):  # r = screen row from the top
        for c in range(8):
            rank_idx, file_idx = (7 - r, 7 - c) if flip else (r, c)
            sx, sy = c * SQ, r * SQ
            if (rank_idx + file_idx) % 2 == 1:  # dark square: checkerboard dither
                for y in range(SQ):
                    for x in range(SQ):
                        grid[sy + y][sx + x] = 1 if (x + y) % 2 == 0 else 0
            p = at(rank_idx, file_idx)
            if p:
                put(sx, sy, PIECES[(p.lower(), p.isupper())], 1, True)
    if mark:
        file_idx, rank_idx = "abcdefgh".index(mark[0]), 8 - int(mark[1])
        c, r = (7 - file_idx, 7 - rank_idx) if flip else (file_idx, rank_idx)
        put(c * SQ, r * SQ, ("###",) * 3, 4, True)
    return tuple("".join("#" if v else "." for v in row) for row in grid)


def _move_text(start_fen: str, i: int, san: str) -> str:
    parts = start_fen.split()
    black_first = parts[1] == "b"
    black = black_first != (i % 2 == 1)
    number = int(parts[5]) + (i + black_first) // 2
    return f"{number}{'…' if black else '.'} {san}"


class ChessPuzzles:
    def __init__(self, ctx):
        self.ctx = ctx
        self.raw = {p["id"]: p for p in json.loads((ctx.folder / "puzzles.json").read_text(encoding="utf-8"))}
        self.entries = ctx.library("puzzles.json")
        self.shown = ctx.shown("puzzles.json")

    def next(self):
        state = self.ctx.state()
        pid, n = state.get("puzzle"), state.get("n")
        if pid not in self.raw or not isinstance(n, int) or not 0 <= n <= len(self.raw[pid]["steps"]):
            pid = pick_unshown(self.entries, self.shown, self.ctx.rng, library="puzzles.json").id
            n = 0
        p = self.raw[pid]
        flip = p["side"] == "Black"
        self.ctx.save_state({"puzzle": pid, "n": n + 1})
        if n == 0:
            return Page("Chess Puzzles", f"{p['side']} to move\n{p['goal']}\nRating {p['rating']}",
                        fen_to_picture(p["fen"], flip))
        step = p["steps"][n - 1]
        body = _move_text(p["fen"], n - 1, step["san"])
        if n == len(p["steps"]):
            body += "\nSolved."
        return Page("Chess Puzzles", body, fen_to_picture(step["fen"], flip, step["from"]))


def create(ctx):
    return ChessPuzzles(ctx)
