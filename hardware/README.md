# Hardware

**Prototype in progress. Parts are being tested; nothing here is final.**

## Prototype parts

| Part | Description |
| :--- | :--- |
| Orange Pi Zero 2W | Main processing board |
| E-paper display | 2.13 inch, 250x122 pixels, black and white |
| PiSugar 3 | Power management board |
| Buttons | Seven inputs: five (up, down, left, right, select) that become one spiral wheel, plus Back and Home |
| LiPo battery | 1,800 mAh flat cell |
| Heatsink | Flat stick-on copper |

## Status
* Battery life is not measured yet.
* The LX-LBC3.1 module and exact battery cell are still to be measured.
* There is no enclosure CAD yet.

## Build it
* [build-docs/](build-docs/README.md): parts list with quantities, pin-by-pin wiring, build stages.
* [pcb/backbone-v1/](pcb/backbone-v1/): the button backbone board. KiCad files, the script that draws it, factory files and a 1:1 paper test print.
* [bring-up.md](bring-up.md): set up the board step by step.
* [compatibility-findings.md](compatibility-findings.md): research notes on how the parts fit together, with sources.

## Form factor
See [form-factor.md](form-factor.md) for design details.

## Licence
This hardware design is licensed under CERN-OHL-S-2.0. See [../LICENSES/CERN-OHL-S-2.0.txt](../LICENSES/CERN-OHL-S-2.0.txt).
