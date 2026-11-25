"""The wires between the board and the screen, behind one small interface."""

import time
from typing import Protocol


class Bus(Protocol):
    def command(self, c: int) -> None: ...  # DC low, one byte
    def data(self, b: bytes) -> None: ...  # DC high
    def reset(self, level: int) -> None: ...
    def busy(self) -> bool: ...
    def sleep_ms(self, ms: int) -> None: ...
    def close(self) -> None: ...


class FakeBus:
    """Records what a driver sends, so tests need no hardware."""

    def __init__(self, busy_for: int = 0):
        self.log: list[tuple[str, int | bytes]] = []
        self.busy_for = busy_for  # busy() calls that return True; -1 = forever
        self.elapsed_ms = 0

    def command(self, c: int) -> None:
        self.log.append(("cmd", c))

    def data(self, b: bytes) -> None:
        self.log.append(("data", bytes(b)))

    def reset(self, level: int) -> None:
        self.log.append(("reset", level))

    def busy(self) -> bool:
        if self.busy_for == 0:
            return False
        if self.busy_for > 0:
            self.busy_for -= 1
        return True

    def sleep_ms(self, ms: int) -> None:
        self.elapsed_ms += ms

    def close(self) -> None:
        pass

    def sequence(self) -> list[tuple[str, int | bytes]]:
        """The log with consecutive data entries joined."""
        out: list[tuple[str, int | bytes]] = []
        for kind, value in self.log:
            if kind == "data" and out and out[-1][0] == "data":
                out[-1] = ("data", out[-1][1] + value)
            else:
                out.append((kind, value))
        return out


class OPiBus:
    """Orange Pi Zero 2W: spidev for SPI (the kernel drives CS), libgpiod v1 for the rest."""

    def __init__(self, spi_bus=1, spi_device=0, spi_hz=4_000_000,
                 chip="gpiochip0", rst=226, dc=262, busy=228):
        import gpiod
        import spidev

        self._spi = spidev.SpiDev()
        self._spi.open(spi_bus, spi_device)
        self._spi.max_speed_hz = spi_hz
        self._spi.mode = 0
        gpio = gpiod.Chip(chip)
        self._rst = gpio.get_line(rst)
        self._dc = gpio.get_line(dc)
        self._busy = gpio.get_line(busy)
        self._rst.request(consumer="spiral", type=gpiod.LINE_REQ_DIR_OUT, default_vals=[1])
        self._dc.request(consumer="spiral", type=gpiod.LINE_REQ_DIR_OUT, default_vals=[1])
        self._busy.request(consumer="spiral", type=gpiod.LINE_REQ_DIR_IN)

    def command(self, c: int) -> None:
        self._dc.set_value(0)
        self._spi.writebytes2([c])

    def data(self, b: bytes) -> None:
        self._dc.set_value(1)
        self._spi.writebytes2(b)

    def reset(self, level: int) -> None:
        self._rst.set_value(level)

    def busy(self) -> bool:
        return self._busy.get_value() == 1

    def sleep_ms(self, ms: int) -> None:
        time.sleep(ms / 1000)

    def close(self) -> None:
        self._spi.close()
        for line in (self._rst, self._dc, self._busy):
            line.release()
