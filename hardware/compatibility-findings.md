# Spiral Node handheld: parts compatibility findings

Date: 2026-11-10. Board: Orange Pi Zero 2W (H618, 1.5 GB). Parts: copper-heatsink case, Waveshare-style 2.13" e-Paper HAT (250x122), PiSugar 3.

Confidence tags: **CONFIRMED** = official manual/datasheet/vendor source or source code. **REPORTED** = forum/community/retailer text. **UNVERIFIED** = inference or not found; do not rely on it.

## Summary verdict

- **E-paper HAT: works electrically, needs a small software port.** The Orange Pi 40-pin header has the same physical pin positions for every signal the HAT uses (SPI1 on pins 19/21/23/24 and GPIOs on 11/18/22). Waveshare's Python library is hard-wired to Raspberry Pi (gpiozero, spidev bus 0), so you must swap in an OPi-friendly `epdconfig.py`. SPI1 is off by default and must be enabled with a device-tree overlay.
- **PiSugar 3: the biggest risk.** Nothing in any source says it works with a non-Raspberry-Pi board. It attaches by pogo pins to pads on the underside of a Pi Zero; whether those land on the right pads of the Orange Pi is unknown. Fallback: wire 5V/GND (and optional SDA/SCL) by hand to the header pins.
- **Physical stack is unproven.** Board size matches the Pi Zero (65 x 30 mm) but hole/header positions, header pin height and heatsink-case clearance under a HAT are not documented. Measure on arrival.
- **Blockers:** (1) header is not soldered by default; (2) PiSugar pad alignment; (3) case height vs HAT; (4) a metal/copper case may hurt Wi-Fi.

## 1. Orange Pi Zero 2W header and e-paper wiring

**Raspberry Pi compatible? Mostly yes, for the pins we need.** The official manual calls it a 40-pin interface (28 GPIO, all 3.3 V logic) and lists 3.3 V on pins 1/17, 5 V on pins 2/4, GND on 6/9/14/20/25/30/34/39 (CONFIRMED, manual section 3.17 [1]). Pins 3/5 are I2C (TWI1), 8/10 are UART0, 19/21/23/24/26 are SPI1 - the same positions as a Raspberry Pi. This is not a full match: some other pins carry different functions (e.g. PWM, UART4/5), which does not matter here.

The header is **not soldered** from the factory (CONFIRMED [1]). A HAT with a female socket needs male pins soldered on the Orange Pi.

**Pin table.** Waveshare pin numbers (BCM / board pin) are from the Waveshare wiki [2]; Orange Pi names and Linux GPIO numbers are from the Orange Pi manual [1]. All CONFIRMED.

| HAT signal | Waveshare Pi pin (BCM / board) | Orange Pi pin name and function | Linux GPIO no. |
|---|---|---|---|
| VCC | 3.3 V / pin 1 | 3.3 V, pin 1 (or 17) | n/a |
| GND | GND | GND, pin 6/9/14/20/25 | n/a |
| DIN (MOSI) | BCM10 / pin 19 | PH7, SPI1_MOSI, pin 19 | 231 |
| CLK (SCLK) | BCM11 / pin 23 | PH6, SPI1_CLK, pin 23 | 230 |
| CS | BCM8 (CE0) / pin 24 | PH5, SPI1_CS0, pin 24 | 229 |
| DC | BCM25 / pin 22 | PI6, shared with TWI0_SDA / UART2_RX, pin 22 | 262 |
| RST | BCM17 / pin 11 | PH2, shared with UART5_TX, pin 11 | 226 |
| BUSY | BCM24 / pin 18 | PH4, no alternate function listed, pin 18 | 228 |

Notes:
- Waveshare's Python config also defines a PWR pin (BCM18, pin 12) that it switches on/off [3]. On Orange Pi pin 12 is PI1 (GPIO 257). The wiki pin table does not list PWR for this HAT [2], so it is probably unconnected on the V4 board; UNVERIFIED. Drop it in the OPi config or leave it harmlessly toggling PI1.
- Keep the i2c0 and UART2/UART5 overlays disabled, or pins 22 and 11 will be claimed by those drivers (inference from the pin-function table; UNVERIFIED in practice).
- The e-paper input levels are 3.3 V compatible (the HAT also tolerates 5 V) [2], and Orange Pi GPIO is 3.3 V [1]. CONFIRMED.

**Which SPI bus.** Only **SPI1** is on the 40-pin header, with CS0 (pin 24) and CS1 (pin 26) (CONFIRMED [1]).

**Enabling SPI1.**
- Official Orange Pi Debian/Ubuntu images: SPI1 is **off by default** (CONFIRMED [1]). Run `sudo orangepi-config`, then System -> Hardware, and tick `spi1-cs0-spidev` (CS0 only; also available: `spi1-cs1-spidev`, `spi1-cs0-cs1-spidev`), save, reboot. Expect `/dev/spidev1.0` (CONFIRMED [1]). The manual's own loopback test is `sudo spidev_test -v -D /dev/spidev1.0` with pin 19 shorted to 21.
- Armbian: Armbian images use an `overlay_prefix` and `armbianEnv.txt` overlays. Reports show trouble: the Zero 2W prefix was `sun50i-h616` although the SoC is H618, and one user had to use a custom overlay for SPI1 [4][5]. A kernel-supplied overlay named `sun50i-orangepizero2-3-spi1-cs0-spidev.dtbo` appears in one dev build's boot log [6], and Zero 3 SPI1 overlays were reported to still need editing [7]. REPORTED, inconsistent. Recommendation: use the official Orange Pi image first.

## 2. Software to drive the e-paper

**Controller chip: SSD1680 (SSD1680Z8 on the panel drawing).** The Waveshare V3 and V4 panel specifications both give "DRIVER IC: SSD1680Z8", 250 gate x 122 source (CONFIRMED [8][9]). V4 is "fully compatible with V3" and adds a fast-refresh demo (CONFIRMED [2]). The wiki describes the V3 label on the back of the screen but gives no V4 label; a retailer lists the product as "V4 Version" (REPORTED [10]). Check the sticker on your unit.

Key HAT facts (CONFIRMED [2]): SPI mode 0, full refresh about 2 s, partial about 0.3 s, refresh power 26.4 mW typical, standby under 0.01 uA, outline 65 x 30.2 mm, display area 48.55 x 23.71 mm. Waveshare's own rule: it can also be wired by cable (PH2.0 8-pin) to non-Pi boards [11].

**Waveshare Python library on Orange Pi: not drop-in.** `epdconfig.py` imports `spidev` and `gpiozero`, hard-codes RST=17, DC=25, CS=8, BUSY=24, PWR=18 as BCM numbers, and opens `SPI.open(0, 0)` at 4 MHz mode 0 [3] (CONFIRMED, read from the source). On Orange Pi that fails because gpiozero's pin factories do not know the H618 and the SPI bus is 1, not 0. `epd2in13_V4.py` only calls the epdconfig functions (`digital_read`, `digital_write`, `spi_writebyte`, `delay_ms`) and uses the BUSY pin as 1 = busy [12]. So the port is: keep `epd2in13_V4.py`, replace `epdconfig.py`.

Suggested approach (UNVERIFIED on this exact board, but each piece is standard):
1. `spidev`: `spi.open(1, 0)`, `max_speed_hz=4000000`, `mode=0`.
2. GPIO via libgpiod (`python3-libgpiod` or `gpiod`) on the line numbers above (PH2, PI6, PH4; chip is probably `gpiochip0` because the manual's numbers are global sysfs numbers - confirm with `gpioinfo`). Alternative: wiringOP-Python, which is pre-installed in Orange Pi images and documented in the manual [1]; use `gpio readall` to get the wPi numbers. `OPi.GPIO` (third-party) H618 support: not checked, UNVERIFIED.
3. Fallback with no Python: Waveshare's C library has a generic `USE_DEV_LIB` option; one Armbian user ran a Waveshare 2.9" panel on an Orange Pi Zero LTS that way (REPORTED [13]; older board).

**Reports of this exact combination (Zero 2W + Waveshare 2.13" HAT): none found.** One third-party write-up says Waveshare e-paper works on any board with SPI and notes the demo code has Raspberry-Pi-specific parts to replace [14] (REPORTED).

## 3. Physical fit

- Board size: 65 x 30 x 1.2 mm, 12.5 g, four 3.0 mm positioning holes (CONFIRMED [1]); CNX describes the same form factor as the Pi Zero 2W, and says it stacks with its expansion board on standoffs [15] (REPORTED).
- HAT size: 65 x 30.2 mm, i.e. a Pi Zero HAT outline [2].
- **Does the HAT line up?** Pin positions on the header are Raspberry-compatible (section 1), but the exact header offset from the board edge and the hole spacing (Pi Zero uses 58 x 23 mm at 3.5 mm in) are not stated in any text source I could read; the manual's mechanical drawing is an image. UNVERIFIED. Test: lay a Pi Zero HAT footprint or the HAT itself over the board and check hole alignment before soldering.
- Orange Pi has two USB-C ports, mini-HDMI and a 24-pin FPC connector [1], not the Pi Zero's micro-USB ports; the HAT shouldn't cover them since it only spans the header end, but check the HAT's overhang vs the HDMI connector.
- **Heatsink case:** I found no product page or dimensions for a "copper-heatsink protective case" for this board. Comparable Pi-Zero metal cases are about 14 mm tall and need a raised ("booster") header to carry a HAT [16]. The SoC sits under any HAT you stack, so a heatsink plus a 2.54 mm socket stack may collide (UNVERIFIED). A GeeekPi-style copper case is reported to kill Wi-Fi signal [17] (REPORTED, Pi Zero case). Measure case internal height; consider a tall male header with the heatsink fitted on the SoC.

## 4. PiSugar 3 with the Orange Pi Zero 2W

What PiSugar 3 is (REPORTED from retailer/CNX, vendor wiki lacks specs): 1200 mAh battery, up to 3 A output, USB-C charging, I2C, built-in RTC, 65 x 30 mm, listed compatible with Pi Zero, Zero W/WH, Zero 2 W only [18][19]. It attaches to the **underside** of the Pi via pogo pins and "does not occupy GPIO" [18][19]. Four screws are included [18].

- **How it connects.** PiSugar's design notes say 5 V comes through two bottom pads (no USB cable) and a special pogo pin reaches the underside of GPIO pin holes for I2C (REPORTED [20][21]; this is about PiSugar 1/2, PiSugar 3 "continues the pogo pin design" [19]). Which exact pads/test points PiSugar 3 touches is **not documented** in anything I could read. Pi Zero test pads are in fixed positions shared by all Zero boards [22] (REPORTED).
- **Do the contacts line up on the Orange Pi Zero 2W?** UNVERIFIED. The Orange Pi manual documents no such test pads on the underside. A commenter says the Radxa Zero lacks the Pi Zero's pogo pads [23] (REPORTED, different board). If PiSugar contacts the header-hole pads for pins 2/3/5 only, it might work (these pins are 5 V, SDA, SCL on both boards) but only if the board outline, hole positions and your soldered pin ends allow it. Treat it as a bench test.
- **I2C.** Default address 0x57 (CONFIRMED, PiSugar power-manager docs [24]); retailers list 0x57/0x68 (RTC at 0x68) [18][19] (REPORTED). The default bus is `/dev/i2c-1`, configurable via `i2c_bus` in `/etc/pisugar-server/config.json` [24][25] (CONFIRMED). Header pins 3 (SDA) and 5 (SCL) are TWI1 = Orange Pi `i2c1`; it is off by default and is enabled with the `pi-i2c1` overlay in `orangepi-config`. The manual warns that its device number may not be `/dev/i2c-1` (their example shows i2c1 as `/dev/i2c-3`) (CONFIRMED [1]) - check with `ls /sys/devices/platform/soc*/*/i2c-*`. Anything that says PiSugar 3 is at 0x75 or uses specific GPIO pins (Cirkit Designer pages) conflicts with the vendor repo (0x75 is only an optional alternative address) - ignore it [24].
- **Power.** Orange Pi recommends USB-C 5 V / 2 A (3 A also ok). Powering via the 5 V header pin is allowed but may be unstable if the supply is weak; the 5 V pin cannot be switched off in software (CONFIRMED [1]). PiSugar 3 delivers up to 3 A (REPORTED [18]), above the board's 2 A spec. A Rock 5A was reported powered by PiSugar 3 Plus [26] (REPORTED, different board).
- **Power button / shutdown.** PiSugar shutdown/auto-power-on relies on its own switch and software; a Radxa user warns the hardware power-off on that board may stop the battery board turning it back on [26] (REPORTED). Test shutdown, wake via PiSugar button and auto power-on on the Orange Pi. PiSugar server defaults to Raspberry Pi assumptions; its software was not checked on H618.
- **Stack: PiSugar under, HAT on top.** Concept is fine (pogo underneath, header on top; PiSugar advertises "unobstructed GPIO access" [19]). But a soldered male header protrudes below the PCB and a case also needs space; stack height with the heatsink case is UNVERIFIED. If it does not fit, use the PiSugar's 5V/GND to a Dupont lead into header pins 4 and 6 (CONFIRMED pin roles [1]; adds wiring, no battery-gauge unless SDA/SCL also wired).

## 5. Rough power and runtime

- Orange Pi spec: Type-C 5 V / 2 A input (CONFIRMED [1]). No official idle current.
- REPORTED measurements: Zero 2W about 1.1 W with extension board, 1.7 W with extension board plus Wi-Fi dongle (Reddit, March 2024, one user, load unstated [27]); a Zero 3 idled 0.8 W at USB-C [28]. For reference, a Pi Zero 2 W idles about 0.6 W [29].
- E-paper: refresh about 26.4 mW, standby about 0 (CONFIRMED [2]) - negligible versus the board.
- Assumptions: 1200 mAh x 3.7 V = 4.4 Wh nominal; about 80% usable after boost/conversion losses, about 3.5 Wh; board idle about 1 W with Wi-Fi on, average with some CPU load about 2 W (my guess, UNVERIFIED).

| Scenario | Avg power | Runtime |
|---|---|---|
| Idle, Wi-Fi quiet | about 0.8 W | about 4.4 h |
| Idle plus Wi-Fi | about 1.1 W | about 3.2 h |
| Moderate CPU use | about 2 W | about 1.75 h |

Vendor claim of 8-10 h applies to a Pi Zero W [18] and should not be assumed here. Idle-power tweaks (CPU governor, Wi-Fi power save) can improve it.

## 6. Known unknowns (only a bench test settles)

1. Whether PiSugar 3 pogo pins land on usable pads of the Orange Pi Zero 2W (and which).
2. HAT and PiSugar hole/header alignment; true stack height with header, heatsink and case.
3. Which `gpiochip`/line names and `/dev/i2c-N` the image exposes; exact `spi1` overlay behavior on your OS image.
4. Whether V4 library timing (BUSY polarity, SPI 4 MHz) works under the OPi SPI driver; PWR pin handling.
5. Real idle/active current of this board with the case and Wi-Fi; metal case effect on Wi-Fi.
6. PiSugar behavior on shutdown, wake, charge-while-running, and brown-out at 2 A boot peaks.
7. Whether the PiSugar software (I2C reads, power manager) runs on the OPi image.

## Bench-test checklist

1. Before powering: solder the 2x20 male header (or fit pins); check polarity, short-check 5 V to GND with a multimeter.
2. Fit check without power: lay the HAT and PiSugar against the board; photograph, note header offset and hole alignment; measure case internal height and heatsink height vs HAT underside.
3. Power from the USB-C port first, flash the official Orange Pi Debian image, log in, run `uname -r; cat /etc/os-release; sudo gpio readall` (wiringOP is pre-installed [1]).
4. Enable SPI1: `sudo orangepi-config` -> System -> Hardware -> tick `spi1-cs0-spidev` -> Save -> reboot; then `ls /dev/spidev1*`; loopback with pin 19 to 21: `sudo spidev_test -v -D /dev/spidev1.0`.
5. Find GPIO lines: `sudo apt install gpiod i2c-tools python3-spidev python3-gpiod python3-pil python3-numpy`; `gpiodetect; gpioinfo | grep -E "PH2|PH4|PI6|PH5"` (names may differ on the vendor kernel; fall back to line numbers 226, 228, 262).
6. Wire/fit the HAT; quick GPIO sanity: RST toggles (`gpioset`), BUSY reads (`gpioget`), then run the Waveshare V4 demo with a modified `epdconfig.py` (SPI `open(1,0)`, libgpiod or wiringOP-Python for RST/DC/BUSY). Use the sticker to confirm V4. Try `python3 epd_2in13_V4_test.py`.
7. I2C for PiSugar: enable `pi-i2c1` in `orangepi-config`, reboot, `ls /sys/devices/platform/soc*/*/i2c-*` to find the bus number N, then `sudo i2cdetect -y N` with PiSugar fitted; expect 0x57 (and 0x68 for RTC).
8. Install PiSugar power manager, set `i2c_bus` to N in `/etc/pisugar-server/config.json`, restart `pisugar-server`; check battery % reading. Test shutdown from the button and wake.
9. Measure current: USB power meter or inline meter on 5 V; log idle (5 min), Wi-Fi on, `stress-ng --cpu 4` load. Run on battery to find real runtime.
10. Thermal: with case and heatsink, run `stress-ng` for 10 min and read `cat /sys/class/thermal/thermal_zone*/temp`; check Wi-Fi RSSI (`iw dev wlan0 link`) with and without the case.
11. Buttons: the HAT covers the header, so for the very first test connect the five buttons (up, down, left, right, select) through a stacking header and a breadboard to free GPIO pins (not the HAT's SPI1/RST/DC/BUSY pins), wired as button-to-GND with the internal pull-up enabled. Confirm each press with `gpioget`/`gpiomon` (or `gpio read` from wiringOP). This step only proves the buttons work. Afterwards remove the stacking header and solder the button wires directly to the Orange Pi. Record the final pin for each button in this file.

## Sources

[1] Orange Pi Zero 2W H618 User Manual v1.1 (sections 1.4, 2.9, 3.17, 3.19.3-3.19.4, 3.21): https://www.nikom.biz/pic_info/A704017/OrangePi_Zero2w_H618_User-Manual_v1.1.pdf
[2] Waveshare 2.13inch e-Paper HAT Manual: https://www.waveshare.com/wiki/2.13inch_e-Paper_HAT_Manual
[3] Waveshare `epdconfig.py`: https://raw.githubusercontent.com/waveshareteam/e-Paper/master/RaspberryPi_JetsonNano/python/lib/waveshare_epd/epdconfig.py
[4] DietPi forum, Zero 2W overlay prefix: https://dietpi.com/forum/t/orange-pi-zero-2w-how-to-enable-uart5/23188
[5] Armbian forum, Zero 2W thread: https://forum.armbian.com/topic/31654-orange-pi-zero-2w/page/2/
[6] Armbian forum profile (pixdrift), overlay name in boot log: https://forum.armbian.com/profile/206186-pixdrift/content/page/3
[7] Armbian forum, Zero 3 SPI CS pin: https://forum.armbian.com/topic/48480-orange-pi-zero-3-spi-cs-pin/
[8] Waveshare 2.13inch e-Paper V3 specification: https://files.waveshare.com/upload/5/59/2.13inch_e-Paper_V3_Specificition.pdf
[9] Waveshare 2.13inch e-Paper V4 specification: https://files.waveshare.com/upload/4/4e/2.13inch_e-Paper_V4_Specification.pdf
[10] Retailer listing "V4 Version": https://www.desertcart.uy/products/164384955-2-13inch-e-ink-display-hat-v4-version-black-white
[11] Waveshare product page (PH2.0 cable for other boards, specs): https://www.waveshare.com/product/displays/e-paper/2.13inch-e-paper-hat.htm
[12] Waveshare `epd2in13_V4.py`: https://raw.githubusercontent.com/waveshareteam/e-Paper/master/RaspberryPi_JetsonNano/python/lib/waveshare_epd/epd2in13_V4.py
[13] Armbian forum, Waveshare e-paper on Orange Pi Zero LTS: https://forum.armbian.com/topic/13444-waveshare-e-paper-on-orange-pi-zero-lts/
[14] Using Waveshare e-ink screens without Raspberry Pi: https://www.nemunai.re/post/waveshare-e-paper-display-on-linux-without-raspberry-pi
[15] CNX Software, Orange Pi Zero 2W: https://www.cnx-software.com/2023/09/09/orange-pi-zero-2w-raspberry-pi-zero-2w-alternative-4gb-ram/
[16] Pimoroni aluminium heatsink case for Pi Zero: https://shop.pimoroni.com/products/aluminium-heatsink-case-for-raspberry-pi-zero
[17] GeeekPi copper heatsink Zero 2 W case listing (Wi-Fi comment): https://www.desertcart.vn/products/492088051-geeekpi-raspberry-pi-zero-2-w-case-kit-with-aluminum
[18] Tindie, PiSugar 3: https://www.tindie.com/products/pisugar/pisugar3-battery-for-raspberry-pi-zero/
[19] CNX Software, PiSugar3: https://www.cnx-software.com/2025/01/06/pisugar3-is-a-low-cost-raspberry-pi-ups-module-with-rtc-hardware-battery-protection-and-power-management-features/
[20] PiSugar Hackaday project (spring pins): https://hackaday.io/project/164733-pisugar-battery-for-raspberry-pi-zero
[21] Hackaday log, SugarPin: https://hackaday.io/project/164733/log/164926
[22] CNX Software, Pi Zero test pads: https://www.cnx-software.com/2022/01/15/usb-add-on-boards-leverage-raspberry-pi-zero-test-pads-usb-gadget-mode/
[23] CNX Software PiSugar3 comment on Radxa Zero: https://cnx-software.com/?p=143330
[24] PiSugar power manager, PiSugar 3 doc (I2C 0x57): https://raw.githubusercontent.com/PiSugar/pisugar-power-manager-rs/master/doc/pisugar3.md
[25] PiSugar power manager default config (`i2c_bus`): https://raw.githubusercontent.com/PiSugar/pisugar-power-manager-rs/master/pisugar-server/debian/config.json
[26] Radxa forum, PiSugar 3 Plus on non-Pi boards: https://forum.radxa.com/t/pisugar-3-plus-and-other-pi-gpio-hats/17948
[27] Reddit r/OrangePI, Zero 3 vs Zero 2W power (via search snippet): https://redlib.ssps.io/r/OrangePI/comments/1bjuxgs/orange_pi_zero_3_vs_zero_2w_power_consumption
[28] Tao of Mac, Orange Pi Zero 3: https://taoofmac.com/space/blog/2024/03/09/2000
[29] CNX Software, Pi Zero 2 W power: https://www.cnx-software.com/2021/12/09/raspberry-pi-zero-2-w-power-consumption/
