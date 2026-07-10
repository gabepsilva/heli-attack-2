/**
 * Discrete camera-feel cues queued by the sim (issue #36).
 * Phaser-free — GameScene drains via {@link drainCameraFeelEvents} and feeds
 * {@link GameCameraFeel}. Builders encode damage-scaled shake / hit-stop /
 * flash / vignette so unit tests can assert exact thresholds.
 */

/** Weapon hit on a heli — shake / flash / hit-stop scale with `damage`. */
export type CameraFeelWeaponHitEvent = Readonly<{
  type: 'weaponHit';
  damage: number;
  killed: boolean;
}>;

/** Player took damage — red flash + damage vignette pulse. */
export type CameraFeelPlayerHurtEvent = Readonly<{
  type: 'playerHurt';
  damage: number;
}>;

export type CameraFeelEvent =
  CameraFeelWeaponHitEvent | CameraFeelPlayerHurtEvent;

/** Build a weapon-hit juice cue from a heli hit event. */
export function buildWeaponHitFeel(
  damage: number,
  killed: boolean,
): CameraFeelWeaponHitEvent {
  return { type: 'weaponHit', damage, killed };
}

/** Build a player-hurt juice cue. */
export function buildPlayerHurtFeel(damage: number): CameraFeelPlayerHurtEvent {
  return { type: 'playerHurt', damage };
}
