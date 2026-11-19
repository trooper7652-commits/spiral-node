import check_sources as c

FACT = {"id": "f1", "check": "88 days", "source": "https://science.nasa.gov/x"}


def run(page, facts=(FACT,)):
    return c.check_facts(list(facts), fetch=lambda url: page)


def test_check_present_passes():
    assert run("<p>Mercury orbits in 88 Days.</p>") == []


def test_check_absent_fails():
    assert run("<p>Venus takes 225 days.</p>") == [("f1", "88 days", FACT["source"])]


def test_tags_between_words_do_not_break_match():
    assert run("<p>about <b>88</b>\n<i>days</i></p><script>x</script>") == []


def test_script_text_is_ignored_and_each_url_fetched_once():
    calls = []

    def fetch(url):
        calls.append(url)
        return "<script>88 days</script>"
    assert len(c.check_facts([FACT, dict(FACT, id="f2")], fetch=fetch)) == 2 and len(calls) == 1
