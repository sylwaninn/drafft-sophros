#!/usr/bin/env python3
"""Fetches the demo pictures: stock portraits for profiles and selfies, stock scenes for chat photos.

    python3 scripts/demo/photos.py <out dir> <list>

<list> has one `key|label` per line (printed by up.sql); each picture is written to <out>/<key>. Sources
are free placeholder services (i.pravatar.cc portraits, picsum.photos scenes), cached in .demo-cache so a
second `demo.sh up` works offline. Without network and cache, a drawn silhouette stands in.
"""
from __future__ import annotations

import hashlib
import pathlib
import re
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
CACHE = ROOT / ".demo-cache"

# Portraits per demo account (i.pravatar.cc ids: adults only, one set per person). Hugo's new account
# reuses his photos, as ban evasion does.
PORTRAITS = {
    1: [32, 26, 36, 27], 2: [13, 11, 14], 3: [13, 53, 11], 4: [45, 44, 28, 47], 5: [19, 9, 23],
    6: [59, 60, 58], 7: [20, 24, 21], 8: [12, 57, 54], 9: [31, 41, 43], 10: [52, 61, 55],
    11: [42, 38, 30], 13: [16, 34, 35], 14: [68, 56, 67, 51],
}
SELFIES = {4: 45}


def source(key: str) -> str:
    account = re.search(r"de000000-0000-4000-8000-0*(\d+)/", key)
    n = int(account.group(1)) if account else 0
    if "/chat/" in key:
        return f"https://picsum.photos/seed/{hashlib.sha1(key.encode()).hexdigest()[:10]}/600/800"
    if key.endswith("selfie.jpg"):
        return f"https://i.pravatar.cc/600?img={SELFIES.get(n, 5)}"
    pos = int(re.search(r"/p(\d+)\.jpg$", key).group(1))
    ids = PORTRAITS.get(n, [5])
    return f"https://i.pravatar.cc/600?img={ids[pos % len(ids)]}"


def fetch(url: str) -> bytes | None:
    cached = CACHE / hashlib.sha1(url.encode()).hexdigest()
    if cached.exists():
        return cached.read_bytes()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "sophros-demo"})
        with urllib.request.urlopen(req, timeout=20) as res:
            data = res.read()
    except OSError:
        return None
    CACHE.mkdir(exist_ok=True)
    cached.write_bytes(data)
    return data


def silhouette(label: str) -> Image.Image:
    img = Image.new("RGB", (600, 800), "#d4d4d8")
    d = ImageDraw.Draw(img)
    d.ellipse((200, 190, 400, 400), fill="#a1a1aa")
    d.rounded_rectangle((120, 430, 480, 900), radius=160, fill="#a1a1aa")
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 40)
    except OSError:
        font = ImageFont.load_default()
    d.text((32, 720), label, font=font, fill="#18181b")
    return img


def main() -> None:
    out = pathlib.Path(sys.argv[1])
    for line in pathlib.Path(sys.argv[2]).read_text().split():
        key, _, label = line.partition("|")
        path = out / key
        path.parent.mkdir(parents=True, exist_ok=True)
        data = fetch(source(key))
        if data:
            path.write_bytes(data)
        else:
            silhouette(label.replace("_", " ")).save(path, "JPEG", quality=82)


if __name__ == "__main__":
    main()
