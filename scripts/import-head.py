"""Import a source image into public/assets/heads/<id>.png."""
from __future__ import annotations

import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "heads"
OUT_SIZE = 128
ALPHA_PAD = 10


def focus_square_crop(
    img: Image.Image,
    focus_x: float = 0.5,
    focus_y: float = 0.5,
) -> Image.Image:
    """Crop a square centered on a normalized point (0–1) in the source image."""
    w, h = img.size
    side = min(w, h)
    cx = int(focus_x * w)
    cy = int(focus_y * h)
    left = max(0, min(cx - side // 2, w - side))
    top = max(0, min(cy - side // 2, h - side))
    return img.crop((left, top, left + side, top + side))


def center_square_crop(img: Image.Image) -> Image.Image:
    return focus_square_crop(img, 0.5, 0.5)


def zoom_center_square(img: Image.Image, factor: float) -> Image.Image:
    """factor > 1 zooms in; 0 < factor < 1 zooms out (more padding around face)."""
    if factor == 1.0:
        return img
    w, h = img.size
    side = min(w, h)
    if factor > 1.0:
        crop_side = max(1, int(side / factor))
        left = (w - crop_side) // 2
        top = (h - crop_side) // 2
        return img.crop((left, top, left + crop_side, top + crop_side))

    if w != h:
        img = center_square_crop(img)
        side = img.size[0]
    new_side = max(1, int(side * factor))
    scaled = img.resize((new_side, new_side), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    offset = (side - new_side) // 2
    canvas.paste(scaled, (offset, offset), scaled)
    return canvas


def trim_transparent(img: Image.Image, pad: int = ALPHA_PAD) -> Image.Image:
    img = img.convert("RGBA")
    bbox = img.getchannel("A").getbbox()
    if not bbox:
        return img

    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width, right + pad)
    bottom = min(img.height, bottom + pad)
    cropped = img.crop((left, top, right, bottom))

    w, h = cropped.size
    side = max(w, h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - w) // 2, (side - h) // 2), cropped)
    return square


def import_head(
    src: Path,
    char_id: str,
    trim_alpha: bool,
    *,
    pad: int = ALPHA_PAD,
    zoom: float = 1.0,
    focus_x: float = 0.5,
    focus_y: float = 0.5,
) -> Path:
    if not src.is_file():
        raise SystemExit(f"Source not found: {src}")

    img = Image.open(src).convert("RGBA")
    if trim_alpha:
        img = trim_transparent(img, pad=pad)
    else:
        img = focus_square_crop(img, focus_x, focus_y)

    if zoom != 1.0:
        img = zoom_center_square(img, zoom)

    img = img.resize((OUT_SIZE, OUT_SIZE), Image.Resampling.LANCZOS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{char_id}.png"
    img.save(out_path)
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Import character head PNG")
    parser.add_argument("id", help="Character id (e.g. arthur)")
    parser.add_argument("src", type=Path, help="Source image path")
    parser.add_argument(
        "--trim-alpha",
        action="store_true",
        help="Crop to non-transparent bounds and pad to square",
    )
    parser.add_argument(
        "--pad",
        type=int,
        default=ALPHA_PAD,
        help="Transparent trim padding in px (default 10)",
    )
    parser.add_argument(
        "--zoom",
        type=float,
        default=1.0,
        help="Zoom: >1 crops tighter, <1 zooms out (e.g. 0.85)",
    )
    parser.add_argument(
        "--focus-x",
        type=float,
        default=0.5,
        help="Horizontal crop focus 0–1 (default 0.5 = center)",
    )
    parser.add_argument(
        "--focus-y",
        type=float,
        default=0.5,
        help="Vertical crop focus 0–1 (default 0.5 = center)",
    )
    args = parser.parse_args()
    out = import_head(
        args.src.resolve(),
        args.id,
        args.trim_alpha,
        pad=args.pad,
        zoom=args.zoom,
        focus_x=args.focus_x,
        focus_y=args.focus_y,
    )
    print(f"Wrote {out} ({OUT_SIZE}x{OUT_SIZE})")


if __name__ == "__main__":
    main()
