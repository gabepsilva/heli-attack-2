#!/usr/bin/env python3
"""
Extract the original Flash ground tileset from the compiled Heli Attack 2 SWF.

The iopred `ha2/assets` PNGs ship the tile *fills* only (`Floor.png`,
`FloorEdge.png`, …) — the shipped tileset is the `tiles` MovieClip, whose 11
frames combine those bitmaps with per-frame transforms (three frames are
horizontally mirrored reuses). Rendering the map from a single `Floor.png`
loses the grass caps, rocky corners and bushes, so we take the tiles straight
from the SWF where the mapping is unambiguous:

    map cell `[collision, frame]` → tiles.gotoAndStop(frame + 1)

Frame 1 is blank (cell frame 0 = empty), so frames 2..11 are cell frames 1..10
and land here as `tile_01.png` … `tile_10.png` (52×52 RGBA, mirrors baked in).

Source SWF (gitignored, like the rest of reference/ha2-source):
    https://github.com/iopred/heliattack/raw/main/ha2/heli2miniclip.%24wf
    → reference/ha2-source/heli2.swf

Usage: python3 scripts/art/extract-swf-tiles.py
Then:  npm run art:import-original && npm run art:pack
"""

from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SWF = ROOT / "reference" / "ha2-source" / "heli2.swf"
OUT_DIR = ROOT / "reference" / "ha2-source" / "gfx" / "tiles"

TILE_SIZE = 52
"""Flash tile art edge (drawn on the 50px map grid with a 1px overlap)."""

TILES_SYMBOL = "tiles"
"""ExportAssets name of the ground tileset MovieClip."""

FIRST_TILE_FRAME = 2
"""Frame 1 of `tiles` is blank (map frame 0); real tiles start at frame 2."""

TILE_COUNT = 10

# SWF tag codes we care about.
TAG_END = 0
TAG_SHOW_FRAME = 1
TAG_DEFINE_SHAPE = (2, 22, 32, 83)
TAG_PLACE_OBJECT = 4
TAG_PLACE_OBJECT2 = 26
TAG_DEFINE_BITS_LOSSLESS = (20, 36)
TAG_DEFINE_SPRITE = 39
TAG_EXPORT_ASSETS = 56

BITMAP_FORMAT_ARGB32 = 5
FILL_SOLID = 0x00
FILL_BITMAP = (0x40, 0x41, 0x42, 0x43)
NO_BITMAP = 0xFFFF
TWIPS = 20


class Reader:
    """Bit/byte cursor over SWF tag bodies (SWF is little-endian, MSB-first bits)."""

    def __init__(self, buf: bytes, pos: int = 0) -> None:
        self.buf = buf
        self.pos = pos
        self.bit = 0

    def u8(self) -> int:
        v = self.buf[self.pos]
        self.pos += 1
        return v

    def u16(self) -> int:
        v = struct.unpack_from("<H", self.buf, self.pos)[0]
        self.pos += 2
        return v

    def u32(self) -> int:
        v = struct.unpack_from("<I", self.buf, self.pos)[0]
        self.pos += 4
        return v

    def align(self) -> None:
        if self.bit:
            self.bit = 0
            self.pos += 1

    def bits(self, n: int) -> int:
        v = 0
        for _ in range(n):
            v = (v << 1) | ((self.buf[self.pos] >> (7 - self.bit)) & 1)
            self.bit += 1
            if self.bit == 8:
                self.bit = 0
                self.pos += 1
        return v

    def sbits(self, n: int) -> int:
        v = self.bits(n)
        if n and v >> (n - 1):
            v -= 1 << n
        return v

    def rect(self) -> None:
        """Skip a RECT (only its size matters to the cursor)."""
        self.align()
        nbits = self.bits(5)
        for _ in range(4):
            self.sbits(nbits)
        self.align()

    def matrix(self) -> dict[str, float]:
        self.align()
        scale_x = scale_y = 1.0
        if self.bits(1):
            nbits = self.bits(5)
            scale_x = self.sbits(nbits) / 65536.0
            scale_y = self.sbits(nbits) / 65536.0
        if self.bits(1):
            nbits = self.bits(5)
            self.sbits(nbits)
            self.sbits(nbits)
        nbits = self.bits(5)
        self.sbits(nbits)
        self.sbits(nbits)
        self.align()
        return {"scaleX": scale_x, "scaleY": scale_y}

    def string(self) -> str:
        end = self.buf.index(0, self.pos)
        s = self.buf[self.pos : end].decode("latin-1")
        self.pos = end + 1
        return s


def read_tags(reader: Reader, end: int) -> list[tuple[int, int, int]]:
    """Return [(code, body_start, body_len)] until `end` or an End tag."""
    tags: list[tuple[int, int, int]] = []
    while reader.pos < end:
        header = reader.u16()
        code, length = header >> 6, header & 0x3F
        if length == 0x3F:
            length = reader.u32()
        start = reader.pos
        tags.append((code, start, length))
        reader.pos = start + length
        if code == TAG_END:
            break
    return tags


class Swf:
    def __init__(self, path: Path) -> None:
        raw = path.read_bytes()
        signature = raw[:3]
        if signature == b"CWS":
            body = zlib.decompress(raw[8:])
        elif signature == b"FWS":
            body = raw[8:]
        else:
            raise SystemExit(f"{path} is not a SWF (signature {signature!r})")
        self.body = body

        reader = Reader(body)
        reader.rect()  # stage
        reader.pos += 4  # frame rate + frame count
        self.tags = read_tags(reader, len(body))

        self.shapes: dict[int, tuple[int, int, int]] = {}
        self.sprites: dict[int, tuple[int, int, int]] = {}
        self.bitmaps: dict[int, tuple[int, int, int]] = {}
        self.exports: dict[str, int] = {}
        for code, start, length in self.tags:
            if code in TAG_DEFINE_SHAPE:
                self.shapes[self._char_id(start)] = (code, start, length)
            elif code == TAG_DEFINE_SPRITE:
                self.sprites[self._char_id(start)] = (code, start, length)
            elif code in TAG_DEFINE_BITS_LOSSLESS:
                self.bitmaps[self._char_id(start)] = (code, start, length)
            elif code == TAG_EXPORT_ASSETS:
                reader = Reader(body, start)
                for _ in range(reader.u16()):
                    char_id = reader.u16()
                    self.exports[reader.string()] = char_id

    def _char_id(self, start: int) -> int:
        return struct.unpack_from("<H", self.body, start)[0]

    def sprite_frame_chars(self, char_id: int) -> dict[int, int]:
        """Frame number (1-based) → character placed on it (sticky depths ignored)."""
        _, start, length = self.sprites[char_id]
        reader = Reader(self.body, start)
        reader.u16()  # sprite id
        reader.u16()  # frame count
        placed: dict[int, int] = {}
        frame = 1
        for code, tag_start, _ in read_tags(reader, start + length):
            if code == TAG_SHOW_FRAME:
                frame += 1
            elif code in (TAG_PLACE_OBJECT, TAG_PLACE_OBJECT2):
                tag = Reader(self.body, tag_start)
                if code == TAG_PLACE_OBJECT:
                    placed[frame] = tag.u16()
                else:
                    flags = tag.u8()
                    tag.u16()  # depth
                    if flags & 0x02:  # HasCharacter
                        placed[frame] = tag.u16()
        return placed

    def shape_bitmap_fill(self, char_id: int) -> tuple[int, dict[str, float]]:
        """(bitmap id, fill matrix) of a shape whose art is one clipped bitmap."""
        code, start, _ = self.shapes[char_id]
        reader = Reader(self.body, start)
        reader.u16()  # shape id
        reader.rect()  # shape bounds
        if code == 83:  # DefineShape4: edge bounds + flags
            reader.rect()
            reader.u8()
        count = reader.u8()
        if count == 0xFF:
            count = reader.u16()
        for _ in range(count):
            fill_type = reader.u8()
            if fill_type == FILL_SOLID:
                reader.pos += 4 if code in (32, 83) else 3
            elif fill_type in FILL_BITMAP:
                bitmap_id = reader.u16()
                matrix = reader.matrix()
                # Mirrored frames carry a leading placeholder fill (id 0xFFFF).
                if bitmap_id != NO_BITMAP:
                    return bitmap_id, matrix
            else:
                break
        raise SystemExit(f"shape {char_id} has no bitmap fill")

    def bitmap_image(self, char_id: int) -> Image.Image:
        _, start, length = self.bitmaps[char_id]
        reader = Reader(self.body, start)
        reader.u16()  # character id
        fmt = reader.u8()
        width = reader.u16()
        height = reader.u16()
        if fmt != BITMAP_FORMAT_ARGB32:
            raise SystemExit(f"bitmap {char_id}: unsupported format {fmt}")
        raw = zlib.decompress(self.body[reader.pos : start + length])

        image = Image.new("RGBA", (width, height))
        pixels = image.load()
        for y in range(height):
            for x in range(width):
                offset = (y * width + x) * 4
                a, r, g, b = raw[offset : offset + 4]
                if a:  # stored premultiplied
                    r = min(255, r * 255 // a)
                    g = min(255, g * 255 // a)
                    b = min(255, b * 255 // a)
                pixels[x, y] = (r, g, b, a)
        return image


def main() -> None:
    if not SWF.is_file():
        raise SystemExit(
            f"Missing {SWF.relative_to(ROOT)}\n"
            "Download the original SWF (gitignored):\n"
            "  curl -L -o reference/ha2-source/heli2.swf \\\n"
            "    https://github.com/iopred/heliattack/raw/main/ha2/heli2miniclip.%24wf"
        )

    swf = Swf(SWF)
    if TILES_SYMBOL not in swf.exports:
        raise SystemExit(f"SWF exports no `{TILES_SYMBOL}` symbol")

    frames = swf.sprite_frame_chars(swf.exports[TILES_SYMBOL])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Extracting `{TILES_SYMBOL}` frames → {OUT_DIR.relative_to(ROOT)}")

    for tile in range(1, TILE_COUNT + 1):
        frame = tile + FIRST_TILE_FRAME - 1
        # A frame without its own PlaceObject keeps the previous frame's art.
        shape_id = next(
            frames[f] for f in range(frame, 0, -1) if f in frames  # noqa: B905
        )
        bitmap_id, matrix = swf.shape_bitmap_fill(shape_id)
        image = swf.bitmap_image(bitmap_id)
        if image.size != (TILE_SIZE, TILE_SIZE):
            raise SystemExit(f"tile {tile}: expected 52×52, got {image.size}")

        mirrored = matrix["scaleX"] < 0
        if mirrored:
            image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        if matrix["scaleY"] < 0:
            image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

        out = OUT_DIR / f"tile_{tile:02d}.png"
        image.save(out, "PNG")
        note = " (mirrored)" if mirrored else ""
        print(f"  {out.name} ← frame {frame} shape {shape_id} bitmap {bitmap_id}{note}")

    print("Done. Run: npm run art:import-original && npm run art:pack")


if __name__ == "__main__":
    sys.exit(main())
