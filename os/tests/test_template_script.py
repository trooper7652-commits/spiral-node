import random
from datetime import date
from pathlib import Path

import spiral
from spiral.loader import discover
from spiral.scripts_api import Page, ScriptContext
from spiral.storage import Store

BUILTIN = Path(spiral.__file__).parent / "builtin_scripts"
COMMUNITY = Path(__file__).resolve().parents[2] / "scripts"


def test_template_is_a_valid_script(tmp_path):
    info = {i.id: i for i in discover(BUILTIN, COMMUNITY)}["TEMPLATE"]
    assert info.error is None
    assert info.module.DESCRIPTION and info.module.AUTHOR
    ctx = ScriptContext("TEMPLATE", info.folder, {}, Store(tmp_path, lambda: 0.0), random.Random(1), lambda: date(2026, 1, 1))
    page = info.module.create(ctx).next()
    assert isinstance(page, Page) and page.title == "Fact" and page.body
