"""Trim transparent margins from Lachy pet sprite."""
from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = Path.home() / "Downloads" / "lachie.png"
OUT = ROOT / "public" / "assets" / "lachy.png"
PAD = 10


def trim_transparent(img: Image.Image, pad: int = PAD) -> Image.Image:
    img = img.convert("RGBA")
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        return img

    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width, right + pad)
    bottom = min(img.height, bottom + pad)
    return img.crop((left, top, right, bottom))


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Process Lachy pet PNG")
    parser.add_argument(
        "src",
        nargs="?",
        type=Path,
        default=DEFAULT_SRC,
        help=f"Source image (default: {DEFAULT_SRC})",
    )
    parser.add_argument("--pad", type=int, default=PAD, help="Padding after trim")
    args = parser.parse_args()

    src = args.src.expanduser().resolve()
    if not src.is_file():
        raise SystemExit(f"Source not found: {src}")

    img = trim_transparent(Image.open(src), pad=args.pad)
    img = img.transpose(Image.FLIP_LEFT_RIGHT)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT)
    print(f"Wrote {OUT} ({img.size[0]}x{img.size[1]})")


if __name__ == "__main__":
    main()
