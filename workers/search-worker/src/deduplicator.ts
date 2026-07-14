import { PrismaClient } from '@prisma/client'
import { Redis } from '@upstash/redis'
import { logger } from './logger'

/**
 * Two-layer deduplication:
 * 1. Redis bloom-filter-style set (fast, in-memory)
 * 2. PostgreSQL unique constraint (source of truth)
 *
 * Never scrape the same placeId twice within a job.
 */
export class Deduplicator {
  private seen = new Set<string>()

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private jobId: string
  ) {}

  async isAlreadyProcessed(placeId: string): Promise<boolean> {
    // 1. Local memory (fastest — within this worker session)
    if (this.seen.has(placeId)) return true

    // 2. Redis (fast — across worker restarts in same job)
    const redisKey = `dedup:${this.jobId}:${placeId}`
    const exists = await this.redis.exists(redisKey)
    if (exists) {
      this.seen.add(placeId)
      return true
    }

    // 3. Database (authoritative)
    const existing = await this.prisma.business.findFirst({
      where: { placeId, jobId: this.jobId },
      select: { id: true },
    })

    if (existing) {
      await this.markProcessed(placeId)
      return true
    }

    return false
  }

  async markProcessed(placeId: string): Promise<void> {
    this.seen.add(placeId)
    const redisKey = `dedup:${this.jobId}:${placeId}`
    // TTL 24h — enough for a job to complete
    await this.redis.setex(redisKey, 60 * 60 * 24, '1')
  }

  async preloadFromDatabase(): Promise<void> {
    // On resume, reload already-processed placeIds into memory
    const existing = await this.prisma.business.findMany({
      where: { jobId: this.jobId },
      select: { placeId: true },
    })

    for (const { placeId } of existing) {
      this.seen.add(placeId)
    }

    logger.info({ jobId: this.jobId, preloaded: this.seen.size }, 'Deduplicator preloaded from DB')
  }
}