# Spiral OS

Python OS for the Spiral Node (250x122 1-bit screen, five buttons). Python 3.11+, Pillow 10.1+ only.

## Install and test

    python -m venv .venv && . .venv/bin/activate
    pip install "Pillow>=10.1" pytest
    python -m pytest -q

Run everything from this folder (`os/`).

## Headless screenshot

    python -m spiral --snapshot out.png            # boots to Home, saves a 250x122 PNG
    python -m spiral --data-dir /tmp/sd --snapshot out.png

The interactive simulator is the browser one (website). It runs this same code through Pyodide via `spiral/web.py`.

## Keys

Up, Down, Left, Right, Select, plus a Back button and a Home button (Home jumps to the Home screen from anywhere). Holding Select for 0.6 s still works as a fallback Back.

## Data folder

State lives in JSON files in the data folder (default `sim-data/` here, `/data` on the device and in the browser): settings, active script and history, shown logs, welcome position, `logs/spiral.log`, and your own scripts in `scripts/<id>/`. Delete it for a factory reset.

## Writing scripts

See [Write a script](../CONTRIBUTING.md#write-a-script) and the working example in [`../scripts/TEMPLATE`](../scripts/TEMPLATE).
