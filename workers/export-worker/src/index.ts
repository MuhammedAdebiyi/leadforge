import { createWorker, prisma, publish, QUEUES, createLogger } from '@leadforge/shared'
import { generateCsv } from './csv'
import { generateExcel } from './excel'
import { sendTelegramFile } from './telegram-upload'
import type { ConsumeMessage, Channel } from 'amqplib'
import type { AppLogger } from '@leadforge/shared'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

interface ExportMessage {
  jobId: string
  userId: string
  format: 'csv' | 'excel'
}

async function processMessage(
  msg: ConsumeMessage,
  _channel: Channel,
  logger: AppLogger
): Promise<void> {
  const { jobId, userId, format }: ExportMessage = JSON.parse(msg.content.toString())

  logger.info({ jobId, format }, '📦 Starting export')

  // Fetch all qualified leads for this job
  const businesses = await prisma.business.findMany({
    where: {
      jobId,
      status: { in: ['QUALIFIED', 'EMAIL_ENRICHED', 'SENT_TO_TELEGRAM'] },
    },
    orderBy: { leadScore: 'desc' },
  })

  if (businesses.length === 0) {
    logger.warn({ jobId }, 'No qualified businesses to export')
    return
  }

  logger.info({ jobId, count: businesses.length, format }, 'Generating export file')

  // Generate file
  const buffer = format === 'excel'
    ? await generateExcel(businesses)
    : generateCsv(businesses)

  const ext = format === 'excel' ? 'xlsx' : 'csv'
  const filename = `leadforge-${jobId.slice(0, 8)}-${Date.now()}.${ext}`
  const tmpPath = path.join(os.tmpdir(), filename)

  fs.writeFileSync(tmpPath, buffer)

  // Mark all as exported
  await prisma.business.updateMany({
    where: { jobId, status: { in: ['QUALIFIED', 'EMAIL_ENRICHED', 'SENT_TO_TELEGRAM'] } },
    data: { status: 'EXPORTED' },
  })

  logger.info({ jobId, filename, count: businesses.length }, '✅ Export generated')

  // Send file via Telegram to the user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true },
  })

  if (user?.telegramChatId) {
    await sendTelegramFile(
      user.telegramChatId,
      tmpPath,
      filename,
      `✅ Export ready!\n\n📊 ${businesses.length} leads from job ${jobId.slice(0, 8)}\n📁 Format: ${format.toUpperCase()}`,
      logger
    )
  }

  // Cleanup temp file
  fs.unlinkSync(tmpPath)
}

createWorker({
  name: 'export-worker',
  queue: QUEUES.EXPORT,
  onMessage: processMessage,
})
