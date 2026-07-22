import { createWorker, prisma, QUEUES } from '@leadforge/shared'
import { sendTelegramMessage } from './sender'
import { startCommandPolling } from './commands'
import { createLogger } from '@leadforge/shared'
import { formatLeadMessage } from './formatter'
import type { ConsumeMessage, Channel } from 'amqplib'
import type { AppLogger } from '@leadforge/shared'

interface TelegramMessage {
  businessId: string
  chatId: string
  retryCount?: number
}

async function processMessage(
  msg: ConsumeMessage,
  _channel: Channel,
  logger: AppLogger
): Promise<void> {
  const { businessId, chatId }: TelegramMessage = JSON.parse(msg.content.toString())

  logger.info({ businessId, chatId }, '📨 Sending Telegram notification')

  // Idempotency — check if already sent successfully
  const alreadySent = await prisma.telegramLog.findFirst({
    where: { businessId, chatId, success: true },
  })

  if (alreadySent) {
    logger.debug({ businessId }, 'Already sent to Telegram — skipping (idempotent)')
    return
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) {
    logger.warn({ businessId }, 'Business not found — skipping')
    return
  }

  const text = formatLeadMessage(business)
  const result = await sendTelegramMessage(chatId, text, logger)

  // Always log the attempt — success or failure
  await prisma.telegramLog.create({
    data: {
      businessId,
      chatId,
      success: result.success,
      error: result.error ?? null,
      retryCount: 0,
    },
  })

  if (!result.success) {
    // Throw so the worker-bootstrap retry logic kicks in
    throw new Error(`Telegram send failed: ${result.error}`)
  }

  // Mark business as sent
  await prisma.business.update({
    where: { id: businessId },
    data: { status: 'SENT_TO_TELEGRAM' },
  })

  logger.info({ businessId, name: business.name, chatId }, '✅ Lead sent to Telegram')
}

createWorker({
  name: 'telegram-worker',
  queue: QUEUES.TELEGRAM,
  onMessage: processMessage,
})

// Run command polling alongside the queue consumer — fire and forget,
// it loops internally via long-polling until the process exits.
startCommandPolling(createLogger('telegram-worker:commands'))
