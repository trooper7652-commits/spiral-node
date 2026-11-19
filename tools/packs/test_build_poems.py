import json
from pathlib import Path

import build_poems as b

HERE = Path(__file__).resolve().parent
POEMS = json.loads((HERE / "poems_list.json").read_text(encoding="utf-8"))
OUT = json.loads(b.OUT.read_text(encoding="utf-8"))

FIXTURE = """{{header
 | title = [[../|Poems]]
 | section = Autumn
}}
<noinclude><pagequality level="3" />{{rh||POEMS.|12}}</noinclude>{{c|XXVIII.}}

{{c|AUTUMN.}}

{{block center|
{{di|T}}HE morns are meeker than they were,<br />
{{em}}The nuts are getting brown;<br />
The berry's cheek is [[plump|plumper]],<ref>a note</ref><br />
The rose is out of town.

The maple wears a gayer ''scarf'',<br />
The field a scarlet gown.
}}
{{nop}}<noinclude><references/></noinclude>
"""


def test_poem_list_is_public_domain():
    assert len(POEMS) >= 60
    for p in POEMS:
        assert p["published"] < 1931, p["title"]
        assert p["author_died"] < 1956, p["title"]
        assert p["wikisource"] and p["author"] and p["title"]


def test_cleaning_keeps_stanzas():
    assert b.clean(FIXTURE, ("Autumn",)) == [
        ["The morns are meeker than they were,", "The nuts are getting brown;",
         "The berry's cheek is plumper,", "The rose is out of town."],
        ["The maple wears a gayer scarf,", "The field a scarlet gown."]]


def test_cleaning_drops_headings_and_poem_tags():
    text = "{{c|THE SOLDIER}}\n<poem>\n1\nIf I should die,\n\nThat is for ever England.\n</poem>\n[[Category:Poems]]"
    assert b.clean(text, ("The Soldier",)) == [["If I should die,"], ["That is for ever England."]]


def test_every_page_fits_without_ellipsis():
    assert len(OUT) == 60
    for poem in OUT:
        for page in poem["pages"]:
            assert b.fits(page), (poem["id"], page)
            font, lines = b.fit_text(page, *b.body_box())
            assert font.size >= 12 and not any(l.endswith("\u2026") for l in lines)


def test_poems_have_sources():
    for poem in OUT:
        assert poem["source"].startswith("https://en.wikisource.org/wiki/"), poem["id"]
        assert poem["topic"] == "poetry" and poem["author"] and poem["pages"]
        assert poem["pages"][-1].endswith("- " + poem["author"])


def test_pagination_splits_between_lines_and_signs_last_page():
    long_stanza = [f"line number {i} of a long stanza" for i in range(12)]
    pages = b.paginate([long_stanza], "A. Poet")
    assert len(pages) > 1 and all(b.fits(p) for p in pages)
    assert "\n".join(l for p in pages for l in p.split("\n") if not l.startswith("- ")) == "\n".join(long_stanza)
    assert pages[-1].endswith("- A. Poet")
    full = b.paginate([[f"l{i}" for i in range(5)]], "A. Poet")  # five lines fill the page: signature goes alone
    assert full[-1] == "- A. Poet"


def test_pages_use_only_drawable_characters():
    for poem in OUT:  # the OS font has no dashes or accents; curly quotes and the ellipsis are fine
        for page in poem["pages"]:
            assert all(ord(c) < 127 or c in "\u2018\u2019\u201c\u201d\u2026" for c in page), (poem["id"], page)
