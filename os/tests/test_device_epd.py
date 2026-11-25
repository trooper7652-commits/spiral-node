import pytest
from PIL import Image

from spiral.device.bus import FakeBus
from spiral.device.epd import Epd2in13V4, EpdTimeout, to_buffer


def _one_black(xy=(0, 0)):
    img = Image.new("1", (250, 122), 1)
    img.putpixel(xy, 0)
    return img


def test_to_buffer_white():
    assert to_buffer(Image.new("1", (250, 122), 1)) == b"\xff" * 4000


def test_to_buffer_top_left_pixel():
    buf = to_buffer(_one_black())
    assert buf[3984] == 0x7F
    assert buf[:3984] == b"\xff" * 3984 and buf[3985:] == b"\xff" * 15


def test_to_buffer_rotate_270():
    buf = to_buffer(_one_black(), rotate=270)
    assert buf[15] == 0xFF & ~0x40
    assert buf[:15] == b"\xff" * 15 and buf[16:] == b"\xff" * 3984


def test_to_buffer_rejects_wrong_size():
    with pytest.raises(ValueError):
        to_buffer(Image.new("1", (100, 100), 1))


def test_init_starts_with_hw_and_sw_reset():
    bus = FakeBus()
    Epd2in13V4(bus).init()
    assert bus.log[:3] == [("reset", 1), ("reset", 0), ("reset", 1)]
    assert next(v for k, v in bus.log if k == "cmd") == 0x12


def test_display_full_writes_both_rams_and_updates():
    bus = FakeBus()
    Epd2in13V4(bus).display_full(b"\x00" * 4000)
    assert bus.sequence() == [
        ("cmd", 0x24), ("data", b"\x00" * 4000),
        ("cmd", 0x26), ("data", b"\x00" * 4000),
        ("cmd", 0x22), ("data", b"\xf7"), ("cmd", 0x20),
    ]


def test_display_partial_writes_new_ram_only():
    bus = FakeBus()
    buf = bytes(range(250)) * 16
    Epd2in13V4(bus).display_partial(buf)
    seq = bus.sequence()
    assert ("cmd", 0x24) in seq and ("data", buf) in seq
    assert ("cmd", 0x26) not in seq
    assert seq[-3:] == [("cmd", 0x22), ("data", b"\xff"), ("cmd", 0x20)]


def test_full_after_partial_reinits():
    bus = FakeBus()
    epd = Epd2in13V4(bus)
    buf = b"\x00" * 4000
    epd.init()
    epd.display_partial(buf)
    bus.log.clear()
    epd.display_full(buf)
    assert bus.log[:3] == [("reset", 1), ("reset", 0), ("reset", 1)]
    cmds = [v for k, v in bus.log if k == "cmd"]
    assert cmds[0] == 0x12 and cmds.index(0x12) < cmds.index(0x24)


def test_full_after_full_does_not_reinit():
    bus = FakeBus()
    epd = Epd2in13V4(bus)
    epd.init()
    epd.display_full(b"\x00" * 4000)
    bus.log.clear()
    epd.display_full(b"\x00" * 4000)
    assert bus.sequence()[0] == ("cmd", 0x24)


def test_busy_timeout():
    bus = FakeBus(busy_for=-1)
    with pytest.raises(EpdTimeout, match="check the cable"):
        Epd2in13V4(bus, busy_timeout_s=0.5).display_full(b"\x00" * 4000)
    assert 500 <= bus.elapsed_ms <= 600


def test_wrong_buffer_length():
    with pytest.raises(ValueError):
        Epd2in13V4(FakeBus()).display_full(b"\x00")
