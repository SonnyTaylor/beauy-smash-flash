"""Generate a simple square app icon for Tauri bundling."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "branding" / "app-icon.png"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    size = 1024
    img = Image.new("RGBA", (size, size), (8, 11, 22, 255))
    draw = ImageDraw.Draw(img)

    margin = 96
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=180,
        fill=(12, 18, 36, 255),
        outline=(0, 255, 255, 255),
        width=10,
    )

    try:
        font = ImageFont.truetype("arialbd.ttf", 220)
    except OSError:
        font = ImageFont.load_default()

    draw.text((size // 2, size // 2), "BSF", fill=(240, 248, 255, 255), anchor="mm", font=font)
    img.save(OUT)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
