/**
 * Issue #36: camera-feel event builders + intensity preference persistence.
 */

import { describe, expect, it } from 'vitest';
import { CAMERA_FEEL } from '../config/cameraFeel';
import { buildPlayerHurtFeel, buildWeaponHitFeel } from './cameraFeelEvents';
import {
  loadCameraFeelIntensity,
  saveCameraFeelIntensity,
  type CameraFeelStorage,
} from './cameraFeelPrefs';

function memoryStorage(): CameraFeelStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
}

describe('cameraFeelEvents (#36)', () => {
  it('builds weapon-hit and player-hurt cues with exact payloads', () => {
    expect(buildWeaponHitFeel(100, false)).toEqual({
      type: 'weaponHit',
      damage: 100,
      killed: false,
    });
    expect(buildWeaponHitFeel(300, true)).toEqual({
      type: 'weaponHit',
      damage: 300,
      killed: true,
    });
    expect(buildPlayerHurtFeel(10)).toEqual({
      type: 'playerHurt',
      damage: 10,
    });
  });
});

describe('cameraFeelPrefs (#36)', () => {
  it('persists intensity across load/save (toggle survives reload)', () => {
    const storage = memoryStorage();
    expect(loadCameraFeelIntensity(storage)).toBe(CAMERA_FEEL.defaultIntensity);

    saveCameraFeelIntensity('off', storage);
    expect(storage.getItem(CAMERA_FEEL.storageKey)).toBe('off');
    expect(loadCameraFeelIntensity(storage)).toBe('off');

    saveCameraFeelIntensity('high', storage);
    expect(loadCameraFeelIntensity(storage)).toBe('high');
  });

  it('falls back to default on missing / corrupt storage values', () => {
    const storage = memoryStorage();
    storage.setItem(CAMERA_FEEL.storageKey, 'nope');
    expect(loadCameraFeelIntensity(storage)).toBe(CAMERA_FEEL.defaultIntensity);
    expect(loadCameraFeelIntensity(null)).toBe(CAMERA_FEEL.defaultIntensity);
  });
});
