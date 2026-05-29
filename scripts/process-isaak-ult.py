"""Copy Isaak chi ult art and key near-black background to transparent."""
from __future__ import annotations

from pathlib import Path
import shutil

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = Path(r"C:\Users\Sonny Taylor\Code\local-game\assets\heads\isaak_ult.png")
OUT = ROOT / "public" / "assets" / "heads" / "isaak_ult.png"
BLACK_THRESH = 42


def key_black_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 10:
                continue
            if r <= BLACK_THRESH and g <= BLACK_THRESH and b <= BLACK_THRESH:
                pixels[x, y] = (0, 0, 0, 0)
    return img


def main() -> None:
    src = DEFAULT_SRC
    if not src.is_file():
        raise SystemExit(f"Source not found: {src}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(src)
    img = key_black_background(img)
    img.save(OUT)
    print(f"Wrote {OUT} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
