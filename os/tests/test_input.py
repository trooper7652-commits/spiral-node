from spiral.input import Action, Button, LongPress


def test_short_select_is_select():
    lp = LongPress()
    assert lp.press(Button.SELECT, 0) is None
    assert lp.release(Button.SELECT, 0.3) == Action.SELECT


def test_long_select_fires_back_while_held():
    lp = LongPress()
    lp.press(Button.SELECT, 0)
    assert lp.tick(0.59) is None
    assert lp.tick(0.6) == Action.BACK
    assert lp.release(Button.SELECT, 0.8) is None


def test_back_fires_once():
    lp = LongPress()
    lp.press(Button.SELECT, 0)
    assert lp.tick(0.7) == Action.BACK
    assert lp.tick(0.9) is None


def test_arrows_fire_on_press():
    lp = LongPress()
    for b in (Button.UP, Button.DOWN, Button.LEFT, Button.RIGHT):
        assert lp.press(b, 0) == Action[b.name]
        assert lp.release(b, 0.1) is None


def test_autorepeat_press_ignored():
    lp = LongPress()
    assert lp.press(Button.SELECT, 0) is None
    assert lp.press(Button.SELECT, 0.1) is None
    assert lp.release(Button.SELECT, 0.3) == Action.SELECT
    assert lp.release(Button.SELECT, 0.4) is None


def test_back_button_is_back_action():
    lp = LongPress()
    assert lp.press(Button.BACK, 0) == Action.BACK
    assert lp.release(Button.BACK, 0.1) is None


def test_home_button_is_home_action():
    lp = LongPress()
    assert lp.press(Button.HOME, 0) == Action.HOME
    assert lp.release(Button.HOME, 0.1) is None


def test_back_and_home_do_not_disturb_select_long_press():
    lp = LongPress()
    lp.press(Button.SELECT, 0)
    assert lp.press(Button.BACK, 0.1) == Action.BACK
    assert lp.tick(0.7) == Action.BACK
