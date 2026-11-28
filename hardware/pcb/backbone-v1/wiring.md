# Backbone v1 wiring

Each button connects its header pin to ground when pressed. The software turns on
the Orange Pi's internal pull-up, so pressed reads 0. No other parts.

| Button | Header pin | Orange Pi pin name | Linux line | Checked on the device |
|---|---|---|---|---|
| up | 7 | PI13 | 269 | yes, 2026-11-25 |
| select (OK) | 13 | PH3 | 227 | yes, 2026-11-25 |
| left | 15 | PI5 | 261 | yes, 2026-11-25 |
| down | 16 | PI14 | 270 | yes, 2026-11-25 |
| home | 32 | PI11 | 267 | yes, 2026-11-25 |
| right | 38 | PI4 | 260 | yes, 2026-11-25 |
| back | 40 | PI3 | 259 | yes, 2026-11-25 |

Ground: header pins 6, 9, 14, 20, 25, 30, 34, 39 all join the ground fill.
Solder at least three of them (30, 34, 39 are next to the button pins).

Confirmed against `gpio readall` on the owner's Orange Pi Zero 2W (2026-11-25): all seven
pins are in mode OFF (free) and the line numbers match. Pins 13 and 15 double as UART5
and UART2 lines, so keep those two overlays off (the screen already needs that).

Line number rule on the H618: PH = 224 + n, PI = 256 + n.

## Build notes

- The board slides over the Orange Pi's header pins and rests on the black plastic.
  Solder from the top, and keep the joints small so the screen still seats.
- Trim the switch legs flush under the board and put an insulating sheet between
  the board and the battery. A leg pressed into a LiPo pouch is a fire risk.
- With the header edge toward the buttons the screen picture is upside down
  compared with today. Flip it with the `rotate` setting in `device.json`.
