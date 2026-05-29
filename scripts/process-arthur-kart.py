"""Copy Arthur go-kart cutout into public/assets (trim transparent margins)."""
from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(r"C:\Users\Sonny Taylor\Code\clients\arthur-atran\public\images\cutout\hero-action.png")
OUT = ROOT / "public" / "assets" / "arthur_kart.png"
PAD = 8


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Source not found: {SRC}")

    img = Image.open(SRC).convert("RGBA")
    bbox = img.getchannel("A").getbbox()
    if bbox:
        left, top, right, bottom = bbox
        left = max(0, left - PAD)
        top = max(0, top - PAD)
        right = min(img.width, right + PAD)
        bottom = min(img.height, bottom + PAD)
        img = img.crop((left, top, right, bottom))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(f"Wrote {OUT} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
