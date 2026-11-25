# Ported from Waveshare's epd2in13_V4.py
#
# Original notice:
# *****************************************************************************
# * | File        :	  epd2in13_V4.py
# * | Author      :   Waveshare team
# * | Function    :   Electronic paper driver
# * | Info        :
# *----------------
# * | This version:   V1.0
# * | Date        :   2023-06-25
# # | Info        :   python demo
# -----------------------------------------------------------------------------
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documnetation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to  whom the Software is
# furished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS OR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.
#

"""Driver for the Waveshare 2.13" V4 e-paper screen (122x250 pixels, portrait)."""

from PIL import Image

from .bus import Bus

WIDTH, HEIGHT = 122, 250
ROW_BYTES = 16  # 122 pixels padded to 128 bits
BUF_LEN = ROW_BYTES * HEIGHT


class EpdTimeout(RuntimeError):
    pass


def to_buffer(img: Image.Image, rotate: int = 90) -> bytes:
    """250x122 landscape image -> 4000 bytes of portrait rows, 1 = white."""
    if img.size != (HEIGHT, WIDTH):
        raise ValueError(f"image must be {HEIGHT}x{WIDTH}, got {img.size[0]}x{img.size[1]}")
    raw = bytearray(img.rotate(rotate, expand=True).convert("1").tobytes())
    for i in range(ROW_BYTES - 1, len(raw), ROW_BYTES):
        raw[i] |= 0x3F  # the 6 padding bits stay white
    return bytes(raw)


class Epd2in13V4:
    def __init__(self, bus: Bus, busy_timeout_s: float = 10.0):
        self.bus = bus
        self.busy_timeout_s = busy_timeout_s
        self._needs_init = False  # a partial refresh pulses RST, which clears what init() set

    def _reset(self) -> None:
        self.bus.reset(1)
        self.bus.sleep_ms(20)
        self.bus.reset(0)
        self.bus.sleep_ms(2)
        self.bus.reset(1)
        self.bus.sleep_ms(20)

    def _cmd(self, c: int, *data: int) -> None:
        self.bus.command(c)
        for d in data:
            self.bus.data(bytes([d]))

    def _read_busy(self) -> None:
        waited_ms = 0
        while self.bus.busy():
            if waited_ms >= self.busy_timeout_s * 1000:
                raise EpdTimeout(
                    f"screen busy for more than {self.busy_timeout_s:g} s: "
                    "check the cable and the BUSY pin"
                )
            self.bus.sleep_ms(10)
            waited_ms += 10

    def _turn_on(self, mode: int) -> None:
        self._cmd(0x22, mode)  # display update control
        self._cmd(0x20)  # activate
        self._read_busy()

    def _window(self) -> None:
        self._cmd(0x44, 0, (WIDTH - 1) >> 3 & 0xFF)
        self._cmd(0x45, 0, 0, (HEIGHT - 1) & 0xFF, (HEIGHT - 1) >> 8 & 0xFF)
        self._cmd(0x4E, 0)
        self._cmd(0x4F, 0, 0)

    def _check(self, buf: bytes) -> None:
        if len(buf) != BUF_LEN:
            raise ValueError(f"buffer must be {BUF_LEN} bytes, got {len(buf)}")

    def init(self) -> None:
        self._needs_init = False
        self._reset()
        self._read_busy()
        self._cmd(0x12)  # software reset
        self._read_busy()
        self._cmd(0x01, 0xF9, 0x00, 0x00)  # driver output control
        self._cmd(0x11, 0x03)  # data entry mode
        self._window()
        self._cmd(0x3C, 0x05)  # border waveform
        self._cmd(0x21, 0x00, 0x80)  # display update control
        self._cmd(0x18, 0x80)  # internal temperature sensor
        self._read_busy()

    def display_full(self, buf: bytes) -> None:
        """Full refresh; also fills the base image that partial refresh compares against."""
        self._check(buf)
        if self._needs_init:
            self.init()
        self._cmd(0x24)
        self.bus.data(buf)
        self._cmd(0x26)
        self.bus.data(buf)
        self._turn_on(0xF7)

    def display_partial(self, buf: bytes) -> None:
        self._check(buf)
        self._needs_init = True
        self.bus.reset(0)
        self.bus.sleep_ms(1)
        self.bus.reset(1)
        self._cmd(0x3C, 0x80)
        self._cmd(0x01, 0xF9, 0x00, 0x00)
        self._cmd(0x11, 0x03)
        self._window()
        self._cmd(0x24)
        self.bus.data(buf)
        self._turn_on(0xFF)

    def sleep(self) -> None:
        """Deep sleep. Closing the bus is the caller's job."""
        self._cmd(0x10, 0x01)
        self.bus.sleep_ms(2000)
