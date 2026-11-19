from spiral.storage import Store, read_json, write_json_atomic


class Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


def test_atomic_write_roundtrip(tmp_path):
    p = tmp_path / "sub" / "a.json"
    write_json_atomic(p, {"x": [1, 2]})
    assert read_json(p, None) == {"x": [1, 2]}


def test_atomic_write_leaves_no_tmp(tmp_path):
    write_json_atomic(tmp_path / "a.json", {"x": 1})
    assert [f.name for f in tmp_path.iterdir()] == ["a.json"]


def test_read_missing_returns_default(tmp_path):
    assert read_json(tmp_path / "nope.json", {"d": 1}) == {"d": 1}


def test_read_corrupt_returns_default_and_renames(tmp_path):
    p = tmp_path / "a.json"
    p.write_text('{"x": ', encoding="utf-8")
    assert read_json(p, "dflt") == "dflt"
    assert (tmp_path / "a.json.corrupt").exists()
    assert not p.exists()


def test_store_saving_true_until_flush(tmp_path):
    s = Store(tmp_path, Clock())
    assert not s.saving
    s.set("a", 1)
    assert s.saving
    s.flush()
    assert not s.saving


def test_flush_if_due_waits_debounce(tmp_path):
    c = Clock()
    s = Store(tmp_path, c)
    s.set("shown/x/facts", {"ids": [1]})
    c.t = 0.5
    assert s.flush_if_due() is False
    assert not (tmp_path / "shown/x/facts.json").exists()
    c.t = 1.0
    assert s.flush_if_due() is True
    assert (tmp_path / "shown/x/facts.json").exists()
    assert s.flush_if_due() is False


def test_store_survives_restart(tmp_path):
    s = Store(tmp_path, Clock())
    s.set("settings", {"clock_offset_s": 5})
    s.flush()
    assert Store(tmp_path, Clock()).get("settings", None) == {"clock_offset_s": 5}


def test_read_wrong_type_treated_as_corrupt(tmp_path):
    p = tmp_path / "a.json"
    p.write_text("[]", encoding="utf-8")
    assert read_json(p, {"index": 0}) == {"index": 0}
    assert (tmp_path / "a.json.corrupt").exists()
