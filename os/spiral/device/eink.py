"""The Display protocol on the e-paper screen."""

from .epd import to_buffer


class EinkDisplay:
    """The runner calls epd.init() once before the first frame."""

    def __init__(self, epd, rotate: int = 90):
        self._epd = epd
        self._rotate = rotate
        self._last: bytes | None = None

    def show(self, img, full: bool) -> None:
        buf = to_buffer(img, self._rotate)
        if full or self._last is None:
            self._epd.display_full(buf)
        elif buf != self._last:
            self._epd.display_partial(buf)
        self._last = buf
