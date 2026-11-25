Facts are written in our own words from NASA web pages, and each one links the page it came from. Questions are original. Rebuild or verify the facts with `python tools/packs/check_sources.py os/spiral/builtin_scripts/space_facts/facts.json`.

The quiz (`quiz.json`) asks a question with three answers. Each entry's `explain` is backed by a `check` phrase on its NASA page; verify it the same way: `python tools/packs/check_sources.py os/spiral/builtin_scripts/space_facts/quiz.json`. The Mode setting picks Mix (a fact, then a quiz question, in turn), Quiz or Read.
