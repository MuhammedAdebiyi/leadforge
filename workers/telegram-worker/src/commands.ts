import { prisma, publish, QUEUES } from '@leadforge/shared'
import type { AppLogger } from '@leadforge/shared'
import { sendTelegramMessage, getUpdates } from './sender'

const STATUS_EMOJI: Record<string, string> = {
  PENDING: '⏳', RUNNING: '▶️', PAUSED: '⏸️',
  COMPLETED: '✅', FAILED: '❌', CANCELLED: '🚫',
}

export async function handleCommand(chatId: string, text: string, logger: AppLogger): Promise<void> {
  const command = text.trim().split(/\s+/)[0].toLowerCase()

  try {
    switch (command) {
      case '/status':
        await handleStatus(chatId, logger)
        break
      case '/pause':
        await handlePause(chatId, logger)
        break
      case '/resume':
        await handleResume(chatId, logger)
        break
      case '/stats':
        await handleStats(chatId, logger)
        break
      case '/start':
      case '/help':
        await sendTelegramMessage(chatId, formatHelp(), logger)
        break
      default:
        await sendTelegramMessage(chatId, `Unknown command. Send /help to see what I can do.`, logger)
    }
  } catch (err) {
    logger.error({ err, chatId, command }, 'Command handler failed')
    await sendTelegramMessage(chatId, `Something went wrong running that command — try again shortly.`, logger).catch(() => {})
  }
}

async function handleStatus(chatId: string, logger: AppLogger): Promise<void> {
  const jobs = await prisma.job.findMany({
    where: { telegramDestination: chatId, status: { in: ['PENDING', 'RUNNING', 'PAUSED'] } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  if (jobs.length === 0) {
    await sendTelegramMessage(chatId, `No active jobs right now. Start one from the dashboard.`, logger)
    return
  }

  const lines = jobs.map(j => {
    const emoji = STATUS_EMOJI[j.status] ?? '•'
    return `${emoji} <b>${escapeHtml(j.keyword)}</b> in ${escapeHtml(j.city)} — ${j.status} (${j.progress}%, ${j.qualifiedBusinesses} qualified)`
  })

  await sendTelegramMessage(chatId, [`<b>📋 Your active jobs</b>`, ``, ...lines].join('\n'), logger)
}

async function handlePause(chatId: string, logger: AppLogger): Promise<void> {
  const running = await prisma.job.findMany({
    where: { telegramDestination: chatId, status: 'RUNNING' },
  })

  if (running.length === 0) {
    await sendTelegramMessage(chatId, `No running jobs to pause.`, logger)
    return
  }

  await prisma.job.updateMany({
    where: { id: { in: running.map(j => j.id) } },
    data: { status: 'PAUSED' },
  })

  logger.info({ chatId, jobIds: running.map(j => j.id) }, 'Jobs paused via Telegram command')
  await sendTelegramMessage(chatId, `⏸️ Paused ${running.length} job(s). Send /resume to continue.`, logger)
}

async function handleResume(chatId: string, logger: AppLogger): Promise<void> {
  const paused = await prisma.job.findMany({
    where: { telegramDestination: chatId, status: 'PAUSED' },
  })

  if (paused.length === 0) {
    await sendTelegramMessage(chatId, `No paused jobs to resume.`, logger)
    return
  }

  for (const job of paused) {
    await prisma.job.update({ where: { id: job.id }, data: { status: 'PENDING' } })
    publish(QUEUES.JOB, {
      jobId: job.id, userId: job.userId, keyword: job.keyword, city: job.city,
      country: job.country, radius: job.radius, maxResults: job.maxResults,
    }, job.id)
  }

  logger.info({ chatId, jobIds: paused.map(j => j.id) }, 'Jobs resumed via Telegram command')
  await sendTelegramMessage(chatId, `▶️ Resumed ${paused.length} job(s).`, logger)
}

async function handleStats(chatId: string, logger: AppLogger): Promise<void> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const jobs = await prisma.job.findMany({
    where: { telegramDestination: chatId },
    select: { id: true },
  })
  const jobIds = jobs.map(j => j.id)

  if (jobIds.length === 0) {
    await sendTelegramMessage(chatId, `No jobs found for this chat yet.`, logger)
    return
  }

  const [qualifiedToday, qualifiedTotal] = await Promise.all([
    prisma.business.count({
      where: { jobId: { in: jobIds }, status: { in: ['QUALIFIED', 'READY_FOR_OUTREACH', 'SENT_TO_TELEGRAM'] }, createdAt: { gte: todayStart } },
    }),
    prisma.business.count({
      where: { jobId: { in: jobIds }, status: { in: ['QUALIFIED', 'READY_FOR_OUTREACH', 'SENT_TO_TELEGRAM'] } },
    }),
  ])

  await sendTelegramMessage(
    chatId,
    [`<b>📊 Your stats</b>`, ``, `Today: <b>${qualifiedToday}</b> qualified leads`, `All time: <b>${qualifiedTotal}</b> qualified leads`].join('\n'),
    logger
  )
}

function formatHelp(): string {
  return [
    `<b>🤖 LeadForge Bot Commands</b>`,
    ``,
    `/status — see your active jobs`,
    `/pause — pause all running jobs`,
    `/resume — resume paused jobs`,
    `/stats — qualified lead counts`,
    `/help — show this message`,
  ].join('\n')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Long-polling loop ────────────────────────────────────────────────────────

let offset = 0
let polling = false

export async function startCommandPolling(logger: AppLogger): Promise<void> {
  if (polling) return
  polling = true
  logger.info('Starting Telegram command polling')

  while (polling) {
    try {
      const updates = await getUpdates(offset)
      for (const update of updates) {
        offset = update.update_id + 1
        const msg = update.message
        if (!msg?.text || !msg.text.startsWith('/')) continue

        const chatId = String(msg.chat.id)
        logger.info({ chatId, text: msg.text }, 'Received Telegram command')
        await handleCommand(chatId, msg.text, logger)
      }
    } catch (err) {
      logger.warn({ err }, 'Polling error — retrying in 3s')
      await new Promise(r => setTimeout(r, 3000))
    }
  }
}
