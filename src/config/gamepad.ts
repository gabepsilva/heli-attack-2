/**
 * Gamepad mapping & thresholds — issue #31.
 *
 * Standard Gamepad layout (W3C / Xbox / Steam Input common mapping). Indices
 * match `navigator.getGamepads()` / Phaser's Standard Gamepad button order so
 * the sampler stays hardware-agnostic.
 */

/** Stick magnitude (0–1) below this is treated as released. */
export const GAMEPAD_DEADZONE = 0.25;

/**
 * Arena-space aim distance (px) from the player center when the right stick is
 * at full deflection. Matches the touch aim range so feel is consistent.
 */
export const GAMEPAD_AIM_RANGE_PX = 400;

/**
 * Standard Gamepad button indices (W3C Gamepad API).
 * https://w3c.github.io/gamepad/#remapping
 */
export const STANDARD_GAMEPAD = {
  /** Bottom face (A / Cross). */
  A: 0,
  /** Right face (B / Circle). */
  B: 1,
  /** Left face (X / Square). */
  X: 2,
  /** Top face (Y / Triangle). */
  Y: 3,
  /** Left bumper (LB / L1). */
  LB: 4,
  /** Right bumper (RB / R1). */
  RB: 5,
  /** Left trigger (LT / L2). */
  LT: 6,
  /** Right trigger (RT / R2). */
  RT: 7,
  BACK: 8,
  START: 9,
  LS: 10,
  RS: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

/**
 * Fixed default gamepad → intent slots (Steam-ready twin-stick).
 * Change a slot here and the shipped controller mapping changes with it.
 */
export const DEFAULT_GAMEPAD_BINDINGS = {
  /** Left stick X → left / right; Y down → duck. */
  moveStick: 'left' as const,
  /** Right stick → aim point relative to player center. */
  aimStick: 'right' as const,
  jump: STANDARD_GAMEPAD.A,
  boost: STANDARD_GAMEPAD.B,
  bulletTime: STANDARD_GAMEPAD.X,
  prevWeapon: STANDARD_GAMEPAD.LB,
  nextWeapon: STANDARD_GAMEPAD.RB,
  fire: STANDARD_GAMEPAD.RT,
  /** D-pad mirrors left-stick move / duck / jump. */
  dpadLeft: STANDARD_GAMEPAD.DPAD_LEFT,
  dpadRight: STANDARD_GAMEPAD.DPAD_RIGHT,
  dpadDown: STANDARD_GAMEPAD.DPAD_DOWN,
  dpadUp: STANDARD_GAMEPAD.DPAD_UP,
} as const;
