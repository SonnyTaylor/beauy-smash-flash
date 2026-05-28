"""Process luca.png for zombie horde head sprite: crop transparent padding."""
from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SRC = Path.home() / "Downloads" / "luca.png"
OUT = ROOT / "public" / "assets" / "heads" / "luca.png"
ALPHA_THRESH = 10


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Source image not found: {SRC}")

    img = Image.open(SRC).convert("RGBA")
    bbox = img.getbbox()
    if bbox is None:
        raise SystemExit("Image is fully transparent")

    cropped = img.crop(bbox)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(OUT)

    print(f"Source: {SRC} ({img.size[0]}x{img.size[1]})")
    print(f"Wrote:  {OUT} ({cropped.size[0]}x{cropped.size[1]})")
    print(f"Crop bbox: {bbox}")


if __name__ == "__main__":
    main()
