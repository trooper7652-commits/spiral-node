"""Build the Spiral Node backbone PCB v1 with KiCad's own Python.

Run:  <KiCad>\\bin\\python.exe build_board.py <KiCad footprints dir> <output .kicad_pcb>

View is the device face: screen at the top, buttons below. x to the right, y down, mm.
The Orange Pi (65 x 30) occupies y 0..30 with its 40-pin header along y ~26.5.
"""
import sys

import pcbnew
from pcbnew import FromMM, ToMM, VECTOR2I

FP_DIR, OUT = sys.argv[1], sys.argv[2]

# ---- dimensions (mm) ----
BOARD_X0, BOARD_X1 = 0.0, 65.0
BOARD_Y0, BOARD_Y1 = 23.0, 61.0          # strip under the HAT starts at 23; plate ends at 61
PITCH = 2.54
PIN1 = (56.63, 25.23)                    # Pi Zero pattern: header centred, 3.5 mm from the edge
PIN_INNER_Y, PIN_OUTER_Y = 25.23, 27.77  # odd pins inner row, even pins on the board edge
OPI_HOLES = [(3.5, 26.5), (61.5, 26.5)]  # 5 mm clearance: the standoff screw heads poke through
CASE_HOLES = [(3.5, 57.5), (61.5, 57.5)]
OPI_HOLE_D = 5.0
TRACK = 0.3
SW_DX, SW_DY = 6.5, 4.5                  # switch pad spacing; pads "1" are the top pair
WHEEL_PITCH = 9.5

# ---- wiring: button -> header pin. Screen, I2C, serial and SPI pins are forbidden. ----
BUTTON_PIN = {"up": 7, "select": 13, "left": 15, "down": 16,
              "home": 32, "right": 38, "back": 40}
FORBIDDEN = {1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 17, 18, 19, 21, 22, 23, 24, 26, 27, 28}
GND_PINS = {6, 9, 14, 20, 25, 30, 34, 39}
assert len(set(BUTTON_PIN.values())) == 7, "two buttons share a pin"
assert not set(BUTTON_PIN.values()) & (FORBIDDEN | GND_PINS), "button on a forbidden pin"


def pin_xy(n):
    k = (n - 1) // 2
    return (PIN1[0] - PITCH * k, PIN_INNER_Y if n % 2 else PIN_OUTER_Y)


# Switch centres. Columns are lined up with header pins so most traces are straight.
WHEEL_CX = pin_xy(BUTTON_PIN["up"])[0] + PITCH / 2 - SW_DX / 2
WHEEL_CY = 46.0
CENTRE = {
    "up": (WHEEL_CX, WHEEL_CY - WHEEL_PITCH),
    "down": (WHEEL_CX, WHEEL_CY + WHEEL_PITCH),
    "left": (WHEEL_CX - WHEEL_PITCH, WHEEL_CY),
    "right": (WHEEL_CX + WHEEL_PITCH, WHEEL_CY),
    "select": (WHEEL_CX, WHEEL_CY),
    "back": (pin_xy(BUTTON_PIN["back"])[0] + SW_DX / 2, WHEEL_CY),
    "home": (pin_xy(BUTTON_PIN["home"])[0] + SW_DX / 2, WHEEL_CY),
}
LABEL = {"up": "UP", "down": "DOWN", "left": "LEFT", "right": "RIGHT",
         "select": "OK", "back": "BACK", "home": "HOME"}

board = pcbnew.BOARD()
P = lambda x, y: VECTOR2I(FromMM(x), FromMM(y))


def near(pad, xy, tol=0.02):
    p = pad.GetPosition()
    return abs(ToMM(p.x) - xy[0]) < tol and abs(ToMM(p.y) - xy[1]) < tol


def add_net(name):
    net = pcbnew.NETINFO_ITEM(board, name)
    board.Add(net)
    return net


def place(lib, name, ref, xy, angle=0):
    fp = pcbnew.FootprintLoad(f"{FP_DIR}/{lib}.pretty", name)
    assert fp, f"footprint {lib}:{name} not found"
    fp.SetReference(ref)
    fp.Reference().SetVisible(False)
    fp.Value().SetVisible(False)
    fp.SetOrientationDegrees(angle)
    fp.SetPosition(P(*xy))
    board.Add(fp)
    return fp


def track(net, layer, pts):
    for a, b in zip(pts, pts[1:]):
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(P(*a)); t.SetEnd(P(*b))
        t.SetWidth(FromMM(TRACK)); t.SetLayer(layer); t.SetNet(net)
        board.Add(t)


def text(s, xy, size=1.0, layer=pcbnew.F_SilkS):
    t = pcbnew.PCB_TEXT(board)
    t.SetText(s); t.SetPosition(P(*xy)); t.SetLayer(layer)
    t.SetTextSize(VECTOR2I(FromMM(size), FromMM(size)))
    t.SetTextThickness(FromMM(size * 0.15))
    board.Add(t)


# ---- outline ----
corners = [(BOARD_X0, BOARD_Y0), (BOARD_X1, BOARD_Y0), (BOARD_X1, BOARD_Y1), (BOARD_X0, BOARD_Y1)]
for a, b in zip(corners, corners[1:] + corners[:1]):
    s = pcbnew.PCB_SHAPE(board)
    s.SetShape(pcbnew.SHAPE_T_SEGMENT)
    s.SetStart(P(*a)); s.SetEnd(P(*b))
    s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(FromMM(0.1))
    board.Add(s)

# ---- nets ----
GND = add_net("GND")
NET = {b: add_net("BTN_" + b.upper()) for b in BUTTON_PIN}

# ---- header: find the rotation that puts pin 1 right and pin 40 left on the outer row ----
for angle in (0, 90, 180, 270):
    hdr = place("Connector_PinHeader_2.54mm", "PinHeader_2x20_P2.54mm_Vertical", "J1", PIN1, angle)
    pads = {int(p.GetNumber()): p for p in hdr.Pads()}
    if near(pads[40], pin_xy(40)) and near(pads[2], pin_xy(2)):
        break
    board.Remove(hdr)
else:
    raise SystemExit("no header rotation matches the expected pin layout")
for n, pad in pads.items():
    assert near(pad, pin_xy(n)), f"header pin {n} is not where the script expects"
    if n in GND_PINS:
        pad.SetNet(GND)
pin_of = {v: k for k, v in BUTTON_PIN.items()}
for n, b in pin_of.items():
    pads[n].SetNet(NET[b])

# ---- switches: pads "1" (top pair) carry the signal, pads "2" go to ground ----
SIG = {}  # button -> [(x, y) left pad, (x, y) right pad]
for i, (b, (cx, cy)) in enumerate(CENTRE.items(), 1):
    sw = place("Button_Switch_THT", "SW_PUSH_6mm_H5mm", f"SW{i}", (cx - SW_DX / 2, cy - SW_DY / 2))
    sig = sorted((ToMM(p.GetPosition().x), ToMM(p.GetPosition().y))
                 for p in sw.Pads() if p.GetNumber() == "1")
    assert len(sig) == 2 and abs(sig[1][0] - sig[0][0] - SW_DX) < 0.02, f"{b}: unexpected switch pads"
    for p in sw.Pads():
        p.SetNet(NET[b] if p.GetNumber() == "1" else GND)
    SIG[b] = sig
    track(NET[b], pcbnew.B_Cu, sig)  # join the two signal legs
    text(LABEL[b], (cx, cy + 4.6) if b != "down" else (cx + 7.5, cy), 0.9)

# ---- mounting holes ----
for cx, cy in OPI_HOLES:  # plain cut-outs: a hole footprint's washer area would overlap the header
    s = pcbnew.PCB_SHAPE(board)
    s.SetShape(pcbnew.SHAPE_T_CIRCLE)
    s.SetCenter(P(cx, cy)); s.SetEnd(P(cx + OPI_HOLE_D / 2, cy))
    s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(FromMM(0.1))
    board.Add(s)
for i, xy in enumerate(CASE_HOLES, 1):
    place("MountingHole", "MountingHole_3.2mm_M3", f"H{i}", xy)

# ---- traces. Front layer except RIGHT, which runs along the back to cross the others. ----
F, B = pcbnew.F_Cu, pcbnew.B_Cu
hp = {b: pin_xy(n) for b, n in BUTTON_PIN.items()}
half = PITCH / 2
jog_y = (PIN_INNER_Y + PIN_OUTER_Y) / 2

x, y = hp["up"]       # inner pin: slip between two outer pins, then straight down
track(NET["up"], F, [(x, y), (x + half, jog_y), SIG["up"][1]])

x, y = hp["select"]
track(NET["select"], F, [(x, y), (x + half, jog_y), (x + half, 31.0), (WHEEL_CX, 31.0),
                         (WHEEL_CX, SIG["select"][1][1]), SIG["select"][1]])

x, y = hp["left"]
track(NET["left"], F, [(x, y), (x - half, jog_y), (x - half, SIG["left"][0][1]), SIG["left"][0]])

x, y = hp["down"]     # outer pin: straight down between LEFT's legs, then across under OK
dx, dy = SIG["down"][0]
track(NET["down"], F, [(x, y), (x, dy - 2.5), (dx, dy - 2.5), (dx, dy)])

track(NET["back"], F, [hp["back"], SIG["back"][0]])
track(NET["home"], F, [hp["home"], SIG["home"][0]])

x, y = hp["right"]
rx, ry = SIG["right"][0]
track(NET["right"], B, [(x, y), (x, 32.0), (rx, 32.0), (rx, ry)])

# ---- ground fill, back layer only (front fill would be cut into islands by the traces) ----
for layer in (B,):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer); z.SetNet(GND)
    o = z.Outline(); o.NewOutline()
    for cx, cy in corners:
        o.Append(FromMM(cx), FromMM(cy))
    board.Add(z)
# Zones are filled afterwards by `kicad-cli pcb drc --refill-zones --save-board`:
# ZONE_FILLER crashes when run outside the KiCad window (KiCad 10.0.4).

# ---- labels ----
text("Spiral Node backbone v1", (22, 58.5), 1.2)
text("CERN-OHL-S-2.0", (22, 60.2), 0.8)
text("1", (pin_xy(2)[0] + 2.2, PIN_OUTER_Y), 1.0)
text("40", (pin_xy(40)[0], PIN_OUTER_Y + 3.0), 0.8)

# ---- self-check on the finished board ----
for b, n in BUTTON_PIN.items():
    assert pads[n].GetNetname() == "BTN_" + b.upper()
used = {n for n, p in pads.items() if p.GetNetname()}
assert used == set(BUTTON_PIN.values()) | GND_PINS, "unexpected net on a header pin"

pcbnew.SaveBoard(OUT, board)
print("saved", OUT)
for b, n in sorted(BUTTON_PIN.items(), key=lambda kv: kv[1]):
    print(f"  pin {n:2d} -> {b}")
