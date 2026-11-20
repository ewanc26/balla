#!/usr/bin/env python3
"""Generate Balla's app icons.

Pure standard library (no Pillow). The mark is a white brick on the brand
blue -- a wall, which is what "balla" means in Gàidhlig.

Run from the repo root:

    python3 scripts/gen-icons.py          # write the assets
    python3 scripts/gen-icons.py --check  # fail if committed assets drift

Hand-editing committed assets is never the fix; change the shapes and colours
here and regenerate, so the check and the files stay honest.
"""
import os
import sys
import struct
import zlib

BLUE = (24, 119, 242, 255)      # #1877F2
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

# (path, width, height, brick inset, background colour)
SPECS = [
    ("assets/icon.png", 1024, 1024, 0.30, BLUE),
    ("assets/adaptive-icon.png", 1024, 1024, 0.34, CLEAR),
    ("assets/splash-icon.png", 512, 512, 0.28, CLEAR),
    ("assets/favicon.png", 48, 48, 0.28, BLUE),
]


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def png_bytes(w: int, h: int, inset: float, background) -> bytes:
    x0, y0 = int(w * inset), int(h * inset)
    x1, y1 = int(w * (1 - inset)), int(h * (1 - inset))
    pixel_in = background == BLUE
    raw = b""
    for y in range(h):
        in_row = y0 <= y < y1
        row = bytearray()
        for x in range(w):
            is_brick = in_row and x0 <= x < x1
            if is_brick:
                row += bytes(WHITE)
            else:
                row += bytes(BLUE if pixel_in else CLEAR)
        raw += b"\x00" + row
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def main() -> int:
    check = "--check" in sys.argv[1:]
    failed = False
    rendered: dict = {}
    for path, w, h, inset, background in SPECS:
        rendered[path] = png_bytes(w, h, inset, background)

    for path, data in rendered.items():
        if check:
            try:
                with open(path, "rb") as f:
                    current = f.read()
            except FileNotFoundError:
                current = None
            if current != data:
                failed = True
                if current is None:
                    print("MISSING " + path)
                else:
                    print("DRIFT   " + path)
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as f:
                f.write(data)
            print("wrote " + path)

    if check:
        if failed:
            print("Committed icons do not match the script. Regenerate and commit:")
            print("    python3 scripts/gen-icons.py")
            return 1
        print("icons are current")
    return 0


if __name__ == "__main__":
    sys.exit(main())
