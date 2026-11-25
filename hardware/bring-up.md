# Bring-up guide: Spiral OS on the Orange Pi Zero 2W

This is a bench guide for a prototype. The code in `os/spiral/device/` has been tested against a fake screen and fake buttons only. The e-paper port and the button pins are untested on a real board until you run these steps, so expect to adjust things and please tell us what you find.

You need: an Orange Pi Zero 2W with the 40-pin header soldered, the Waveshare 2.13" V4 e-paper HAT, five buttons wired to ground, and a way to log in (keyboard and screen, or SSH).

Screen wiring on the 40-pin header (the HAT plugs straight in): SPI1 on pins 19 (MOSI), 23 (CLK) and 24 (CS0); RST on pin 11 (line 226), DC on pin 22 (line 262), BUSY on pin 18 (line 228). Power is 3.3 V and ground.

## Steps

1. **Flash the official Orange Pi Debian 12 (Bookworm) image** for the Zero 2W and log in. Armbian users have reported trouble enabling SPI1, so start with the official image. Right after login, run `python3 --version`: it must print 3.11 or newer (Spiral OS needs it). If it is older, use a newer image.

2. **Enable SPI1.** Run `sudo orangepi-config`, go to System, then Hardware, tick `spi1-cs0-spidev`, save and reboot. Then check that `/dev/spidev1.0` exists:

   ```
   ls /dev/spidev1*
   ```

   Keep the `i2c0` and UART2/UART5 overlays off, or pins 22 and 11 may be taken by those drivers.

3. **Install the packages.**

   ```
   sudo apt install gpiod python3-libgpiod python3-spidev python3-venv
   ```

4. **Make a virtual environment with Pillow 10.1 or newer.** Debian's own Pillow is too old, so install it with pip:

   ```
   sudo mkdir -p /opt/spiral
   sudo python3 -m venv --system-site-packages /opt/spiral/venv
   sudo /opt/spiral/venv/bin/pip install "Pillow>=10.1"
   ```

   `--system-site-packages` lets the venv see the apt-installed `gpiod` and `spidev`.

5. **Copy the `os/` folder** from this repository to `/opt/spiral/os`, and create the folders for the settings and saves:

   ```
   sudo cp -r os /opt/spiral/os
   sudo mkdir -p /etc/spiral /var/lib/spiral
   sudo cp /opt/spiral/os/deploy/device.example.json /etc/spiral/device.json
   ```

6. **Find your button lines.** List the lines and look at their names:

   ```
   gpiodetect
   gpioinfo
   ```

   The screen lines are 226 (RST), 262 (DC) and 228 (BUSY); the names may differ on the vendor kernel, so if `gpioinfo` shows other numbers for PH2, PI6 and PH4, put those into `device.json`. Pick five free lines for the buttons, wire each button between its line and ground (the software turns on the pull-up), then watch each line while you press its button:

   ```
   sudo gpiomon --bias=pull-up --num-events=2 --falling-edge gpiochip0 <line>
   ```

   `--bias=pull-up` holds the line high while nothing is pressed, as Spiral OS does. A press should print an event. Do this for each button. If you test with a stacking header and a breadboard first, that is fine; the HAT covers the header otherwise. Choose lines that are not 226, 262 or 228 and not part of SPI1 (pins 19, 21, 23, 24 and 26).

7. **Edit `/etc/spiral/device.json`.** Replace the `null` values under `buttons` with your line numbers. `up`, `down`, `left`, `right` and `select` are needed. `back` and `home` may stay `null`: holding Select gives Back. The program checks this file before it touches any pin and tells you what is wrong, for example a missing button, two buttons on one line, or a button on a screen pin.

8. **Try a dry run.** This uses a pretend screen and pretend buttons, saves each frame as a PNG, and needs no hardware:

   ```
   cd /opt/spiral/os
   /opt/spiral/venv/bin/python -m spiral.device --config /etc/spiral/device.json --dry-run /tmp/frames --seconds 10
   ```

   The dry run keeps its saves in `/tmp/frames/data`, so it never touches `/var/lib/spiral`. Look at the pictures in `/tmp/frames`. The last one should be the Home screen.

9. **Run it for real.**

   ```
   cd /opt/spiral/os
   sudo /opt/spiral/venv/bin/python -m spiral.device --config /etc/spiral/device.json
   ```

   You should see the boot animation and then Home. Press Select to open the menu. If the screen does not answer within 10 seconds the program prints `spiral: screen not responding`, then exits; check the cable, the HAT seating and the BUSY line.

   If the picture is upside down, set `"rotate": 270` in `device.json` and run again.

10. **Install the service** so it starts at boot:

    ```
    sudo cp /opt/spiral/os/deploy/spiral.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable --now spiral
    ```

    Watch it with `journalctl -u spiral -f`. The service runs as root for the bench; a later version should use a normal user in the spi and gpio groups. It restarts after 2 seconds if the screen stops answering. A bad `device.json` stops it instead (exit 2): fix the file, then run `sudo systemctl restart spiral`.

## Not done yet

- The battery shows 100% always. The PiSugar 3 has not been tried on this board, and no battery reading is wired in.
- Physical fit (header height, case, battery) is unmeasured.
- Back and Home buttons have no pins in v1.

## Bench checklist

- [ ] `/dev/spidev1.0` exists after enabling the overlay
- [ ] Each of the five buttons shows an event in `gpiomon`
- [ ] Dry run saves frames and the last one is Home
- [ ] Live run shows the boot animation and Home
- [ ] One press moves one step; holding Select goes Back once
- [ ] Menu, Power off, OK: the screen goes to the off picture and the program exits
- [ ] `systemctl enable --now spiral` survives a reboot

Write down the final line for each button and any change you had to make, so the next person can skip the guessing.
