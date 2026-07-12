#!/usr/bin/env python3
"""
Derive the held-gun table from the original Heli Attack 2 SWF.

The player and the heli door gunner share one `gun` MovieClip (14 frames, one
per arsenal slot; Flash `gun.gotoAndStop(guns[cgun].type + 1)`). Each frame
places a gun bitmap plus a `barrell` locator that Flash reads with
`gun.barrell.localToGlobal()` to spawn bullets. The loose PNGs in
`ha2/assets` are just the bitmaps — they lose two things this script recovers:

  grip   the clip's registration point, i.e. what `gun._rotation` turns around.
         Expressed here as a normalized Phaser origin into the bitmap.
  muzzle the `barrell` offset from that registration, in gun-local pixels.

Slot 13 (ShoulderCannon) places no bitmap at all: predator mode is cloaked, so
the player holds nothing. That is a real datum, not a missing asset.

Output is a table for `src/art/catalog.ts` (pivots) and `src/combat/heldGun.ts`
(muzzles). Numbers are frozen — the SWF will not change — so this script exists
to prove where they came from and to re-derive them on demand, not to run in CI.

Usage: python3 scripts/art/extract-swf-guns.py [path/to/heli2.swf]
Default SWF: reference/ha2-source/heli2.swf (gitignored; see README).
"""

from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SWF = ROOT / "reference" / "ha2-source" / "heli2.swf"

GUN_CLIP_FRAMES = 14
"""Flash `gun` MovieClip — one frame per arsenal slot."""

TWIPS = 20

# SWF tag codes.
TAG_SHOW_FRAME = 1
TAG_DEFINE_SHAPE = (2, 22, 32, 83)
TAG_REMOVE_OBJECT = 5
TAG_PLACE_OBJECT2 = 26
TAG_REMOVE_OBJECT2 = 28
TAG_DEFINE_SPRITE = 39

# Arsenal order — index-aligned with src/config/weapons.ts WEAPONS.
WEAPON_NAMES = [
    "MachineGun",
    "AkimboMac10",
    "Shotgun",
    "ShotgunRockets",
    "GrenadeLauncher",
    "RPG",
    "RocketLauncher",
    "SeekerLauncher",
    "FlameThrower",
    "FireMines",
    "ABombLauncher",
    "RailGun",
    "GrappleCannon",
    "ShoulderCannon",
]


class Reader:
    """Bit/byte cursor over SWF bodies (little-endian bytes, MSB-first bits)."""

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

    def rect(self) -> tuple[float, float, float, float]:
        """(xmin, xmax, ymin, ymax) in px, relative to the shape's origin."""
        self.align()
        nbits = self.bits(5)
        vals = [self.sbits(nbits) / TWIPS for _ in range(4)]
        self.align()
        return vals[0], vals[1], vals[2], vals[3]

    def matrix(self) -> tuple[float, float]:
        """Translation (px). Scale / rotate are skipped — gun frames use neither."""
        self.align()
        if self.bits(1):  # has scale
            nbits = self.bits(5)
            self.sbits(nbits)
            self.sbits(nbits)
        if self.bits(1):  # has rotate
            nbits = self.bits(5)
            self.sbits(nbits)
            self.sbits(nbits)
        nbits = self.bits(5)
        tx = self.sbits(nbits) / TWIPS
        ty = self.sbits(nbits) / TWIPS
        self.align()
        return tx, ty


def swf_body(path: Path) -> bytes:
    raw = path.read_bytes()
    sig = raw[:3]
    if sig == b"CWS":
        return zlib.decompress(raw[8:])
    if sig == b"FWS":
        return raw[8:]
    raise SystemExit(f"{path}: not an SWF (signature {sig!r})")


def tags(buf: bytes, pos: int, end: int):
    while pos < end:
        (code_len,) = struct.unpack_from("<H", buf, pos)
        pos += 2
        code, length = code_len >> 6, code_len & 0x3F
        if length == 0x3F:
            (length,) = struct.unpack_from("<I", buf, pos)
            pos += 4
        yield code, pos, length
        pos += length


def first_tag_pos(body: bytes) -> int:
    r = Reader(body)
    r.rect()  # frame size
    return r.pos + 4  # frame rate (2) + frame count (2)


def find_gun_clip(body: bytes, start: int) -> tuple[int, int, int]:
    """The `gun` clip is the only 14-frame sprite placed inside two parents."""
    sprites: dict[int, tuple[int, int, int]] = {}  # cid -> (frames, pos, len)
    contains: dict[int, set[int]] = {}
    for code, pos, length in tags(body, start, len(body)):
        if code != TAG_DEFINE_SPRITE:
            continue
        cid, frames = struct.unpack_from("<HH", body, pos)
        sprites[cid] = (frames, pos + 4, length - 4)
        kids = set()
        for c2, p2, _ in tags(body, pos + 4, pos + length):
            if c2 == TAG_PLACE_OBJECT2 and body[p2] & 0x02:
                kids.add(struct.unpack_from("<H", body, p2 + 3)[0])
        contains[cid] = kids

    candidates = [
        cid
        for cid, (frames, _, _) in sprites.items()
        if frames == GUN_CLIP_FRAMES
        and sum(1 for kids in contains.values() if cid in kids) >= 2
    ]
    if len(candidates) != 1:
        raise SystemExit(
            f"expected exactly one shared {GUN_CLIP_FRAMES}-frame clip, "
            f"found {candidates}"
        )
    cid = candidates[0]
    frames, pos, length = sprites[cid]
    return cid, pos, length


def shape_bounds(body: bytes, start: int) -> dict[int, tuple[float, ...]]:
    out: dict[int, tuple[float, ...]] = {}
    for code, pos, _ in tags(body, start, len(body)):
        if code in TAG_DEFINE_SHAPE:
            r = Reader(body, pos)
            cid = r.u16()
            out[cid] = r.rect()
    return out


def gun_frames(body: bytes, pos: int, length: int) -> list[dict[int, tuple]]:
    """Display list (depth -> (char, tx, ty)) after each frame of the gun clip."""
    frames: list[dict[int, tuple]] = []
    disp: dict[int, tuple] = {}
    for code, p, _ in tags(body, pos, pos + length):
        if code == TAG_SHOW_FRAME:
            frames.append(dict(disp))
        elif code == TAG_PLACE_OBJECT2:
            r = Reader(body, p)
            flags = r.u8()
            depth = r.u16()
            char = r.u16() if flags & 0x02 else None
            tx = ty = 0.0
            if flags & 0x04:
                tx, ty = r.matrix()
            if char is not None:
                disp[depth] = (char, tx, ty)
            elif depth in disp:
                disp[depth] = (disp[depth][0], tx, ty)
        elif code == TAG_REMOVE_OBJECT:
            disp.pop(struct.unpack_from("<H", body, p + 2)[0], None)
        elif code == TAG_REMOVE_OBJECT2:
            disp.pop(struct.unpack_from("<H", body, p)[0], None)
    return frames


def main() -> None:
    swf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SWF
    if not swf.is_file():
        raise SystemExit(
            f"Missing {swf}\n"
            "Pull the SWF (gitignored — see README):\n"
            "  curl -L -o reference/ha2-source/heli2.swf \\\n"
            "    https://github.com/iopred/heliattack/raw/main/ha2/heli2miniclip.%24wf"
        )

    body = swf_body(swf)
    start = first_tag_pos(body)
    cid, pos, length = find_gun_clip(body, start)
    bounds = shape_bounds(body, start)
    frames = gun_frames(body, pos, length)

    print(f"gun clip char={cid}, {len(frames)} frames (from {swf.name})\n")
    print(
        f"{'#':>2}  {'weapon':<16} {'bitmap':>9}  "
        f"{'grip px':>10}  {'pivot (normalized)':>22}  {'muzzle':>14}"
    )

    # The bitmap sits at the lowest depth; `barrell` is the other placed child.
    for i, disp in enumerate(frames):
        shapes = {d: v for d, v in disp.items() if v[0] in bounds}
        others = {d: v for d, v in disp.items() if v[0] not in bounds}
        muzzle = next(iter(others.values()))[1:] if others else (0.0, 0.0)

        # Predator cloak: no bitmap, but the barrell still spawns bullets.
        if not shapes:
            print(
                f"{i:>2}  {WEAPON_NAMES[i]:<16} {'—':>9}  "
                f"{'(cloaked)':>11}  {'—':>22}  {muzzle[0]:6.1f},{muzzle[1]:6.1f}"
            )
            continue

        char, _, _ = shapes[min(shapes)]
        x0, x1, y0, y1 = bounds[char]
        w, h = x1 - x0, y1 - y0
        # Registration is the clip origin; the bitmap's top-left is at (x0, y0),
        # so the grip sits (-x0, -y0) into the bitmap.
        grip_x, grip_y = -x0, -y0
        pivot_x, pivot_y = grip_x / w, grip_y / h

        print(
            f"{i:>2}  {WEAPON_NAMES[i]:<16} {w:4.0f}×{h:<4.0f}  "
            f"{grip_x:5.1f},{grip_y:5.1f}  "
            f"{pivot_x:10.4f},{pivot_y:10.4f}  {muzzle[0]:6.1f},{muzzle[1]:6.1f}"
        )

    print(
        "\nPivots → SpriteDef.pivot in src/art/catalog.ts"
        "\nMuzzles → HELD_GUNS[i].muzzle in src/combat/heldGun.ts"
    )


if __name__ == "__main__":
    main()
