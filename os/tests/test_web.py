from PIL import Image

from spiral.config import BOOT_FRAME_S, BOOT_FRAMES, BOOT_HOLD_S
from spiral.web import WebHost, pack_bits

BOOT_MS = ((BOOT_FRAMES - 1) * BOOT_FRAME_S + BOOT_HOLD_S) * 1000


def run(host, start, end, step=100):
    """Tick from start to end (ms); return (last non-None result, time reached)."""
    out, t = None, start
    while t <= end:
        out = host.tick(t) or out
        t += step
    return out, t


def home_host(tmp_path):
    host = WebHost(str(tmp_path), seed=1)
    host.power_on(0)
    out, t = run(host, 0, BOOT_MS + 100)
    assert out["screen"] == "home"
    return host, out, t


SRC = ("from spiral.scripts_api import Page, Preference\n"
       "NAME = 'Mine'\n"
       "PREFERENCES = [Preference('interval', 'Refresh', (15, 30), 30, 's')]\n"
       "FACTS = [{'id': 'a', 'text': 'Hello', 'topic': 't', 'source': 's'}]\n"
       "class R:\n    def __init__(self, ctx):\n        self.f = ctx.entries(FACTS)\n"
       "    def next(self):\n        return Page('Fact', self.f[0].text)\n"
       "def create(ctx):\n    return R(ctx)\n")


def test_install_script_runs_in_web_host(tmp_path):
    host, _, t = home_host(tmp_path)
    assert host.install_script("my_script", SRC) is None
    assert (tmp_path / "scripts" / "my_script" / "script.py").read_text() == SRC
    assert host.start("my_script", t) is True
    out = host.tick(t + 100)
    assert out["text"] == "Fact\nHello"
    assert host.install_script("broken", "raise ValueError('nope')\n") == "nope"
    assert host.start("broken", t + 200) is False


def test_install_script_rejects_bad_id(tmp_path):
    host, _, _ = home_host(tmp_path)
    for bad in ("", "../x", "Has Caps", "a-b", "x" * 41, "a/b"):
        assert host.install_script(bad, SRC)  # an error string
    assert not (tmp_path / "scripts").exists()


def test_web_power_on_reaches_home(tmp_path):
    host = WebHost(str(tmp_path), seed=1)
    host.power_on(0)
    first = host.tick(0)
    assert first["screen"] == "boot" and first["full"] is True
    out, _ = run(host, 100, BOOT_MS + 100)
    assert out["screen"] == "home" and out["powered_off"] is False
    assert host.tick(BOOT_MS + 5000) is None  # nothing new drawn


def test_bits_length_and_packing(tmp_path):
    black = pack_bits(Image.new("1", (250, 122), 0))
    assert len(black) == 3904
    assert black[0] == 0x80 | 0x7F  # all 8 pixels of the first byte are black
    assert black[31] == 0xC0  # 250 px: last byte holds 2 pixels, padding bits stay 0
    one = Image.new("1", (250, 122), 1)
    one.putpixel((0, 0), 0)
    assert pack_bits(one)[0] == 0x80 and pack_bits(one)[1] == 0
    host, out, _ = home_host(tmp_path)
    assert len(out["bits"]) == 3904


def test_hold_select_600ms_is_back(tmp_path):
    host, _, t = home_host(tmp_path)
    host.press("select", t)
    host.release("select", t + 50)
    assert host.tick(t + 60)["screen"] == "menu"
    host.press("select", t + 1000)
    assert host.tick(t + 1500) is None  # not yet 0.6 s
    assert host.tick(t + 1600)["screen"] == "home"
    host.release("select", t + 1700)
    assert host.tick(t + 1800) is None  # no extra Select after Back


def test_text_mirrors_page(tmp_path):
    host, out, t = home_host(tmp_path)
    assert out["text"] and out["text"] == host.app.screen_text()
    host.press("select", t)
    host.release("select", t + 10)
    out = host.tick(t + 20)
    assert out["screen"] == "menu" and out["text"].startswith("Menu:")


def test_flush_flag_after_save(tmp_path):
    host, _, t = home_host(tmp_path)
    host.flushed_since_last_call()  # drain the boot-time save
    assert host.flushed_since_last_call() is False
    host.app.store.set("settings", {"x": 1})
    host.tick(t + 100)
    assert host.flushed_since_last_call() is False  # still inside the debounce
    host.tick(t + 2000)
    assert host.flushed_since_last_call() is True
    assert host.flushed_since_last_call() is False
    assert (tmp_path / "settings.json").exists()


def test_reset_clears_state(tmp_path):
    host, out, t = home_host(tmp_path)
    first = out["text"]
    host.tick(t + 2000)
    assert any(tmp_path.iterdir())
    host.reset()
    assert tmp_path.exists() and not any(tmp_path.iterdir())
    assert host.tick(t + 3000) is None  # powered off until the next power_on
    host.power_on(10000)
    out, _ = run(host, 10000, 10000 + BOOT_MS + 100)
    assert out["text"] == first  # welcome position started over


def test_power_off_then_on_reboots(tmp_path):
    host, _, t = home_host(tmp_path)
    host.app.power_off()
    out = host.tick(t)
    assert out["powered_off"] is True and out["screen"] == "off"
    host.power_on(t + 1000)
    out, _ = run(host, t + 1000, t + 1000 + BOOT_MS + 100)
    assert out["screen"] == "home" and out["powered_off"] is False


def test_web_start_known_script_shows_its_page(tmp_path):
    host, _, t = home_host(tmp_path)
    assert host.start("connect", t) is True
    out = host.tick(t + 10)
    assert out["screen"] == "home" and out["text"].endswith("What links these?")
    assert host.app.active_script_id == "connect"


def test_web_start_unknown_returns_false(tmp_path):
    host, _, t = home_host(tmp_path)
    assert host.start("nope", t) is False
    assert host.tick(t + 10) is None and host.app.active_script_id is None


def test_web_start_ignored_while_booting(tmp_path):
    host = WebHost(str(tmp_path), seed=1)
    host.power_on(0)
    assert host.start("connect", 0) is False
