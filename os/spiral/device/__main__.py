"""python -m spiral.device: run Spiral OS on the board (or, with --dry-run, on a pretend screen)."""

import argparse
import random
import signal
import time
from dataclasses import replace
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image

from ..app import App
from ..input import Button, LongPress
from ..web import BUILTIN_DIR, WELCOME_FILE
from .bus import FakeBus
from .buttons import GpioButtons
from .config import ConfigError, load_config
from .eink import EinkDisplay
from .epd import HEIGHT, WIDTH, Epd2in13V4, EpdTimeout

TICK_S = 0.05


def run(cfg, bus, lines, clock, wall, sleep, max_s=None) -> int:
    app = None
    try:
        epd = Epd2in13V4(bus)
        epd.init()
        buttons = GpioButtons(lines, {Button(k): pin for k, pin in cfg.buttons.items() if pin is not None})
        longpress = LongPress()
        app = App(EinkDisplay(epd, cfg.rotate), clock, wall, cfg.data_dir, BUILTIN_DIR, WELCOME_FILE,
                  lambda: 100,  # shortcut: no battery reading yet (PiSugar untested on this board), read pisugar-server once it works
                  random.Random())
        app.boot()
        t0 = clock()
        while True:
            now = clock()
            for button, down in buttons.poll(now):
                action = longpress.press(button, now) if down else longpress.release(button, now)
                if action is not None:
                    app.handle(action)
            action = longpress.tick(now)
            if action is not None:
                app.handle(action)
            app.tick()
            if app.powered_off:
                epd.sleep()
                return 0
            if max_s is not None and clock() - t0 >= max_s:
                app.store.flush()
                epd.sleep()
                return 0
            sleep(TICK_S)
    except EpdTimeout as e:
        print(f"spiral: screen not responding ({e})")
        return 1
    finally:
        try:
            if app is not None:
                app.store.flush()
        finally:
            try:
                bus.close()
            finally:
                lines.close()


class _Released:
    """Dry-run buttons: every line reads 1 (released)."""

    def read(self, line: int) -> int:
        return 1

    def close(self) -> None:
        pass


class _FrameBus(FakeBus):
    """A fake screen that saves the picture each time the screen RAM (0x24) is written."""

    def __init__(self, out_dir: Path, rotate: int):
        super().__init__()
        self.out_dir, self.rotate, self.count, self._last_cmd = out_dir, rotate, 0, None

    def command(self, c: int) -> None:
        self._last_cmd = c
        super().command(c)

    def data(self, b: bytes) -> None:
        super().data(b)
        if self._last_cmd == 0x24 and len(b) == 4000:
            img = Image.frombytes("1", (WIDTH, HEIGHT), bytes(b)).rotate(-self.rotate, expand=True)
            self.count += 1
            img.save(self.out_dir / f"frame-{self.count:03d}.png")


def _dry_run(cfg, out_dir: Path, seconds: float) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    t = [0.0]  # virtual time: sleeping just moves the counter
    start = datetime.now()

    def sleep(s):
        t[0] += s

    cfg = replace(cfg, data_dir=str(out_dir / "data"))  # never touch the real save folder
    return run(cfg, _FrameBus(out_dir, cfg.rotate), _Released(), lambda: t[0],
               lambda: start + timedelta(seconds=t[0]), sleep, max_s=seconds)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m spiral.device")
    ap.add_argument("--config", required=True, type=Path)
    ap.add_argument("--dry-run", metavar="OUT_DIR", type=Path, help="no hardware: save each frame as a PNG")
    ap.add_argument("--seconds", type=float, help="how long a dry run lasts (default 10)")
    args = ap.parse_args(argv)
    try:
        cfg = load_config(args.config)
    except ConfigError as e:
        print(f"spiral: {e}")
        return 2
    if args.dry_run is not None:
        return _dry_run(cfg, args.dry_run, args.seconds if args.seconds is not None else 10.0)

    from .bus import OPiBus
    from .buttons import OPiLines

    def stop(signum, frame):
        raise SystemExit(0)  # lets `systemctl stop` run the finally blocks, so saves are flushed

    signal.signal(signal.SIGTERM, stop)
    bus = OPiBus(cfg.spi_bus, cfg.spi_device, cfg.spi_hz, cfg.gpiochip, cfg.rst, cfg.dc, cfg.busy)
    lines = OPiLines(cfg.gpiochip, [p for p in cfg.buttons.values() if p is not None])
    return run(cfg, bus, lines, time.monotonic, datetime.now, time.sleep)


if __name__ == "__main__":
    raise SystemExit(main())
