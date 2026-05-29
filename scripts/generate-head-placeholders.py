"""Generate colored placeholder head PNGs (initials) for loadout/arena fallback.

Skips files that already exist — use --force to overwrite.
"""
from __future__ import annotations

import argparse
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "heads"
SIZE = 128

# id, initials, RGB
ROSTER = [
    ("sonny", "SN", (0, 255, 255)),
    ("bailey", "BL", (255, 0, 128)),
    ("jacob", "JC", (50, 255, 50)),
    ("isaak", "IS", (255, 200, 0)),
    ("taj", "TJ", (255, 80, 80)),
    ("finn", "FN", (180, 100, 255)),
    ("sifan", "SF", (255, 160, 60)),
    ("connor", "CN", (140, 180, 255)),
    ("archie", "AR", (255, 120, 200)),
    ("arthur", "AT", (200, 80, 40)),
    ("oscar", "OG", (255, 220, 100)),
    ("vlad", "VL", (160, 60, 220)),
    ("luca", "LC", (100, 140, 70)),
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing head PNGs (default: only create missing)",
    )
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("arial.ttf", 48)
    except OSError:
        font = ImageFont.load_default()

    written = 0
    skipped = 0
    for char_id, initials, rgb in ROSTER:
        out_path = OUT_DIR / f"{char_id}.png"
        if out_path.exists() and not args.force:
            skipped += 1
            print(f"Skip {out_path} (already exists)")
            continue

        img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        pad = 8
        draw.ellipse(
            (pad, pad, SIZE - pad, SIZE - pad),
            fill=(*rgb, 255),
            outline=(255, 255, 255, 200),
            width=3,
        )
        bbox = draw.textbbox((0, 0), initials, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = (SIZE - tw) // 2 - bbox[0]
        ty = (SIZE - th) // 2 - bbox[1]
        draw.text((tx, ty), initials, fill=(255, 255, 255, 255), font=font)
        img.save(out_path)
        written += 1
        print(f"Wrote {out_path}")

    print(f"Done — wrote {written}, skipped {skipped} in {OUT_DIR}")


if __name__ == "__main__":
    main()
