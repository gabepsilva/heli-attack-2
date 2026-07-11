#!/usr/bin/env python3
"""
Generate final 1080p-native world sprites for issue #34.

Redraws helis (+strafe variant), weapons, projectiles, VFX, powerups,
muzzle flash, explosion, and background — MIT-licensed silhouettes inspired by
the Flash art bible (proportions only, not GPL pixel copies). Style matches
art/player/ (warm desert / military palette).

Outputs under art/world/ at ART_WORLD_FINAL_SCALE (4×) of Flash original sizes
in src/art/catalog.ts. Background is a separate full-bleed plate.

Ground tiles are NOT generated here — the shipped tileset is the original Flash
`tiles` MovieClip (scripts/art/extract-swf-tiles.py).

Usage: python3 scripts/art/generate-world-final.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "art" / "world"
SCALE = 4

# Shared palette with player finals — warm desert fatigues / steel accents.
OUTLINE = (26, 22, 18, 255)
STEEL = (110, 120, 130, 255)
STEEL_HI = (160, 170, 180, 255)
STEEL_DK = (55, 60, 68, 255)
DESERT = (196, 118, 52, 255)
DESERT_DK = (150, 82, 32, 255)
DESERT_HI = (220, 150, 80, 255)
COOL = (70, 140, 170, 255)
COOL_DK = (40, 90, 120, 255)
COOL_HI = (120, 190, 210, 255)
ROTOR = (40, 40, 45, 255)
GLASS = (40, 70, 90, 200)
MUZZLE = (255, 220, 120, 255)
MUZZLE_CORE = (255, 255, 230, 255)
FIRE_ORANGE = (255, 140, 40, 255)
FIRE_YELLOW = (255, 220, 80, 255)
FIRE_RED = (220, 60, 30, 255)
SMOKE_C = (90, 90, 95, 180)
BLOOD_C = (160, 30, 40, 220)
CRATE = (180, 140, 70, 255)
CRATE_DK = (120, 90, 40, 255)
GUN = (70, 75, 80, 255)
GUN_HI = (120, 125, 130, 255)
BULLET_Y = (255, 220, 90, 255)
BULLET_R = (255, 100, 90, 255)
ENEMY = (90, 70, 55, 255)
ENEMY_HELMET = (60, 70, 50, 255)
SKY_TOP = (18, 40, 70, 255)
SKY_BOT = (55, 90, 110, 255)
DUNE = (160, 120, 70, 255)
DUNE_DK = (120, 85, 45, 255)


def blank(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w * SCALE, h * SCALE), (0, 0, 0, 0))


def px(v: float) -> float:
    return v * SCALE


def ellipse(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    rw: float,
    rh: float,
    fill: tuple[int, ...],
    outline: tuple[int, ...] | None = OUTLINE,
    width: float = 0.35,
) -> None:
    x0, y0 = px(cx - rw), px(cy - rh)
    x1, y1 = px(cx + rw), px(cy + rh)
    ow = max(1, int(round(px(width))))
    draw.ellipse([x0, y0, x1, y1], fill=fill, outline=outline, width=ow)


def rect(
    draw: ImageDraw.ImageDraw,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    fill: tuple[int, ...],
    outline: tuple[int, ...] | None = OUTLINE,
    width: float = 0.3,
    radius: float = 0.6,
) -> None:
    ow = max(1, int(round(px(width))))
    draw.rounded_rectangle(
        [px(x0), px(y0), px(x1), px(y1)],
        radius=max(1, int(px(radius))),
        fill=fill,
        outline=outline,
        width=ow,
    )


def line(
    draw: ImageDraw.ImageDraw,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    fill: tuple[int, ...],
    width: float = 1.0,
) -> None:
    draw.line(
        [px(x0), px(y0), px(x1), px(y1)],
        fill=fill,
        width=max(1, int(round(px(width)))),
    )


def save(img: Image.Image, name: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    img.save(path, "PNG")
    print(f"  {name} {img.size[0]}×{img.size[1]}")


def draw_heli(
    img: Image.Image,
    *,
    body: tuple[int, ...],
    body_hi: tuple[int, ...],
    body_dk: tuple[int, ...],
    wreck: bool = False,
    flash: bool = False,
) -> None:
    draw = ImageDraw.Draw(img)
    w, h = img.size[0] / SCALE, img.size[1] / SCALE
    cx, cy = w / 2, h / 2

    if flash:
        body = (240, 240, 245, 255)
        body_hi = (255, 255, 255, 255)
        body_dk = (200, 200, 210, 255)

    # Main rotor disc
    if not wreck:
        ellipse(draw, cx + 8, cy - 28, 78, 6, (*ROTOR[:3], 120), outline=None)
        line(draw, cx - 70, cy - 28, cx + 86, cy - 28, ROTOR, 1.2)
    else:
        line(draw, cx - 40, cy - 20, cx + 30, cy - 35, ROTOR, 1.5)
        line(draw, cx + 20, cy - 10, cx + 55, cy - 40, STEEL_DK, 1.2)

    # Fuselage
    rect(draw, cx - 70, cy - 18, cx + 55, cy + 22, body, radius=8)
    rect(draw, cx - 55, cy - 12, cx + 20, cy + 8, body_hi, outline=None, radius=4)

    # Cockpit glass
    ellipse(draw, cx - 48, cy - 2, 14, 12, GLASS, outline=OUTLINE, width=0.4)

    # Tail boom
    rect(draw, cx + 50, cy - 4, cx + 95, cy + 8, body_dk, radius=2)
    # Tail rotor
    if not wreck:
        ellipse(draw, cx + 98, cy + 2, 3, 14, STEEL, outline=OUTLINE, width=0.3)
    else:
        ellipse(draw, cx + 90, cy + 10, 8, 5, STEEL_DK, outline=None)

    # Skids
    line(draw, cx - 50, cy + 24, cx + 40, cy + 24, STEEL_DK, 1.4)
    line(draw, cx - 45, cy + 18, cx - 45, cy + 24, STEEL_DK, 1.0)
    line(draw, cx + 30, cy + 18, cx + 30, cy + 24, STEEL_DK, 1.0)

    # Nose gun stub
    rect(draw, cx - 78, cy + 2, cx - 68, cy + 8, STEEL, radius=1)

    if wreck:
        # Scorch / missing panels
        ellipse(draw, cx - 10, cy + 4, 18, 10, (40, 35, 30, 200), outline=None)
        ellipse(draw, cx + 25, cy - 8, 12, 8, (50, 40, 30, 180), outline=None)


def make_heli() -> None:
    img = blank(212, 106)
    draw_heli(img, body=DESERT, body_hi=DESERT_HI, body_dk=DESERT_DK)
    save(img, "heli.png")


def make_heli_strafe() -> None:
    img = blank(212, 106)
    draw_heli(img, body=COOL, body_hi=COOL_HI, body_dk=COOL_DK)
    save(img, "heli_strafe.png")


def make_heli_hit() -> None:
    img = blank(212, 106)
    draw_heli(img, body=DESERT, body_hi=DESERT_HI, body_dk=DESERT_DK, flash=True)
    save(img, "heli_hit.png")


def make_heli_destroyed() -> None:
    img = blank(173, 89)
    draw_heli(img, body=STEEL_DK, body_hi=STEEL, body_dk=ROTOR, wreck=True)
    save(img, "heliDestroyed.png")


def make_enemy_guy() -> None:
    w, h = 25, 48
    img = blank(w, h)
    draw = ImageDraw.Draw(img)
    cx = w / 2
    # Legs
    rect(draw, cx - 5, 32, cx - 1, 48, ENEMY, radius=1)
    rect(draw, cx + 1, 32, cx + 5, 48, ENEMY, radius=1)
    # Body
    rect(draw, cx - 6, 16, cx + 6, 34, ENEMY, radius=2)
    # Helmet
    ellipse(draw, cx, 10, 7, 6.5, ENEMY_HELMET)
    ellipse(draw, cx + 1, 12, 3, 2.5, (210, 170, 140, 255), outline=None)
    save(img, "enemyguy.png")


def make_bullet_player() -> None:
    img = blank(10, 9)
    draw = ImageDraw.Draw(img)
    ellipse(draw, 5, 4.5, 4.2, 3.5, BULLET_Y, outline=OUTLINE, width=0.25)
    ellipse(draw, 5, 4.5, 2.0, 1.6, MUZZLE_CORE, outline=None)
    save(img, "bullett.png")


def make_bullet_enemy() -> None:
    img = blank(10, 9)
    draw = ImageDraw.Draw(img)
    ellipse(draw, 5, 4.5, 4.2, 3.5, BULLET_R, outline=OUTLINE, width=0.25)
    ellipse(draw, 5, 4.5, 2.0, 1.6, (255, 200, 180, 255), outline=None)
    save(img, "enemybullet.png")


def make_weapon_machinegun() -> None:
    img = blank(29, 16)
    draw = ImageDraw.Draw(img)
    # Receiver
    rect(draw, 2, 5, 18, 12, GUN, radius=1.5)
    # Barrel
    rect(draw, 17, 6.5, 27, 10.5, GUN_HI, radius=0.5)
    # Grip
    rect(draw, 4, 10, 9, 15, STEEL_DK, radius=0.8)
    # Mag
    rect(draw, 10, 11, 14, 15, STEEL, radius=0.5)
    # Sight
    line(draw, 8, 5, 8, 3, OUTLINE, 0.6)
    save(img, "machineGun.png")


def make_grenade() -> None:
    img = blank(19, 11)
    draw = ImageDraw.Draw(img)
    ellipse(draw, 9.5, 6, 7, 4.5, (70, 100, 55, 255))
    rect(draw, 7, 1.5, 12, 4, STEEL, radius=0.5)
    save(img, "grenade.png")


def make_rocket() -> None:
    img = blank(21, 15)
    draw = ImageDraw.Draw(img)
    # Body
    rect(draw, 2, 5, 16, 11, (180, 60, 40, 255), radius=2)
    # Nose
    ellipse(draw, 16, 8, 4, 3.2, (220, 90, 50, 255))
    # Fins
    line(draw, 3, 5, 1, 2, STEEL_DK, 1.0)
    line(draw, 3, 11, 1, 14, STEEL_DK, 1.0)
    save(img, "Rocket.png")


def make_smoke() -> None:
    img = blank(28, 27)
    draw = ImageDraw.Draw(img)
    for cx, cy, r in ((10, 14, 7), (16, 10, 8), (18, 16, 6), (12, 18, 5)):
        ellipse(draw, cx, cy, r, r * 0.85, SMOKE_C, outline=None)
    save(img, "smoke.png")


def make_blood() -> None:
    img = blank(30, 30)
    draw = ImageDraw.Draw(img)
    for cx, cy, rw, rh in (
        (15, 14, 8, 6),
        (10, 18, 5, 4),
        (20, 10, 4, 5),
        (18, 20, 3, 3),
        (8, 10, 3, 2.5),
    ):
        ellipse(draw, cx, cy, rw, rh, BLOOD_C, outline=None)
    save(img, "blood.png")


def make_powerup() -> None:
    img = blank(33, 32)
    draw = ImageDraw.Draw(img)
    rect(draw, 4, 6, 29, 28, CRATE, radius=2)
    rect(draw, 6, 8, 27, 26, CRATE_DK, outline=None, radius=1)
    # Cross straps
    line(draw, 16.5, 6, 16.5, 28, DESERT_HI, 1.5)
    line(draw, 4, 17, 29, 17, DESERT_HI, 1.5)
    # Star badge
    ellipse(draw, 16.5, 17, 5, 5, (255, 220, 100, 255), outline=OUTLINE, width=0.3)
    save(img, "powerup.png")


def make_muzzle_flash() -> None:
    # Compact flash — drawn larger via displaySize in-scene.
    img = blank(16, 16)
    draw = ImageDraw.Draw(img)
    # Star burst
    cx, cy = 8, 8
    for i in range(8):
        ang = i * (math.pi / 4)
        x1 = cx + math.cos(ang) * 7
        y1 = cy + math.sin(ang) * 7
        line(draw, cx, cy, x1, y1, MUZZLE, 1.2)
    ellipse(draw, cx, cy, 4.5, 4.5, MUZZLE, outline=None)
    ellipse(draw, cx, cy, 2.2, 2.2, MUZZLE_CORE, outline=None)
    save(img, "muzzle_flash.png")


def make_explosion() -> None:
    # Half of Flash bigboom (374×373) — packs cleanly at 4× in a 4096 atlas.
    w, h = 187, 186
    img = blank(w, h)
    draw = ImageDraw.Draw(img)
    cx, cy = w / 2, h / 2
    # Outer fire rings
    for r, col in (
        (80, (*FIRE_RED[:3], 160)),
        (60, (*FIRE_ORANGE[:3], 200)),
        (42, (*FIRE_YELLOW[:3], 230)),
        (24, MUZZLE_CORE),
    ):
        ellipse(draw, cx, cy, r, r * 0.95, col, outline=None)
    # Smoke puffs
    for ang, dist, rr in (
        (0.3, 70, 18),
        (1.2, 75, 22),
        (2.4, 68, 16),
        (3.8, 72, 20),
        (5.0, 65, 14),
    ):
        ellipse(
            draw,
            cx + math.cos(ang) * dist,
            cy + math.sin(ang) * dist,
            rr,
            rr * 0.8,
            (*SMOKE_C[:3], 140),
            outline=None,
        )
    save(img, "explosion.png")


def make_bg() -> None:
    # Flash bg.png 452×322 — 4× plate for parallax / full-bleed backdrop.
    w, h = 452, 322
    img = Image.new("RGBA", (w * SCALE, h * SCALE), SKY_TOP)
    draw = ImageDraw.Draw(img)
    # Sky gradient
    for y in range(h * SCALE):
        t = y / (h * SCALE)
        r = int(SKY_TOP[0] + (SKY_BOT[0] - SKY_TOP[0]) * t)
        g = int(SKY_TOP[1] + (SKY_BOT[1] - SKY_TOP[1]) * t)
        b = int(SKY_TOP[2] + (SKY_BOT[2] - SKY_TOP[2]) * t)
        draw.line([(0, y), (w * SCALE - 1, y)], fill=(r, g, b, 255))
    # Distant dunes
    dune = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dd = ImageDraw.Draw(dune)
    dd.polygon(
        [
            (0, px(220)),
            (px(120), px(180)),
            (px(240), px(200)),
            (px(360), px(160)),
            (px(452), px(190)),
            (px(452), px(322)),
            (0, px(322)),
        ],
        fill=DUNE_DK,
    )
    dd.polygon(
        [
            (0, px(260)),
            (px(100), px(230)),
            (px(220), px(250)),
            (px(340), px(220)),
            (px(452), px(245)),
            (px(452), px(322)),
            (0, px(322)),
        ],
        fill=DUNE,
    )
    img = Image.alpha_composite(img, dune)
    # Soft haze
    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    save(img, "bg.png")


def main() -> None:
    print(f"Generating {SCALE}× final world art → {OUT_DIR.relative_to(ROOT)}")
    make_heli()
    make_heli_strafe()
    make_heli_hit()
    make_heli_destroyed()
    make_enemy_guy()
    make_bullet_player()
    make_bullet_enemy()
    make_weapon_machinegun()
    make_grenade()
    make_rocket()
    make_smoke()
    make_blood()
    make_powerup()
    make_muzzle_flash()
    make_explosion()
    make_bg()
    print("Done.")


if __name__ == "__main__":
    main()
