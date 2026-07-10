/**
 * Local high scores — unit tests for issue #25 acceptance criteria.
 *
 * AC: High score persists across reloads
 * AC: A new record updates the stored table
 *
 * Also locks Flash display scale (×100), floor comparison, and optional
 * accuracy / helis stats formatting.
 */

import { describe, expect, it } from 'vitest';
import { HIGH_SCORES, SCORE } from '../config/constants';
import {
  accuracyPercent,
  createEmptyHighScoreTable,
  createMemoryStorage,
  formatHighScoreHud,
  formatHighScoreLine,
  formatHighScoreTableText,
  formatRunStatsLine,
  highScoreDisplayScale,
  loadHighScores,
  saveHighScores,
  submitRunScore,
} from './highScores';

describe('highScores Flash / config locks (issue #25)', () => {
  it('locks storage key, table size, and display scale (×100)', () => {
    expect(HIGH_SCORES.storageKey).toBe('heli-attack-2.highScores');
    expect(HIGH_SCORES.maxEntries).toBe(10);
    expect(SCORE.displayScale).toBe(100);
    expect(highScoreDisplayScale()).toBe(100);
  });

  it('formats HUD like Flash: High Score: floor(score)*100', () => {
    expect(formatHighScoreHud(0)).toBe('High Score: 0');
    expect(formatHighScoreHud(42)).toBe('High Score: 4200');
    expect(formatHighScoreHud(42.7)).toBe('High Score: 4200');
  });

  it('computes Flash accuracy floor((hits/shots)*100), 0% when no shots', () => {
    expect(accuracyPercent(0, 0)).toBe(0);
    expect(accuracyPercent(5, 0)).toBe(0);
    expect(accuracyPercent(1, 2)).toBe(50);
    expect(accuracyPercent(1, 3)).toBe(33);
    expect(accuracyPercent(10, 10)).toBe(100);
    expect(formatRunStatsLine(7, 33)).toBe('Helis: 7    Accuracy: 33%');
  });
});

describe('high score persistence (issue #25 AC: persists across reloads)', () => {
  it('round-trips a saved table through storage (reload simulation)', () => {
    const storage = createMemoryStorage();
    const table = createEmptyHighScoreTable();
    table.entries = [
      {
        score: 100,
        helisKilled: 3,
        accuracyPercent: 40,
        at: '2026-01-01T00:00:00.000Z',
      },
      {
        score: 50,
        helisKilled: 1,
        accuracyPercent: 20,
        at: '2026-01-02T00:00:00.000Z',
      },
    ];
    table.stats.bestScore = 100;
    table.stats.games = 2;
    table.stats.totalHelis = 4;

    expect(saveHighScores(table, storage)).toBe(true);

    // Fresh load = page reload reading the same localStorage key.
    const reloaded = loadHighScores(storage);
    expect(reloaded.entries).toHaveLength(2);
    expect(reloaded.entries[0]).toEqual(table.entries[0]);
    expect(reloaded.entries[1]).toEqual(table.entries[1]);
    expect(reloaded.stats.bestScore).toBe(100);
    expect(reloaded.stats.games).toBe(2);
    expect(reloaded.stats.totalHelis).toBe(4);
    expect(formatHighScoreTableText(reloaded)).toBe('1. 10000\n2. 5000');
  });

  it('survives a second process reading the same serialized payload', () => {
    const shared: Record<string, string> = {};
    const writer = createMemoryStorage(shared);
    submitRunScore(
      { score: 29.7, helisKilled: 2, shots: 10, hits: 4 },
      writer,
      HIGH_SCORES.storageKey,
      () => '2026-07-10T12:00:00.000Z',
    );

    // New storage handle over the same backing map ≈ new page load.
    const reader = createMemoryStorage(shared);
    const loaded = loadHighScores(reader);
    expect(loaded.stats.bestScore).toBe(29); // Math.floor(29.7)
    expect(loaded.entries[0]!.score).toBe(29);
    expect(formatHighScoreHud(loaded.stats.bestScore)).toBe('High Score: 2900');
    expect(loaded.entries[0]!.accuracyPercent).toBe(40);
    expect(loaded.entries[0]!.helisKilled).toBe(2);
  });

  it('returns an empty table when storage is missing or corrupt', () => {
    expect(loadHighScores(null).entries).toEqual([]);
    const storage = createMemoryStorage({
      [HIGH_SCORES.storageKey]: '{not-json',
    });
    expect(loadHighScores(storage)).toEqual(createEmptyHighScoreTable());
  });
});

describe('new record updates table (issue #25 AC)', () => {
  it('inserts the first positive score as rank 1 and marks a new record', () => {
    const storage = createMemoryStorage();
    const result = submitRunScore(
      { score: 10, helisKilled: 1, shots: 5, hits: 2 },
      storage,
      HIGH_SCORES.storageKey,
      () => '2026-07-10T01:00:00.000Z',
    );

    expect(result.isNewRecord).toBe(true);
    expect(result.rank).toBe(1);
    expect(result.table.entries).toHaveLength(1);
    expect(result.table.entries[0]!.score).toBe(10);
    expect(result.table.stats.bestScore).toBe(10);
    expect(result.table.stats.games).toBe(1);
    expect(formatHighScoreLine(1, result.table.entries[0]!)).toBe('1. 1000');

    // Persisted for the next load.
    expect(loadHighScores(storage).entries[0]!.score).toBe(10);
  });

  it('promotes a beaten best score to rank 1 and rewrites storage', () => {
    const storage = createMemoryStorage();
    submitRunScore(
      { score: 20, helisKilled: 1, shots: 10, hits: 5 },
      storage,
      HIGH_SCORES.storageKey,
      () => '2026-07-10T01:00:00.000Z',
    );

    const beaten = submitRunScore(
      { score: 50.9, helisKilled: 4, shots: 20, hits: 10 },
      storage,
      HIGH_SCORES.storageKey,
      () => '2026-07-10T02:00:00.000Z',
    );

    expect(beaten.isNewRecord).toBe(true);
    expect(beaten.rank).toBe(1);
    expect(beaten.table.entries.map((e) => e.score)).toEqual([50, 20]);
    expect(beaten.table.stats.bestScore).toBe(50);
    expect(formatHighScoreTableText(beaten.table)).toBe('1. 5000\n2. 2000');

    const reloaded = loadHighScores(storage);
    expect(reloaded.entries.map((e) => e.score)).toEqual([50, 20]);
    expect(reloaded.stats.bestScore).toBe(50);
    expect(reloaded.stats.games).toBe(2);
    expect(reloaded.stats.totalHelis).toBe(5);
    expect(reloaded.stats.bestHelis).toBe(4);
  });

  it('does not treat a lower score as a new record but still ranks it', () => {
    const storage = createMemoryStorage();
    submitRunScore(
      { score: 100, helisKilled: 5, shots: 10, hits: 8 },
      storage,
      undefined,
      () => '2026-07-10T01:00:00.000Z',
    );

    const lower = submitRunScore(
      { score: 40, helisKilled: 2, shots: 10, hits: 3 },
      storage,
      undefined,
      () => '2026-07-10T02:00:00.000Z',
    );

    expect(lower.isNewRecord).toBe(false);
    expect(lower.rank).toBe(2);
    expect(lower.table.stats.bestScore).toBe(100);
    expect(lower.table.entries.map((e) => e.score)).toEqual([100, 40]);
  });

  it('rejects a zero score from the table (Flash only promotes when score > hs)', () => {
    const storage = createMemoryStorage();
    const result = submitRunScore(
      { score: 0, helisKilled: 0, shots: 0, hits: 0 },
      storage,
    );
    expect(result.isNewRecord).toBe(false);
    expect(result.rank).toBeNull();
    expect(result.table.entries).toHaveLength(0);
    expect(result.table.stats.games).toBe(1);
    expect(formatHighScoreTableText(result.table)).toBe('No high scores yet');
  });

  it('evicts the lowest entry when the table is full and a better score arrives', () => {
    const storage = createMemoryStorage();
    for (let i = 1; i <= HIGH_SCORES.maxEntries; i += 1) {
      submitRunScore(
        { score: i * 10, helisKilled: i, shots: 10, hits: 5 },
        storage,
        undefined,
        () => `2026-07-10T00:${String(i).padStart(2, '0')}:00.000Z`,
      );
    }

    const full = loadHighScores(storage);
    expect(full.entries).toHaveLength(HIGH_SCORES.maxEntries);
    expect(full.entries[full.entries.length - 1]!.score).toBe(10);

    const miss = submitRunScore(
      { score: 5, helisKilled: 0, shots: 1, hits: 0 },
      storage,
      undefined,
      () => '2026-07-10T12:00:00.000Z',
    );
    expect(miss.rank).toBeNull();
    expect(miss.isNewRecord).toBe(false);
    expect(loadHighScores(storage).entries.map((e) => e.score)).toEqual(
      full.entries.map((e) => e.score),
    );

    const hit = submitRunScore(
      { score: 15, helisKilled: 1, shots: 1, hits: 1 },
      storage,
      undefined,
      () => '2026-07-10T13:00:00.000Z',
    );
    expect(hit.rank).not.toBeNull();
    expect(hit.isNewRecord).toBe(false);
    const scores = loadHighScores(storage).entries.map((e) => e.score);
    expect(scores).toHaveLength(HIGH_SCORES.maxEntries);
    expect(scores).toContain(15);
    expect(scores).not.toContain(10); // lowest evicted
    expect(scores[0]).toBe(HIGH_SCORES.maxEntries * 10);
  });
});
