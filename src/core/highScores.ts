/**
 * Local high-score table + optional career stats — issue #25.
 *
 * Pure logic (no Phaser). Persists via injectable {@link HighScoreStorage}
 * (defaults to `localStorage`). Flash compared `Math.floor(score) > hs` and
 * displayed `hs * 100`; we store floored internal scores the same way.
 *
 * Acceptance criteria:
 *   - High score persists across reloads (load → save → load round-trip)
 *   - A new record updates the stored table
 */

import { HIGH_SCORES, SCORE } from '../config/constants';
import { displayedScore } from '../combat/score';

/** Minimal Storage surface (real `localStorage` or an in-memory test double). */
export type HighScoreStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** One ranked run in the local table. */
export type HighScoreEntry = {
  /** Internal floored score (Flash `hs = Math.floor(score)`). */
  score: number;
  /** Helis killed this run (Flash `rthelis` / `temp.helis`). */
  helisKilled: number;
  /** Accuracy percent 0–100 (Flash `floor((hits/shots)*100)`). */
  accuracyPercent: number;
  /** ISO-8601 timestamp when the run was recorded. */
  at: string;
};

/** Career totals mirrored from Flash SharedObject aggregates. */
export type HighScoreCareerStats = {
  games: number;
  totalHelis: number;
  totalShots: number;
  totalHits: number;
  /** Best internal floored score ever (Flash `hs`). */
  bestScore: number;
  /** Best helis-in-one-run (Flash `bhelis`). */
  bestHelis: number;
};

export type HighScoreTable = {
  entries: HighScoreEntry[];
  stats: HighScoreCareerStats;
};

/** Per-run payload submitted at game-over. */
export type RunScoreInput = {
  /** Internal score (may be fractional — floored like Flash). */
  score: number;
  helisKilled: number;
  shots: number;
  hits: number;
};

export type SubmitRunResult = {
  table: HighScoreTable;
  /** True when this run is now rank 1 (beats previous best). */
  isNewRecord: boolean;
  /**
   * 1-based rank in the table after insert, or `null` if the run did not
   * qualify for the top {@link HIGH_SCORES.maxEntries}.
   */
  rank: number | null;
};

type PersistedPayload = {
  version: 1;
  entries: HighScoreEntry[];
  stats: HighScoreCareerStats;
};

function emptyStats(): HighScoreCareerStats {
  return {
    games: 0,
    totalHelis: 0,
    totalShots: 0,
    totalHits: 0,
    bestScore: 0,
    bestHelis: 0,
  };
}

/** Empty table — used when storage is missing or corrupt. */
export function createEmptyHighScoreTable(): HighScoreTable {
  return { entries: [], stats: emptyStats() };
}

/** In-memory Storage double for unit tests (no DOM required). */
export function createMemoryStorage(
  initial: Record<string, string> = {},
): HighScoreStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
      initial[key] = value;
    },
    removeItem(key: string): void {
      map.delete(key);
      delete initial[key];
    },
  };
}

function browserStorage(): HighScoreStorage | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls || typeof ls.getItem !== 'function') {
      return null;
    }
    return ls;
  } catch {
    // Private mode / blocked storage.
    return null;
  }
}

function isFiniteNonNeg(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

function sanitizeEntry(raw: unknown): HighScoreEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const e = raw as Partial<HighScoreEntry>;
  if (!isFiniteNonNeg(e.score)) {
    return null;
  }
  return {
    score: Math.floor(e.score),
    helisKilled: isFiniteNonNeg(e.helisKilled) ? Math.floor(e.helisKilled) : 0,
    accuracyPercent: isFiniteNonNeg(e.accuracyPercent)
      ? Math.min(100, Math.floor(e.accuracyPercent))
      : 0,
    at:
      typeof e.at === 'string' && e.at.length > 0
        ? e.at
        : new Date(0).toISOString(),
  };
}

function sanitizeStats(raw: unknown): HighScoreCareerStats {
  const base = emptyStats();
  if (!raw || typeof raw !== 'object') {
    return base;
  }
  const s = raw as Partial<HighScoreCareerStats>;
  return {
    games: isFiniteNonNeg(s.games) ? Math.floor(s.games) : 0,
    totalHelis: isFiniteNonNeg(s.totalHelis) ? Math.floor(s.totalHelis) : 0,
    totalShots: isFiniteNonNeg(s.totalShots) ? Math.floor(s.totalShots) : 0,
    totalHits: isFiniteNonNeg(s.totalHits) ? Math.floor(s.totalHits) : 0,
    bestScore: isFiniteNonNeg(s.bestScore) ? Math.floor(s.bestScore) : 0,
    bestHelis: isFiniteNonNeg(s.bestHelis) ? Math.floor(s.bestHelis) : 0,
  };
}

function sortEntries(entries: HighScoreEntry[]): HighScoreEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Tie-break: older record keeps the higher rank (stable by timestamp).
    return a.at.localeCompare(b.at);
  });
}

/**
 * Flash accuracy: `Math.floor((hits/shots)*100) + "%"`, or `"0%"` when no shots.
 * Clamped to 100 so write and read agree even if a caller passes mismatched
 * denominators (DoT / multi-pellet without a hit latch).
 */
export function accuracyPercent(hits: number, shots: number): number {
  if (!(shots > 0) || !Number.isFinite(shots) || !Number.isFinite(hits)) {
    return 0;
  }
  const h = Math.max(0, hits);
  const s = Math.max(0, shots);
  return Math.min(100, Math.floor((h / s) * 100));
}

/** Flash HUD: `High Score: ` + (hs * 100). */
export function formatHighScoreHud(internalScore: number): string {
  return `High Score: ${displayedScore(internalScore)}`;
}

/** One table row for menu / game-over (1-based rank). */
export function formatHighScoreLine(
  rank: number,
  entry: HighScoreEntry,
): string {
  return `${rank}. ${displayedScore(entry.score)}`;
}

/** Multiline table body for Phaser text (empty → placeholder). */
export function formatHighScoreTableText(table: HighScoreTable): string {
  if (table.entries.length === 0) {
    return 'No high scores yet';
  }
  return table.entries
    .map((entry, i) => formatHighScoreLine(i + 1, entry))
    .join('\n');
}

/** Optional run-stats line (Flash stats panel: helis + accuracy). */
export function formatRunStatsLine(
  helisKilled: number,
  accuracy: number,
): string {
  return `Helis: ${helisKilled}    Accuracy: ${accuracy}%`;
}

/**
 * Load the table from storage. Corrupt / missing data yields an empty table
 * (never throws — localStorage can fail in private browsing).
 */
export function loadHighScores(
  storage: HighScoreStorage | null = browserStorage(),
  storageKey: string = HIGH_SCORES.storageKey,
): HighScoreTable {
  if (!storage) {
    return createEmptyHighScoreTable();
  }
  let raw: string | null;
  try {
    raw = storage.getItem(storageKey);
  } catch {
    return createEmptyHighScoreTable();
  }
  if (raw === null || raw === '') {
    return createEmptyHighScoreTable();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedPayload>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      return createEmptyHighScoreTable();
    }
    const entries = sortEntries(
      parsed.entries
        .map(sanitizeEntry)
        .filter((e): e is HighScoreEntry => e !== null),
    ).slice(0, HIGH_SCORES.maxEntries);
    const stats = sanitizeStats(parsed.stats);
    if (entries.length > 0 && stats.bestScore < entries[0]!.score) {
      stats.bestScore = entries[0]!.score;
    }
    return { entries, stats };
  } catch {
    return createEmptyHighScoreTable();
  }
}

/** Persist the table. Returns false if storage is unavailable / throws. */
export function saveHighScores(
  table: HighScoreTable,
  storage: HighScoreStorage | null = browserStorage(),
  storageKey: string = HIGH_SCORES.storageKey,
): boolean {
  if (!storage) {
    return false;
  }
  const payload: PersistedPayload = {
    version: 1,
    entries: sortEntries(table.entries).slice(0, HIGH_SCORES.maxEntries),
    stats: { ...table.stats },
  };
  try {
    storage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Record a finished run: update career stats and insert into the ranked table
 * when the floored score qualifies. Mirrors Flash `so.data.highscore = hs` +
 * aggregate counters, then `so.flush()`.
 */
export function submitRunScore(
  run: RunScoreInput,
  storage: HighScoreStorage | null = browserStorage(),
  storageKey: string = HIGH_SCORES.storageKey,
  now: () => string = () => new Date().toISOString(),
): SubmitRunResult {
  const table = loadHighScores(storage, storageKey);
  const previousBest = table.stats.bestScore;
  const floored = Math.max(0, Math.floor(run.score));
  const helis = Math.max(0, Math.floor(run.helisKilled));
  const shots = Math.max(0, Math.floor(run.shots));
  const hits = Math.max(0, Math.floor(run.hits));
  const acc = accuracyPercent(hits, shots);

  table.stats.games += 1;
  table.stats.totalHelis += helis;
  table.stats.totalShots += shots;
  table.stats.totalHits += hits;
  if (floored > table.stats.bestScore) {
    table.stats.bestScore = floored;
  }
  if (helis > table.stats.bestHelis) {
    table.stats.bestHelis = helis;
  }

  const entry: HighScoreEntry = {
    score: floored,
    helisKilled: helis,
    accuracyPercent: acc,
    at: now(),
  };

  // Positive scores only — empty slots fill freely; a full table requires
  // beating the lowest entry (strict `>`, matching Flash `floor(score) > hs`).
  const lowest = table.entries[table.entries.length - 1]?.score ?? 0;
  const qualifies =
    floored > 0 &&
    (table.entries.length < HIGH_SCORES.maxEntries || floored > lowest);

  let rank: number | null = null;
  if (qualifies) {
    table.entries = sortEntries([...table.entries, entry]).slice(
      0,
      HIGH_SCORES.maxEntries,
    );
    const idx = table.entries.findIndex(
      (e) => e.at === entry.at && e.score === entry.score,
    );
    rank = idx >= 0 ? idx + 1 : null;
  }

  // Flash: only promote hs when floor(score) > hs — isNewRecord matches that.
  const isNewRecord = floored > previousBest && floored > 0;

  saveHighScores(table, storage, storageKey);
  return { table, isNewRecord, rank };
}

/** Spec lock: display scale used by high-score formatting. */
export function highScoreDisplayScale(): number {
  return SCORE.displayScale;
}
