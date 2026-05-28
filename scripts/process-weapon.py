"""Process a weapon PNG: key light backgrounds, detect pivot/muzzle, write JSON metadata."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
WHITE_THRESH = 245
BLACK_THRESH = 28
MUZZLE_SLICE = 0.1


def key_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a <= 10:
                continue
            if r >= WHITE_THRESH and g >= WHITE_THRESH and b >= WHITE_THRESH:
                pixels[x, y] = (0, 0, 0, 0)
            elif r <= BLACK_THRESH and g <= BLACK_THRESH and b <= BLACK_THRESH:
                pixels[x, y] = (0, 0, 0, 0)
    return img


def detect_meta(img: Image.Image, weapon_id: str, display_size: float, orbit: float, rotation: float):
    pixels = img.load()
    w, h = img.size
    opaque = []
    for y in range(h):
        for x in range(w):
            if pixels[x, y][3] > 10:
                opaque.append((x, y))
    if not opaque:
        raise SystemExit(f"No opaque pixels in {weapon_id}")

    xs = [p[0] for p in opaque]
    ys = [p[1] for p in opaque]
    min_x, max_x = min(xs), max(xs)
    bbox_w = max_x - min_x + 1

    muzzle_x_cut = max_x - int(bbox_w * MUZZLE_SLICE)
    muzzle_pts = [(x, y) for x, y in opaque if x >= muzzle_x_cut]
    muzzle_x = sum(p[0] for p in muzzle_pts) / len(muzzle_pts)
    muzzle_y = sum(p[1] for p in muzzle_pts) / len(muzzle_pts)

    grip_x_cut = min_x + bbox_w // 3
    grip_pts = [(x, y) for x, y in opaque if x <= grip_x_cut]
    grip_x = sum(p[0] for p in grip_pts) / len(grip_pts)
    grip_y = sum(p[1] for p in grip_pts) / len(grip_pts)

    return {
        "id": weapon_id,
        "sprite": f"weapons/{weapon_id}.png",
        "width": w,
        "height": h,
        "displayScale": round(display_size / max(w, h), 4),
        "orbitRadius": orbit,
        "pivot": {"x": round(grip_x / w, 4), "y": round(grip_y / h, 4)},
        "muzzle": {"x": round(muzzle_x / w, 4), "y": round(muzzle_y / h, 4)},
        "defaultRotation": rotation,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("weapon_id")
    parser.add_argument("--display-size", type=float, default=80.0)
    parser.add_argument("--orbit", type=float, default=30.0)
    parser.add_argument("--rotation", type=float, default=0.0)
    parser.add_argument("--rotate-deg", type=float, default=0.0)
    parser.add_argument("--flip-x", action="store_true")
    args = parser.parse_args()

    src = ROOT / "public" / "assets" / "weapons" / f"{args.weapon_id}.png"
    meta_path = ROOT / "src" / "content" / "weapons" / f"{args.weapon_id}.json"
    ts_path = ROOT / "src" / "content" / "weapons" / f"{args.weapon_id}.ts"

    img = Image.open(src)
    if args.flip_x:
        img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if args.rotate_deg:
        img = img.rotate(args.rotate_deg, expand=True, resample=Image.Resampling.BICUBIC)
    img = key_background(img)
    img.save(src)

    meta = detect_meta(img, args.weapon_id, args.display_size, args.orbit, args.rotation)
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")

    const = args.weapon_id.upper()
    ts_path.write_text(
        f"import meta from './{args.weapon_id}.json';\n"
        f"import type {{ WeaponMeta }} from './types';\n\n"
        f"export const {const}_WEAPON: WeaponMeta = meta;\n",
        encoding="utf-8",
    )
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
