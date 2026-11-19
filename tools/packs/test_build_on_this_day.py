import json
from pathlib import Path

import build_on_this_day as b

OUT = json.loads(b.OUT.read_text(encoding="utf-8"))


def ev(year, text, url="https://en.wikipedia.org/wiki/X"):
    return {"year": year, "text": text, "pages": [{"content_urls": {"desktop": {"page": url}}}]}


def test_keeps_five_shortest_by_year():
    data = {"selected": [ev(1900 + i, f"Event {i}.") for i in (6, 2, 9, 1, 4, 3, 5)]
            + [ev(1800, "x" * 141), ev(1700, "No link.") | {"pages": []}]}
    got = b.entries_for("03-04", data)
    assert [e["text"][:4] for e in got] == ["1901", "1902", "1903", "1904", "1905"]  # too long / unlinked dropped


def test_entry_shape():
    got = b.entries_for("03-04", {"selected": [ev(1861, "Lincoln was “sworn” in – a café day.", "https://en.wikipedia.org/wiki/L")]})
    assert got == [{"id": "03-04-1861-1", "text": "1861: Lincoln was “sworn” in - a cafe day.",
                    "topic": "03-04", "source": "https://en.wikipedia.org/wiki/L"}]


def test_all_366_dates_present():
    have = {e["topic"] for e in OUT}
    assert {f"{m:02d}-{d:02d}" for m, d in b.DATES} <= have and len(b.DATES) == 366


def test_every_event_has_source():
    assert all(e["source"].startswith("https://en.wikipedia.org/wiki/") for e in OUT)
    assert len({e["id"] for e in OUT}) == len(OUT)


def test_every_event_fits_without_ellipsis():
    assert all(b.fits(e["text"]) for e in OUT)


def test_clean_maps_and_drops_undrawable():
    assert b.clean("Bolesław and Ælfric of Đorđe‑x co­op paid £45.") == "Boleslaw and Aelfric of Dorde-x coop paid 45 pounds."
    assert b.clean("Ancient 王 text") is None
    assert b.clean("He said “hi” and ‘bye’.") == "He said “hi” and ‘bye’."


def test_clean_strips_picture_notes_and_spacing():
    assert b.clean("Flag (flag pictured) raised and king (both depicted on coin) died.") == "Flag raised and king died."
    assert b.clean("Julius Caesar , the dictator ; ok : fine  here .") == "Julius Caesar, the dictator; ok: fine here."
    assert b.clean("Rome (founded 753 BC) fell.") == "Rome (founded 753 BC) fell."


def test_duplicates_within_date_dropped():
    got = b.entries_for("09-07", {"selected": [ev(1822, "Pedro declared."), ev(1822, "Pedro declared."), ev(1900, "Other.")]})
    assert [e["id"] for e in got] == ["09-07-1822-1", "09-07-1900-2"]


def test_clean_featured_notes_double_period_and_cut_off():
    assert b.clean("A poster (poster featured) and a song (audio featured) won.") == "A poster and a song won."
    assert b.clean("It ran in the U.S. (steam train pictured).") == "It ran in the U.S."
    assert b.clean("He waited... then left.") == "He waited... then left."
    assert b.clean("Captured the French commodore Francois") is None
    assert b.clean('She was crowned "King of Hungary".') == 'She was crowned "King of Hungary".'


def test_reworded_duplicate_in_same_year_dropped():
    a = 'Following Louis I\'s death without a male heir, his daughter Mary was crowned with the title of "King" of Hungary.'
    c = 'Following Louis I\'s death without a male heir, his daughter Mary was crowned with the title of "King of Hungary".'
    got = b.entries_for("09-17", {"selected": [ev(1382, a), ev(1382, c), ev(1382, "A different event entirely.")]})
    assert [e["text"] for e in got] == [f"1382: {a}", "1382: A different event entirely."]


def test_data_clean():
    import re
    for e in OUT:
        assert re.fullmatch(r"[ -~‘’“”]*", e["text"]), e["id"]
        assert not re.search(r"\s[,.;:]|  |\b(pictured|depicted|shown|illustrated|featured)\b|(?<!\.)\.\.(?!\.)", e["text"], re.I), e["id"]
        assert re.search(r"[.!?\"')’”]$", e["text"]), e["id"]
    assert len({(e["topic"], e["text"]) for e in OUT}) == len(OUT)
