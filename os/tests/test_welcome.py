from pathlib import Path

from spiral.storage import Store
from spiral.welcome import Welcome, load_messages


def make_store(tmp_path):
    return Store(tmp_path, lambda: 0.0)


def test_skips_comments_and_blanks(tmp_path):
    f = tmp_path / "w.txt"
    f.write_text("# c\n\n  Hello  \nWorld\n  # indented comment\n", encoding="utf-8")
    assert load_messages(f) == ["Hello", "World"]


def test_real_file_has_34_messages():
    msgs = load_messages(Path(__file__).resolve().parents[1] / "welcome-messages.txt")
    assert len(msgs) == 34
    assert msgs[0] == "Welcome back, maker."


def test_rotates_in_order_across_boots(tmp_path):
    store = make_store(tmp_path)
    msgs = ["a", "b", "c"]
    assert [Welcome(msgs, store).advance() for _ in range(3)] == msgs


def test_wraps_after_last(tmp_path):
    store = make_store(tmp_path)
    msgs = ["a", "b"]
    got = [Welcome(msgs, store).advance() for _ in range(3)]
    assert got == ["a", "b", "a"]


def test_missing_or_comment_only_file_falls_back(tmp_path):
    assert load_messages(tmp_path / "nope.txt") == ["Welcome."]
    f = tmp_path / "c.txt"
    f.write_text("# only\n\n# comments\n", encoding="utf-8")
    assert load_messages(f) == ["Welcome."]
