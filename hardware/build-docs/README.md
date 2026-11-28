# Spiral Node build docs

Spiral Node is a pocket e-ink device. It runs on an Orange Pi Zero 2W with a 2.13 inch e-paper screen, seven buttons and a custom button board ("backbone"). It is a prototype. Nothing here is final.

Read the files in this order.

| Topic | File that covers it | Status |
|---|---|---|
| Hardware / parts list | [hardware.md](hardware.md) | New. Also see `hardware/README.md` (short parts table) in the public repo. |
| Wiring (screen pins, button pins, ground) | [wiring.md](wiring.md) | New. It merges the button table in `hardware/pcb/backbone-v1/wiring.md` with the screen pins in `hardware/bring-up.md`, and lists where the files disagree. |
| Build / assembly | [build.md](build.md) | New. Assembly of the board is only partly recorded. Gaps are marked `TODO (owner)`. |
| Software install and run | Already exists, not copied here: `hardware/bring-up.md` (set up the board, step by step), `os/README.md` (install, test, snapshot), `CONTRIBUTING.md` (write a script, run the simulator), `website/README.md` (the website and browser simulator), `docs/script-format.md` (script format) | Existing |

Paths in these docs are relative to the project folder. Files under `hardware/pcb/` are the board design files. All other paths are in the public repo.

Other background files: `hardware/compatibility-findings.md` (research on whether the parts work together, with sources, partly unverified) and `hardware/form-factor.md` (planned shape and size).

## Open questions at a glance

Every `TODO (owner)` in these files means a fact that is not written down anywhere yet. Search for `TODO (owner)` to list them.
