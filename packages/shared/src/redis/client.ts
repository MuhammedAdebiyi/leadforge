import { Redis } from '@upstash/redis'
import { env } from '../env'

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

export const TTL = {
  SESSION: 60 * 60 * 24 * 7,
  JOB_PROGRESS: 60 * 60 * 24,
  SEARCH_CACHE: 60 * 60 * 6,
  DEDUP: 60 * 60 * 24,
  LEAD_TEMP: 60 * 60,
} as const

export async function testRedisConnection(logger: { info: Function; error: Function }) {
  try {
    await redis.ping()
    logger.info(' Redis connected (Upstash)')
  } catch (error) {
    logger.error({ error }, ' Redis connection failed')
    process.exit(1)
  }
}