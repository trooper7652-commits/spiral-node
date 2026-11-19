"""Build os/spiral/builtin_scripts/poems/poems.json from English Wikisource (public-domain poems).

Run: python build_poems.py [--cache DIR]   (needs network; downloads are cached in DIR)
"""
import argparse
import html
import json
import re
import ssl
import sys
import tempfile
import unicodedata
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "os"))
from spiral.config import SCREEN_H, SCREEN_W  # noqa: E402
from spiral.render import PAD, _page_top, fit_text  # noqa: E402

UA = "SpiralNodeBuildTool/1.0 (+https://github.com/trooper7652-commits/spiral-node)"
API = "https://en.wikisource.org/w/api.php"
LIST = Path(__file__).with_name("poems_list.json")
OUT = ROOT / "os/spiral/builtin_scripts/poems/poems.json"
MIN_FONT = 12
MAX_PAGES = 12
# Templates that wrap real poem text; every other template is dropped.
KEEP = {"sc", "smaller", "larger", "x-smaller", "xx-smaller", "x-larger", "xx-larger", "uc", "lc", "i",
        "di", "dropinitial", "drop initial", "italic", "small-caps", "asc",
        "block center", "center block", "block center/s"}
WRAPPERS = re.compile(r"\{\{(?:ppoem|tpp|float center|poem)", re.I)
ROMAN = re.compile(r"[IVXLC]+\.?")
JUNK = re.compile(r"\[\[(?:Category|File|Image|[a-z]{2,3}(?:-[a-z]+)?):[^\]]*\]\]", re.I)


def body_box():
    """Width and height `page_screen` gives the poem body."""
    return SCREEN_W - 2 * PAD, SCREEN_H - _page_top() - 1


def fits(text):
    width, height = body_box()
    font, lines = fit_text(text, width, height)
    return font.size >= MIN_FONT and not any(l.endswith("…") for l in lines)


def _context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return None


def _get(title, cache):
    """Wikitext of one page title; the raw API reply is cached on disk."""
    f = Path(cache) / (re.sub(r"[^A-Za-z0-9]+", "_", title)[:100] + ".json")
    if not f.exists():
        q = urllib.parse.urlencode({"action": "parse", "page": title, "prop": "wikitext", "format": "json",
                                    "formatversion": 2, "redirects": 1})
        req = urllib.request.Request(f"{API}?{q}", headers={"User-Agent": UA})
        f.write_bytes(urllib.request.urlopen(req, timeout=30, context=_context()).read())
        time.sleep(0.5)
    data = json.loads(f.read_text(encoding="utf-8"))
    if "parse" not in data:
        raise LookupError(f"no such Wikisource page: {title}")
    return data["parse"]["wikitext"]


def _pages_tag(m, cache):
    """Text of a transcluded scan range: <pages index="X.djvu" from=3 to=4 fromsection=a />."""
    a = {k: v1 or v2 for k, v1, v2 in re.findall(r'(\w+)=(?:"([^"]*)"|([^\s/]+))', m.group(1))}
    nums = [int(x) for x in re.findall(r"\d+", a.get("include", ""))]
    if "from" in a:
        nums = range(int(a["from"]), int(a.get("to", a["from"])) + 1)
    text = "\n".join(_get(f"Page:{a['index']}/{n}", cache) for n in nums)
    sec = a.get("fromsection") or a.get("onlysection")
    if sec:
        s = re.escape(sec)
        text = "\n".join(re.findall(rf'<section begin="?{s}"? ?/>(.*?)<section end="?{s}"? ?/>', text, flags=re.S))
    return text


def fetch(title, cache):
    """Wikitext of one Wikisource page, with any transcluded scan pages filled in."""
    return re.sub(r"<pages\s+([^>]*?)/>", lambda m: _pages_tag(m, cache), _get(title, cache))


def _strip_templates(s):
    pat = re.compile(r"\{\{([^{}]*)\}\}")
    while True:  # innermost first
        def sub(m):
            name, _, rest = m.group(1).partition("|")
            args = rest.split("|")
            if name.strip().lower() in KEEP and "=" not in args[0]:
                return args[0]
            return ""
        new = pat.sub(sub, s)
        if new == s:
            return s
        s = new


def _first_wrapper(s):
    """Text inside the first poem wrapper template (stops a page that holds the next poem too)."""
    m = WRAPPERS.search(s)
    if not m:
        return s
    depth, i, last = 0, m.start(), None
    while i < len(s):
        two = s[i:i + 2]
        if two in ("{{", "[["):
            depth += 1
            i += 2
        elif two in ("}}", "]]"):
            depth -= 1
            i += 2
            if depth == 0:
                break
        else:
            if s[i] == "|" and depth == 1:
                last = i
            i += 1
    return s[last + 1:i - 2] if last is not None else s


def _drawable(s):
    """The OS font draws plain ASCII and curly quotes but not dashes or accents: flatten those."""
    s = s.replace("—", "--").replace("–", "-")
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def _norm(line):
    return re.sub(r"[^a-z]+", " ", line.lower()).strip()


def _sentence_case(line):
    """'THERE is no frigate' -> 'There is no frigate' (small-capital openings); other lines stay as they are."""
    words = line.split(" ")
    changed = False
    for i, w in enumerate(words[:-1]):
        core = re.sub(r"[^A-Za-z']", "", w)
        if len(core) > 1 and core.isupper():
            words[i] = w.lower()
            changed = True
        elif not (i == 0 and len(core) == 1 and words[1][:1].isupper()):
            break
    if not changed:
        return line
    out = " ".join(words)
    return out[:1].upper() + out[1:]


def clean(wikitext, names=()):
    """Wikitext to a list of stanzas, each a list of plain lines. `names` are titles to drop if repeated as headings."""
    s = re.sub(r"<noinclude>.*?</noinclude>|<!--.*?-->|<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", wikitext, flags=re.S)
    blocks = re.findall(r"<poem[^>]*>(.*?)</poem>", s, flags=re.S)
    s = "\n\n".join(blocks) if blocks else s
    s = JUNK.sub("", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    if not blocks:
        s = _first_wrapper(s)
    s = _strip_templates(s)
    s = re.sub(r"</?br\s*/?>[ \t]*\n?", "\n", s, flags=re.I)
    s = re.sub(r"</?[a-zA-Z][^>]*>", "", s)
    s = _drawable(html.unescape(s)).replace("\xa0", " ").replace("<>", "")
    s = re.sub(r"'{2,}", "", s)
    titles = {_norm(n) for n in names}
    stanzas, cur = [], []
    for raw in s.split("\n"):
        line = raw.strip().lstrip(":").strip()
        heading = line.upper() == line and _norm(re.sub(r"^[IVXLC]+\.\s+", "", line)) in titles  # "AUTUMN."
        if (re.fullmatch(r"\d+\.?", line) or ROMAN.fullmatch(line) or heading
                or line.startswith(("=", "{", "|", "}", "__", "*", ">"))):
            continue  # line numbers, headings, leftover markup
        if line:
            cur.append(re.sub(r"\s+", " ", line))
        elif cur:
            stanzas.append(cur)
            cur = []
    if cur:
        stanzas.append(cur)
    if stanzas:
        stanzas[0][0] = _sentence_case(stanzas[0][0])
    return stanzas


def paginate(stanzas, author):
    """Pages that fit the screen: whole stanzas where possible, long stanzas split between lines.
    The last page ends with the author line, or gets a page of its own when it will not fit."""
    pages, cur = [], ""
    for st in stanzas:
        text = "\n".join(st)
        joined = f"{cur}\n\n{text}" if cur else text
        if fits(joined):
            cur = joined
            continue
        if cur:
            pages.append(cur)
            cur = ""
        if fits(text):
            cur = text
            continue
        for line in st:  # a stanza too tall for one page: split between lines
            trial = f"{cur}\n{line}" if cur else line
            if cur and not fits(trial):
                pages.append(cur)
                cur = line
            else:
                cur = trial
    pages.append(cur)
    sign = f"- {author}"
    if fits(f"{pages[-1]}\n{sign}"):
        pages[-1] += f"\n{sign}"
    else:
        pages.append(sign)
    return pages


def slug(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower().replace("'", "")).strip("-")


def to_entry(item, stanzas):
    wiki = urllib.parse.quote(item["wikisource"].replace(" ", "_"), safe="/:,()'!?;")
    return {"id": slug(item["title"]), "title": item["title"], "topic": "poetry",
            "source": "https://en.wikisource.org/wiki/" + wiki,
            "author": item["author"], "pages": paginate(stanzas, item["author"])}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(Path(tempfile.gettempdir()) / "spiral-poems-cache"))
    a = ap.parse_args()
    Path(a.cache).mkdir(parents=True, exist_ok=True)
    out, bad = [], []
    for item in json.loads(LIST.read_text(encoding="utf-8")):
        try:
            names = (item["title"], item["wikisource"].rsplit("/", 1)[-1])
            entry = to_entry(item, clean(fetch(item["wikisource"], a.cache), names))
            if len(entry["pages"]) > MAX_PAGES:
                raise ValueError(f"{len(entry['pages'])} pages is too long")
            out.append(entry)
        except Exception as e:  # report every failure, keep going
            bad.append(f"{item['title']}: {e}")
    for b in bad:
        print("FAILED", b)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(out)} poems to {OUT}")


if __name__ == "__main__":
    main()
