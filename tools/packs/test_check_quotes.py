import check_quotes as c

Q = {"id": "q1", "check": "the only thing we have to fear", "source": "https://en.wikiquote.org/wiki/X"}


def page(sourced, heading="Misattributed", after="the only thing we have to fear"):
    return (f'<body><nav><a href="#toc-{heading}" id="toc-{heading}">x</a></nav><p>{sourced}</p>'
            f'<div class="mw-heading"><h2 id="{heading}">{heading}</h2></div><p>{after}</p></body>')


def run(html, quotes=(Q,)):
    return c.check_quotes(list(quotes), fetch=lambda url: html)


def test_check_passes_in_sourced_section():
    assert run(page("The only thing we have to fear is fear itself.", after="nothing")) == []


def test_check_fails_in_misattributed_section():
    assert run(page("Other words.")) == [("q1", Q["check"], Q["source"])]


def test_check_fails_in_quotes_about_section():
    assert len(run(page("Other words.", "Quotes_about"))) == 1


def test_check_fails_in_attributed_section():
    assert len(run(page("Other words.", "Attributed"))) == 1


def test_older_markup_headline_span_stops_too():
    old = '<p>Other words.</p><h2><span class="mw-headline" id="Disputed">Disputed</span></h2><p>the only thing we have to fear</p>'
    assert len(run(old)) == 1


def test_quote_only_in_data_mw_attribute_before_sourced_text_fails():
    html = ('<div data-mw="==Misattributed==\n* &lt;ref&gt;x&lt;/ref&gt; the only thing we have to fear is">x</div>'
            '<div data-mw=\'{"w":"==Misattributed==\n* <ref>x</ref> the only thing we have to fear is"}\'><p>Other words.</p></div>'
            '<h2 id="Misattributed">Misattributed</h2>')
    assert len(run(html)) == 1


def test_check_fails_when_only_in_misquote_note():
    html = '<p>Real words. Sometimes misquoted as: "the only thing we have to fear is"</p>'
    assert len(run(html)) == 1
    assert run(html, [dict(Q, check="Real words")]) == []


def test_curly_and_straight_quotes_match():
    q = dict(Q, check="it's a \"fine\" day indeed")
    assert run("<p>It’s a “fine”  day indeed</p>", [q]) == []
    q = dict(Q, check="it’s a “fine” day indeed")
    assert run("<p>It's a \"fine\" day indeed</p>", [q]) == []
