import json
from datetime import datetime
from pathlib import Path

import pytest
from PIL import Image

from spiral.device.__main__ import main, run
from spiral.device.bus import FakeBus
from spiral.device.config import ConfigError, load_config

EXAMPLE = Path(__file__).parent.parent / "deploy" / "device.example.json"
PINS = {"up": 1, "down": 2, "left": 3, "right": 4, "select": 5, "back": None, "home": None}


def write_cfg(tmp_path, **over):
    cfg = {"data_dir": str(tmp_path / "data"), "buttons": dict(PINS)}
    for k, v in over.items():
        if k == "buttons":
            cfg["buttons"].update(v)
        else:
            cfg[k] = v
    path = tmp_path / "device.json"
    path.write_text(json.dumps(cfg), encoding="utf-8")
    return path


def test_example_config_loads_but_has_no_buttons():
    with pytest.raises(ConfigError) as e:
        load_config(EXAMPLE)
    assert "buttons.up" in str(e.value) and "hardware/bring-up.md" in str(e.value)


def test_good_config_loads(tmp_path):
    cfg = load_config(write_cfg(tmp_path))
    assert cfg.buttons["select"] == 5 and cfg.rst == 226 and cfg.rotate == 90


def test_button_on_screen_pin_rejected(tmp_path):
    with pytest.raises(ConfigError, match="rst"):
        load_config(write_cfg(tmp_path, buttons={"select": 226}))


def test_duplicate_button_lines_rejected(tmp_path):
    with pytest.raises(ConfigError, match="same line"):
        load_config(write_cfg(tmp_path, buttons={"down": 1}))


def test_unknown_key_rejected(tmp_path):
    with pytest.raises(ConfigError, match="colour"):
        load_config(write_cfg(tmp_path, colour="red"))
    with pytest.raises(ConfigError, match="buttons.fire"):
        load_config(write_cfg(tmp_path, buttons={"fire": 9}))


def test_bad_values_rejected(tmp_path):
    with pytest.raises(ConfigError, match="buttons.up"):
        load_config(write_cfg(tmp_path, buttons={"up": True}))
    with pytest.raises(ConfigError, match="buttons.up"):
        load_config(write_cfg(tmp_path, buttons={"up": -1}))


def test_bad_json_rejected(tmp_path):
    path = tmp_path / "device.json"
    path.write_text("{nope", encoding="utf-8")
    with pytest.raises(ConfigError, match="device.json"):
        load_config(path)


def test_main_exits_2_on_bad_config(tmp_path, capsys):
    assert main(["--config", str(EXAMPLE)]) == 2
    assert "buttons.up" in capsys.readouterr().out


def test_dry_run_boots_to_home(tmp_path):
    cfg = write_cfg(tmp_path)
    out = tmp_path / "frames"
    assert main(["--config", str(cfg), "--dry-run", str(out), "--seconds", "5"]) == 0
    frames = sorted(out.glob("frame-*.png"))
    assert len(frames) >= 6
    for f in frames:
        assert Image.open(f).size == (250, 122)
    assert Image.open(frames[-1]).convert("L").getextrema()[0] < 255


def test_dry_run_keeps_saves_out_of_real_data_dir(tmp_path):
    cfg = write_cfg(tmp_path, data_dir=str(tmp_path / "real"))
    out = tmp_path / "frames"
    assert main(["--config", str(cfg), "--dry-run", str(out), "--seconds", "5"]) == 0
    assert not (tmp_path / "real").exists()
    assert (out / "data").is_dir()


def test_rotate_only_90_or_270(tmp_path):
    for bad in (0, 180):
        with pytest.raises(ConfigError, match="device.json.*rotate"):
            load_config(write_cfg(tmp_path, rotate=bad))
    assert load_config(write_cfg(tmp_path, rotate=270)).rotate == 270


class Sim:
    """Virtual time plus fake button lines scripted as (line, down_at, up_at)."""

    def __init__(self, presses=()):
        self.t = 0.0
        self.presses = presses
        self.closed = False

    def clock(self):
        return self.t

    def sleep(self, s):
        self.t += s

    def wall(self):
        return datetime(2026, 1, 1, 12, 0, 0)

    def read(self, line):
        return 0 if any(l == line and a <= self.t < b for l, a, b in self.presses) else 1

    def close(self):
        self.closed = True


def test_power_off_exits_and_sleeps_screen(tmp_path):
    cfg = load_config(write_cfg(tmp_path))
    # Home: select opens the menu; down x5 reaches "Power off"; select opens the
    # dialog (Cancel is the default); right moves to OK; select confirms.
    keys = ["select"] + ["down"] * 5 + ["select", "right", "select"]
    presses = [(PINS[k], 4.0 + 0.5 * i, 4.2 + 0.5 * i) for i, k in enumerate(keys)]
    sim, bus = Sim(presses), FakeBus()
    assert run(cfg, bus, sim, sim.clock, sim.wall, sim.sleep, max_s=60) == 0
    cmds = [v for k, v in bus.sequence() if k == "cmd"]
    assert cmds[-1] == 0x10
    assert sim.t < 20  # it stopped on power off, not on max_s
    assert any((tmp_path / "data").glob("*.json"))  # the store was flushed


def test_max_s_stops_and_sleeps_screen(tmp_path):
    cfg = load_config(write_cfg(tmp_path))
    sim, bus = Sim(), FakeBus()
    assert run(cfg, bus, sim, sim.clock, sim.wall, sim.sleep, max_s=5) == 0
    assert [v for k, v in bus.sequence() if k == "cmd"][-1] == 0x10


def test_screen_timeout_exits_1(tmp_path, capsys):
    cfg = load_config(write_cfg(tmp_path))
    sim = Sim()
    assert run(cfg, FakeBus(busy_for=-1), sim, sim.clock, sim.wall, sim.sleep) == 1
    assert capsys.readouterr().out.startswith("spiral: screen not responding")
    assert sim.closed
