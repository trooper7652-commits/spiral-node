"""Build os/spiral/builtin_scripts/on_this_day/events.json from Wikipedia's "On this day" feed.

Run: python build_on_this_day.py [--cache DIR]   (needs network; replies are cached in DIR)
"""
import argparse
import calendar
import json
import re
import tempfile
import time
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

from build_poems import ROOT, UA, _context, _drawable, fits

HOSTS = ("https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/{}/{}",
         "https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/{}/{}")
OUT = ROOT / "os/spiral/builtin_scripts/on_this_day/events.json"
DATES = [(m, d) for m in range(1, 13) for d in range(1, calendar.monthrange(2024, m)[1] + 1)]
MAX_LEN, PER_DAY = 140, 5


_MAP = str.maketrans({"ʼ": "'", "ʻ": "'", "ł": "l", "Ł": "L", "Đ": "D", "đ": "d", "Æ": "Ae", "æ": "ae",
                      "Ø": "O", "ø": "o", "ß": "ss", "‑": "-", "­": None})
_PICTURE = re.compile(r"\s*\([^()]*\b(?:pictured|depicted|shown|illustrated|featured)\b[^()]*\)", re.I)
_OK = re.compile(r"[ -~‘’“”]*")


def clean(text):
    """Text the device can show, or None when a character it cannot draw is left or the sentence is cut off."""
    text = re.sub(r"£\s?(\d+(?:[,.]\d+)*)", r"\1 pounds", " ".join(text.split()).translate(_MAP))
    text = _PICTURE.sub("", _drawable(text))
    text = " ".join(re.sub(r"\s+([,.;:])", r"\1", text).split())
    text = re.sub(r"(?<!\.)\.\.(?!\.)", ".", text)  # "U.S. (note)." leaves "U.S.." behind
    if not re.search(r"[.!?\"')’”]$", text):
        return None  # the feed sometimes cuts a sentence off
    return text if _OK.fullmatch(text) else None


def label(year):
    return f"{-year} BC" if year < 0 else str(year)


def entries_for(mmdd, data, drop=None):
    """Up to 5 earliest events of one date that fit the page, as library entries."""
    found = []
    for e in data.get("selected", []):
        text, year = clean(e.get("text", "")), e.get("year")
        if text is None:
            continue
        try:
            source = e["pages"][0]["content_urls"]["desktop"]["page"]
        except (KeyError, IndexError):
            continue
        if drop and drop.search(text):
            continue  # words the public repo must not contain
        if not isinstance(year, int) or len(text) > MAX_LEN or not fits(f"{label(year)}: {text}"):
            continue
        found.append((year, text, source))
    found.sort(key=lambda f: f[0])
    kept = []
    for f in found:  # the same event listed twice, word for word or reworded in the same year: keep the first
        if not any(k[1] == f[1] or (k[0] == f[0] and SequenceMatcher(None, k[1], f[1]).ratio() >= 0.7) for k in kept):
            kept.append(f)
    found = kept
    return [{"id": f"{mmdd}-{y}-{n}", "text": f"{label(y)}: {t}", "topic": mmdd, "source": s}
            for n, (y, t, s) in enumerate(found[:PER_DAY], 1)]


def fetch(m, d, cache):
    f = Path(cache) / f"{m:02d}-{d:02d}.json"
    if not f.exists():
        for host in HOSTS:
            try:
                req = urllib.request.Request(host.format(f"{m:02d}", f"{d:02d}"), headers={"User-Agent": UA})
                f.write_bytes(urllib.request.urlopen(req, timeout=30, context=_context()).read())
                break
            except OSError:
                continue
        else:
            raise OSError(f"no host answered for {m:02d}-{d:02d}")
        time.sleep(0.3)
    return json.loads(f.read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(Path(tempfile.gettempdir()) / "spiral-otd-cache"))
    ap.add_argument("--drop", help="regex: skip events whose text matches")
    a = ap.parse_args()
    drop = re.compile(a.drop, re.I) if a.drop else None
    Path(a.cache).mkdir(parents=True, exist_ok=True)
    out = [e for m, d in DATES for e in entries_for(f"{m:02d}-{d:02d}", fetch(m, d, a.cache), drop)]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("[\n" + ",\n".join(json.dumps(e, ensure_ascii=False) for e in out) + "\n]\n", encoding="utf-8")
    print(f"wrote {len(out)} events to {OUT}")


if __name__ == "__main__":
    main()
