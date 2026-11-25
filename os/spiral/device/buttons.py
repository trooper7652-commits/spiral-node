"""Debounced GPIO buttons: a line reading 0 is pressed (pull-up)."""

from typing import Protocol

from ..input import Button


class LineReader(Protocol):
    def read(self, line: int) -> int: ...
    def close(self) -> None: ...


class OPiLines:
    """libgpiod v1 inputs with the pull-up on."""

    def __init__(self, chip: str, lines: list[int]):
        import gpiod

        gpio = gpiod.Chip(chip)
        self._lines = {n: gpio.get_line(n) for n in lines}
        for line in self._lines.values():
            line.request(consumer="spiral", type=gpiod.LINE_REQ_DIR_IN,
                         flags=gpiod.LINE_REQ_FLAG_BIAS_PULL_UP)

    def read(self, line: int) -> int:
        return self._lines[line].get_value()

    def close(self) -> None:
        for line in self._lines.values():
            line.release()


class GpioButtons:
    def __init__(self, reader: LineReader, pins: dict[Button, int], debounce_ms: int = 20):
        self._reader = reader
        self._pins = pins
        self._wait_s = debounce_ms / 1000
        self._level = {b: 1 for b in pins}  # accepted level; 1 = released
        self._since: dict[Button, float | None] = {b: None for b in pins}  # when a new level first read

    def poll(self, now: float) -> list[tuple[Button, bool]]:
        events = []
        for button, line in self._pins.items():
            seen = self._reader.read(line)
            if seen == self._level[button]:
                self._since[button] = None
                continue
            if self._since[button] is None:
                self._since[button] = now
            if now - self._since[button] + 1e-6 >= self._wait_s:
                self._level[button] = seen
                self._since[button] = None
                events.append((button, seen == 0))
        return events
