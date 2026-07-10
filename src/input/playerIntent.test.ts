/**
 * Player intent — unit tests for issue #29.
 * Asserts gameplay consumes intent (not keys) and exact default control semantics.
 */

import { describe, expect, it } from 'vitest';
import {
  createWeaponInventory,
  getActiveWeaponDef,
} from '../combat/weaponInventory';
import { POWERUP } from '../config/constants';
import { SimSession } from '../core/simSession';
import {
  createIntentActionBuffer,
  queueWeaponDigit,
  queueWeaponFromWheelDelta,
  sampleKeyboardMouseIntent,
} from './keyboardMouse';
import { applyPlayerIntent, createPlayerIntent } from './playerIntent';

/** Opt-in full arsenal for weapon-switch intent tests (#92). */
function grantTestArsenal(session: SimSession): void {
  session.inventory = createWeaponInventory({ testGrant: true });
}

describe('playerIntent (issue #29)', () => {
  it('createPlayerIntent starts fully released with the given aim point', () => {
    const intent = createPlayerIntent(120, 340);
    expect(intent).toEqual({
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
      bulletTime: false,
      fire: false,
      aimX: 120,
      aimY: 340,
      selectWeaponDigit: null,
      prevWeapon: false,
      nextWeapon: false,
    });
  });

  it('applyPlayerIntent copies held move/aim/fire/boost/bullet-time onto the session', () => {
    const session = new SimSession();
    const intent = createPlayerIntent(400, 200);
    intent.left = true;
    intent.right = false;
    intent.jump = true;
    intent.duck = true;
    intent.boost = true;
    intent.bulletTime = true;
    intent.fire = true;

    applyPlayerIntent(session, intent);

    expect(session.player.input).toEqual({
      left: true,
      right: false,
      jump: true,
      duck: true,
      boost: true,
    });
    expect(session.player.mouse).toEqual({ x: 400, y: 200 });
    expect(session.fireHeld).toBe(true);
    expect(session.bulletTimeHeld).toBe(true);
  });

  it('applyPlayerIntent clears held flags when intent is released', () => {
    const session = new SimSession();
    session.player.input = {
      left: true,
      right: true,
      jump: true,
      duck: true,
      boost: true,
    };
    session.fireHeld = true;
    session.bulletTimeHeld = true;
    session.player.mouse = { x: 1, y: 2 };

    applyPlayerIntent(session, createPlayerIntent(50, 60));

    expect(session.player.input).toEqual({
      left: false,
      right: false,
      jump: false,
      duck: false,
      boost: false,
    });
    expect(session.player.mouse).toEqual({ x: 50, y: 60 });
    expect(session.fireHeld).toBe(false);
    expect(session.bulletTimeHeld).toBe(false);
  });

  it('applyPlayerIntent routes digit / prev / next weapon switch through inventory', () => {
    const session = new SimSession();
    grantTestArsenal(session);
    expect(getActiveWeaponDef(session.inventory).name).toBe('MachineGun');

    // Digit 3 → arsenal index 2 (Shotgun); next → ShotgunRockets; prev back.
    const toShotgun = createPlayerIntent();
    toShotgun.selectWeaponDigit = 3;
    applyPlayerIntent(session, toShotgun);
    expect(getActiveWeaponDef(session.inventory).name).toBe('Shotgun');

    const next = createPlayerIntent();
    next.nextWeapon = true;
    applyPlayerIntent(session, next);
    expect(getActiveWeaponDef(session.inventory).name).toBe('ShotgunRockets');

    const prev = createPlayerIntent();
    prev.prevWeapon = true;
    applyPlayerIntent(session, prev);
    expect(getActiveWeaponDef(session.inventory).name).toBe('Shotgun');
  });

  it('applyPlayerIntent ignores weapon actions when all switch fields are idle', () => {
    const session = new SimSession();
    const before = session.inventory.activeIndex;
    applyPlayerIntent(session, createPlayerIntent());
    expect(session.inventory.activeIndex).toBe(before);
  });

  it('keyboard/mouse sample → applyPlayerIntent is the only gameplay input path', () => {
    // Acceptance: gameplay reads intent, not raw keys. This round-trip is the
    // shipped path GameScene uses after sampling Phaser into abstract slots.
    const session = new SimSession();
    grantTestArsenal(session);
    const actions = createIntentActionBuffer();
    queueWeaponDigit(actions, 2); // digit 2 → AkimboMac10

    const intent = sampleKeyboardMouseIntent({
      held: {
        left: true,
        right: false,
        jump: false,
        duck: false,
        boost: true,
        bulletTime: false,
      },
      pointer: {
        aimX: 640,
        aimY: 360,
        primaryDown: true,
        rightDown: false,
      },
      actions,
      allowFire: true,
    });
    applyPlayerIntent(session, intent);

    expect(session.player.input.left).toBe(true);
    expect(session.player.input.boost).toBe(true);
    expect(session.player.mouse).toEqual({ x: 640, y: 360 });
    expect(session.fireHeld).toBe(true);
    expect(session.bulletTimeHeld).toBe(false);
    expect(getActiveWeaponDef(session.inventory).name).toBe('AkimboMac10');
  });
});

describe('mouse wheel → intent → inventory (issue #104)', () => {
  it('wheel down cycles to the next owned weapon; wheel up to the previous', () => {
    const session = new SimSession();
    grantTestArsenal(session);
    expect(getActiveWeaponDef(session.inventory).name).toBe('MachineGun');

    const downBuf = createIntentActionBuffer();
    queueWeaponFromWheelDelta(downBuf, 100);
    applyPlayerIntent(
      session,
      sampleKeyboardMouseIntent({
        held: {
          left: false,
          right: false,
          jump: false,
          duck: false,
          boost: false,
          bulletTime: false,
        },
        pointer: {
          aimX: 0,
          aimY: 0,
          primaryDown: false,
          rightDown: false,
        },
        actions: downBuf,
        allowFire: true,
      }),
    );
    expect(getActiveWeaponDef(session.inventory).name).toBe('AkimboMac10');

    const upBuf = createIntentActionBuffer();
    queueWeaponFromWheelDelta(upBuf, -100);
    applyPlayerIntent(
      session,
      sampleKeyboardMouseIntent({
        held: {
          left: false,
          right: false,
          jump: false,
          duck: false,
          boost: false,
          bulletTime: false,
        },
        pointer: {
          aimX: 0,
          aimY: 0,
          primaryDown: false,
          rightDown: false,
        },
        actions: upBuf,
        allowFire: true,
      }),
    );
    expect(getActiveWeaponDef(session.inventory).name).toBe('MachineGun');
  });

  it('wheel cycle skips empty slots and never selects the predator gun', () => {
    const session = new SimSession();
    // Only MachineGun owned — next must stay on slot 0 (empty + predator skipped).
    expect(session.inventory.activeIndex).toBe(0);
    const buf = createIntentActionBuffer();
    queueWeaponFromWheelDelta(buf, 1);
    const intent = sampleKeyboardMouseIntent({
      held: {
        left: false,
        right: false,
        jump: false,
        duck: false,
        boost: false,
        bulletTime: false,
      },
      pointer: {
        aimX: 0,
        aimY: 0,
        primaryDown: false,
        rightDown: false,
      },
      actions: buf,
      allowFire: true,
    });
    applyPlayerIntent(session, intent);
    expect(session.inventory.activeIndex).toBe(0);
    expect(getActiveWeaponDef(session.inventory).name).toBe('MachineGun');
  });

  it('wheel switch is ignored while PredatorMode locks switching', () => {
    const session = new SimSession();
    grantTestArsenal(session);
    session.playerPowerup.powerupOn = POWERUP.PredatorMode;
    session.inventory.activeIndex = 0;

    const buf = createIntentActionBuffer();
    queueWeaponFromWheelDelta(buf, 50);
    const intent = sampleKeyboardMouseIntent({
      held: {
        left: false,
        right: false,
        jump: false,
        duck: false,
        boost: false,
        bulletTime: false,
      },
      pointer: {
        aimX: 0,
        aimY: 0,
        primaryDown: false,
        rightDown: false,
      },
      actions: buf,
      allowFire: true,
    });
    expect(intent.nextWeapon).toBe(true);
    applyPlayerIntent(session, intent);
    expect(session.inventory.activeIndex).toBe(0);
  });
});
