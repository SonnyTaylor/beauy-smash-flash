"""Process yoghurt_effect.png: rotate spout to barrel-right, detect pivot/muzzle."""
from __future__ import annotations

import json
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "assets" / "weapons" / "yoghurt_effect.png"
OUT = SRC
META = ROOT / "src" / "content" / "weapons" / "yoghurt_effect.json"

WHITE_THRESH = 245
MUZZLE_SLICE = 0.12


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    # Product art has the spout at the top; rotate so it points right like other weapons.
    img = img.rotate(-90, expand=True, resample=Image.Resampling.BICUBIC)
    pixels = img.load()
    w, h = img.size

    opaque = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 10 and not (r >= WHITE_THRESH and g >= WHITE_THRESH and b >= WHITE_THRESH):
                opaque.append((x, y))
            elif a > 10:
                pixels[x, y] = (0, 0, 0, 0)

    if not opaque:
        raise SystemExit("No opaque pixels found in yoghurt image")

    xs = [p[0] for p in opaque]
    ys = [p[1] for p in opaque]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    bbox_w = max_x - min_x + 1

    muzzle_x_cut = max_x - int(bbox_w * MUZZLE_SLICE)
    muzzle_pts = [(x, y) for x, y in opaque if x >= muzzle_x_cut]
    muzzle_x = sum(p[0] for p in muzzle_pts) / len(muzzle_pts)
    muzzle_y = sum(p[1] for p in muzzle_pts) / len(muzzle_pts)

    grip_x_cut = min_x + bbox_w // 3
    grip_pts = [(x, y) for x, y in opaque if x <= grip_x_cut]
    grip_x = sum(p[0] for p in grip_pts) / len(grip_pts)
    grip_y = sum(p[1] for p in grip_pts) / len(grip_pts)

    img.save(OUT)

    meta = {
        "id": "yoghurt_effect",
        "sprite": "weapons/yoghurt_effect.png",
        "width": w,
        "height": h,
        "displayScale": round(72 / w, 4),
        "orbitRadius": 28,
        "pivot": {
            "x": round(grip_x / w, 4),
            "y": round(grip_y / h, 4),
        },
        "muzzle": {
            "x": round(muzzle_x / w, 4),
            "y": round(muzzle_y / h, 4),
        },
        "defaultRotation": 0,
    }

    META.parent.mkdir(parents=True, exist_ok=True)
    META.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Wrote {META}")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
