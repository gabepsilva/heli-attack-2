/**
 * Process-wide {@link AudioManager} so Boot unlock + Game SFX share one context.
 */
import { AudioManager } from './audioManager';

let shared: AudioManager | null = null;

export function getGameAudio(): AudioManager {
  if (!shared) {
    shared = new AudioManager();
  }
  return shared;
}

/** Test helper — replace the shared instance. */
export function setGameAudioForTests(manager: AudioManager | null): void {
  shared = manager;
}
