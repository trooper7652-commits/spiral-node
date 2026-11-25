"""The device.json file: which pins the screen and buttons use. Reading it never touches GPIO."""

import json
from dataclasses import dataclass, field, fields
from pathlib import Path

REQUIRED = ("up", "down", "left", "right", "select")
BUTTONS = REQUIRED + ("back", "home")  # v1 has five buttons; holding Select gives Back


class ConfigError(ValueError):
    pass


@dataclass
class DeviceConfig:
    spi_bus: int = 1
    spi_device: int = 0
    spi_hz: int = 4_000_000
    gpiochip: str = "gpiochip0"
    rst: int = 226
    dc: int = 262
    busy: int = 228
    rotate: int = 90
    data_dir: str = "/var/lib/spiral"
    buttons: dict = field(default_factory=lambda: {b: None for b in BUTTONS})


def _is_int(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def load_config(path: Path) -> DeviceConfig:
    path = Path(path)

    def fail(msg: str):
        raise ConfigError(f"{path}: {msg}")

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except OSError as e:
        fail(f"cannot read the file ({e.strerror or e})")
    except ValueError as e:
        fail(f"not valid JSON ({e})")
    if not isinstance(raw, dict):
        fail("the top level must be a JSON object")

    cfg = DeviceConfig()
    types = {f.name: f.type for f in fields(DeviceConfig)}
    for key, value in raw.items():
        if key not in types:
            fail(f"unknown key '{key}'")
        if key == "buttons":
            continue
        if types[key] is str:
            ok = isinstance(value, str) and value != ""
        else:
            ok = _is_int(value) and (value >= 0 if key != "rotate" else value in (90, 270))  # the OS draws landscape, the panel is portrait
        if not ok:
            fail(f"'{key}' has a bad value: {value!r}")
        setattr(cfg, key, value)

    buttons = raw.get("buttons", {})
    if not isinstance(buttons, dict):
        fail("'buttons' must be an object")
    for key, value in buttons.items():
        if key not in BUTTONS:
            fail(f"unknown key 'buttons.{key}'")
        if value is not None and not (_is_int(value) and value >= 0):
            fail(f"'buttons.{key}' must be a line number (0 or more) or null, got {value!r}")
        cfg.buttons[key] = value

    for key in REQUIRED:
        if cfg.buttons[key] is None:
            fail(f"'buttons.{key}' is not set. Find your button lines first: see hardware/bring-up.md")

    screen = {"rst": cfg.rst, "dc": cfg.dc, "busy": cfg.busy}
    used: dict[int, str] = {}
    for key, line in cfg.buttons.items():
        if line is None:
            continue
        for name, pin in screen.items():
            if line == pin:
                fail(f"'buttons.{key}' is line {line}, which the screen uses for '{name}'")
        if line in used:
            fail(f"'buttons.{key}' and 'buttons.{used[line]}' are on the same line ({line})")
        used[line] = key
    return cfg
