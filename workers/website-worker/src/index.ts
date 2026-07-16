import { createWorker, prisma, publish, QUEUES } from '@leadforge/shared'
import { checkWebsite } from './checker'
import type { ConsumeMessage, Channel } from 'amqplib'
import type { AppLogger } from '@leadforge/shared'

interface WebsiteMessage {
  businessId: string
  jobId: string
}

async function processMessage(msg: ConsumeMessage, _channel: Channel, logger: AppLogger): Promise<void> {
  const { businessId, jobId }: WebsiteMessage = JSON.parse(msg.content.toString())

  logger.info({ businessId, jobId }, '🔍 Validating business')

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    logger.warn({ businessId }, 'Business not found — skipping')
    return
  }

  if (business.status !== 'DISCOVERED') {
    logger.debug({ businessId, status: business.status }, 'Already past discovery — skipping')
    return
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { city: true, leadScoreThreshold: true, telegramDestination: true, useEmailEnrichment: true },
  })

  if (!job) {
    logger.warn({ jobId }, 'Job not found — skipping')
    return
  }

  const result = await checkWebsite(business.mapsUrl ?? '', business.name, job.city, logger)

  if (result.hasWebsite) {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        hasWebsite: true,
        hasSocialPresence: result.hasSocialPresence,
        website: result.url,
        status: 'ARCHIVED',
        leadScore: 0,
      },
    })
    logger.debug({ businessId, url: result.url }, 'Has website — archived')
    return
  }

  await prisma.business.update({
    where: { id: businessId },
    data: {
      hasWebsite: false,
      hasSocialPresence: result.hasSocialPresence,
      website: null,
      status: 'VALIDATED',
    },
  })

  logger.debug(
    { businessId, name: business.name, hasSocialPresence: result.hasSocialPresence },
    'Validated — no website confirmed'
  )

  const meetsThreshold = business.leadScore >= (job.leadScoreThreshold ?? 50)

  if (!meetsThreshold) {
    await prisma.business.update({
      where: { id: businessId },
      data: { status: 'ARCHIVED' },
    })
    logger.debug({ businessId, score: business.leadScore, threshold: job.leadScoreThreshold }, 'Below ICP threshold — archived')
    return
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { status: 'QUALIFIED' },
  })

  await prisma.job.update({
    where: { id: jobId },
    data: { qualifiedBusinesses: { increment: 1 } },
  })

  logger.info({ businessId, name: business.name, score: business.leadScore }, '✅ Lead qualified — matches ICP')

  if (job.useEmailEnrichment) {
    publish(QUEUES.EMAIL, { businessId, jobId }, businessId)
    logger.debug({ businessId }, 'Queued for email enrichment')
  } else {
    await prisma.business.update({
      where: { id: businessId },
      data: { status: 'READY_FOR_OUTREACH' },
    })
    if (job.telegramDestination) {
      publish(QUEUES.TELEGRAM, { businessId, chatId: job.telegramDestination }, businessId)
      logger.debug({ businessId }, 'Queued for Telegram')
    }
  }
}

createWorker({
  name: 'website-worker',
  queue: QUEUES.WEBSITE,
  onMessage: processMessage,
})
