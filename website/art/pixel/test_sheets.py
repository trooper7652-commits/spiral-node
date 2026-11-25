from PIL import Image

from .build import OUT
from .palette import PALETTE
from .sheets import SCENES, compose_at, main


def test_size():
    assert compose_at(OUT / "desk" / "wide", 0).size == (576, 360)


def test_moves():
    d = OUT / "desk" / "wide"
    assert compose_at(d, 0).tobytes() != compose_at(d, 1000).tobytes()


def test_palette_only():
    im = compose_at(OUT / "shell" / "tall", 0)
    ok = {c[:3] for c in PALETTE.values()}
    assert all(p[:3] in ok for p in im.getdata() if p[3] > 0)


def test_main(tmp_path):
    assert main([str(tmp_path)]) == 0
    names = [f"sheet-wide-{i}.png" for i in range(1, 5)] + ["sheet-tall-1.png", "sheet-tall-2.png", "cast.png"]
    names += [f"{s}-{v}.gif" for s, _ in SCENES for v in ("wide", "tall")]
    for n in names:
        assert (tmp_path / n).exists(), n
    for n in names:
        if n.endswith(".gif"):
            with Image.open(tmp_path / n) as im:
                # Pillow merges identical neighbouring frames and adds their durations, so check the loop length
                total = 0
                for i in range(im.n_frames):
                    im.seek(i)
                    total += im.info["duration"]
                assert im.n_frames >= 2 and total == 2000, n
