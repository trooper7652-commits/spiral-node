# Quick Story

Short stories told one page at a time: Aesop's animal tales, myths, folk tales and legends, retold in our own words from collections published before 1931 (all in the public domain). Each story's `source` names the collection and links to it.

`stories.json` is a list of `{id, title, topic, source, pages}`. Every page has to fit the screen; `python -m pytest -q tests/test_quick_story.py` (run from `os/`) checks the library.