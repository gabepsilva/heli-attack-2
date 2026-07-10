#!/usr/bin/env python3
"""
Generate final 1080p-native player sprites for issue #33.

Draws original MIT-licensed soldier poses inspired by the Flash art bible
(silhouette / proportions only — not pixel copies of GPL assets).

Outputs PNGs under art/player/ at ART_PLAYER_FINAL_SCALE (8×) of the Flash
original sizes documented in src/art/catalog.ts.

Usage: python3 scripts/art/generate-player-final.py
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "art" / "player"
SCALE = 8

# Palette — warm desert fatigues, distinct from a 1:1 GPL pixel dump.
OUTLINE = (26, 22, 18, 255)
HELMET = (196, 118, 52, 255)
HELMET_SHADE = (150, 82, 32, 255)
HELMET_HI = (220, 150, 80, 255)
FACE = (232, 184, 150, 255)
FACE_SHADE = (210, 150, 120, 255)
BOOT = (55, 55, 58, 255)
BOOT_HI = (90, 90, 95, 255)
HURT_FLASH = (230, 90, 70, 255)
CHAR_SHADE = (160, 90, 40, 255)
BELT = (90, 60, 35, 255)
GOGGLE = (30, 30, 35, 255)
BURN = (70, 55, 45, 255)
BURN_HI = (110, 85, 60, 255)
SOOT = (35, 30, 28, 255)


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
) -> None:
    ow = max(1, int(round(px(width))))
    draw.rounded_rectangle(
        [px(x0), px(y0), px(x1), px(y1)],
        radius=max(1, int(px(0.6))),
        fill=fill,
        outline=outline,
        width=ow,
    )


def draw_soldier(
    img: Image.Image,
    *,
    body_top: float,
    body_bot: float,
    body_cx: float,
    body_hw: float,
    head_cy: float,
    head_r: float,
    face_cy: float,
    face_r: float,
    foot_y: float,
    foot_spread: float,
    foot_w: float = 3.2,
    foot_h: float = 1.6,
    lean: float = 0.0,
    hurt: bool = False,
    burned: bool = False,
) -> None:
    draw = ImageDraw.Draw(img)
    helmet = BURN if burned else (HURT_FLASH if hurt else HELMET)
    helmet_shade = SOOT if burned else (CHAR_SHADE if hurt else HELMET_SHADE)
    helmet_hi = BURN_HI if burned else HELMET_HI
    body = helmet
    body_shade = helmet_shade

    # Feet
    for side in (-1, 1):
        fx = body_cx + side * foot_spread + lean * 0.3
        ellipse(
            draw,
            fx,
            foot_y,
            foot_w / 2,
            foot_h / 2,
            BOOT_HI if not burned else SOOT,
        )
        ellipse(
            draw,
            fx,
            foot_y + 0.2,
            foot_w / 2 * 0.85,
            foot_h / 2 * 0.7,
            BOOT,
            outline=None,
        )

    # Torso
    rect(
        draw,
        body_cx - body_hw + lean,
        body_top,
        body_cx + body_hw + lean,
        body_bot,
        body,
    )
    # Shade strip
    rect(
        draw,
        body_cx + body_hw * 0.15 + lean,
        body_top + 0.5,
        body_cx + body_hw * 0.85 + lean,
        body_bot - 0.5,
        body_shade,
        outline=None,
    )
    # Belt
    by = body_top + (body_bot - body_top) * 0.62
    rect(
        draw,
        body_cx - body_hw * 0.92 + lean,
        by,
        body_cx + body_hw * 0.92 + lean,
        by + 1.4,
        BELT,
        outline=None,
    )

    if burned:
        # Short arms
        for side in (-1, 1):
            ax = body_cx + side * (body_hw + 1.5) + lean
            ellipse(draw, ax, body_top + 6, 2.2, 3.5, BURN)
            ellipse(draw, ax, body_top + 9.5, 1.6, 1.6, FACE_SHADE)

    # Face
    ellipse(draw, body_cx + lean * 0.5, face_cy, face_r, face_r * 0.95, FACE)
    ellipse(
        draw,
        body_cx + face_r * 0.25 + lean * 0.5,
        face_cy,
        face_r * 0.45,
        face_r * 0.7,
        FACE_SHADE,
        outline=None,
    )

    if burned:
        # Goggles + mouth
        rect(
            draw,
            body_cx - face_r * 0.75 + lean * 0.5,
            face_cy - 1.2,
            body_cx + face_r * 0.75 + lean * 0.5,
            face_cy + 0.8,
            GOGGLE,
            outline=None,
        )
        ellipse(
            draw,
            body_cx + lean * 0.5,
            face_cy + face_r * 0.55,
            0.7,
            0.45,
            GOGGLE,
            outline=None,
        )

    # Helmet dome
    ellipse(draw, body_cx + lean * 0.4, head_cy, head_r, head_r * 0.85, helmet)
    ellipse(
        draw,
        body_cx - head_r * 0.25 + lean * 0.4,
        head_cy - head_r * 0.15,
        head_r * 0.45,
        head_r * 0.35,
        helmet_hi,
        outline=None,
    )
    ellipse(
        draw,
        body_cx + head_r * 0.35 + lean * 0.4,
        head_cy,
        head_r * 0.4,
        head_r * 0.55,
        helmet_shade,
        outline=None,
    )
    # Brim
    rect(
        draw,
        body_cx - head_r * 1.05 + lean * 0.4,
        head_cy + head_r * 0.35,
        body_cx + head_r * 1.05 + lean * 0.4,
        head_cy + head_r * 0.55,
        helmet_shade,
        outline=None,
    )

    if hurt:
        # Recoil slash marks
        for i, (dx, dy) in enumerate(((-2, 4), (3, 8), (-1, 14))):
            x = body_cx + dx + lean
            y = body_top + dy
            ellipse(draw, x, y, 1.2, 0.7, HURT_FLASH, outline=None)


def save(img: Image.Image, name: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    img.save(path, "PNG")
    print(f"wrote {path.relative_to(ROOT)} ({img.size[0]}×{img.size[1]})")


def make_idle() -> None:
    # Flash guy.png 24×49
    w, h = 24, 49
    img = blank(w, h)
    cx = w / 2
    draw_soldier(
        img,
        body_top=16,
        body_bot=44,
        body_cx=cx,
        body_hw=7.5,
        head_cy=8.5,
        head_r=8.5,
        face_cy=14.5,
        face_r=4.2,
        foot_y=46.5,
        foot_spread=4.5,
    )
    save(img, "player_idle.png")


def make_duck() -> None:
    # Flash duck.png 25×39
    w, h = 25, 39
    img = blank(w, h)
    cx = w / 2
    draw_soldier(
        img,
        body_top=14,
        body_bot=34,
        body_cx=cx,
        body_hw=8.2,
        head_cy=8,
        head_r=8.2,
        face_cy=13.5,
        face_r=4.0,
        foot_y=36.5,
        foot_spread=5.0,
        foot_w=3.6,
    )
    save(img, "player_duck.png")


def make_jump() -> None:
    # Flash jump.png 25×55 — stretched / airborne
    w, h = 25, 55
    img = blank(w, h)
    cx = w / 2
    draw_soldier(
        img,
        body_top=18,
        body_bot=48,
        body_cx=cx,
        body_hw=7.8,
        head_cy=9.5,
        head_r=8.5,
        face_cy=15.5,
        face_r=4.2,
        foot_y=51.5,
        foot_spread=3.2,
        foot_w=3.0,
        lean=0.4,
    )
    save(img, "player_jump.png")


def make_jump2() -> None:
    # Flash jump2.png 25×55 — second air pose, slight tuck
    w, h = 25, 55
    img = blank(w, h)
    cx = w / 2
    draw_soldier(
        img,
        body_top=17,
        body_bot=46,
        body_cx=cx,
        body_hw=8.0,
        head_cy=9,
        head_r=8.3,
        face_cy=15,
        face_r=4.1,
        foot_y=50.5,
        foot_spread=5.5,
        foot_w=3.0,
        lean=-0.5,
    )
    save(img, "player_jump2.png")


def make_step1() -> None:
    w, h = 24, 49
    img = blank(w, h)
    cx = w / 2
    draw_soldier(
        img,
        body_top=16,
        body_bot=44,
        body_cx=cx,
        body_hw=7.5,
        head_cy=8.5,
        head_r=8.5,
        face_cy=14.5,
        face_r=4.2,
        foot_y=46.5,
        foot_spread=5.5,
        lean=-0.8,
    )
    save(img, "player_step1.png")


def make_step2() -> None:
    w, h = 24, 49
    img = blank(w, h)
    cx = w / 2
    draw_soldier(
        img,
        body_top=16,
        body_bot=44,
        body_cx=cx,
        body_hw=7.5,
        head_cy=8.5,
        head_r=8.5,
        face_cy=14.5,
        face_r=4.2,
        foot_y=46.5,
        foot_spread=5.5,
        lean=0.8,
    )
    save(img, "player_step2.png")


def make_hurt() -> None:
    w, h = 24, 49
    img = blank(w, h)
    cx = w / 2
    draw_soldier(
        img,
        body_top=16,
        body_bot=44,
        body_cx=cx,
        body_hw=7.5,
        head_cy=8.5,
        head_r=8.5,
        face_cy=14.5,
        face_r=4.2,
        foot_y=46.5,
        foot_spread=4.5,
        lean=1.2,
        hurt=True,
    )
    save(img, "player_hurt.png")


def make_death() -> None:
    # Flash guyburned.png 40×49 — wider burned figure
    w, h = 40, 49
    img = blank(w, h)
    cx = w / 2
    draw_soldier(
        img,
        body_top=15,
        body_bot=42,
        body_cx=cx,
        body_hw=9.5,
        head_cy=9,
        head_r=9.5,
        face_cy=15.5,
        face_r=5.0,
        foot_y=45.5,
        foot_spread=6.5,
        foot_w=4.0,
        burned=True,
    )
    # Char marks
    draw = ImageDraw.Draw(img)
    for i in range(5):
        ang = i * (math.pi * 2 / 5)
        ellipse(
            draw,
            cx + math.cos(ang) * 6,
            28 + math.sin(ang) * 8,
            1.4,
            1.0,
            SOOT,
            outline=None,
        )
    save(img, "player_death.png")


def main() -> None:
    make_idle()
    make_duck()
    make_jump()
    make_jump2()
    make_step1()
    make_step2()
    make_hurt()
    make_death()
    print(f"Done — {SCALE}× final player frames in {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
