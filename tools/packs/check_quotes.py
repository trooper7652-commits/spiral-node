"""Check that every quote's `check` text is in the sourced part of its Wikiquote `source` page.

Run: python tools/packs/check_quotes.py os/spiral/builtin_scripts/famous_quotes/quotes.json   (needs network)
"""
import json
import re
import sys

from check_sources import fetch, visible_text

# Sections that hold doubtful or third-party text; the sourced quotes come before them.
STOP = re.compile(r'\sid="(?:Disputed|Misattributed|Quotes_about|About|Attributed|Unsourced)')

# Notes such as `has sometimes been misquoted as: "..."` sit inside the sourced part but are not the quote.
NOTE = re.compile(r'(?:misquoted|paraphrased)[^"]{0,40}"[^"]*"')


def attributed_text(html):
    """Visible, lowercased text of the page before the first stop heading (matches both old and new MediaWiki markup)."""
    m = STOP.search(html)
    return visible_text(html[:m.start()] if m else html)


def norm(s):
    s = s.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).lower()


def check_quotes(quotes, fetch=fetch):
    """Return (id, check, url) for each quote whose check is not in its page's sourced part; each URL is fetched once."""
    pages, failures = {}, []
    for q in quotes:
        url = q["source"]
        if url not in pages:
            try:
                pages[url] = NOTE.sub(" ", norm(attributed_text(fetch(url))))
            except Exception:  # an unreachable page fails its quotes
                pages[url] = ""
        if norm(q["check"]) not in pages[url]:
            failures.append((q["id"], q["check"], url))
    return failures


def main(argv):
    with open(argv[1], encoding="utf-8") as fh:
        quotes = json.load(fh)
    failures = check_quotes(quotes)
    for qid, check, url in failures:
        print(f"FAIL {qid}: {check} not in sourced part of {url}")
    print(f"{len(quotes) - len(failures)} of {len(quotes)} quotes verified, {len(failures)} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
