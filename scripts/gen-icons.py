#!/usr/bin/env python3
"""Generate Balla's app icons.

Pure standard library (no Pillow). The artwork is the same wall mark as
`site/mark.svg` and `src/components/BrandMark.tsx`: three white bars on the
brand blue, with the last bar split into a lighter brick. "Balla" means "wall"
in Gàidhlig.

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

BLUE = (8, 102, 255, 255)        # #0866FF — Balla's one brand blue
LIGHT = (191, 211, 255, 255)     # #BFD7FF — the lighter brick in the mark
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

# (path, width, height, mark inset, background colour)
SPECS = [
    ("assets/icon.png", 1024, 1024, 0.30, BLUE),
    ("assets/adaptive-icon.png", 1024, 1024, 0.34, CLEAR),
    ("assets/splash-icon.png", 512, 512, 0.28, CLEAR),
    ("assets/favicon.png", 48, 48, 0.28, BLUE),
]

# Bar geometry from the 32x32 viewBox in site/mark.svg.
BARS = (
    (7 / 32, 25 / 32, 9 / 32, WHITE),
    (7 / 32, 25 / 32, 15 / 32, WHITE),
    (7 / 32, 18 / 32, 21 / 32, WHITE),
    (17 / 32, 25 / 32, 21 / 32, LIGHT),
)


def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def in_rounded_square(nx: float, ny: float, radius: float = 8 / 32) -> bool:
    """Whether a point is inside the source mark's rounded 32x32 square."""
    cx = min(max(nx, radius), 1 - radius)
    cy = min(max(ny, radius), 1 - radius)
    return (nx - cx) ** 2 + (ny - cy) ** 2 <= radius ** 2


def bar_colour(nx: float, ny: float, solid: bool):
    """Draw the bars in source order so the lighter brick overlaps the third."""
    if not solid:
        return None
    colour = None
    for x0, x1, y0, bar in BARS:
        if x0 <= nx < x1 and y0 <= ny < y0 + 4 / 32:
            colour = bar
    return colour


def png_bytes(w: int, h: int, inset: float, background) -> bytes:
    x0, y0 = int(w * inset), int(h * inset)
    x1, y1 = int(w * (1 - inset)), int(h * (1 - inset))
    size = x1 - x0
    solid_background = background == BLUE
    raw = b""
    for y in range(h):
        row = bytearray()
        for x in range(w):
            inside = x0 <= x < x1 and y0 <= y < y1
            nx, ny = (x - x0) / size, (y - y0) / size
            base = (
                BLUE
                if solid_background
                else (BLUE if inside and in_rounded_square(nx, ny) else CLEAR)
            )
            colour = bar_colour(nx, ny, inside and base == BLUE)
            row += bytes(colour if colour is not None else base)
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
