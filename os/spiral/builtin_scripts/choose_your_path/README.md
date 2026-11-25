# Choose Your Path

Old tales and myths, retold so that you choose what happens next. Each starts from the old tale, then asks what might happen if you chose differently, and most endings are gentler than the original. Every story comes from a tale published before 1931, named in its `source`.

`stories.json`: each story has `nodes`; `start` is the first page, each choice node has 2-3 `options` (`label`, `to`), and endings have no options and end with "The end.". `python -m pytest -q tests/test_choose_your_path.py` (run from `os/`) checks that every node is reachable, nothing loops, every story has at least three endings, and every page fits the screen.
