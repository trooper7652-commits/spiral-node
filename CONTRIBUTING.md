# Contributing to Spiral Node

Thanks for stopping by! Writing a script is the easiest way in: a small Python file and a list of facts, stories or topics is all it takes. Fixes to the docs, the website and Spiral OS are welcome too. If you have a question or an idea, start a thread in [Discussions](https://github.com/trooper7652-commits/spiral-node/discussions).

## Write a script

1. Fork the repo and copy `scripts/TEMPLATE/` to `scripts/<your_id>/`. The folder name is the script's ID: lowercase letters, digits, `_` or `-`. Pick one that isn't a built-in ID (`connect`, `fun_fact_question`, `quick_story`).
2. In `script.py`, set `NAME`, `DESCRIPTION` (one line for the website gallery) and `AUTHOR` (your GitHub username).
3. Replace the `FACTS` list in `script.py` with your own entries. A script can be a single file: `ctx.entries(FACTS)` checks a list of entries the same way a JSON library is checked. For a big library, add a JSON file and load it in `create(ctx)` instead.
4. Run the tests and try your script in the simulator (see below).
5. Commit with a sign-off (`git commit -s`) and open a pull request. The script-idea issues are a good place to find or claim an idea.

### The script contract

`script.py` defines:

- `NAME`: the name shown in the Scripts list.
- `DESCRIPTION` and `AUTHOR`: shown in the website's script gallery.
- `PREFERENCES`: a list of `Preference(key, label, choices, default, suffix)`. It must include one with the key `"interval"`, the refresh time in seconds, for example `Preference("interval", "Refresh", (15, 30, 60), 30, "s")`. Its choices are positive integers and its default is one of them.
- `create(ctx)`: returns an object whose `next()` returns a `Page(title, body)`.

A page can also carry a small picture: `Page(title, body, picture=rows)`. Each row is a string of `#` (ink) and `.` (paper), every row the same length, at most 120 wide and 88 rows tall. The picture is drawn at the left and the text wraps beside it. A malformed picture shows a "Script error" page.

`ctx` gives you:

- `ctx.library("facts.json")`: loads a JSON library from your folder.
- `ctx.entries(list_of_dicts, kind="fact")`: the same, for entries written inside `script.py`.
- `ctx.today()`: today's `datetime.date` on the device clock.
- `ctx.shown("facts.json")`: remembers which entries were shown. Pass it to `pick_unshown(entries, shown, ctx.rng, library="facts.json")` from `spiral.library`. When everything has been shown, it raises `LibraryExhausted`, and Spiral OS asks if you want to start over.
- `ctx.state()` and `ctx.save_state(d)`: a small dict that survives restarts.
- `ctx.prefs` (the chosen preferences) and `ctx.rng` (a `random.Random`).

A script that fails to load shows up as `<id> (error)` in the Scripts list and never stops the device.

### Library format

A library is a JSON list. IDs are unique and every text field is a non-empty string.

```json
[
  {"id": "wombat-cubes", "text": "Wombat droppings are cube-shaped.",
   "topic": "sample", "source": "https://en.wikipedia.org/wiki/Wombat"}
]
```

Stories (`ctx.library("stories.json", "story")`) use `"title"` and `"pages"`, a list of strings with one screen each, instead of `"text"`.

The screen is 250x122 pixels, so keep each page short. A sentence or two reads best.

### Content

- Give every fact a source link.
- Stories are your own or in the public domain.
- Keep it friendly for all ages.

## Run the tests

```
cd os
pip install "Pillow>=10.1" pytest
python -m pytest -q

cd website
npm install
npm test
npm run dev        # then open http://localhost:3000/try?script=<your_id>
```

Scripts in `scripts/` are bundled into the simulator automatically, so you can see your pages on the real Spiral OS before you open a pull request.

## Review

Scripts are ordinary Python and run with full access on the device, so a maintainer reads every script pull request before it is merged. Small, focused pull requests are the quickest to review.

## Sign your commits (DCO)

Each commit needs a sign-off line. `git commit -s` adds it for you:

```
Signed-off-by: Your Name <you@example.com>
```

It certifies the [Developer Certificate of Origin](https://developercertificate.org/): that you wrote the change, or have the right to share it under this project's licences. Forgot it? Run `git commit --amend -s` for the last commit, or `git rebase --signoff main` for several.

## How we talk

Be kind and patient, and assume good intent. Everyone was new once. The [Code of Conduct](CODE_OF_CONDUCT.md) applies everywhere in the project.

## Licences

Code (including `script.py`) is GPL-3.0, hardware notes are CERN-OHL-S-2.0, and docs, art and script content (facts, stories, topics) are CC BY-SA 4.0. Your contribution is shared under the licence of the folder it lands in. See [LICENSES/README.md](LICENSES/README.md).
