import type { AppLogger } from '@leadforge/shared'

const HUNTER_API = 'https://api.hunter.io/v2'
const HUNTER_KEY = process.env.HUNTER_API_KEY

export interface EmailFindResult {
  email: string | null
  confidence: number | null
  source: 'hunter' | 'scraped' | null
}

export async function findEmail(
  businessName: string,
  domain: string | null,
  logger: AppLogger
): Promise<EmailFindResult> {
  // No domain and no Hunter key — nothing we can do
  if (!domain || !HUNTER_KEY) {
    return { email: null, confidence: null, source: null }
  }

  try {
    const cleanDomain = extractDomain(domain)
    const url = `${HUNTER_API}/domain-search?domain=${cleanDomain}&api_key=${HUNTER_KEY}&limit=1`

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json() as {
      data?: {
        emails?: Array<{ value: string; confidence: number }>
      }
      errors?: Array<{ details: string }>
    }

    if (data.errors?.length) {
      logger.warn({ errors: data.errors, domain: cleanDomain }, 'Hunter API error')
      return { email: null, confidence: null, source: null }
    }

    const first = data.data?.emails?.[0]
    if (!first) {
      logger.debug({ domain: cleanDomain }, 'No email found via Hunter')
      return { email: null, confidence: null, source: null }
    }

    logger.debug({ email: first.value, confidence: first.confidence }, 'Email found via Hunter')
    return { email: first.value, confidence: first.confidence, source: 'hunter' }
  } catch (err) {
    logger.warn({ err, domain }, 'Hunter lookup failed')
    return { email: null, confidence: null, source: null }
  }
}

function extractDomain(input: string): string {
  try {
    const url = input.startsWith('http') ? input : `https://${input}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return input.replace(/^www\./, '').split('/')[0]
  }
}
