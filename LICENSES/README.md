# Licences

Spiral Node uses three licences, one per kind of work:

| What | Where | Licence |
|---|---|---|
| Code: Spiral OS, the website and simulator, the art scripts, script code (`script.py`) | `os/`, `website/` (except the folders in the CC BY-SA row), `scripts/*/script.py` | GPL-3.0 ([`../LICENSE`](../LICENSE)) |
| Hardware notes and design files, including their `.md` files | `hardware/` | CERN-OHL-S-2.0 ([`CERN-OHL-S-2.0.txt`](CERN-OHL-S-2.0.txt)) |
| Docs, art and script content (facts, questions, stories, topics) | `*.md` outside `hardware/`, `docs/`, `website/design/`, `website/public/art/`, `website/public/og/`, `website/public/press/`, `os/spiral/builtin_scripts/*/*.json`, `scripts/*/*.json` | CC BY-SA 4.0 ([`CC-BY-SA-4.0.txt`](CC-BY-SA-4.0.txt)) |

The art is drawn by code: `website/art/*.py` is GPL-3.0, and the images it makes are CC BY-SA 4.0.

Third-party files keep their own licence: the Pillow wheel in `website/vendor/pyodide/` comes with Pillow's licence inside it.

By opening a pull request you agree that your contribution is shared under the licence of the folder it lands in (see the sign-off in [`../CONTRIBUTING.md`](../CONTRIBUTING.md)).
