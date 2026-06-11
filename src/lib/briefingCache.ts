import { ExecutiveBriefingDTO } from "@/types/briefing";

interface CacheEntry {
  data: ExecutiveBriefingDTO;
  timestamp: number;
}

// Store the cache in globalThis so it survives hot reloads in development
// AND is reused across requests in the same warm serverless container.
const globalForCache = globalThis as unknown as {
  briefingCache: Map<string, CacheEntry> | undefined;
};

export const briefingCache = globalForCache.briefingCache ?? new Map<string, CacheEntry>();

// Always store — not just in development.
globalForCache.briefingCache = briefingCache;


/**
 * Retrieves a cached briefing for a user if it exists and is not older than 15 minutes.
 */
export function getCachedBriefing(userId: string): ExecutiveBriefingDTO | null {
  const entry = briefingCache.get(userId);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  if (now - entry.timestamp > fifteenMinutes) {
    briefingCache.delete(userId);
    return null;
  }

  return entry.data;
}

/**
 * Stores a briefing in the cache for the user.
 */
export function setCachedBriefing(userId: string, data: ExecutiveBriefingDTO): void {
  briefingCache.set(userId, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Invalidates the briefing cache for the user.
 */
export function invalidateBriefingCache(userId: string): void {
  briefingCache.delete(userId);
}
