"""Check that every fact's `check` text appears on its NASA `source` page.

Run: python tools/packs/check_sources.py os/spiral/builtin_scripts/space_facts/facts.json   (needs network)
"""
import html
import json
import re
import ssl
import sys
import urllib.request

UA = "SpiralNodeBuildTool/1.0 (+https://github.com/trooper7652-commits/spiral-node)"


def _context():
    try:  # the Windows cert store can hold an expired root; certifi's bundle does not
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return None


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20, context=_context()) as r:
        return r.read().decode("utf-8", "replace")


def visible_text(page):
    page = re.sub(r"(?is)<(script|style)\b.*?</\1\s*>", " ", page)
    page = re.sub(r"(?s)<[^>]*>", " ", page)
    return re.sub(r"\s+", " ", html.unescape(page)).replace("\u00a0", " ").lower()


def check_facts(facts, fetch=fetch):
    """Return (id, check, url) for each fact whose check is not on its page; each URL is fetched once."""
    pages, failures = {}, []
    for f in facts:
        url = f["source"]
        if url not in pages:
            try:
                pages[url] = visible_text(fetch(url))
            except Exception:  # an unreachable page fails its facts
                pages[url] = ""
        want = re.sub(r"\s+", " ", f["check"]).lower()
        if want not in pages[url]:
            failures.append((f["id"], f["check"], url))
    return failures


def main(argv):
    with open(argv[1], encoding="utf-8") as fh:
        facts = json.load(fh)
    failures = check_facts(facts)
    for fid, check, url in failures:
        print(f"FAIL {fid}: {check} not on {url}")
    print(f"{len(facts) - len(failures)} of {len(facts)} facts verified, {len(failures)} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
