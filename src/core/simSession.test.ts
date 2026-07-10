import { describe, expect, it } from 'vitest';
import {
  BULLET,
  BULLET_TIME,
  HELI,
  PLAYER,
  POWERUP,
  SIM_DT,
  SIM_HZ,
  WEAPONS,
  WORLD,
} from '../config/constants';
import { nextWeapon, selectWeaponByDigitKey } from '../combat/weaponInventory';
import { PLAYER_SPAWN } from '../player/player';
import { DEBUG_BOX_SPAWN, SimSession } from './simSession';

describe('SimSession', () => {
  it('reset restores a fresh run after timeStep / motion mutations (scene switch)', () => {
    const session = new SimSession();

    session.timeScale.setTimeStep(0.5);
    session.accumulator.advance(SIM_DT / 2);
    session.update(1000 / 30); // one sim tick — idle bullet-time eases 0.5 → 0.6
    expect(session.timeScale.timeStep).toBeCloseTo(0.6, 10);
    expect(session.debugBox.body.vy).toBeGreaterThan(0);
    expect(session.player.body.vy).toBeGreaterThan(0);
    expect(session.simTickCount).toBeGreaterThan(0);
    expect(session.accumulator.leftoverSeconds).toBeCloseTo(SIM_DT / 2);

    session.player.input = {
      left: false,
      right: true,
      jump: false,
      duck: false,
      boost: false,
    };
    session.player.placeAt(400, 50);
    session.debugBox.placeAt(400, 50);
    session.debugBox.dragging = true;
    session.fireHeld = true;
    session.bulletTimeHeld = true;
    session.bulletTime.meter = 10;
    session.update(1000 / 30);
    expect(session.weapon.shots).toBeGreaterThan(0);

    // Game → Boot → Game: create() must call reset() so state does not leak.
    session.reset();

    expect(session.timeScale.timeStep).toBe(1);
    expect(session.bulletTime.meter).toBe(250);
    expect(session.bulletTimeHeld).toBe(false);
    expect(session.player.body.x).toBe(PLAYER_SPAWN.x);
    expect(session.player.body.y).toBe(PLAYER_SPAWN.y);
    expect(session.player.body.vx).toBe(0);
    expect(session.player.body.vy).toBe(0);
    expect(session.player.input).toEqual({
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    });
    expect(session.bullets.activeCount).toBe(0);
    expect(session.bullets.acquireCount).toBe(0);
    expect(session.fireHeld).toBe(false);
    expect(session.weapon.shots).toBe(0);
    expect(session.weapon.reloadTime).toBe(Number.POSITIVE_INFINITY);
    expect(session.weapon.bullets).toBe(Number.POSITIVE_INFINITY);
    expect(session.debugBox.body.x).toBe(DEBUG_BOX_SPAWN.x);
    expect(session.debugBox.body.y).toBe(DEBUG_BOX_SPAWN.y);
    expect(session.debugBox.body.vx).toBe(0);
    expect(session.debugBox.body.vy).toBe(0);
    expect(session.debugBox.dragging).toBe(false);
    expect(session.simTickCount).toBe(0);
    expect(session.ticksThisSecond).toBe(0);
    expect(session.secondTimerMs).toBe(0);
    expect(session.displayedSimRate).toBe(0);
    expect(session.accumulator.leftoverSeconds).toBe(0);
    expect(session.score.value).toBe(0);
    expect(session.playerHealth.health).toBe(100);
    expect(session.playerHealth.alive).toBe(true);
    expect(session.enemyBullets.activeCount).toBe(0);
  });

  it('steps the player walk curve through the fixed sim (ramp to cap, decay to 0)', () => {
    const session = new SimSession();
    // Settle onto the floor.
    for (let i = 0; i < 40; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.player.body.onGround).toBe(true);

    session.player.input = {
      left: false,
      right: true,
      jump: false,
      duck: false,
      boost: false,
    };
    const ramp: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      session.update(1000 / 30);
      ramp.push(session.player.body.vx);
    }
    expect(ramp).toEqual([1, 2, 3, 4, 5, 5, 5, 5]);
    expect(session.player.body.vx).toBe(PLAYER.walkCap);

    session.player.input = {
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    };
    const decay: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      session.update(1000 / 30);
      decay.push(session.player.body.vx);
    }
    expect(decay).toEqual([4, 3, 2, 1, 0, 0]);
    expect(session.player.body.vx).toBe(0);
  });

  it('ignores NaN deltas so the HUD rate timer cannot freeze', () => {
    const session = new SimSession();
    for (let i = 0; i < 30; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);

    session.update(Number.NaN);
    for (let i = 0; i < 300; i += 1) {
      session.update(1000 / 30);
    }

    expect(Number.isNaN(session.secondTimerMs)).toBe(false);
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);
  });

  it('converts Phaser delta ms → seconds and steps at ~30 Hz for 60 Hz frames', () => {
    const session = new SimSession();
    const frames = 60;
    const deltaMs = 1000 / 60;

    for (let i = 0; i < frames; i += 1) {
      session.update(deltaMs);
    }

    expect(session.simTickCount).toBe(SIM_HZ);
    const rate = session.simTickCount / (frames * (deltaMs / 1000));
    expect(rate).toBeGreaterThanOrEqual(SIM_HZ - 1);
    expect(rate).toBeLessThanOrEqual(SIM_HZ + 1);
  });

  it('updates displayedSimRate after ~1s of wall time', () => {
    const session = new SimSession();
    for (let i = 0; i < 30; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.displayedSimRate).toBeCloseTo(SIM_HZ, 0);
    expect(session.ticksThisSecond).toBe(0);
    expect(session.secondTimerMs).toBe(0);
  });

  it('steps the debug box under gravity scaled by the live timeStep', () => {
    const session = new SimSession();
    // Hold bullet-time 5 frames: 1 → 0.5 (Flash −0.1/frame ease).
    session.bulletTimeHeld = true;
    for (let i = 0; i < 5; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.timeScale.timeStep).toBeCloseTo(0.5, 10);

    const y0 = session.debugBox.body.y;
    const vy0 = session.debugBox.body.vy;
    session.update(1000 / 30); // eases to 0.4, then steps with that scale

    expect(session.timeScale.timeStep).toBeCloseTo(0.4, 10);
    expect(session.debugBox.body.vy).toBe(vy0 + WORLD.gravity);
    expect(session.debugBox.body.y).toBe(y0 + (vy0 + WORLD.gravity) * 0.4);
  });

  it('owns the original 35×15 level of 50px tiles (not the test arena)', () => {
    const session = new SimSession();
    expect(session.map.tileSize).toBe(50);
    expect(session.map.width).toBe(35);
    expect(session.map.height).toBe(15);
    // Continuous ground row from decompiled map1.
    expect(session.map.cells[14]!.every((c) => c === 1)).toBe(true);
  });

  it('streams MachineGun at reload cadence while fireHeld (issue #11)', () => {
    const session = new SimSession();
    const slotsRef = session.bullets.slots;
    expect(session.bullets.capacity).toBe(BULLET.poolCapacity);
    expect(WEAPONS[0].reload).toBe(5);

    session.fireHeld = true;
    const fireTicks: number[] = [];
    for (let i = 0; i < SIM_HZ; i += 1) {
      const before = session.bullets.acquireCount;
      session.update(1000 / 30);
      if (session.bullets.acquireCount > before) {
        fireTicks.push(i);
      }
    }

    // Held fire @ 30 Hz with reload 5 → shots on ticks 0,5,10,15,20,25.
    expect(fireTicks).toEqual([0, 5, 10, 15, 20, 25]);
    expect(session.weapon.shots).toBe(6);
    expect(session.bullets.acquireCount).toBe(6);
    expect(session.fireHeld).toBe(true);
    expect(session.bullets.slots).toBe(slotsRef);
  });

  it('does not spawn while fireHeld is false even when reload-ready', () => {
    const session = new SimSession();
    expect(session.weapon.reloadTime).toBe(Number.POSITIVE_INFINITY);

    session.fireHeld = false;
    session.update(1000 / 30);

    expect(session.weapon.shots).toBe(0);
    expect(session.bullets.acquireCount).toBe(0);
    // Reload still advances each sim tick (Flash reloadtime++ every move frame).
    expect(session.weapon.reloadTime).toBe(Number.POSITIVE_INFINITY);
  });

  it('tryFire spawns at the current muzzle with MachineGun speed/damage', () => {
    const session = new SimSession();
    session.player.gunAim = { rotationDeg: 0, flipY: false };
    session.player.muzzle = { x: 150, y: 250 };

    expect(session.tryFire()).toBe(true);
    const bullet = session.bullets.slots.find((b) => b.active)!;
    expect(bullet.x).toBe(150);
    expect(bullet.y).toBe(250);
    expect(bullet.vx).toBeCloseTo(8, 10);
    expect(bullet.vy).toBeCloseTo(0, 10);
    expect(bullet.damage).toBe(10);
  });

  it('reuses pool slots across many held-fire shots without growing capacity', () => {
    const session = new SimSession();
    const capacity = session.bullets.capacity;
    const slotsRef = session.bullets.slots;

    // Aim left so bullets exit the arena cull quickly and recycle.
    session.player.mouse = {
      x: session.player.gunPivot.x - 400,
      y: session.player.gunPivot.y,
    };
    for (let i = 0; i < 20; i += 1) {
      session.update(1000 / 30);
    }

    session.fireHeld = true;
    // 120 ticks held → 120/5 = 24 shots at reload 5 (first immediate).
    for (let i = 0; i < 120; i += 1) {
      session.update(1000 / 30);
    }

    expect(session.weapon.shots).toBe(120 / WEAPONS[0].reload);
    expect(session.bullets.acquireCount).toBe(session.weapon.shots);
    expect(session.bullets.capacity).toBe(capacity);
    expect(session.bullets.slots).toBe(slotsRef);
    expect(session.bullets.recycleCount).toBeGreaterThan(0);
    expect(session.bullets.activeCount).toBeLessThanOrEqual(capacity);
  });

  it('spawns a heli on reset and kills it after 30 held-fire hits (issue #12)', () => {
    const session = new SimSession();
    expect(session.helicopters).toHaveLength(1);
    const heli = session.helicopters[0]!;
    heli.x = 900;
    heli.y = 220;
    heli.xspeed = 0;
    heli.yspeed = 0;
    heli.tx = heli.x;
    heli.ty = heli.y;
    expect(heli.health).toBe(300);
    expect(heli.active).toBe(true);

    const hit = {
      x: heli.x - HELI.spriteW / 2 + 22,
      y: heli.y - HELI.spriteH / 2 + 2,
    };
    session.player.placeAt(hit.x - 80, hit.y);
    session.player.mouse = { x: hit.x, y: hit.y };
    session.fireHeld = true;

    for (let tick = 0; tick < SIM_HZ * 20 && heli.active; tick += 1) {
      heli.xspeed = 0;
      heli.yspeed = 0;
      heli.tx = heli.x;
      heli.ty = heli.y;
      session.update(1000 / 30);
    }

    expect(heli.active).toBe(false);
    expect(heli.health).toBe(0);
    expect(session.weapon.shots).toBeGreaterThanOrEqual(30);
    expect(
      session.explosions.some((e) => e.active) || session.explosions.length > 0,
    ).toBe(true);
  });

  it('increments score by damage per hit and resets score (issue #13)', () => {
    const session = new SimSession();
    expect(session.score.value).toBe(0);

    const heli = session.helicopters[0]!;
    heli.x = 900;
    heli.y = 220;
    heli.xspeed = 0;
    heli.yspeed = 0;
    heli.tx = heli.x;
    heli.ty = heli.y;

    const hit = {
      x: heli.x - HELI.spriteW / 2 + 22,
      y: heli.y - HELI.spriteH / 2 + 2,
    };
    session.player.placeAt(hit.x - 80, hit.y);
    session.player.mouse = { x: hit.x, y: hit.y };
    session.fireHeld = true;

    let sawFlash = false;
    for (let tick = 0; tick < SIM_HZ * 20 && heli.active; tick += 1) {
      heli.xspeed = 0;
      heli.yspeed = 0;
      heli.tx = heli.x;
      heli.ty = heli.y;
      session.update(1000 / 30);
      if (heli.hitFlashRemaining > 0) {
        sawFlash = true;
      }
    }

    expect(heli.active).toBe(false);
    expect(session.score.value).toBe(HELI.hp);
    expect(session.score.value).toBe(30 * WEAPONS[0].damage);
    expect(sawFlash).toBe(true);
    expect(
      session.explosions.some((e) => e.active) || session.explosions.length > 0,
    ).toBe(true);

    session.reset();
    expect(session.score.value).toBe(0);
  });

  it('switches weapons instantly and keeps per-slot ammo/reload (issue #14)', () => {
    const session = new SimSession();
    expect(session.inventory.slots).toHaveLength(14);
    expect(session.inventory.activeIndex).toBe(0);
    expect(session.weapon.type).toBe(0);

    // Charge MachineGun a couple frames after one shot.
    session.fireHeld = true;
    session.update(1000 / 30); // fires, reloadTime → 0
    session.update(1000 / 30); // reloadTime → 1
    session.update(1000 / 30); // reloadTime → 2
    expect(session.weapon.shots).toBe(1);
    expect(session.weapon.reloadTime).toBe(2);
    const mgReload = session.weapon.reloadTime;

    expect(nextWeapon(session.inventory)).toBe(true);
    expect(session.inventory.activeIndex).toBe(1);
    expect(session.weapon.type).toBe(1);
    expect(session.weapon.bullets).toBe(50);
    // Prior slot untouched.
    expect(session.inventory.slots[0]!.reloadTime).toBe(mgReload);

    // Fire Akimbo once — twin-stream (#15): two bullets at speed 8 / damage 9.
    session.bullets.reset();
    const before = session.bullets.acquireCount;
    session.fireHeld = true;
    session.update(1000 / 30);
    expect(session.bullets.acquireCount).toBe(before + 2);
    const active = session.bullets.slots.filter((b) => b.active);
    expect(active).toHaveLength(2);
    for (const bullet of active) {
      expect(bullet.damage).toBe(WEAPONS[1].damage);
      expect(bullet.speed).toBe(WEAPONS[1].speed);
    }
    expect(session.weapon.bullets).toBe(49);

    expect(selectWeaponByDigitKey(session.inventory, 1)).toBe(true);
    expect(session.inventory.activeIndex).toBe(0);
    expect(session.weapon.reloadTime).toBe(mgReload);

    session.reset();
    expect(session.inventory.activeIndex).toBe(0);
    expect(session.weapon.shots).toBe(0);
    expect(session.inventory.slots[1]!.bullets).toBe(50);
  });

  it('Shotgun spawns a five-pellet spread; RPG is slower than GrenadeLauncher (#15)', () => {
    const session = new SimSession();
    // Aim straight +X so gunAim settles near 0° (player.step overwrites gunAim).
    session.player.mouse = {
      x: session.player.gunPivot.x + 400,
      y: session.player.gunPivot.y,
    };
    for (let i = 0; i < 60; i += 1) {
      session.update(1000 / 30);
    }

    // Shotgun (digit 3 → index 2).
    expect(selectWeaponByDigitKey(session.inventory, 3)).toBe(true);
    expect(session.inventory.activeIndex).toBe(2);
    session.bullets.reset();
    session.fireHeld = true;
    session.update(1000 / 30);
    expect(session.bullets.acquireCount).toBe(5);
    const pellets = session.bullets.slots.filter((b) => b.active);
    expect(pellets).toHaveLength(5);
    const rotations = pellets.map((b) => b.rotationDeg).sort((a, b) => a - b);
    const mid = rotations[2]!;
    expect(rotations.map((r) => Math.round(r - mid))).toEqual([
      -10, -5, 0, 5, 10,
    ]);
    for (const p of pellets) {
      expect(p.speed).toBe(WEAPONS[2].speed);
      expect(p.damage).toBe(WEAPONS[2].damage);
    }

    // GrenadeLauncher (digit 5 → index 4) vs RPG (digit 6 → index 5).
    expect(selectWeaponByDigitKey(session.inventory, 5)).toBe(true);
    session.bullets.reset();
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;
    session.update(1000 / 30);
    const grenade = session.bullets.slots.find((b) => b.active)!;
    expect(grenade.speed).toBe(15);
    expect(grenade.damage).toBe(75);
    const grenadeSpeed = grenade.speed;

    expect(selectWeaponByDigitKey(session.inventory, 6)).toBe(true);
    session.bullets.reset();
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;
    session.update(1000 / 30);
    const rpg = session.bullets.slots.find((b) => b.active)!;
    expect(rpg.speed).toBe(4);
    expect(rpg.damage).toBe(75);
    expect(rpg.speed).toBeLessThan(grenadeSpeed);
  });

  it('special weapons: flame streams DoT, seeker homes, rail hitscan (#16)', () => {
    const session = new SimSession();
    session.player.mouse = {
      x: session.player.gunPivot.x + 400,
      y: session.player.gunPivot.y,
    };
    for (let i = 0; i < 60; i += 1) {
      session.update(1000 / 30);
    }

    // FlameThrower (digit 9 → index 8): reload 1, hold:true, flame behavior.
    expect(selectWeaponByDigitKey(session.inventory, 9)).toBe(true);
    expect(session.inventory.activeIndex).toBe(8);
    expect(WEAPONS[8].reload).toBe(1);
    expect(WEAPONS[8].hold).toBe(true);
    session.bullets.reset();
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;
    session.fireHeld = true;
    session.update(1000 / 30);
    session.update(1000 / 30);
    session.update(1000 / 30);
    const flames = session.bullets.slots.filter((b) => b.active);
    expect(flames.length).toBeGreaterThanOrEqual(2);
    for (const f of flames) {
      expect(f.behavior).toBe('flame');
      expect(f.speed).toBe(8);
      expect(f.damage).toBe(2);
    }

    // SeekerLauncher (digit 8 → index 7).
    expect(selectWeaponByDigitKey(session.inventory, 8)).toBe(true);
    session.bullets.reset();
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;
    session.fireHeld = true;
    session.update(1000 / 30);
    const seeker = session.bullets.slots.find((b) => b.active)!;
    expect(seeker.behavior).toBe('seeker');
    expect(seeker.speed).toBe(7);
    expect(seeker.damage).toBe(100);

    // RailGun (digit keys wrap — select by cycling to index 11).
    session.inventory.activeIndex = 11;
    session.weapon.type = 11;
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;
    session.weapon.bullets = 3;
    session.bullets.reset();
    session.fireHeld = true;
    session.update(1000 / 30);
    const rail = session.bullets.slots.find((b) => b.active)!;
    expect(rail.behavior).toBe('rail');
    expect(rail.speed).toBe(20);
    expect(rail.damage).toBe(150);

    // FireMines (index 9).
    session.inventory.activeIndex = 9;
    session.weapon.type = 9;
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;
    session.weapon.bullets = 3;
    session.bullets.reset();
    session.update(1000 / 30);
    const mine = session.bullets.slots.find((b) => b.active)!;
    expect(mine.behavior).toBe('mine');
    expect(mine.speed).toBe(3);
    expect(mine.damage).toBe(5);
  });

  it('heavy weapons: A-Bomb blast, Grapple pull, Shoulder rail (#17)', () => {
    const session = new SimSession();
    session.player.mouse = {
      x: session.player.gunPivot.x + 400,
      y: session.player.gunPivot.y,
    };
    for (let i = 0; i < 60; i += 1) {
      session.update(1000 / 30);
    }

    // ABombLauncher (index 10): reload 150, speed 3, damage 300, abomb.
    session.inventory.activeIndex = 10;
    session.weapon.type = 10;
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;
    session.weapon.bullets = 2;
    session.bullets.reset();
    session.fireHeld = true;
    session.update(1000 / 30);
    const abomb = session.bullets.slots.find((b) => b.active)!;
    expect(abomb.behavior).toBe('abomb');
    expect(abomb.speed).toBe(3);
    expect(abomb.damage).toBe(300);
    expect(WEAPONS[10].reload).toBe(150);

    // GrappleCannon (index 12).
    session.inventory.activeIndex = 12;
    session.weapon.type = 12;
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;
    session.weapon.bullets = 2;
    session.bullets.reset();
    session.update(1000 / 30);
    const grapple = session.bullets.slots.find((b) => b.active)!;
    expect(grapple.behavior).toBe('grapple');
    expect(grapple.speed).toBe(20);
    expect(grapple.damage).toBe(300);
    expect(WEAPONS[12].reload).toBe(250);

    // ShoulderCannon / predator (index 13) — rail hitscan, damage 300.
    session.inventory.activeIndex = 13;
    session.weapon.type = 13;
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;
    session.weapon.bullets = Number.POSITIVE_INFINITY;
    session.bullets.reset();
    session.update(1000 / 30);
    const shoulder = session.bullets.slots.find((b) => b.active)!;
    expect(shoulder.behavior).toBe('rail');
    expect(shoulder.speed).toBe(20);
    expect(shoulder.damage).toBe(300);
    expect(WEAPONS[13].reload).toBe(100);
  });

  it('bullet-time: hold eases to 0.2×, release eases to 1×, player slows with world (#42)', () => {
    const session = new SimSession();
    expect(session.bulletTime.meter).toBe(BULLET_TIME.maxFrames);

    // Settle on the floor so walk displacement is horizontal-only.
    for (let i = 0; i < 40; i += 1) {
      session.update(1000 / 30);
    }
    expect(session.player.body.onGround).toBe(true);

    session.bulletTimeHeld = true;
    const down: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      session.update(1000 / 30);
      down.push(session.timeScale.timeStep);
    }
    expect(down).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]);
    expect(session.bulletTime.meter).toBe(BULLET_TIME.maxFrames - 8);

    // Player walk uses the eased scale (same as the world — not TimeRift).
    session.player.body.vx = PLAYER.walkCap;
    session.player.input = {
      left: false,
      right: true,
      jump: false,
      duck: false,
      boost: false,
    };
    const x0 = session.player.body.x;
    session.update(1000 / 30);
    expect(session.timeScale.timeStep).toBe(0.2);
    expect(session.player.body.x - x0).toBeCloseTo(PLAYER.walkCap * 0.2, 10);

    session.bulletTimeHeld = false;
    const up: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      session.update(1000 / 30);
      up.push(session.timeScale.timeStep);
    }
    expect(up).toEqual([0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  });

  it('bullet-time: meter ends slow-mo at 0; heli kill refills ⅓ max (#42)', () => {
    const session = new SimSession();
    session.bulletTime.meter = 2;
    session.bulletTimeHeld = true;
    session.update(1000 / 30);
    session.update(1000 / 30);
    expect(session.bulletTime.meter).toBe(0);

    // Still holding with empty meter → ease back up (slow-mo ended).
    const before = session.timeScale.timeStep;
    session.update(1000 / 30);
    expect(session.bulletTime.meter).toBe(0);
    expect(session.timeScale.timeStep).toBeGreaterThan(before);

    session.bulletTimeHeld = false;
    // Drain to a known empty, then simulate kill refill via the public helper path.
    session.bulletTime.meter = 0;
    const heli = session.helicopters[0]!;
    heli.health = 1;
    heli.x = 900;
    heli.y = 220;
    heli.xspeed = 0;
    heli.yspeed = 0;
    heli.tx = heli.x;
    heli.ty = heli.y;
    const hit = {
      x: heli.x - HELI.spriteW / 2 + 22,
      y: heli.y - HELI.spriteH / 2 + 2,
    };
    session.player.placeAt(hit.x - 80, hit.y);
    session.player.mouse = { x: hit.x, y: hit.y };
    session.fireHeld = true;
    session.weapon.reloadTime = Number.POSITIVE_INFINITY;

    for (let tick = 0; tick < 30 && heli.active; tick += 1) {
      heli.xspeed = 0;
      heli.yspeed = 0;
      heli.tx = heli.x;
      heli.ty = heli.y;
      session.update(1000 / 30);
    }

    expect(heli.active).toBe(false);
    expect(session.bulletTime.meter).toBeCloseTo(BULLET_TIME.refillPerKill, 10);
  });

  it('TimeRift forces bullet-time slow-mo without draining the meter (#42)', () => {
    const session = new SimSession();
    session.playerPowerup.powerupOn = POWERUP.TimeRift;
    session.playerPowerup.powerupTime = 500;
    session.bulletTimeHeld = false;
    const meterBefore = session.bulletTime.meter;

    const down: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      session.update(1000 / 30);
      down.push(session.timeScale.timeStep);
    }
    expect(down).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]);
    expect(session.bulletTime.meter).toBe(meterBefore);

    // Key held under TimeRift still must not drain.
    session.bulletTimeHeld = true;
    session.update(1000 / 30);
    expect(session.bulletTime.meter).toBe(meterBefore);
    expect(session.timeScale.timeStep).toBe(0.2);
  });
});
