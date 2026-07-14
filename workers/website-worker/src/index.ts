import { createWorker, prisma, publish, QUEUES, createLogger } from '@leadforge/shared'
import { checkWebsite } from './checker'
import type { ConsumeMessage, Channel } from 'amqplib'
import type { AppLogger } from '@leadforge/shared'

interface WebsiteMessage {
  businessId: string
  jobId: string
}

async function processMessage(msg: ConsumeMessage, _channel: Channel, logger: AppLogger): Promise<void> {
  const { businessId, jobId }: WebsiteMessage = JSON.parse(msg.content.toString())

  logger.info({ businessId, jobId }, '🔍 Checking website')

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    logger.warn({ businessId }, 'Business not found — skipping')
    return
  }

  // Already fully processed — idempotency guard
  if (business.status !== 'WEBSITE_CHECKED') {
    logger.debug({ businessId, status: business.status }, 'Already past website check — skipping')
    return
  }

  const result = await checkWebsite(business.mapsUrl ?? '', business.name, logger)

  if (result.hasWebsite) {
    // Has a website — not a lead, archive it
    await prisma.business.update({
      where: { id: businessId },
      data: { hasWebsite: true, website: result.url, status: 'ARCHIVED' },
    })
    logger.debug({ businessId, url: result.url }, 'Has website — archived')
    return
  }

  // No website confirmed — qualify the lead
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { leadScoreThreshold: true, telegramDestination: true, useEmailEnrichment: true },
  })

  if (!job) {
    logger.warn({ jobId }, 'Job not found — skipping')
    return
  }

  const meetsThreshold = business.leadScore >= (job.leadScoreThreshold ?? 50)

  if (!meetsThreshold) {
    await prisma.business.update({
      where: { id: businessId },
      data: { status: 'ARCHIVED' },
    })
    logger.debug({ businessId, score: business.leadScore }, 'Score below threshold — archived')
    return
  }

  // Qualified lead
  await prisma.business.update({
    where: { id: businessId },
    data: { hasWebsite: false, website: null, status: 'QUALIFIED' },
  })

  await prisma.job.update({
    where: { id: jobId },
    data: { qualifiedBusinesses: { increment: 1 } },
  })

  logger.info({ businessId, name: business.name, score: business.leadScore }, '✅ Lead qualified')

  // Route to email enrichment or straight to Telegram
  if (job.useEmailEnrichment) {
    publish(QUEUES.EMAIL, { businessId, jobId }, businessId)
    logger.debug({ businessId }, 'Queued for email enrichment')
  } else if (job.telegramDestination) {
    publish(QUEUES.TELEGRAM, { businessId, chatId: job.telegramDestination }, businessId)
    logger.debug({ businessId }, 'Queued for Telegram')
  }
}

createWorker({
  name: 'website-worker',
  queue: QUEUES.WEBSITE,
  onMessage: processMessage,
})
