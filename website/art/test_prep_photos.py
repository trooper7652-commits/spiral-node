from PIL import Image

from prep_photos import main


def _gps_exif() -> Image.Exif:
    exif = Image.Exif()
    exif[0x0110] = "Cam"  # Model
    exif[0x0112] = 6  # Orientation: rotated
    gps = exif.get_ifd(0x8825)  # GPS IFD
    gps[1] = "N"
    gps[2] = (1.0, 2.0, 3.0)
    return exif


def _make(path, size, exif=None):
    img = Image.new("RGB", size, (120, 90, 60))
    if exif is None:
        img.save(path, "JPEG")
    else:
        img.save(path, "JPEG", exif=exif)
    return path


def test_output_has_no_exif_or_gps(tmp_path):
    src = tmp_path / "in"
    src.mkdir()
    _make(src / "shot.jpg", (800, 600), exif=_gps_exif())
    with Image.open(src / "shot.jpg") as im:
        assert im.getexif().get(0x8825) is not None  # the source really carries GPS
    out = tmp_path / "out"
    assert main([str(src), str(out)]) == 0
    with Image.open(out / "shot.jpg") as im:
        assert len(im.getexif()) == 0
        assert "exif" not in im.info
        assert 0x8825 not in im.getexif()


def test_long_edge_is_1600_and_ratio_4_3(tmp_path):
    src = tmp_path / "in"
    src.mkdir()
    _make(src / "wide.jpg", (4000, 2000))
    _make(src / "tall.jpg", (2000, 4000))
    out = tmp_path / "out"
    assert main([str(src), str(out)]) == 0
    with Image.open(out / "wide.jpg") as im:
        assert im.size == (1600, 1200)
    with Image.open(out / "tall.jpg") as im:
        assert im.size == (1200, 1600)


def test_shared_stem_is_not_overwritten(tmp_path):
    src = tmp_path / "in"
    src.mkdir()
    _make(src / "a.jpg", (800, 600))
    Image.new("RGB", (400, 300), (10, 20, 30)).save(src / "a.png")
    out = tmp_path / "out"
    assert main([str(src), str(out)]) == 0
    assert sorted(p.name for p in out.iterdir()) == ["a-png.jpg", "a.jpg"]
    with Image.open(out / "a.jpg") as im:
        assert im.size == (800, 600)
    with Image.open(out / "a-png.jpg") as im:
        assert im.size == (400, 300)
