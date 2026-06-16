/**
 * In-memory throttle for expensive background recalculations.
 * Prevents re-running full table-scan updates on every page load.
 * The throttle resets on server restart, which is fine — it only prevents
 * hammering the DB when users navigate between pages rapidly.
 */

const lastRunMap = new Map<string, number>();

/**
 * Returns true if the operation for `key` should be skipped because it ran
 * within the last `ttlMs` milliseconds.
 */
export function shouldThrottle(key: string, ttlMs: number): boolean {
  const last = lastRunMap.get(key);
  if (last && Date.now() - last < ttlMs) {
    return true;
  }
  lastRunMap.set(key, Date.now());
  return false;
}
