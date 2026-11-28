# Build and assembly

This is the assembly order as far as the project files show it. The prototype has been brought up on a bench in stages. Final assembly into a case is not recorded.

For software steps, use `hardware/bring-up.md`. It is complete and is not repeated here.

## Stage A: bench test of the bare board and screen

Source: `hardware/compatibility-findings.md` (bench checklist) and `hardware/bring-up.md`.

1. Solder the 2x20 male header onto the Orange Pi Zero 2W. Check polarity. With a multimeter, check there is no short between 5 V and ground.
2. Lay the screen HAT and the PiSugar against the board without power and check that holes and header line up. Measure the case inner height and the heatsink height. (No result is recorded.)
3. Power the board from its USB-C port. Flash the official Orange Pi Debian 12 (Bookworm) image to the microSD card and log in. Run `python3 --version`. It must print 3.11 or newer.
4. Enable SPI1: `sudo orangepi-config`, System, Hardware, tick `spi1-cs0-spidev`, save, reboot. Check `ls /dev/spidev1*`.
5. Plug in the screen HAT (pins in `wiring.md`).
6. Test the buttons first on a breadboard or stacking header if you want to prove the lines before the PCB. Wire each button between its line and ground. Check each press with `gpiomon`. (Steps in `hardware/bring-up.md`, step 6.)
7. Install the software and run the dry run and the live run (`hardware/bring-up.md`, steps 3 to 9).

## Stage B: the backbone button board

Source: `hardware/pcb/backbone-v1/wiring.md` and `build_board.py`.

1. Get the board made from `hardware/pcb/backbone-v1/out/backbone-v1-gerbers.zip`. The 1:1 paper print `out/paper-test-1to1.pdf` can be used to check the fit first. Ordering details: `TODO (owner)` (board options such as finish and colour are not recorded).
2. Solder the seven switches (6 mm tactile) into the places marked UP, DOWN, LEFT, RIGHT, OK, BACK and HOME on the silkscreen. Solder order: `TODO (owner)`.
3. Trim the switch legs flush under the board.
4. Slide the board over the Orange Pi header pins. It rests on the black plastic of the header.
5. Solder from the top. Keep the joints small so the screen still seats.
6. Solder at least three of the ground pins (30, 34, 39 are next to the button pins). The seven button pins must be soldered too (7, 13, 15, 16, 32, 38, 40).
7. Put an insulating sheet between the board and the battery.
8. Screw through the two corner holes on the Orange Pi side (5 mm holes for screw heads) and the two M3 holes at the bottom edge, as needed. Screw details: `TODO (owner)`.
9. Orientation: with the header edge toward the buttons, the screen picture is upside down compared with the earlier prototype. Set `rotate` in `device.json` (see `wiring.md`).
10. Check each button with `gpiomon`. Compare against the table in `wiring.md`.

## Stage C: power, heatsink and case

Source: `hardware/form-factor.md`.

- Stick the flat copper heatsink on the processor and keep it away from the battery.
- The 1,800 mAh flat battery sits beside the board block, under the wheel.
- The PiSugar 3 attaches to the underside of the Orange Pi by pogo pins (reported). It has not been tried on this board.

Everything about the case is unwritten. There is no enclosure CAD.

## Final bench checklist

Taken from `hardware/bring-up.md`.

- [ ] `/dev/spidev1.0` exists after enabling the overlay
- [ ] Each button shows an event in `gpiomon`
- [ ] Dry run saves frames and the last one is Home
- [ ] Live run shows the boot animation and Home
- [ ] One press moves one step; holding Select goes Back once
- [ ] Menu, Power off, OK: the screen goes to the off picture and the program exits
- [ ] `systemctl enable --now spiral` survives a reboot

## TODO

- TODO (owner): how the screen HAT and the backbone board stack on the one header (which sits above which, and how the HAT clears the switches). The button doc only says the screen "still seats".
- TODO (owner): where the PiSugar 3 and battery go relative to the backbone board, and the final stack height.
- TODO (owner): the soldering order and any jig for the switches.
- TODO (owner): the board order options (finish, colour, quantity).
- TODO (owner): the case and final closing steps.
- TODO (owner): battery life test result (not measured yet).
