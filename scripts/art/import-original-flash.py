#!/usr/bin/env python3
"""
Import original Flash (iopred ha2/assets) PNGs into the atlas source dirs (#95).

Nearest-neighbor upscales originals into art/player/ (8×) and art/world/ (4×)
so the existing packer / size assertions keep working. Missing originals use
documented stubs:
  - player_hurt  ← guy.png
  - heli_strafe  ← heli.png
  - muzzle_flash ← generated 16×16 stub (no Flash file)

Source tree (gitignored): reference/ha2-source/gfx/
  Pull from https://github.com/iopred/heliattack/tree/main/ha2/assets
  Ground tiles come from gfx/tiles/ — the assets tree only ships the tile fills
  (Floor.png, FloorEdge.png, …), so run `npm run art:extract-tiles` first to
  pull the composed `tiles` MovieClip frames out of the original SWF.

Usage: python3 scripts/art/extract-swf-tiles.py   # ground tileset
       python3 scripts/art/import-original-flash.py
Then:  npm run art:pack
"""

from __future__ import annotations

import base64
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
GFX = ROOT / "reference" / "ha2-source" / "gfx"
PLAYER_OUT = ROOT / "art" / "player"
WORLD_OUT = ROOT / "art" / "world"
PLAYER_SCALE = 8
WORLD_SCALE = 4

# Catalog originalW×originalH for explosion is half of Flash bigboom.
EXPLOSION_CATALOG = (187, 186)


def nn_scale(im: Image.Image, scale: int) -> Image.Image:
    w, h = im.size
    return im.resize((w * scale, h * scale), Image.Resampling.NEAREST)


def require(name: str) -> Path:
    path = GFX / name
    if not path.is_file():
        raise SystemExit(
            f"Missing {path}\n"
            "Pull iopred ha2/assets into reference/ha2-source/gfx/ "
            "(Floor from assets/new/Floor.png)."
        )
    return path


def load_rgba(name: str) -> Image.Image:
    return Image.open(require(name)).convert("RGBA")


def write_scaled(src: Image.Image, dest: Path, scale: int) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    out = nn_scale(src, scale)
    out.save(dest)
    print(f"  {dest.relative_to(ROOT)} ← {src.size} ×{scale} → {out.size}")


def apply_alpha_mask(rgb_src: Image.Image, alpha_src: Image.Image) -> Image.Image:
    """Copy alpha from alpha_src onto rgb_src RGB (Flash heli_hit is opaque black)."""
    assert rgb_src.size == alpha_src.size, (rgb_src.size, alpha_src.size)
    r, g, b, _ = rgb_src.split()
    _, _, _, a = alpha_src.split()
    return Image.merge("RGBA", (r, g, b, a))


def make_muzzle_stub() -> Image.Image:
    """Tiny generated muzzle flash — no original Flash file (#95)."""
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    draw.ellipse([2, 2, 13, 13], fill=(255, 220, 120, 220))
    draw.ellipse([5, 5, 10, 10], fill=(255, 255, 230, 255))
    return im


def bake_heli_hit_mask(heli: Image.Image) -> None:
    """Regenerate 212×106 1-bit mask from original heli alpha."""
    assert heli.size == (212, 106), heli.size
    w, h = heli.size
    bytes_per_row = math.ceil(w / 8)
    raw = bytearray(bytes_per_row * h)
    px = heli.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 0:
                byte_index = y * bytes_per_row + (x >> 3)
                bit_offset = 7 - (x & 7)
                raw[byte_index] |= 1 << bit_offset
    b64 = base64.b64encode(bytes(raw)).decode("ascii")
    out = ROOT / "src" / "combat" / "heliHitMask.generated.ts"
    out.write_text(
        "/** Auto-generated from original Flash heli.png alpha (#95). "
        "Do not edit by hand. */\n"
        f"export const HELI_HIT_MASK_W = {w};\n"
        f"export const HELI_HIT_MASK_H = {h};\n"
        f"export const HELI_HIT_MASK_B64 =\n"
        f"  '{b64}';\n",
        encoding="utf8",
    )
    print(f"  {out.relative_to(ROOT)} (heli hit mask)")


def main() -> None:
    print(f"Importing original Flash art from {GFX.relative_to(ROOT)}")

    player_map = [
        ("guy.png", "player_idle.png"),
        ("duck.png", "player_duck.png"),
        ("jump.png", "player_jump.png"),
        ("jump2.png", "player_jump2.png"),
        ("step1.png", "player_step1.png"),
        ("step2.png", "player_step2.png"),
        ("guy.png", "player_hurt.png"),  # stub: reuse idle
        ("guyburned.png", "player_death.png"),
    ]
    for src_name, dest_name in player_map:
        write_scaled(load_rgba(src_name), PLAYER_OUT / dest_name, PLAYER_SCALE)

    world_map = [
        ("heli.png", "heli.png"),
        ("heli.png", "heli_strafe.png"),  # stub: reuse hover
        ("heli_hit.png", "heli_hit.png"),
        ("heliDestroyed.png", "heliDestroyed.png"),
        # Flash Shard MovieClip frames (assets skip shard2).
        ("shard0.png", "shard.png"),
        ("shard1.png", "shard_1.png"),
        ("shard3.png", "shard_3.png"),
        ("shard4.png", "shard_4.png"),
        ("shard5.png", "shard_5.png"),
        ("enemyguy.png", "enemyguy.png"),
        ("bullett.png", "bullett.png"),
        ("enemybullet.png", "enemybullet.png"),
        ("grenade.png", "grenade.png"),
        ("Rocket.png", "Rocket.png"),
        # Per-weapon projectile frames (Flash `bullet.gotoAndStop(frame)`).
        ("shotgunrocketbullet.png", "shotgunrocketbullet.png"),
        ("rpg.png", "rpg.png"),
        ("seekerbullet.png", "seekerbullet.png"),
        ("flame.png", "flame.png"),
        ("minebullet.png", "minebullet.png"),
        ("mine.png", "mine.png"),
        ("abombbullet.png", "abombbullet.png"),
        # Rail beams are static muzzle-anchored sprites (Flash `railFrame` never
        # moves the clip): RailGun is bullet frame 9, ShoulderCannon frame 11.
        ("railtrail.png", "railtrail.png"),
        ("shouldercannon.png", "shouldercannon.png"),
        ("grapplebullet.png", "grapplebullet.png"),
        # Held guns — the 13 bitmaps of the Flash `gun` MovieClip, one per
        # arsenal slot (slot 13 / ShoulderCannon is cloaked: no bitmap).
        # FireMines holds `mine.png` (imported above as the planted body).
        # Grips + muzzles: python3 scripts/art/extract-swf-guns.py
        ("machineGun.png", "machineGun.png"),
        ("uzi.png", "uzi.png"),
        ("shotty.png", "shotty.png"),
        ("shotgunrocket.png", "shotgunrocket.png"),
        ("grenadelauncher.png", "grenadelauncher.png"),
        ("rpggun.png", "rpggun.png"),
        ("rlauncher.png", "rlauncher.png"),
        ("seekerlauncher.png", "seekerlauncher.png"),
        ("flameThrower.png", "flameThrower.png"),
        ("abomb.png", "abomb.png"),
        ("rail.png", "rail.png"),
        ("grapplegun.png", "grapplegun.png"),
        ("smoke.png", "smoke.png"),
        ("blood.png", "blood.png"),
        ("powerup.png", "powerup.png"),
        ("powerhealth.png", "powerhealth.png"),  # health crate (white + red cross)
        # HUD / drop weapon crate icons — Flash `HUD.weapon` frames (#105).
        ("powermachinegun.png", "powermachinegun.png"),
        ("poweruzi.png", "poweruzi.png"),  # AkimboMac10 (iopred old/)
        ("powershotgun.png", "powershotgun.png"),
        ("powershotgunrocket.png", "powershotgunrocket.png"),
        ("powergen.png", "powergen.png"),  # GrenadeLauncher
        ("powerrpg.png", "powerrpg.png"),
        ("powerrocketlauncher.png", "powerrocketlauncher.png"),
        ("powerseeker.png", "powerseeker.png"),
        ("powerflamethrower.png", "powerflamethrower.png"),
        ("powermine.png", "powermine.png"),
        ("powerabomb.png", "powerabomb.png"),
        ("powerrail.png", "powerrail.png"),
        ("powergrapple.png", "powergrapple.png"),
        ("powershouldercannon.png", "powershouldercannon.png"),
        ("bg.png", "bg.png"),
        ("title.png", "title.png"),
    ]
    # Tilesets — `tiles` / `bg` MovieClip frames (see extract-swf-tiles.py).
    world_map += [
        (f"tiles/tile_{n:02d}.png", f"tile_{n:02d}.png") for n in range(1, 11)
    ]
    world_map += [
        (f"tiles/bg_tile_{n:02d}.png", f"bg_tile_{n:02d}.png") for n in range(1, 3)
    ]
    heli_src = load_rgba("heli.png")
    for src_name, dest_name in world_map:
        src = load_rgba(src_name)
        # Flash heli_hit.png is RGB on opaque black — borrow heli silhouette alpha.
        if dest_name == "heli_hit.png":
            src = apply_alpha_mask(src, heli_src)
        write_scaled(src, WORLD_OUT / dest_name, WORLD_SCALE)

    # Explosion: catalog stores half Flash bigboom, then × world scale.
    boom = load_rgba("bigboom.png")
    half = boom.resize(EXPLOSION_CATALOG, Image.Resampling.NEAREST)
    write_scaled(half, WORLD_OUT / "explosion.png", WORLD_SCALE)

    write_scaled(make_muzzle_stub(), WORLD_OUT / "muzzle_flash.png", WORLD_SCALE)

    bake_heli_hit_mask(heli_src)
    print("Done. Run: npm run art:pack")


if __name__ == "__main__":
    main()
