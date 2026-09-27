#!/usr/bin/env python3
"""Draws the demo pictures: a coloured silhouette per photo, never a real face.

    python3 scripts/demo/images.py <out dir> <list>

<list> has one `key|label` per line (printed by up.sql); each picture is written to <out>/<key>.
"""
import hashlib
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

PALETTE = ["#9fe870", "#38c8ff", "#ffc091", "#ffd11a", "#c5edab", "#e8ebe6", "#d9c8ff", "#ffb3c1"]


def font(size: int):
    for path in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw(key: str, label: str) -> Image.Image:
    seed = int(hashlib.sha256(key.encode()).hexdigest(), 16)
    bg = PALETTE[seed % len(PALETTE)]
    img = Image.new("RGB", (600, 800), bg)
    d = ImageDraw.Draw(img)
    ink = (14, 15, 12)
    shade = tuple(max(0, int(bg[i : i + 2], 16) - 60) for i in (1, 3, 5))
    # A silhouette, placed a little differently for each picture.
    dx = (seed >> 8) % 120 - 60
    d.ellipse((200 + dx, 190, 400 + dx, 400), fill=shade)
    d.rounded_rectangle((120 + dx, 430, 480 + dx, 900), radius=160, fill=shade)
    d.text((32, 32), "demo", font=font(34), fill=ink)
    d.text((32, 720), label, font=font(40), fill=ink)
    return img


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    for line in pathlib.Path(sys.argv[2]).read_text().split():
        key, _, label = line.partition("|")
        path = out / key
        path.parent.mkdir(parents=True, exist_ok=True)
        draw(key, label.replace("_", " ")).save(path, "JPEG", quality=82)


if __name__ == "__main__":
    main()
