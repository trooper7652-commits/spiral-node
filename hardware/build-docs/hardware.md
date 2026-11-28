# Hardware: parts and tools

Prototype. The parts list comes from the project files. Where a file does not say, the table says `TODO (owner)`.

A short parts table already exists in `hardware/README.md`. This file adds quantities, the button board parts and the tools.

## Parts

| Part | Qty | What it does | Where this is recorded |
|---|---|---|---|
| Orange Pi Zero 2W (Allwinner H618, 1.5 GB RAM, 65 x 30 x 1.2 mm) | 1 | Main computer. Runs Spiral OS. | `hardware/README.md`, `hardware/compatibility-findings.md` |
| 2x20 male pin header, 2.54 mm pitch | 1 | The 40-pin header is not soldered at the factory. It carries the screen and the button board. | `hardware/compatibility-findings.md` (section 1), `hardware/pcb/backbone-v1/build_board.py` (footprint `PinHeader_2x20_P2.54mm_Vertical`) |
| Waveshare 2.13 inch e-Paper HAT, V4 (250 x 122, black and white, SSD1680 controller, 65 x 30.2 mm) | 1 | The screen. Plugs onto the 40-pin header. | `hardware/bring-up.md`, `hardware/compatibility-findings.md` |
| Backbone PCB v1 (65 x 38 mm, 1.6 mm thick, 2 copper layers) | 1 | Holds the seven buttons and joins each one to a header pin and to ground. Design is in KiCad. | `hardware/pcb/backbone-v1/` |
| Tactile push switch, 6 mm, 5 mm tall, through-hole (KiCad footprint `SW_PUSH_6mm_H5mm`) | 7 | Up, down, left, right, select (OK), back, home. | `hardware/pcb/backbone-v1/build_board.py` |
| PiSugar 3 power board | 1 | Battery power management. Not proven on this board. Battery level is not read yet (the software shows 100 percent). | `hardware/README.md`, `hardware/bring-up.md` ("Not done yet") |
| LiPo battery, flat cell, 1,800 mAh | 1 | Power. The exact cell is not measured or chosen. | `hardware/README.md`, `hardware/form-factor.md` |
| Flat stick-on copper heatsink | 1 | Cools the processor. Must stay away from the battery. | `hardware/README.md`, `hardware/form-factor.md` |
| M3 screws or standoffs for the two board mounting holes (3.2 mm holes at the bottom corners of the PCB) | 2 | Fix the board to a case. | `hardware/pcb/backbone-v1/build_board.py`. Size and length: `TODO (owner)` |
| Standoff screws for the two Orange Pi holes (the PCB has 5 mm clearance holes so the screw heads poke through) | 2 | Hold the board stack. | `hardware/pcb/backbone-v1/build_board.py`. Type and length: `TODO (owner)` |
| Insulating sheet | 1 | Goes between the PCB and the battery so a switch leg cannot press into the cell. | `hardware/pcb/backbone-v1/wiring.md`. Material: `TODO (owner)` |
| microSD card | 1 | Holds the operating system image. | Implied by the Orange Pi image flashing step in `hardware/bring-up.md`. Size: `TODO (owner)` |
| USB-C power supply and cable, 5 V, 2 A (3 A also fine) | 1 | Power for bench work. | `hardware/compatibility-findings.md` (section 4) |
| Enclosure | 1 | None yet. There is no case design. | `hardware/README.md` |

Parts for the finished product, such as two USB-C ports, a charge light and a power button, are planned only. See `hardware/form-factor.md`.

### Specific part numbers

Switch manufacturer part number, header part number, battery model, screw sizes: `TODO (owner)`.

## Tools

| Tool | Why | Where this is recorded |
|---|---|---|
| Soldering iron and solder | Solder the header and the switches. Joints on the board must be small so the screen still seats. | `hardware/pcb/backbone-v1/wiring.md`, `hardware/compatibility-findings.md` |
| Multimeter | Check for a short between 5 V and ground before first power on. | `hardware/compatibility-findings.md` (bench checklist) |
| A way to trim the switch legs flush under the board | Legs must not touch the battery. | `hardware/pcb/backbone-v1/wiring.md`. Tool type: `TODO (owner)` |
| Keyboard and screen, or an SSH connection | Log in to the Orange Pi. | `hardware/bring-up.md` |
| Computer with Python 3.11 or newer | Run the tests and the simulator. | `os/README.md` |
| KiCad (version 10.0.4 was used) | Only to change the board design or rebuild it. | `hardware/pcb/backbone-v1/build_board.py` |
| USB power meter (optional) | Measure battery draw. | `hardware/compatibility-findings.md` (bench checklist) |

## Board files

| File | What it is |
|---|---|
| `hardware/pcb/backbone-v1/build_board.py` | Script that builds the board in KiCad's own Python. |
| `hardware/pcb/backbone-v1/backbone.kicad_pcb`, `.kicad_pro` | KiCad board and project files. |
| `hardware/pcb/backbone-v1/out/backbone-v1-gerbers.zip` and `out/gerbers/` | Factory files for the board. |
| `hardware/pcb/backbone-v1/out/paper-test-1to1.pdf` | A 1:1 print for a fit check on paper. |
| `hardware/pcb/backbone-v1/out/drc.rpt` | Design check report: 0 violations, 0 unconnected pads. |

Licence: hardware design is CERN-OHL-S-2.0 (`LICENSES/README.md`).
