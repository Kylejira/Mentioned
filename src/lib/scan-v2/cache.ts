/**
 * Response Caching System
 * 
 * Caches AI responses to ensure consistency across scans.
 * Same query + same platform = same cached response = consistent results
 * 
 * Using in-memory cache for simplicity. For production scale, replace with Redis.
 */

interface CacheEntry {
  data: CachedResponse;
  expiresAt: number;
  createdAt: number;
}

interface CachedResponse {
  response: string;
  timestamp: string;
}

// In-memory cache
const cache = new Map<string, CacheEntry>();

// Cache configuration
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const MAX_CACHE_SIZE = 10000; // Maximum number of entries

/**
 * Generate a consistent cache key for a query
 */
export function getCacheKey(query: string, platform: string): string {
  // Normalize query for consistent cache keys
  const normalizedQuery = query
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:'"]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');       // Normalize whitespace
  
  return `query:${platform}:${normalizedQuery}`;
}

/**
 * Get a cached response
 */
export function getFromCache(key: string): CachedResponse | null {
  const entry = cache.get(key);
  
  if (!entry) {
    return null;
  }
  
  // Check if expired
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    console.log(`[Cache] EXPIRED: ${key.substring(0, 50)}...`);
    return null;
  }
  
  const ageMinutes = Math.round((Date.now() - entry.createdAt) / 1000 / 60);
  console.log(`[Cache] HIT (age: ${ageMinutes}m): ${key.substring(0, 50)}...`);
  return entry.data;
}

/**
 * Store a response in cache
 */
export function setInCache(key: string, response: string): void {
  // Enforce max cache size (LRU-style: delete oldest entries)
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
      console.log(`[Cache] Evicted oldest entry to make room`);
    }
  }
  
  const now = Date.now();
  cache.set(key, {
    data: {
      response,
      timestamp: new Date().toISOString()
    },
    expiresAt: now + CACHE_TTL,
    createdAt: now
  });
  
  console.log(`[Cache] SET: ${key.substring(0, 50)}... (size: ${cache.size})`);
}

/**
 * Check if a query is cached
 */
export function isCached(query: string, platform: string): boolean {
  const key = getCacheKey(query, platform);
  const entry = cache.get(key);
  return entry !== null && entry !== undefined && Date.now() <= entry.expiresAt;
}

/**
 * Clear all cached responses
 */
export function clearCache(): void {
  const size = cache.size;
  cache.clear();
  console.log(`[Cache] Cleared ${size} entries`);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate: number;
  oldestEntry: string | null;
  newestEntry: string | null;
} {
  let oldestTime = Infinity;
  let newestTime = 0;
  let oldestKey: string | null = null;
  let newestKey: string | null = null;
  
  for (const [key, entry] of cache.entries()) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestKey = key;
    }
    if (entry.createdAt > newestTime) {
      newestTime = entry.createdAt;
      newestKey = key;
    }
  }
  
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: 0, // Would need to track hits/misses for this
    oldestEntry: oldestKey ? new Date(oldestTime).toISOString() : null,
    newestEntry: newestKey ? new Date(newestTime).toISOString() : null
  };
}

/**
 * Remove expired entries from cache
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let removed = 0;
  
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
      removed++;
    }
  }
  
  if (removed > 0) {
    console.log(`[Cache] Cleanup: removed ${removed} expired entries`);
  }
  
  return removed;
}

// Run cleanup every hour
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 60 * 60 * 1000);
}

/*
 * PRODUCTION UPGRADE: Replace with Redis
 * 
 * import { Redis } from '@upstash/redis';
 * 
 * const redis = new Redis({
 *   url: process.env.UPSTASH_REDIS_URL,
 *   token: process.env.UPSTASH_REDIS_TOKEN,
 * });
 * 
 * export async function getFromCache(key: string): Promise<CachedResponse | null> {
 *   const data = await redis.get(key);
 *   return data ? JSON.parse(data as string) : null;
 * }
 * 
 * export async function setInCache(key: string, response: string): Promise<void> {
 *   await redis.set(key, JSON.stringify({ response, timestamp: new Date().toISOString() }), { 
 *     ex: 86400 // 24 hours TTL
 *   });
 * }
 */
