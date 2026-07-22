import type { AppLogger } from '@leadforge/shared'

const TELEGRAM_API = 'https://api.telegram.org'
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

export interface SendResult {
  success: boolean
  messageId?: number
  error?: string
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  logger: AppLogger
): Promise<SendResult> {
  const url = `${TELEGRAM_API}/bot${BOT_TOKEN}/sendMessage`

  try {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    }, 3, logger)

    const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string }

    if (!data.ok) {
      logger.warn({ chatId, error: data.description }, 'Telegram API returned not-ok')
      return { success: false, error: data.description }
    }

    return { success: true, messageId: data.result?.message_id }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error({ err, chatId }, 'Failed to send Telegram message')
    return { success: false, error }
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number,
  logger: AppLogger
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options)

      // Handle Telegram rate limiting (429)
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10)
        logger.warn({ attempt, retryAfter }, 'Telegram rate limited — waiting')
        await sleep(retryAfter * 1000)
        continue
      }

      return res
    } catch (err) {
      if (attempt === retries) throw err
      const backoff = Math.pow(2, attempt) * 1000
      logger.warn({ attempt, backoff }, 'Telegram fetch failed — retrying')
      await sleep(backoff)
    }
  }

  throw new Error('Max retries exceeded for Telegram request')
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    chat: { id: number }
    text?: string
  }
}

export async function getUpdates(offset: number): Promise<TelegramUpdate[]> {
  const url = `${TELEGRAM_API}/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=25`
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  const data = await res.json() as { ok: boolean; result?: TelegramUpdate[] }
  return data.ok && data.result ? data.result : []
}
