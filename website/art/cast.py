"""Pixel sprites for the hero scenes: one string row per art pixel, one letter per Helix 16 colour.

Each entry is a list of frames; a frame is a list of equal-width rows. Frames are laid side by side in one PNG strip.
"""

KEY = dict(K="ink", W="paper", c="cloud", O="amber", A="copper", a="copper_deep", B="brown", b="brown_deep",
           h="brown_hi", R="apple", L="leaf", F="forest", o="olive", d="olive_deep", g="olive_bright", s="sky",
           r="rose", D="dusk", n="night", i="ink_hi", p="n_brown", q="n_brown_deep", y="n_hi", z="n_deep")


def tweak(frame, *changes):
    """frame copy with (x, y, char) changes applied."""
    rows = [list(r) for r in frame]
    for x, y, ch in changes:
        rows[y][x] = ch
    return ["".join(r) for r in rows]


MONARCH = [
    [".KKK.K.KKK.",
     "KOOOKKKOOOK",
     "KOWOOKOOWOK",
     "KOOOOKOOOOK",
     ".KOOAKAOOK.",
     "..KOAKAOK..",
     "...KK.KK..."],
    [".....K.....",
     "....KOK....",
     "...KOOOK...",
     "...KOWOK...",
     "...KOOOK...",
     "....KAK....",
     ".....K....."],
]

BAT = [
    ["K...K.K...K",
     "KK.KKKKK.KK",
     "KKKKKKKKKKK",
     ".KKK.K.KKK.",
     "..K.....K..",
     "..........."],
    ["....K.K....",
     "..KKKKKKK..",
     ".KKKKKKKKK.",
     "KKK.KKK.KKK",
     "KK.......KK",
     "K.........K"],
]
BAT = [[r.ljust(11, ".") for r in f] for f in BAT]

FIREFLY = [[".O.",
            "OWO",
            ".O."]]

OWL_OPEN = [".b.....b.",
            ".bbbbbbb.",
            "bbWWbWWbb",
            "bbWKbWKbb",
            "bbbbObbbb",
            "bBhhhhhBb",
            "BBhBhBhBB",
            "BBhhhhhBB",
            ".BhBhBhB.",
            "..BBBBB..",
            "..AA.AA.."]
OWL = [OWL_OPEN, tweak(OWL_OPEN, *[(x, 2, "b") for x in (2, 3, 5, 6)], (2, 3, "K"), (3, 3, "K"), (5, 3, "K"), (6, 3, "K"))]

ROBIN1 = ["..BBB....",
          ".BKBBB...",
          "OBBBBBB..",
          ".AABBBBB.",
          ".AAABBBBB",
          "..AAABBB.",
          "...A.BB..",
          "...K.K..."]
ROBIN = [ROBIN1, tweak(ROBIN1, (8, 4, "."), (7, 3, "B"), (8, 3, "B"))]

CARDINAL1 = ["..R......",
             ".RRR.....",
             "KKRRR....",
             "OKRRRR...",
             ".RRRRRRR.",
             ".RRRRRRRR",
             "..RRRRRR.",
             "...RRRR.R",
             "...K.K..."]
CARDINAL = [CARDINAL1, tweak(CARDINAL1, (2, 0, "."), (3, 0, "R"), (8, 7, "."), (8, 6, "R"))]

FROG1 = ["..........",
         "..........",
         ".KK....KK.",
         "KgWK..KWgK",
         "KggggggggK",
         "KgLggggLgK",
         ".KLLLLLLK.",
         "KK.KKKK.KK"]
FROG2 = [".KK....KK.",
         "KgWK..KWgK",
         "KggggggggK",
         ".KgLLLLgK.",
         ".KgK..KgK.",
         "KgK....KgK",
         "KK......KK",
         ".........."]
FROG = [FROG1, FROG2]

TOAD1 = ["..........",
         "..OO..OO..",
         ".OKO..OKO.",
         "BBBBBBBBBB",
         "BhBBbBBhBB",
         "BBBhBBBBBB",
         "BbBBBBbBBB",
         ".BB....BB."]
TOAD = [TOAD1, tweak(TOAD1, (4, 5, "h"), (5, 5, "h"), (4, 6, "h"), (5, 6, "h"), (3, 3, "h"), (6, 3, "h"))]

RABBIT1 = [".......h..",
           "......hch.",
           "......hch.",
           ".....hhhh.",
           ".....hhKhO",
           "..hhhhhhh.",
           ".hhhhhhhh.",
           "chhhhhhhh.",
           ".hh.hh.hh."]
RABBIT = [RABBIT1, tweak(RABBIT1, (7, 0, "."), (8, 0, "h"), (6, 1, "h"), (7, 1, "h"), (8, 1, "c"), (9, 1, "h"), (9, 4, "."), (8, 4, "K"))]

SQUIRREL1 = ["........AA",
             ".......AAAa",
             "..AA...AAAa",
             ".AKAA..AAa.",
             "OAAAA.AAA..",
             ".AAAAAAA...",
             "..cAAAA....",
             "..ccAAA....",
             "..ccAAA....",
             "...AAA.....",
             "..aa.aa...."]
SQUIRREL1 = [r.ljust(11, ".") for r in SQUIRREL1]
SQUIRREL = [SQUIRREL1, tweak(SQUIRREL1, (8, 0, "."), (9, 0, "A"), (10, 0, "A"), (10, 1, "."), (10, 2, "."), (9, 1, "A"))]

DOG1 = ["..b.........",
        ".bbb........",
        ".bAAA.......",
        "KAKAAA......",
        ".AAAA.......",
        "..AAA.......",
        "..AAAAA.....",
        "..AWWAAAA...",
        "..AWWAAAAA..",
        "..AAAAAAAAa.",
        "..aa.aaa.aa."]
DOG = [DOG1, tweak(DOG1, (10, 9, "A"), (11, 9, "."), (10, 8, "A"), (11, 8, "A"), (11, 7, "a"), (11, 6, "a"))]

DOG_ASLEEP = [["..........", "..........", "..bbbbbb..", ".bAAAAAAb.", "bAAAAAAAAb", "KAWWAAAAAa", ".aaaaaaaa."],
              ["..........", "..bbbbbb..", ".bAAAAAAb.", "bAAAAAAAAb", "bAAAAAAAAb", "KAWWAAAAAa", ".aaaaaaaa."]]

# thinker: neutral figure, round glasses (ink lens + light glint), book beside; sunset = seated, chin on hand
THINKER_SIT = ["...BBBB.....",
               "..BBBBBB....",
               "..AABBBB....",
               ".cKAABB.....",
               "..AaaB......",
               "..AADDD.....",
               "..DiDDDDD...",
               "..DiDDDDDD..",
               "..DiDDDDDDD.",
               ".nnnnDDDDDn.",
               ".nnnnnnnnnn.",
               ".nn..nnnnn..",
               ".nn......aaa",
               ".KK......WWa"]
THINKER = [THINKER_SIT]

# night: lying on the hill, one arm behind the head, book on chest
THINKER_LIE = ["...........",
               "...cK.aWa.n",
               "A.BAADDDDnn",
               "AABBADDDnnn",
               "........KK."]
THINKER_NIGHT = [THINKER_LIE]

DOE1 = ["..............b..b..",
        "..............hbbh..",
        "..............hhhhh.",
        "..............hKhhhh",
        "..............hhhhhK",
        "..............hhhhh.",
        ".............hhhh...",
        "............hhhh....",
        "..hhhhhhhhhhhhh.....",
        ".hhhhhhhhhhhhhh.....",
        "Whhhhhhhhhhhhhh.....",
        "WhhhhhhhhhhhhBh.....",
        ".hhhhhhhhhhhBh......",
        "..cccchhhhcc........",
        "..hB.hB...hB.hB.....",
        "..hB.hB...hB.hB.....",
        "..B..B....B..B......",
        "..K..K....K..K......"]
DOE = [DOE1, tweak(DOE1, (14, 0, "."), (15, 0, "b"), (16, 0, "b"), (17, 0, "."), (0, 9, "W"), (0, 10, "h"), (1, 8, "W"))]

FAWN1 = ["..........b.b",
         "..........hhh",
         "..........hKh",
         "..........hhhK",
         ".........hhh..",
         ".hhhhhhhhhh...",
         "WhWhhWhhhhh...",
         "WhhhhhhhhBh...",
         ".chchhhhch....",
         ".hB.hB.hB.hB..",
         ".K..K..K..K..."]
FAWN1 = [r.ljust(14, ".") for r in FAWN1]
FAWN = [FAWN1, tweak(FAWN1, (10, 0, "."), (11, 0, "b"), (12, 0, "b"), (0, 6, "W"))]

# the night deer reuses the doe's shape in the moonlit colours
NIGHT_SWAP = dict(h="p", B="q", b="q", c="y", W="y", K="z")


def night(frames):
    return [[r.translate(str.maketrans(NIGHT_SWAP)) for r in f] for f in frames]


FOX1 = ["...........b..b",
        "..........AAAAA",
        "..........AKAAAA",
        "AAA.......AAAAAO",
        "AAAAAAAAAAAAAAK.",
        "WaAAAAAAAAAAAA..",
        ".aAAAAAAAAAAA...",
        "..A.A.....A.A...",
        "..K.K.....K.K..."]
FOX1 = [r.ljust(16, ".") for r in FOX1]
FOX = [FOX1, tweak(FOX1, (2, 7, "."), (3, 7, "A"), (3, 8, "."), (4, 8, "K"), (10, 7, "."), (11, 7, "A"), (11, 8, "."), (12, 8, "K"))]

SPRITES = dict(monarch=MONARCH, bat=BAT, firefly=FIREFLY, owl=OWL, robin=ROBIN, cardinal=CARDINAL, frog=FROG,
               toad=TOAD, rabbit=RABBIT, squirrel=SQUIRREL, dog=DOG, dog_asleep=DOG_ASLEEP, thinker=THINKER,
               thinker_night=THINKER_NIGHT, doe=DOE, fawn=FAWN, deer_night=night(DOE), fox=FOX)
for _n, _frames in SPRITES.items():
    _w = {len(r) for f in _frames for r in f}
    _h = {len(f) for f in _frames}
    assert len(_w) == 1 and len(_h) == 1, (_n, _w, _h)
