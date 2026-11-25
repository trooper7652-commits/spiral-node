# Fun Fact + Question

One sourced fun fact and one question to think about, or a true-or-false quiz.

- `facts.json`: facts in our own words. Each names the page it came from (`source`) and a short phrase copied from that page (`check`).
- `questions.json`: original questions to think about.
- `quiz.json`: true-or-false statements. `explain` gives the true fact, backed by `check` on the `source` page.

The Mode setting picks Mix (a fact, then a quiz question, in turn), Quiz or Read.

Verify the sources (needs network), from the repository root:

    python tools/packs/check_sources.py os/spiral/builtin_scripts/fun_fact_question/facts.json
    python tools/packs/check_sources.py os/spiral/builtin_scripts/fun_fact_question/quiz.json
