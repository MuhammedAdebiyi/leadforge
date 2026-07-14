import * as fs from 'fs'
import * as path from 'path'
import type { AppLogger } from '@leadforge/shared'

const TELEGRAM_API = 'https://api.telegram.org'
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

export async function sendTelegramFile(
  chatId: string,
  filePath: string,
  filename: string,
  caption: string,
  logger: AppLogger
): Promise<void> {
  const url = `${TELEGRAM_API}/bot${BOT_TOKEN}/sendDocument`

  const fileBuffer = fs.readFileSync(filePath)
  const blob = new Blob([fileBuffer])

  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('caption', caption)
  form.append('parse_mode', 'HTML')
  form.append('document', blob, filename)

  try {
    const res = await fetch(url, { method: 'POST', body: form })
    const data = await res.json() as { ok: boolean; description?: string }

    if (!data.ok) {
      logger.error({ chatId, error: data.description }, 'Failed to send export file via Telegram')
    } else {
      logger.info({ chatId, filename }, '✅ Export file sent via Telegram')
    }
  } catch (err) {
    logger.error({ err, chatId }, 'Telegram file upload threw')
  }
}
