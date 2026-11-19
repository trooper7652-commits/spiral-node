import subprocess
import sys
from pathlib import Path

from PIL import Image

OS_DIR = Path(__file__).resolve().parent.parent


def test_snapshot_headless(tmp_path):
    png = tmp_path / "s.png"
    r = subprocess.run([sys.executable, "-m", "spiral", "--data-dir", str(tmp_path / "d"),
                        "--snapshot", str(png)], cwd=OS_DIR, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    assert Image.open(png).size == (250, 122)


def test_no_snapshot_prints_help_and_exits_0(tmp_path):
    r = subprocess.run([sys.executable, "-m", "spiral", "--data-dir", str(tmp_path)],
                       cwd=OS_DIR, capture_output=True, text=True)
    assert r.returncode == 0 and "browser" in r.stdout
