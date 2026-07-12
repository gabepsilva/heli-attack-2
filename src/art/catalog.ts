/**
 * Sprite catalog for the art pipeline (#32 / #33 / #34 / #95).
 * Every entry is a committed atlas source (`final: true`).
 * #95 ships temporary original Flash sprites (nearest-neighbor upscaled);
 * hi-res redraws are TBD. Player frames live under {@link ART_PLAYER_FINAL_DIR}
 * (8×); world frames under {@link ART_WORLD_FINAL_DIR} (4×).
 */

import {
  ART_PLAYER_FINAL_DIR,
  ART_PLAYER_FINAL_SCALE,
  ART_WORLD_FINAL_DIR,
  ART_WORLD_FINAL_SCALE,
} from '../config/art';

/** Normalized pivot: (0,0) = top-left, (0.5,1) = bottom-center, etc. */
export type SpritePivot = Readonly<{ x: number; y: number }>;

export type SpriteDef = Readonly<{
  /** Atlas frame name (and logical id). */
  id: string;
  /**
   * Source PNG basename.
   * Player: under {@link ART_PLAYER_FINAL_DIR}.
   * World: under {@link ART_WORLD_FINAL_DIR}.
   */
  sourceFile: string;
  /** Original Flash-era pixel size (art bible / pose reference). */
  originalW: number;
  originalH: number;
  /** Pivot used when placing the sprite in the scene. */
  pivot: SpritePivot;
  /**
   * Game-space draw size, when it is *not* the sprite's original pixel size.
   * Default (omitted) is 1 game unit = 1 Flash px. Set it for art whose drawn
   * box deliberately differs from its bitmap — an oversized tile, a canopy that
   * blooms past its source, a half-res explosion sheet drawn at full feel.
   */
  drawW?: number;
  drawH?: number;
  /** Short role note for ART-SPEC / artists. */
  role: string;
  /**
   * When true, the packer loads the committed source PNG (no runtime
   * placeholder upscale). All catalog entries are committed after #34.
   */
  final?: boolean;
}>;

/**
 * Curated atlas set — temporary original Flash art (#95), hi-res TBD.
 */
export const SPRITE_DEFS = [
  {
    id: 'player_idle',
    sourceFile: 'player_idle.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player stand / idle (temp Flash guy.png)',
    final: true,
  },
  {
    id: 'player_duck',
    sourceFile: 'player_duck.png',
    originalW: 25,
    originalH: 39,
    pivot: { x: 0.5, y: 1 },
    role: 'Player duck (temp Flash duck.png)',
    final: true,
  },
  {
    id: 'player_jump',
    sourceFile: 'player_jump.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player jump (temp Flash jump.png)',
    final: true,
  },
  {
    id: 'player_jump2',
    sourceFile: 'player_jump2.png',
    originalW: 25,
    originalH: 55,
    pivot: { x: 0.5, y: 1 },
    role: 'Player double-jump (temp Flash jump2.png)',
    final: true,
  },
  {
    id: 'player_step1',
    sourceFile: 'player_step1.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 1 (temp Flash step1.png)',
    final: true,
  },
  {
    id: 'player_step2',
    sourceFile: 'player_step2.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player walk cycle frame 2 (temp Flash step2.png)',
    final: true,
  },
  {
    id: 'player_hurt',
    sourceFile: 'player_hurt.png',
    originalW: 24,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player hurt flash (stub: reuse guy.png — no dedicated original)',
    final: true,
  },
  {
    id: 'player_death',
    sourceFile: 'player_death.png',
    originalW: 40,
    originalH: 49,
    pivot: { x: 0.5, y: 1 },
    role: 'Player death (temp Flash guyburned.png)',
    final: true,
  },
  {
    id: 'player_chute',
    sourceFile: 'player_chute.png',
    originalW: 12,
    originalH: 12,
    pivot: { x: 0.5, y: 1 },
    // Canopy blooms well past its source bitmap — it is not a character-sized sprite.
    drawW: 126,
    drawH: 126,
    role: 'Player spawn parachute canopy (heroStart gfx.chute)',
    final: true,
  },
  {
    id: 'heli',
    sourceFile: 'heli.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy helicopter look 0 / hover (temp Flash heli.png)',
    final: true,
  },
  {
    id: 'heli_strafe',
    sourceFile: 'heli_strafe.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy helicopter look 1 / strafe (stub: reuse heli.png)',
    final: true,
  },
  {
    id: 'heli_hit',
    sourceFile: 'heli_hit.png',
    originalW: 212,
    originalH: 106,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter damaged flash (temp Flash heli_hit.png)',
    final: true,
  },
  {
    id: 'heli_destroyed',
    sourceFile: 'heliDestroyed.png',
    originalW: 173,
    originalH: 89,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Helicopter wreck (temp Flash heliDestroyed.png)',
    final: true,
  },
  {
    id: 'shard',
    sourceFile: 'shard.png',
    originalW: 24,
    originalH: 19,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard0.png)',
    final: true,
  },
  {
    id: 'shard_1',
    sourceFile: 'shard_1.png',
    originalW: 17,
    originalH: 21,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard1.png)',
    final: true,
  },
  {
    id: 'shard_3',
    sourceFile: 'shard_3.png',
    originalW: 14,
    originalH: 11,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard3.png)',
    final: true,
  },
  {
    id: 'shard_4',
    sourceFile: 'shard_4.png',
    originalW: 10,
    originalH: 24,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard4.png)',
    final: true,
  },
  {
    id: 'shard_5',
    sourceFile: 'shard_5.png',
    originalW: 10,
    originalH: 24,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Heli death scrap (temp Flash shard5.png)',
    final: true,
  },
  {
    id: 'enemy_guy',
    sourceFile: 'enemyguy.png',
    originalW: 25,
    originalH: 48,
    pivot: { x: 0.5, y: 1 },
    role: 'Heli door-gunner body (+ ground enemy) (temp Flash enemyguy.png)',
    final: true,
  },
  {
    id: 'bullet_player',
    sourceFile: 'bullett.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Player projectile (temp Flash bullett.png)',
    final: true,
  },
  {
    id: 'bullet_enemy',
    sourceFile: 'enemybullet.png',
    originalW: 10,
    originalH: 9,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Enemy projectile (temp Flash enemybullet.png)',
    final: true,
  },
  // --- Held guns, one per arsenal slot ------------------------------------
  // The hands are drawn into each bitmap, and `pivot` is the grip the gun turns
  // around — both taken from the original `gun` MovieClip's registration point,
  // not eyeballed. Slot 13 (ShoulderCannon) has no bitmap: predator mode is
  // cloaked. Re-derive with: python3 scripts/art/extract-swf-guns.py
  {
    id: 'weapon_machinegun',
    sourceFile: 'machineGun.png',
    originalW: 29,
    originalH: 16,
    pivot: { x: 0.1724, y: 0.75 },
    role: 'Held gun 0 — MachineGun (Flash machineGun.png)',
    final: true,
  },
  {
    id: 'weapon_mac10',
    sourceFile: 'uzi.png',
    originalW: 32,
    originalH: 37,
    // Akimbo: the pair straddles the grip, so it sits left of the bitmap edge.
    pivot: { x: -0.0625, y: 0.5676 },
    role: 'Held gun 1 — AkimboMac10 (Flash uzi.png)',
    final: true,
  },
  {
    id: 'weapon_shotgun',
    sourceFile: 'shotty.png',
    originalW: 36,
    originalH: 16,
    pivot: { x: 0.1389, y: 0.75 },
    role: 'Held gun 2 — Shotgun (Flash shotty.png)',
    final: true,
  },
  {
    id: 'weapon_shotgunrockets',
    sourceFile: 'shotgunrocket.png',
    originalW: 41,
    originalH: 23,
    pivot: { x: 0.1707, y: 0.8261 },
    role: 'Held gun 3 — ShotgunRockets (Flash shotgunrocket.png)',
    final: true,
  },
  {
    id: 'weapon_grenadelauncher',
    sourceFile: 'grenadelauncher.png',
    originalW: 44,
    originalH: 22,
    pivot: { x: 0.2955, y: 0.8182 },
    role: 'Held gun 4 — GrenadeLauncher (Flash grenadelauncher.png)',
    final: true,
  },
  {
    id: 'weapon_rpg',
    sourceFile: 'rpggun.png',
    originalW: 50,
    originalH: 24,
    pivot: { x: 0.36, y: 0.8333 },
    role: 'Held gun 5 — RPG (Flash rpggun.png)',
    final: true,
  },
  {
    id: 'weapon_rocketlauncher',
    sourceFile: 'rlauncher.png',
    originalW: 44,
    originalH: 27,
    pivot: { x: 0.4318, y: 0.8519 },
    role: 'Held gun 6 — RocketLauncher (Flash rlauncher.png)',
    final: true,
  },
  {
    id: 'weapon_seekerlauncher',
    sourceFile: 'seekerlauncher.png',
    originalW: 49,
    originalH: 32,
    pivot: { x: 0.4898, y: 0.875 },
    role: 'Held gun 7 — SeekerLauncher (Flash seekerlauncher.png)',
    final: true,
  },
  {
    id: 'weapon_flamethrower',
    sourceFile: 'flameThrower.png',
    originalW: 39,
    originalH: 20,
    pivot: { x: 0.2308, y: 0.8 },
    role: 'Held gun 8 — FlameThrower (Flash flameThrower.png)',
    final: true,
  },
  {
    id: 'weapon_firemines',
    sourceFile: 'mine.png',
    originalW: 21,
    originalH: 19,
    // Not a gun: the player holds the mine itself, out past the hand — hence
    // the negative grip. Same bitmap as the planted `mine`, different pivot.
    pivot: { x: -0.4286, y: 0.7895 },
    role: 'Held gun 9 — FireMines (Flash mine.png, held)',
    final: true,
  },
  {
    id: 'weapon_abomb',
    sourceFile: 'abomb.png',
    originalW: 51,
    originalH: 35,
    pivot: { x: 0.4314, y: 0.8571 },
    role: 'Held gun 10 — ABombLauncher (Flash abomb.png)',
    final: true,
  },
  {
    id: 'muzzle_flash',
    sourceFile: 'muzzle_flash.png',
    originalW: 16,
    originalH: 16,
    pivot: { x: 0.5, y: 0.5 },
    drawW: 18,
    drawH: 18,
    role: 'Weapon muzzle flash (generated stub — no Flash original)',
    final: true,
  },
  {
    id: 'grenade',
    sourceFile: 'grenade.png',
    originalW: 19,
    originalH: 11,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Grenade projectile (temp Flash grenade.png)',
    final: true,
  },
  {
    id: 'rocket',
    sourceFile: 'Rocket.png',
    originalW: 21,
    originalH: 15,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Rocket projectile (temp Flash Rocket.png)',
    final: true,
  },
  {
    id: 'shotgunrocketbullet',
    sourceFile: 'shotgunrocketbullet.png',
    originalW: 17,
    originalH: 12,
    pivot: { x: 0.5, y: 0.5 },
    role: 'ShotgunRockets projectile (Flash shotgunrocketbullet.png / bullet frame 7)',
    final: true,
  },
  {
    id: 'rpg',
    sourceFile: 'rpg.png',
    originalW: 22,
    originalH: 13,
    pivot: { x: 0.5, y: 0.5 },
    role: 'RPG projectile (Flash rpg.png / bullet frame 8)',
    final: true,
  },
  {
    id: 'seekerbullet',
    sourceFile: 'seekerbullet.png',
    originalW: 23,
    originalH: 15,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Seeker projectile (Flash seekerbullet.png / bullet frame 5)',
    final: true,
  },
  {
    id: 'flame',
    sourceFile: 'flame.png',
    originalW: 42,
    originalH: 42,
    pivot: { x: 0.5, y: 0.5 },
    role: 'FlameThrower projectile (Flash flame.png / bullet frame 3)',
    final: true,
  },
  {
    id: 'minebullet',
    sourceFile: 'minebullet.png',
    originalW: 20,
    originalH: 11,
    pivot: { x: 0.5, y: 0.5 },
    role: 'FireMines lobbed projectile (Flash minebullet.png / bullet frame 10)',
    final: true,
  },
  {
    id: 'mine',
    sourceFile: 'mine.png',
    originalW: 21,
    originalH: 19,
    pivot: { x: 0.5, y: 0.5 },
    role: 'FireMines planted look (Flash mine.png)',
    final: true,
  },
  {
    id: 'abombbullet',
    sourceFile: 'abombbullet.png',
    originalW: 36,
    originalH: 29,
    pivot: { x: 0.5, y: 0.5 },
    role: 'A-Bomb projectile (Flash abombbullet.png / bullet frame 6)',
    final: true,
  },
  {
    id: 'railtrail',
    sourceFile: 'railtrail.png',
    originalW: 456,
    originalH: 32,
    // Flash `railFrame` never moves the clip: the beam is pinned at the muzzle
    // and fades. The white-hot blast is the left edge, so anchor there and let
    // the beam extend along +x (rotation 0) like every other bullet frame.
    pivot: { x: 0, y: 0.5 },
    role: 'RailGun beam (Flash railtrail.png / bullet frame 9)',
    final: true,
  },
  {
    id: 'shouldercannon',
    sourceFile: 'shouldercannon.png',
    originalW: 456,
    originalH: 32,
    pivot: { x: 0, y: 0.5 },
    role: 'ShoulderCannon beam (Flash shouldercannon.png / bullet frame 11)',
    final: true,
  },
  {
    id: 'weapon_rail',
    sourceFile: 'rail.png',
    originalW: 57,
    originalH: 31,
    pivot: { x: 0.4035, y: 0.871 },
    role: 'Held gun 11 — RailGun (Flash rail.png)',
    final: true,
  },
  {
    id: 'weapon_grapplecannon',
    sourceFile: 'grapplegun.png',
    originalW: 54,
    originalH: 27,
    pivot: { x: 0.3333, y: 0.8519 },
    role: 'Held gun 12 — GrappleCannon (Flash grapplegun.png)',
    final: true,
  },
  {
    id: 'grapplebullet',
    sourceFile: 'grapplebullet.png',
    originalW: 21,
    originalH: 21,
    pivot: { x: 0.5, y: 0.5 },
    role: 'GrappleCannon projectile (Flash grapplebullet.png / bullet frame 12)',
    final: true,
  },
  {
    id: 'smoke',
    sourceFile: 'smoke.png',
    originalW: 28,
    originalH: 27,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Smoke VFX (temp Flash smoke.png)',
    final: true,
  },
  {
    id: 'blood',
    sourceFile: 'blood.png',
    originalW: 30,
    originalH: 30,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Hit / blood VFX (temp Flash blood.png)',
    final: true,
  },
  {
    id: 'explosion',
    sourceFile: 'explosion.png',
    originalW: 187,
    originalH: 186,
    pivot: { x: 0.5, y: 0.5 },
    // Flash bigboom ~374px; catalog stores half-res source, drawn at full feel.
    drawW: 120,
    drawH: 120,
    role: 'Heli death explosion (temp Flash bigboom.png, half-res catalog)',
    final: true,
  },
  {
    id: 'powerup',
    sourceFile: 'powerup.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'State / mystery powerup crate (Flash powerup.png)',
    final: true,
  },
  {
    id: 'powerhealth',
    sourceFile: 'powerhealth.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'Health crate (Flash powerhealth.png — white box + red cross)',
    final: true,
  },
  // Flash `HUD.weapon` crate icons — one frame per cgun slot (#105).
  {
    id: 'powermachinegun',
    sourceFile: 'powermachinegun.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 0 MachineGun (Flash powermachinegun.png)',
    final: true,
  },
  {
    id: 'poweruzi',
    sourceFile: 'poweruzi.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 1 AkimboMac10 (Flash old/poweruzi.png)',
    final: true,
  },
  {
    id: 'powershotgun',
    sourceFile: 'powershotgun.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 2 Shotgun (Flash powershotgun.png)',
    final: true,
  },
  {
    id: 'powershotgunrocket',
    sourceFile: 'powershotgunrocket.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 3 ShotgunRockets (Flash powershotgunrocket.png)',
    final: true,
  },
  {
    id: 'powergen',
    sourceFile: 'powergen.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 4 GrenadeLauncher (Flash powergen.png)',
    final: true,
  },
  {
    id: 'powerrpg',
    sourceFile: 'powerrpg.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 5 RPG (Flash powerrpg.png)',
    final: true,
  },
  {
    id: 'powerrocketlauncher',
    sourceFile: 'powerrocketlauncher.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 6 RocketLauncher (Flash powerrocketlauncher.png)',
    final: true,
  },
  {
    id: 'powerseeker',
    sourceFile: 'powerseeker.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 7 SeekerLauncher (Flash powerseeker.png)',
    final: true,
  },
  {
    id: 'powerflamethrower',
    sourceFile: 'powerflamethrower.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 8 FlameThrower (Flash powerflamethrower.png)',
    final: true,
  },
  {
    id: 'powermine',
    sourceFile: 'powermine.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 9 FireMines (Flash powermine.png)',
    final: true,
  },
  {
    id: 'powerabomb',
    sourceFile: 'powerabomb.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 10 ABombLauncher (Flash powerabomb.png)',
    final: true,
  },
  {
    id: 'powerrail',
    sourceFile: 'powerrail.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 11 RailGun (Flash powerrail.png)',
    final: true,
  },
  {
    id: 'powergrapple',
    sourceFile: 'powergrapple.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 12 GrappleCannon (Flash powergrapple.png)',
    final: true,
  },
  {
    id: 'powershouldercannon',
    sourceFile: 'powershouldercannon.png',
    originalW: 33,
    originalH: 32,
    pivot: { x: 0.5, y: 0.5 },
    role: 'HUD weapon crate cgun 13 ShoulderCannon (Flash powershouldercannon.png)',
    final: true,
  },
  // Ground tileset — Flash `tiles` MovieClip frames 2..11, extracted from the
  // original SWF (`npm run art:extract-tiles`). Map cell frame `n` draws
  // `tile_0n`. Flash renders frames 5, 7 and 11 by mirroring an earlier bitmap
  // (negative fill scale); the extractor bakes those flips into the PNGs.
  {
    id: 'tile_01',
    sourceFile: 'tile_01.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Ground surface — grass cap on exposed dirt',
    final: true,
  },
  {
    id: 'tile_02',
    sourceFile: 'tile_02.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Buried dirt — no grass (a tile sits on top)',
    final: true,
  },
  {
    id: 'tile_03',
    sourceFile: 'tile_03.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Left end cap — grass cap + rocky left edge',
    final: true,
  },
  {
    id: 'tile_04',
    sourceFile: 'tile_04.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Right end cap — grass cap + rocky right edge (mirrors tile_03)',
    final: true,
  },
  {
    id: 'tile_05',
    sourceFile: 'tile_05.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Bush at the left side of a ledge base',
    final: true,
  },
  {
    id: 'tile_06',
    sourceFile: 'tile_06.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Bush at the right side of a ledge base (mirrors tile_05)',
    final: true,
  },
  {
    id: 'tile_07',
    sourceFile: 'tile_07.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Rocky overhang corner — grass cap, open right edge + underside',
    final: true,
  },
  {
    id: 'tile_08',
    sourceFile: 'tile_08.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Rocky overhang corner — Flash frame 9, same art as tile_07',
    final: true,
  },
  {
    id: 'tile_09',
    sourceFile: 'tile_09.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Buried dirt variant (tileset frame 10; unused by map1)',
    final: true,
  },
  {
    id: 'tile_10',
    sourceFile: 'tile_10.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Bush at a ledge base — Flash frame 11, same art as tile_06',
    final: true,
  },
  // Parallax foliage tileset — Flash `bg` MovieClip frames 2..3, drawn behind
  // the ground by `bglayer1` (decorative only; collision slot is always 0).
  {
    id: 'bg_tile_01',
    sourceFile: 'bg_tile_01.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Background foliage — fern / bush crown',
    final: true,
  },
  {
    id: 'bg_tile_02',
    sourceFile: 'bg_tile_02.png',
    originalW: 52,
    originalH: 52,
    pivot: { x: 0, y: 0 },
    role: 'Background foliage — palm trunk with fronds',
    final: true,
  },
] as const satisfies readonly SpriteDef[];

export type SpriteId = (typeof SPRITE_DEFS)[number]['id'];

/**
 * Player animation frame ids wired to Flash hero gfx states (#33).
 * Walk is the two-frame nested cycle under Flash gfx frame 4.
 */
export const PLAYER_ANIM_FRAMES = {
  idle: 'player_idle',
  duck: 'player_duck',
  jump: 'player_jump',
  jump2: 'player_jump2',
  walk: ['player_step1', 'player_step2'],
  hurt: 'player_hurt',
  death: 'player_death',
} as const satisfies {
  idle: SpriteId;
  duck: SpriteId;
  jump: SpriteId;
  jump2: SpriteId;
  walk: readonly SpriteId[];
  hurt: SpriteId;
  death: SpriteId;
};

/** All player atlas frame ids. */
export const PLAYER_FINAL_FRAME_IDS: readonly SpriteId[] = [
  PLAYER_ANIM_FRAMES.idle,
  PLAYER_ANIM_FRAMES.duck,
  PLAYER_ANIM_FRAMES.jump,
  PLAYER_ANIM_FRAMES.jump2,
  ...PLAYER_ANIM_FRAMES.walk,
  PLAYER_ANIM_FRAMES.hurt,
  PLAYER_ANIM_FRAMES.death,
];

/**
 * Ground tileset frames, indexed by the Flash map cell frame slot: cell frame
 * `n` (1..10) draws `TILE_FRAME_IDS[n - 1]`, i.e. `tiles.gotoAndStop(n + 1)`.
 * Cell frame `0` is the blank tileset frame and draws nothing.
 */
export const TILE_FRAME_IDS = [
  'tile_01',
  'tile_02',
  'tile_03',
  'tile_04',
  'tile_05',
  'tile_06',
  'tile_07',
  'tile_08',
  'tile_09',
  'tile_10',
] as const satisfies readonly SpriteId[];

/**
 * Parallax foliage frames (Flash `bg` tileset), indexed the same way: `bglayer1`
 * cell frame `n` (1..2) draws `BG_TILE_FRAME_IDS[n - 1]`.
 */
export const BG_TILE_FRAME_IDS = [
  'bg_tile_01',
  'bg_tile_02',
] as const satisfies readonly SpriteId[];

/**
 * Atlas frame for a map cell's visual slot, or `null` for a blank cell.
 * Out-of-range frames are treated as blank rather than throwing — a malformed
 * cell should leave a hole, not crash the render.
 */
export function tileFrameForCell(frame: number): SpriteId | null {
  return TILE_FRAME_IDS[frame - 1] ?? null;
}

/** As {@link tileFrameForCell}, for the background foliage layer. */
export function bgTileFrameForCell(frame: number): SpriteId | null {
  return BG_TILE_FRAME_IDS[frame - 1] ?? null;
}

/** Indexed once — {@link isTileFrame} runs per sprite per frame in the render loops. */
const TILE_FRAME_ID_SET: ReadonlySet<string> = new Set<string>([
  ...TILE_FRAME_IDS,
  ...BG_TILE_FRAME_IDS,
]);

/** True for tileset frames (ground or foliage) — they share the 52×52 draw box. */
export function isTileFrame(id: string): boolean {
  return TILE_FRAME_ID_SET.has(id);
}

/**
 * Heli look → atlas frame (#20 / #34 / #95).
 * Look 0 = hover, look 1 = strafe (stub reuses heli.png until a dedicated original).
 */
export const HELI_LOOK_FRAMES = [
  'heli',
  'heli_strafe',
] as const satisfies readonly SpriteId[];

/** Flash `Shard` looks — `shard0/1/3/4/5.png` (no shard2 in assets). */
export const SHARD_LOOK_FRAMES = [
  'shard',
  'shard_1',
  'shard_3',
  'shard_4',
  'shard_5',
] as const satisfies readonly SpriteId[];

/** Atlas frame for a bouncing scrap look index. */
export function shardFrameForLook(look: number): SpriteId {
  return SHARD_LOOK_FRAMES[look] ?? SHARD_LOOK_FRAMES[0];
}

/** World (non-player) frame ids. */
export const WORLD_FINAL_FRAME_IDS: readonly SpriteId[] = SPRITE_DEFS.filter(
  (d) => !d.id.startsWith('player_'),
).map((d) => d.id);

/**
 * Catalog id → iopred `ha2/assets` basename used by the import script (#95).
 * Stubs document the reuse / generated source when no dedicated original exists.
 */
export const FLASH_ORIGINAL_SOURCES = {
  player_idle: 'guy.png',
  player_duck: 'duck.png',
  player_jump: 'jump.png',
  player_jump2: 'jump2.png',
  player_step1: 'step1.png',
  player_step2: 'step2.png',
  player_hurt: 'guy.png', // stub reuse
  player_death: 'guyburned.png',
  player_chute: null, // custom canopy art (not from Flash assets)
  heli: 'heli.png',
  heli_strafe: 'heli.png', // stub reuse
  heli_hit: 'heli_hit.png',
  heli_destroyed: 'heliDestroyed.png',
  shard: 'shard0.png',
  shard_1: 'shard1.png',
  shard_3: 'shard3.png',
  shard_4: 'shard4.png',
  shard_5: 'shard5.png',
  enemy_guy: 'enemyguy.png',
  bullet_player: 'bullett.png',
  bullet_enemy: 'enemybullet.png',
  weapon_machinegun: 'machineGun.png',
  muzzle_flash: null, // generated stub
  grenade: 'grenade.png',
  rocket: 'Rocket.png',
  shotgunrocketbullet: 'shotgunrocketbullet.png',
  rpg: 'rpg.png',
  seekerbullet: 'seekerbullet.png',
  flame: 'flame.png',
  minebullet: 'minebullet.png',
  mine: 'mine.png',
  abombbullet: 'abombbullet.png',
  railtrail: 'railtrail.png',
  shouldercannon: 'shouldercannon.png',
  weapon_mac10: 'uzi.png',
  weapon_shotgun: 'shotty.png',
  weapon_shotgunrockets: 'shotgunrocket.png',
  weapon_grenadelauncher: 'grenadelauncher.png',
  weapon_rpg: 'rpggun.png',
  weapon_rocketlauncher: 'rlauncher.png',
  weapon_seekerlauncher: 'seekerlauncher.png',
  weapon_flamethrower: 'flameThrower.png',
  weapon_firemines: 'mine.png', // held mine (same bitmap as the planted body)
  weapon_abomb: 'abomb.png',
  weapon_rail: 'rail.png',
  weapon_grapplecannon: 'grapplegun.png',
  grapplebullet: 'grapplebullet.png',
  smoke: 'smoke.png',
  blood: 'blood.png',
  explosion: 'bigboom.png',
  powerup: 'powerup.png',
  powerhealth: 'powerhealth.png',
  powermachinegun: 'powermachinegun.png',
  poweruzi: 'old/poweruzi.png', // AkimboMac10 — only under iopred old/
  powershotgun: 'powershotgun.png',
  powershotgunrocket: 'powershotgunrocket.png',
  powergen: 'powergen.png',
  powerrpg: 'powerrpg.png',
  powerrocketlauncher: 'powerrocketlauncher.png',
  powerseeker: 'powerseeker.png',
  powerflamethrower: 'powerflamethrower.png',
  powermine: 'powermine.png',
  powerabomb: 'powerabomb.png',
  powerrail: 'powerrail.png',
  powergrapple: 'powergrapple.png',
  powershouldercannon: 'powershouldercannon.png',
  // Extracted from the SWF `tiles` MovieClip, not shipped as ha2/assets PNGs
  // (those are the fills only) — see scripts/art/extract-swf-tiles.py.
  tile_01: 'tiles/tile_01.png',
  tile_02: 'tiles/tile_02.png',
  tile_03: 'tiles/tile_03.png',
  tile_04: 'tiles/tile_04.png',
  tile_05: 'tiles/tile_05.png',
  tile_06: 'tiles/tile_06.png',
  tile_07: 'tiles/tile_07.png',
  tile_08: 'tiles/tile_08.png',
  tile_09: 'tiles/tile_09.png',
  tile_10: 'tiles/tile_10.png',
  bg_tile_01: 'tiles/bg_tile_01.png',
  bg_tile_02: 'tiles/bg_tile_02.png',
} as const satisfies Record<SpriteId, string | null>;

/**
 * Flash `HUD.weapon.gotoAndStop(cgun+1)` — atlas frame per arsenal slot (#105).
 * Index-aligned with {@link WEAPONS} / Flash `this.guns[cgun]`.
 */
export const WEAPON_HUD_ICON_FRAMES = [
  'powermachinegun',
  'poweruzi',
  'powershotgun',
  'powershotgunrocket',
  'powergen',
  'powerrpg',
  'powerrocketlauncher',
  'powerseeker',
  'powerflamethrower',
  'powermine',
  'powerabomb',
  'powerrail',
  'powergrapple',
  'powershouldercannon',
] as const satisfies readonly SpriteId[];

/** Atlas frame for Flash HUD weapon crate at arsenal slot `cgun`. */
export function weaponHudIconFrame(cgun: number): SpriteId {
  return WEAPON_HUD_ICON_FRAMES[cgun] ?? WEAPON_HUD_ICON_FRAMES[0];
}

/**
 * Flash `addBullet(..., frame)` — atlas frame per arsenal weapon.
 * MG / Uzi / Shotgun share `bullett` (frame 1); others use dedicated PNGs.
 * RailGun and ShoulderCannon share `railFrame` behavior but *not* art — they
 * are bullet frames 9 and 11, two separate beams.
 */
export const WEAPON_PROJECTILE_FRAMES = [
  'bullet_player', // 0 MachineGun
  'bullet_player', // 1 AkimboMac10
  'bullet_player', // 2 Shotgun
  'shotgunrocketbullet', // 3 ShotgunRockets
  'grenade', // 4 GrenadeLauncher
  'rpg', // 5 RPG
  'rocket', // 6 RocketLauncher
  'seekerbullet', // 7 SeekerLauncher
  'flame', // 8 FlameThrower
  'minebullet', // 9 FireMines (lobbed)
  'abombbullet', // 10 ABombLauncher
  'railtrail', // 11 RailGun
  'grapplebullet', // 12 GrappleCannon
  'shouldercannon', // 13 ShoulderCannon
] as const satisfies readonly SpriteId[];

/** Atlas frame for a fired weapon projectile (Flash bullet timeline frame). */
export function projectileFrameForWeapon(weaponIndex: number): SpriteId {
  return WEAPON_PROJECTILE_FRAMES[weaponIndex] ?? WEAPON_PROJECTILE_FRAMES[0];
}

/**
 * World-drop crate frame: health → `powerhealth`, state → `powerup`,
 * weapon → matching HUD crate icon.
 */
export function powerupCrateFrame(
  kind: 'health' | 'weapon' | 'state',
  weaponIndex: number = 0,
): SpriteId {
  if (kind === 'health') {
    return 'powerhealth';
  }
  if (kind === 'state') {
    return 'powerup';
  }
  return weaponHudIconFrame(weaponIndex);
}

/** Frame ids with no dedicated Flash original (documented stubs). */
export const FLASH_STUB_FRAME_IDS = [
  'player_hurt',
  'heli_strafe',
  'muzzle_flash',
] as const satisfies readonly SpriteId[];

/** Indexed once at load — the render loops call {@link getSpriteDef} per sprite
 * per frame, which a linear scan of the whole catalog would not survive. */
const SPRITE_DEFS_BY_ID: ReadonlyMap<SpriteId, SpriteDef> = new Map(
  SPRITE_DEFS.map((def) => [def.id, def]),
);

export function getSpriteDef(id: SpriteId): SpriteDef {
  const def = SPRITE_DEFS_BY_ID.get(id);
  if (!def) {
    throw new Error(`Unknown sprite id: ${id}`);
  }
  return def;
}

export function isSpriteId(value: string): value is SpriteId {
  return SPRITE_DEFS.some((s) => s.id === value);
}

/** True when this catalog entry is a committed atlas source (not a runtime placeholder). */
export function isFinalSprite(def: SpriteDef): boolean {
  return def.final === true;
}

/** True when every catalog sprite is a committed atlas source. */
export function catalogHasNoPlaceholders(): boolean {
  return SPRITE_DEFS.every((d) => isFinalSprite(d));
}

/** Repo-relative path to a final player source PNG. */
export function finalPlayerSourcePath(def: SpriteDef): string {
  return `${ART_PLAYER_FINAL_DIR}/${def.sourceFile}`;
}

/** Repo-relative path to a final world source PNG. */
export function finalWorldSourcePath(def: SpriteDef): string {
  return `${ART_WORLD_FINAL_DIR}/${def.sourceFile}`;
}

/** Repo-relative path to the committed final source for a catalog entry. */
export function finalSourcePath(def: SpriteDef): string {
  if (def.id.startsWith('player_')) {
    return finalPlayerSourcePath(def);
  }
  return finalWorldSourcePath(def);
}

/** Texture scale for a catalog entry (player 8×, world 4×). */
export function textureScaleFor(def: SpriteDef): number {
  if (!isFinalSprite(def)) {
    // Legacy path — catalog no longer ships placeholders after #34.
    return ART_WORLD_FINAL_SCALE;
  }
  return def.id.startsWith('player_')
    ? ART_PLAYER_FINAL_SCALE
    : ART_WORLD_FINAL_SCALE;
}

/**
 * Texture pixel size in the packed atlas.
 * Player frames use {@link ART_PLAYER_FINAL_SCALE}; world frames use
 * {@link ART_WORLD_FINAL_SCALE}.
 */
export function textureSize(def: SpriteDef): { w: number; h: number } {
  const scale = textureScaleFor(def);
  return {
    w: def.originalW * scale,
    h: def.originalH * scale,
  };
}

/**
 * Game-space draw size for a sprite.
 * Sprites draw at original Flash pixels (1 game unit = 1 Flash px) so aspect is
 * preserved; a def opts out via {@link SpriteDef.drawW} / {@link SpriteDef.drawH}.
 * The player's 48×48 constant is the Flash hero *MovieClip* layout box used for
 * collision centering — never a stretch target for the bitmaps.
 */
export function gameDrawSize(def: SpriteDef): { w: number; h: number } {
  return {
    w: def.drawW ?? def.originalW,
    h: def.drawH ?? def.originalH,
  };
}

/** Atlas frame for a heli look index (#20/#34). */
export function heliFrameForLook(look: number): SpriteId {
  return HELI_LOOK_FRAMES[look] ?? HELI_LOOK_FRAMES[0];
}
