import { createWorker, prisma, publish, QUEUES } from '@leadforge/shared'
import { findEmail } from './finder'
import type { ConsumeMessage, Channel } from 'amqplib'
import type { AppLogger } from '@leadforge/shared'

interface EmailMessage {
  businessId: string
  jobId: string
}

async function processMessage(
  msg: ConsumeMessage,
  _channel: Channel,
  logger: AppLogger
): Promise<void> {
  const { businessId, jobId }: EmailMessage = JSON.parse(msg.content.toString())

  logger.info({ businessId, jobId }, '📧 Enriching email')

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    logger.warn({ businessId }, 'Business not found — skipping')
    return
  }

  // Already enriched — idempotency guard
  if (business.status === 'EMAIL_ENRICHED' || business.status === 'SENT_TO_TELEGRAM') {
    logger.debug({ businessId }, 'Already enriched — skipping')
    return
  }

  // Try to find email via Hunter
  const result = await findEmail(business.name, business.website, logger)

  await prisma.business.update({
    where: { id: businessId },
    data: {
      email: result.email,
      status: 'EMAIL_ENRICHED',
    },
  })

  logger.info({ businessId, email: result.email, source: result.source }, '✅ Email enrichment done')

  // Forward to Telegram
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { telegramDestination: true },
  })

  if (job?.telegramDestination) {
    publish(QUEUES.TELEGRAM, { businessId, chatId: job.telegramDestination }, businessId)
    logger.debug({ businessId }, 'Queued for Telegram')
  }
}

createWorker({
  name: 'email-worker',
  queue: QUEUES.EMAIL,
  onMessage: processMessage,
})
