import random
from datetime import date
import shutil
from pathlib import Path

from spiral.loader import discover
from spiral.scripts_api import Page, ScriptContext
from spiral.storage import Store

FIX = Path(__file__).parent / "fixtures" / "scripts"


def _dir(tmp_path, name, *fixtures):
    d = tmp_path / name
    d.mkdir()
    for f in fixtures:
        shutil.copytree(FIX / f, d / f)
    return d


def test_discovers_good_script(tmp_path):
    [info] = discover(_dir(tmp_path, "b", "good"), tmp_path / "missing")
    assert (info.id, info.name, info.error) == ("good", "Good", None)
    assert info.preferences[0].key == "interval"
    ctx = ScriptContext("good", info.folder, {}, Store(tmp_path / "d", lambda: 0.0), random.Random(1), lambda: date(2026, 1, 1))
    assert info.module.create(ctx).next() == Page("Good", "hello")


def test_import_error_isolated(tmp_path):
    infos = {i.id: i for i in discover(_dir(tmp_path, "b", "good", "broken_import"), tmp_path / "u")}
    assert infos["good"].error is None
    assert infos["broken_import"].error and "does_not_exist_xyz" in infos["broken_import"].error
    assert infos["broken_import"].name == "broken_import (error)"


def test_missing_interval_is_error(tmp_path):
    [info] = discover(_dir(tmp_path, "b", "no_interval"), tmp_path / "u")
    assert info.error == "missing interval preference"
    assert info.name == "no_interval (error)"


def test_user_overrides_builtin(tmp_path):
    builtin = _dir(tmp_path, "b", "good")
    user = _dir(tmp_path, "u", "good")
    src = user / "good" / "script.py"
    src.write_text(src.read_text().replace('NAME = "Good"', 'NAME = "Mine"'))
    [info] = discover(builtin, user)
    assert info.name == "Mine"
    assert info.folder == user / "good"


def test_sorted_by_name(tmp_path):
    infos = discover(_dir(tmp_path, "b", "good", "broken_import", "no_interval"), tmp_path / "u")
    assert [i.name for i in infos] == ["broken_import (error)", "Good", "no_interval (error)"]


def test_context_state_roundtrip(tmp_path):
    store = Store(tmp_path, lambda: 0.0)
    ctx = ScriptContext("s", tmp_path, {}, store, random.Random(1), lambda: date(2026, 1, 1))
    assert ctx.state() == {}
    ctx.state()["x"] = 1  # a fresh copy: mutating it changes nothing
    assert ctx.state() == {}
    ctx.save_state({"story": "a", "page": 2})
    store.flush()
    ctx2 = ScriptContext("s", tmp_path, {}, Store(tmp_path, lambda: 0.0), random.Random(1), lambda: date(2026, 1, 1))
    assert ctx2.state() == {"story": "a", "page": 2}
    assert ctx2.shown("facts.json").key == "shown/s/facts"
