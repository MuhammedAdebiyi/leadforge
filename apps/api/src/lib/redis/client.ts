import { Redis } from '@upstash/redis'
import { config } from '../../config'
import { logger } from '../logger'

export const redis = new Redis({
  url: config.UPSTASH_REDIS_REST_URL,
  token: config.UPSTASH_REDIS_REST_TOKEN,
})

export async function testRedisConnection() {
  try {
    await redis.ping()
    logger.info('Redis connected (Upstash)')
  } catch (error) {
    logger.error({ error }, ' Redis connection failed')
    process.exit(1)
  }
}

export const TTL = {
  SESSION: 60 * 60 * 24 * 7,
  JOB_PROGRESS: 60 * 60 * 24,
  SEARCH_CACHE: 60 * 60 * 6,
  RATE_LIMIT: 60,
  API_CACHE: 60 * 5,
  LEAD_TEMP: 60 * 60,
} as const

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    return redis.get<T>(key)
  },
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    if (ttl) {
      await redis.setex(key, ttl, JSON.stringify(value))
    } else {
      await redis.set(key, JSON.stringify(value))
    }
  },
  async del(key: string): Promise<void> {
    await redis.del(key)
  },
  async exists(key: string): Promise<boolean> {
    return (await redis.exists(key)) === 1
  },
  jobProgressKey: (jobId: string) => `job:progress:${jobId}`,
  searchCacheKey: (k: string, c: string) => `search:${k.toLowerCase()}:${c.toLowerCase()}`,
}
