import argparse
from pathlib import Path

from .config import BOOT_FRAME_S, BOOT_FRAMES, BOOT_HOLD_S
from .web import WebHost


def main() -> int:
    ap = argparse.ArgumentParser(prog="python -m spiral")
    ap.add_argument("--data-dir", default=str(Path(__file__).resolve().parent.parent / "sim-data"))
    ap.add_argument("--snapshot", metavar="out.png", help="boot to Home headless and save the screen")
    args = ap.parse_args()
    if not args.snapshot:
        print("The interactive simulator is the browser one (see the website); use --snapshot out.png here.")
        return 0
    Path(args.data_dir).mkdir(parents=True, exist_ok=True)
    host = WebHost(args.data_dir, seed=0)
    host.power_on(0)
    ms = 0.0
    while ms <= ((BOOT_FRAMES - 1) * BOOT_FRAME_S + BOOT_HOLD_S) * 1000 + 100:
        host.tick(ms)
        ms += 100
    host.app.store.flush()
    host.last_img.save(args.snapshot)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
