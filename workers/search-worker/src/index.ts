import { createWorker, prisma, redis, TTL, publish, QUEUES } from '@leadforge/shared'
import { initBrowserPool, acquireBrowser, closeBrowserPool } from './browser-pool'
import { scrapeGoogleMaps } from './scraper'
import { Deduplicator } from './deduplicator'
import { scoreLead } from './scorer'
import type { RawBusiness } from './extractor'
import type { ConsumeMessage, Channel } from 'amqplib'
import type { AppLogger } from '@leadforge/shared'

interface JobMessage {
  jobId: string
  userId: string
  keyword: string
  city: string
  country: string
  radius: number
  maxResults: number
}

async function processJob(msg: ConsumeMessage, channel: Channel, logger: AppLogger): Promise<void> {
  const jobMessage: JobMessage = JSON.parse(msg.content.toString())
  const { jobId, keyword, city, country, radius, maxResults } = jobMessage
  const startedAt = Date.now()

  logger.info({ jobId, keyword, city }, '▶ Processing job')

  await prisma.job.update({ where: { id: jobId }, data: { status: 'RUNNING' } })

  const savedProgress = await prisma.jobProgress.findUnique({ where: { jobId } })
  logger.info({ jobId, resumingFromPage: savedProgress?.currentPage ?? 0 }, 'Loaded progress')

  const deduplicator = new Deduplicator(prisma, redis, jobId)
  await deduplicator.preloadFromDatabase()

  const { context, release } = await acquireBrowser()
  let totalFound = 0
  let qualifiedCount = 0

  try {
    await scrapeGoogleMaps(context, {
      keyword, city, country, radius, maxResults, jobId,

      shouldStop: async () => {
        const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } })
        return job?.status === 'PAUSED' || job?.status === 'CANCELLED'
      },

      onProgress: async (processed, total, currentStep) => {
        const pct = total > 0 ? Math.round((processed / total) * 100) : 0
        await redis.setex(
          `job:progress:${jobId}`,
          TTL.JOB_PROGRESS,
          JSON.stringify({ processed, total, currentStep, pct })
        )
        if (processed % 10 === 0) {
          await prisma.job.update({ where: { id: jobId }, data: { progress: pct, totalBusinesses: processed } })
          await prisma.jobProgress.update({ where: { jobId }, data: { processedCount: processed } })
        }
      },

      onBusiness: async (raw: RawBusiness, index: number) => {
        totalFound++

        if (await deduplicator.isAlreadyProcessed(raw.placeId)) {
          logger.debug({ placeId: raw.placeId }, 'Duplicate — skipping')
          return
        }

        const leadScore = scoreLead(raw)

        const business = await prisma.business.upsert({
          where: { placeId_jobId: { placeId: raw.placeId, jobId } },
          create: {
            placeId: raw.placeId, jobId, name: raw.name, phone: raw.phone,
            address: raw.address, website: raw.website, hasWebsite: raw.hasWebsite,
            category: raw.category, rating: raw.rating, reviewCount: raw.reviewCount,
            mapsUrl: raw.mapsUrl, latitude: raw.latitude, longitude: raw.longitude,
            leadScore, status: 'WEBSITE_CHECKED',
          },
          update: {},
        })

        await deduplicator.markProcessed(raw.placeId)

        if (!raw.hasWebsite) {
          publish(QUEUES.WEBSITE, { businessId: business.id, jobId }, business.id)
          qualifiedCount++
        }

        await prisma.jobProgress.update({
          where: { jobId },
          data: { lastProcessedPlace: raw.placeId, processedCount: index + 1 },
        })
      },
    })

    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', completedAt: new Date(), totalBusinesses: totalFound, qualifiedBusinesses: qualifiedCount, progress: 100 },
    })

    const duration = Date.now() - startedAt
    logger.info({ jobId, totalFound, qualifiedCount, durationMs: duration }, '✅ Job completed')

    await prisma.workerLog.create({
      data: { workerName: 'search-worker', jobId, duration: Math.round(duration / 1000), status: 'COMPLETED' },
    })
  } catch (err) {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : String(err) },
    })
    await prisma.workerLog.create({
      data: { workerName: 'search-worker', jobId, duration: Math.round((Date.now() - startedAt) / 1000), status: 'FAILED', message: err instanceof Error ? err.message : String(err) },
    })
    throw err
  } finally {
    await release()
  }
}

// ── 30 lines — everything else lives in createWorker ─────────────────────────
createWorker({
  name: 'search-worker',
  queue: QUEUES.JOB,
  onMessage: processJob,
  onStart: async () => initBrowserPool(),
  onShutdown: async () => closeBrowserPool(),
})
