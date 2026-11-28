# Wiring

All numbers below were cross-checked between these sources:

- `hardware/pcb/backbone-v1/wiring.md` (button wiring doc)
- `hardware/pcb/backbone-v1/build_board.py` (the script that makes the board)
- `hardware/pcb/backbone-v1/backbone.kicad_pcb` (the finished board file; the header pad nets were read from it)
- `os/spiral/device/config.py` and `os/deploy/device.example.json` (software pin settings)
- `hardware/bring-up.md` and `hardware/compatibility-findings.md` (screen pins)

Pin numbers are positions on the Orange Pi 40-pin header. "Line" is the Linux GPIO number that the software uses. Rule for the H618 chip: PH n = 224 + n, PI n = 256 + n. Every line below follows that rule.

## Screen (e-paper HAT plugs straight onto the header)

| Signal | Header pin | Orange Pi pin | Line | Notes |
|---|---|---|---|---|
| 3.3 V | 1 | | | Power |
| Ground | 6 (or 9, 14, 20, 25) | | | |
| MOSI (DIN) | 19 | PH7, SPI1 | 231 | Needs the SPI1 overlay `spi1-cs0-spidev` |
| CLK | 23 | PH6, SPI1 | 230 | |
| CS | 24 | PH5, SPI1 CS0 | 229 | |
| DC | 22 | PI6 | 262 | In software defaults as `dc` |
| RST | 11 | PH2 | 226 | In software defaults as `rst` |
| BUSY | 18 | PH4 | 228 | In software defaults as `busy` |

Software defaults (`config.py`): SPI bus 1, device 0, 4 MHz, chip `gpiochip0`, RST 226, DC 262, BUSY 228. They match the table.

Keep the `i2c0` and UART2 / UART5 overlays off, or those drivers take pins 22 and 11.

## Buttons (backbone PCB v1)

Each button joins its header pin to ground when pressed. The software turns on the internal pull-up, so a press reads 0. There are no other parts on the board.

| Button | Header pin | Orange Pi pin | Line | Net name on PCB |
|---|---|---|---|---|
| Up | 7 | PI13 | 269 | BTN_UP |
| Select (OK) | 13 | PH3 | 227 | BTN_SELECT |
| Left | 15 | PI5 | 261 | BTN_LEFT |
| Down | 16 | PI14 | 270 | BTN_DOWN |
| Home | 32 | PI11 | 267 | BTN_HOME |
| Right | 38 | PI4 | 260 | BTN_RIGHT |
| Back | 40 | PI3 | 259 | BTN_BACK |

The button doc records all seven lines as checked on a real board. Pins 13 and 15 double as UART lines, so keep those overlays off (the screen needs that anyway).

### Switch pads

Each switch is the 6 mm tactile type with four legs. On the board, the top pair of legs (pad 1) carries the button signal and the bottom pair (pad 2) goes to ground. Both signal legs are joined with a short track on the back.

### Ground

Header pins 6, 9, 14, 20, 25, 30, 34 and 39 are ground and join the ground fill on the back of the board. Solder at least three. Pins 30, 34 and 39 are next to the button pins.

### Pins the board never uses

The script refuses any button on pins 1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 17, 18, 19, 21, 22, 23, 24, 26, 27 or 28. These are the power, I2C, UART and SPI pins and the screen pins.

## Software side

The program reads line numbers from `device.json` (example in `os/deploy/device.example.json`). Rules checked at start: up, down, left, right and select must be set; back and home may be left `null`; no two buttons on one line; no button on a screen line (RST, DC, BUSY). Because of those rules, the table above can be copied straight into the `buttons` block:

| `device.json` key | Line |
|---|---|
| up | 269 |
| down | 270 |
| left | 261 |
| right | 260 |
| select | 227 |
| back | 259 |
| home | 267 |

(The example file in the repo has all of these set to `null`. See the mismatch list.)

## Cross-check result

Agree in all sources (button wiring doc, build script, finished board file): the seven button-to-pin assignments, the eight ground pins, and the net on each header pad. Screen pins agree between the findings file, the bring-up guide and the software defaults.

## Mismatches found

1. **Five buttons or seven.** `hardware/bring-up.md`, `os/README.md` and the comment in `os/spiral/device/config.py` say v1 has five buttons and that Back and Home have no pins. The board design and button wiring doc have seven buttons, with fixed pins for Back (40) and Home (32). `hardware/README.md` already lists seven.
2. **Button lines not in the example config.** `os/deploy/device.example.json` has all seven button lines set to `null`. `bring-up.md` tells the builder to "pick five free lines", but the board fixes them to the lines in the table above.
3. **Battery.** `hardware/README.md` lists both a PiSugar 3 and a separate 1,800 mAh LiPo. `hardware/compatibility-findings.md` and the project knowledge file describe the PiSugar 3 as carrying a roughly 1,200 mAh battery of its own. Which battery is used, and how the two relate, is not stated.
4. **Heatsink.** The research and knowledge files name a "copper heatsink case". `hardware/README.md` and `hardware/form-factor.md` say a case will not fit and use a flat stick-on heatsink.
5. **Unused forbidden pins.** The build script forbids pins 12, 27 and 28 for buttons. The findings file notes pin 12 is probably an unused screen power line. No file records why 27 and 28 are forbidden.
6. **UART names.** The button wiring doc says pins 13 and 15 double as UART5 and UART2 lines. The findings file lists UART5 on pin 11 and UART2 on pin 22 and does not mention pins 13 or 15. The findings file's pin table was not extended to the button pins.
7. **Screen rotation.** `device.example.json` has `rotate` 90. `bring-up.md` says use 270 if the picture is upside down. The button wiring doc says that with the backbone's header orientation the picture is upside down compared with the earlier prototype and to flip it with `rotate`. It does not say which value the backbone needs.
8. **Not wired at all.** The PiSugar 3 power and I2C connection to the Orange Pi is not described in the board files. The findings file says its contacts may not line up with the Orange Pi (unverified).

## TODO

- TODO (owner): the `rotate` value (90 or 270) that is right with the backbone board.
- TODO (owner): how the PiSugar 3 connects to the Orange Pi (pogo pins or wires) and which pins it uses.
- TODO (owner): whether the e-paper HAT plugs into the same header pins as the backbone, and in which order they stack (see build.md).
- TODO (owner): a corrected `device.example.json` with the seven button lines, or a statement that it should stay `null`.
