PALETTE = {
    "ink": (28, 26, 20),
    "paper": (241, 231, 204),
    "olive": (111, 125, 60),
    "olive_deep": (71, 82, 42),
    "orange": (240, 118, 46),
    "gold": (233, 168, 32),
    "white": (255, 246, 220),
    "sun": (255, 208, 106),
    "amber": (255, 171, 69),
    "red": (224, 54, 76),
    "rust": (178, 60, 60),
    "plum": (122, 42, 72),
    "aubergine": (74, 33, 71),
    "night": (12, 22, 61),
    "navy": (26, 44, 104),
    "dusk": (52, 71, 138),
    "sky": (106, 154, 216),
    "sky_pale": (184, 220, 240),
    "teal": (62, 138, 116),
    "sea": (42, 108, 140),
    "lime": (214, 240, 112),
    "leaf": (154, 214, 82),
    "grass": (69, 145, 64),
    "forest": (31, 79, 52),
    "tan": (208, 144, 78),
    "brown": (138, 90, 43),
    "bark": (90, 51, 36),
    "umber": (58, 32, 24),
    "skin": (242, 180, 138),
    "sand": (232, 207, 150),
    "slate": (106, 106, 152),
    "mist": (168, 160, 184),
}

def ramp(*names: str) -> list[tuple[int, int, int]]:
    return [PALETTE[n] for n in names]

def rgba(c) -> tuple[int, int, int, int]:
    if isinstance(c, str):
        r, g, b = PALETTE[c]
        return (r, g, b, 255)
    if len(c) == 3:
        return (c[0], c[1], c[2], 255)
    return tuple(c)

def css_list() -> list[str]:
    return [f"rgb({r}, {g}, {b})" for r, g, b in PALETTE.values()]
