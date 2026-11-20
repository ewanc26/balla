#!/usr/bin/env python3
"""Generate Balla's placeholder app icons.

Pure standard library (no Pillow). The mark is a simple white brick on the
brand blue -- a wall, which is what "balla" means in Gàidhlig.

Run once from the repo root:  python3 scripts/gen-icons.py
"""
import os
import struct
import zlib

BLUE = (24, 119, 242, 255)      # #1877F2
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: str, w: int, h: int, pixel) -> None:
    raw = b""
    for y in range(h):
        row = b""
        for x in range(w):
            row += bytes(pixel(x, y))
        raw += b"\x00" + row
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
    + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path)


def brick(x: int, y: int, w: int, h: int, inset: float) -> bool:
    x0, y0 = int(w * inset), int(h * inset)
    x1, y1 = int(w * (1 - inset)), int(h * (1 - inset))
    return x0 <= x < x1 and y0 <= y < y1


def main() -> None:
    os.makedirs("assets", exist_ok=True)

    # App icon: blue field, white brick.
    write_png("assets/icon.png", 1024, 1024, lambda x, y: WHITE if brick(x, y, 1024, 1024, 0.30) else BLUE)

    # Android adaptive foreground: transparent field, white brick.
    write_png("assets/adaptive-icon.png", 1024, 1024, lambda x, y: WHITE if brick(x, y, 1024, 1024, 0.34) else CLEAR)

    # Splash: just the white brick, centred on the configured splash background.
    write_png("assets/splash-icon.png", 512, 512, lambda x, y: WHITE if brick(x, y, 512, 512, 0.28) else CLEAR)

    # Favicon.
    write_png("assets/favicon.png", 48, 48, lambda x, y: WHITE if brick(x, y, 48, 48, 0.28) else BLUE)


if __name__ == "__main__":
    main()
