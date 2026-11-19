"""Render the README's e-ink GIF from the real Spiral OS: boot, Home, then two Connect pages.
Run from website/: python art/make_gif.py  →  ../docs/e-ink.gif (deterministic: fixed seed and clock)."""
import sys
import tempfile
from datetime import datetime
from pathlib import Path

from PIL import Image

OS = Path(__file__).resolve().parents[2] / "os"
sys.path.insert(0, str(OS))
import spiral.web as web  # noqa: E402

OUT = OS.parent / "docs" / "e-ink.gif"
INK, PAPER = (0x1D, 0x1A, 0x16), (0xF4, 0xEC, 0xD8)
SCALE = 2


class FixedClock:
    @staticmethod
    def now():
        return datetime(2026, 11, 16, 9, 41)


def frame(img):
    """1-bit OS frame → warm ink-on-paper, scaled up with hard pixel edges."""
    rgb = Image.new("RGB", img.size, PAPER)
    rgb.paste(Image.new("RGB", img.size, INK), mask=img.convert("L").point(lambda v: 255 if v < 128 else 0))
    return rgb.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)


def main():
    web.datetime = FixedClock  # the status bar clock reads this
    frames, durations = [], []
    with tempfile.TemporaryDirectory() as data:
        host = web.WebHost(data, seed=7)
        host.power_on(0)
        ms, last = 0.0, 0.0
        while host.app.booting or not frames:  # boot animation, every frame with its real timing
            if host.tick(ms):
                if frames:
                    durations.append(ms - last)
                frames.append(frame(host.last_img))
                last = ms
            ms += 50
        host.tick(ms + 50)
        durations.append(max(ms - last, 100))
        frames.append(frame(host.last_img))  # Home
        durations.append(2500)
        assert host.start("connect", ms + 100)
        host.tick(ms + 150)
        frames.append(frame(host.last_img))  # first Connect page
        durations.append(4000)
        host.tick(ms + 150 + 60_000)  # Connect's default interval is 60 s
        frames.append(frame(host.last_img))
        durations.append(4000)
        assert "What links these?" in host.app.screen_text()
    OUT.parent.mkdir(exist_ok=True)
    frames[0].save(OUT, save_all=True, append_images=frames[1:], duration=[int(d) for d in durations], loop=0,
                   optimize=False, disposal=1)
    print(f"{OUT.name}: {len(frames)} frames")


if __name__ == "__main__":
    main()
