from enum import Enum

from .config import LONG_PRESS_S


class Button(Enum):
    UP = "up"
    DOWN = "down"
    LEFT = "left"
    RIGHT = "right"
    SELECT = "select"
    # TODO(hardware): GPIO pins for BACK and HOME are not assigned yet; the pager build maps them
    # (like the other buttons) outside this package. The simulator drives them by name.
    BACK = "back"
    HOME = "home"


class Action(Enum):
    UP = "up"
    DOWN = "down"
    LEFT = "left"
    RIGHT = "right"
    SELECT = "select"
    BACK = "back"
    HOME = "home"


class LongPress:
    def __init__(self, threshold_s: float = LONG_PRESS_S):
        self.threshold_s = threshold_s
        self._down = set()
        self._t0 = 0.0
        self._back_fired = False

    def press(self, button: Button, now: float):
        if button in self._down:  # key autorepeat
            return None
        self._down.add(button)
        if button is Button.SELECT:
            self._t0 = now
            self._back_fired = False
            return None
        return Action[button.name]

    def release(self, button: Button, now: float):
        if button not in self._down:
            return None
        self._down.discard(button)
        if button is not Button.SELECT or self._back_fired:
            return None
        # A missed tick must still give Back.
        if now - self._t0 >= self.threshold_s:
            return Action.BACK
        return Action.SELECT

    def tick(self, now: float):
        if (Button.SELECT in self._down and not self._back_fired
                and now - self._t0 >= self.threshold_s):
            self._back_fired = True
            return Action.BACK
        return None
