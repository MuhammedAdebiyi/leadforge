import { Redis } from '@upstash/redis'
import { env } from '../config/env'
import type { AppLogger } from '../logger'

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

export const TTL = {
  SESSION:      60 * 60 * 24 * 7,
  JOB_PROGRESS: 60 * 60 * 24,
  SEARCH_CACHE: 60 * 60 * 6,
  DEDUP:        60 * 60 * 24,
  LEAD_TEMP:    60 * 60,
  API_CACHE:    60 * 5,
} as const

export async function testRedisConnection(logger: AppLogger): Promise<void> {
  try {
    await redis.ping()
    logger.info('Redis connected (Upstash)')
  } catch (error) {
    logger.error({ error }, ' Redis connection failed')
    process.exit(1)
  }
}
