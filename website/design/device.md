# Virtual Spiral Node: device brief

Source: the founder's layout for the pager (2026-11-17). The exact numbers live in `public/art/device.json` and `art/device-layout.json` (percentages of the device image), both written by `art/make_art.py`.

## Shape

- A landscape river-stone body, about 95 x 62 x 20 mm, drawn 400x264 art px (1 art px = 1 screen px). Sealed: no antenna, IR window, pin header, visible screws or bulges.
- E-ink screen across the top, 250x122 exactly, at (75, 28), inside a paper page margin (28 px at the sides, 12 px above and below).
- Bottom right: a subtle round spiral wheel (2-3 loops) with a thin copper ring, centred at (322, 212), radius 36. The select centre has radius 8.
- Bottom left: a small copper spiral logo, then flat Back (84, 200) and Home (132, 200) keys, each 40x24, with an engraved left arrow and house.
- Left side face (84x264, drawn face-on): the USB-C port, the charge light and the power button near the top. Nothing else.
- Prototype design, may change.

## Wheel mapping (5 wheel inputs, plus Back and Home keys)

- Up, down, left, right: the four edge segments of the wheel (quarters around 12, 6, 9 and 3 o'clock).
- Select: the round centre (spiral logo engraved).
- Back and Home are their own keys (Back goes back, Home goes to the Home screen). Long press of select (≥ 0.6 s) stays as a Back fallback.
- Press state: the pressed part shifts 1 art px down and darkens one step; no bounce ("hard and intentional").

## Colourways

Olive (default), brown and black, from the palette in `DESIGN.md`. The screen bezel is always `ink`.

## Screen

- Shows the real 250x122 1-bit frame, paper `#f4ecd8` for white and ink `#1d1a16` for black, with a very subtle paper texture (CSS, no image request).
- Hero (on `/`): a static real frame from the OS (a fun fact and question page), rendered by the OS's own code at build time. "Try it right here" swaps in the live OS.
- `/try`: the live frame from the worker.

## Phone layout

The pager is landscape, so phones show the same shape, scaled down to fit. Under 600 px the hero device is about 300 px wide, and "Try it right here" opens `/try` instead. This is a website layout, not a hardware claim.
