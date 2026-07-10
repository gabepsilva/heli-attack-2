/**
 * Persist / load camera-feel intensity (issue #36).
 * Mirrors high-score storage: injectable Storage, never throws.
 */

import {
  CAMERA_FEEL,
  isCameraFeelIntensity,
  type CameraFeelIntensity,
} from '../config/cameraFeel';

/** Minimal Storage surface (real `localStorage` or an in-memory test double). */
export type CameraFeelStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

function defaultStorage(): CameraFeelStorage | null {
  try {
    const ls = globalThis.localStorage;
    if (ls && typeof ls.getItem === 'function') {
      return ls;
    }
  } catch {
    // Private browsing / denied access.
  }
  return null;
}

/** Read intensity from storage, falling back to the default. */
export function loadCameraFeelIntensity(
  storage: CameraFeelStorage | null = defaultStorage(),
): CameraFeelIntensity {
  if (!storage) {
    return CAMERA_FEEL.defaultIntensity;
  }
  try {
    const raw = storage.getItem(CAMERA_FEEL.storageKey);
    if (raw && isCameraFeelIntensity(raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return CAMERA_FEEL.defaultIntensity;
}

/** Persist intensity; no-ops when storage is unavailable. */
export function saveCameraFeelIntensity(
  intensity: CameraFeelIntensity,
  storage: CameraFeelStorage | null = defaultStorage(),
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(CAMERA_FEEL.storageKey, intensity);
  } catch {
    // ignore quota / private browsing
  }
}
