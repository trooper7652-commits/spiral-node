"""Plain word search over the libraries of every installed script."""
import json
from dataclasses import dataclass


@dataclass(frozen=True)
class Hit:
    title: str
    text: str
    source: str
    script: str


def _entries(folder):
    """(id, title, text, topic, source) for each searchable entry in the folder's *.json files; bad files are skipped."""
    for path in sorted(folder.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(data, list):
            continue
        for r in data:
            if not isinstance(r, dict) or not isinstance(r.get("id"), str) or "answer" in r or "steps" in r:
                continue  # quiz items and puzzles (chess puzzles have steps) are questions, not facts to show
            title = r.get("title") if isinstance(r.get("title"), str) else ""
            text = r.get("text") if isinstance(r.get("text"), str) else ""
            if not text and isinstance(r.get("pages"), list) and r["pages"] and isinstance(r["pages"][0], str):
                text = r["pages"][0]
            if not (title or text):
                continue
            topic = r.get("topic") if isinstance(r.get("topic"), str) else ""
            source = r.get("source") if isinstance(r.get("source"), str) else ""
            if not source.strip():
                continue  # every hit is shown with its source
            yield r["id"], title, text, topic, source


def search(app, query: str, limit: int = 30) -> list[Hit]:
    """Entries whose title, text or topic contain every word of the query (any case), by script name then id."""
    words = query.lower().split()
    if len(query.strip()) < 2 or not words:
        return []
    found = []
    for info in app.scripts.values():
        if info.error:
            continue
        for eid, title, text, topic, source in _entries(info.folder):
            hay = f"{title} {text} {topic}".lower()
            if all(w in hay for w in words):
                found.append((info.name, eid, Hit(title, text or title, source, info.name)))
    found.sort(key=lambda t: (t[0], t[1]))
    return [h for _, _, h in found[:limit]]
