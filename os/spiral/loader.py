import importlib.util
import logging
from dataclasses import dataclass
from pathlib import Path

from .scripts_api import Preference

log = logging.getLogger("spiral")


@dataclass
class ScriptInfo:
    id: str
    name: str
    folder: Path
    preferences: tuple[Preference, ...]
    module: object
    error: str | None


def _check_contract(module) -> tuple[str, tuple[Preference, ...]]:
    """Return (name, preferences) or raise ValueError with a one-line reason."""
    name = getattr(module, "NAME", None)
    if not isinstance(name, str) or not name.strip():
        raise ValueError("missing NAME")
    prefs = getattr(module, "PREFERENCES", None)
    if not isinstance(prefs, (list, tuple)) or not all(isinstance(p, Preference) for p in prefs):
        raise ValueError("PREFERENCES must be a list of Preference")
    interval = next((p for p in prefs if p.key == "interval"), None)
    if interval is None:
        raise ValueError("missing interval preference")
    ok = (isinstance(interval.choices, (list, tuple)) and interval.choices
          and all(type(c) is int and c > 0 for c in interval.choices))
    if not ok:
        raise ValueError("interval choices must be positive integers")
    if interval.default not in interval.choices:
        raise ValueError("interval default must be one of its choices")
    if not callable(getattr(module, "create", None)):
        raise ValueError("missing create(ctx)")
    return name, tuple(prefs)


def _load(script_id: str, folder: Path) -> ScriptInfo:
    try:
        spec = importlib.util.spec_from_file_location(f"spiral_script_{script_id}", folder / "script.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        name, prefs = _check_contract(module)
        return ScriptInfo(script_id, name, folder, prefs, module, None)
    except (Exception, SystemExit) as e:  # scripts are user code: anything can go wrong
        msg = str(e).splitlines()[0] if str(e) else ""
        error = msg if isinstance(e, ValueError) else f"{type(e).__name__}: {msg}"
        log.warning("script %s is broken: %s", script_id, error)
        return ScriptInfo(script_id, f"{script_id} (error)", folder, (), None, error)


def discover(builtin_dir: Path, user_dir: Path) -> list[ScriptInfo]:
    folders = {}
    for root in (Path(builtin_dir), Path(user_dir)):
        if not root.is_dir():
            continue
        for sub in sorted(root.iterdir()):
            if (sub / "script.py").is_file():
                if sub.name in folders:
                    log.info("user script %s overrides built-in", sub.name)
                folders[sub.name] = sub
    infos = [_load(i, f) for i, f in folders.items()]
    return sorted(infos, key=lambda i: i.name.lower())
