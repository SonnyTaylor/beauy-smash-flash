"""Process glock.png: key black to transparent, detect muzzle + grip pivot."""
from __future__ import annotations

import json
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "assets" / "weapons" / "glock.png"
OUT = SRC
META = ROOT / "src" / "content" / "weapons" / "glock.json"

BLACK_THRESH = 28
MUZZLE_SLICE = 0.08  # rightmost 8% of opaque bbox width


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    opaque = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 10 and (r > BLACK_THRESH or g > BLACK_THRESH or b > BLACK_THRESH):
                opaque.append((x, y))

    if not opaque:
        raise SystemExit("No opaque pixels found in glock image")

    xs = [p[0] for p in opaque]
    ys = [p[1] for p in opaque]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    bbox_w = max_x - min_x + 1

    muzzle_x_cut = max_x - int(bbox_w * MUZZLE_SLICE)
    muzzle_pts = [(x, y) for x, y in opaque if x >= muzzle_x_cut]
    muzzle_x = sum(p[0] for p in muzzle_pts) / len(muzzle_pts)
    muzzle_y = sum(p[1] for p in muzzle_pts) / len(muzzle_pts)

    # Grip pivot: left third of bbox, vertical center of mass
    grip_x_cut = min_x + bbox_w // 3
    grip_pts = [(x, y) for x, y in opaque if x <= grip_x_cut]
    grip_x = sum(p[0] for p in grip_pts) / len(grip_pts)
    grip_y = sum(p[1] for p in grip_pts) / len(grip_pts)

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r <= BLACK_THRESH and g <= BLACK_THRESH and b <= BLACK_THRESH:
                pixels[x, y] = (0, 0, 0, 0)

    img.save(OUT)

    meta = {
        "id": "glock",
        "sprite": "weapons/glock.png",
        "width": w,
        "height": h,
        "displayScale": round(80 / w, 4),
        "orbitRadius": 34,
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
