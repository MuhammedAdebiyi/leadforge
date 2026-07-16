import { chromium } from 'playwright'
import type { AppLogger } from '@leadforge/shared'

export interface WebsiteCheckResult {
  hasWebsite: boolean
  hasSocialPresence: boolean
  url: string | null
  checkedAt: Date
}

const TIMEOUT = 10000

/**
 * Detection order (most reliable first):
 * 1. Google Maps "authority" link — Google's own official website field
 * 2. Guessed URL (businessname.com/.ng/.co) — only counts on a real 200, no 403s
 * 3. DuckDuckGo HTML search fallback — last resort, low volume, respectful
 */
export async function checkWebsite(
  mapsUrl: string,
  businessName: string,
  city: string,
  logger: AppLogger
): Promise<WebsiteCheckResult> {
  const checkedAt = new Date()

  // Layer 1: Google Maps official website link — most authoritative signal
  if (mapsUrl) {
    try {
      const result = await checkViaPlaywright(mapsUrl, logger)
      if (result) {
        logger.debug({ url: result }, 'Website found via Maps authority link')
        return { hasWebsite: true, hasSocialPresence: false, url: result, checkedAt }
      }
    } catch (err) {
      logger.warn({ err, mapsUrl }, 'Playwright check failed — continuing to next layer')
    }
  }

  // Layer 2: guessed URL, but ONLY a real 200 counts — 403/301/302 prove nothing
  const guessedUrls = generateGuessedUrls(businessName)
  for (const url of guessedUrls) {
    try {
      const res = await fetchWithTimeout(url, 5000)
      if (res.ok) {
        logger.debug({ url, status: res.status }, 'Website found via guessed URL (200 OK)')
        return { hasWebsite: true, hasSocialPresence: false, url, checkedAt }
      }
    } catch {
      // not reachable — continue
    }
  }

  // Layer 3: DuckDuckGo HTML search fallback — only reached if layers 1 & 2 found nothing
  try {
    const ddgResult = await searchDuckDuckGo(businessName, city, logger)
    if (ddgResult.url) {
      return { hasWebsite: true, hasSocialPresence: ddgResult.isSocial, url: ddgResult.url, checkedAt }
    }
    if (ddgResult.isSocial) {
      return { hasWebsite: false, hasSocialPresence: true, url: null, checkedAt }
    }
  } catch (err) {
    logger.warn({ err, businessName }, 'DuckDuckGo fallback failed — assuming no website')
  }

  return { hasWebsite: false, hasSocialPresence: false, url: null, checkedAt }
}

const SOCIAL_DOMAINS = ['facebook.com', 'instagram.com', 'wa.me', 'linktr.ee']

// Known third-party directories/listing/review sites — never count as "the business's own website"
const EXCLUDED_DOMAINS = [
  'jumia.com', 'duckduckgo.com', 'google.com', 'yellowpages',
  'businesslist', 'nairaland.com', 'connectnigeria.com',
  'vconnect.com', 'finelib.com', 'nigeriagalleria.com', 'jiji.ng',
  'africabz.com', 'zaubee.com', 'cybo.com', 'mynigeriabusiness.ng',
  'ngcontacts.com.ng', '9jadirectory.org', 'nigeriadirectory.com.ng',
  'tripadvisor.com', 'foursquare.com', 'yelp.com', 'facebook.com',
  'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
]

async function searchDuckDuckGo(
  businessName: string,
  city: string,
  logger: AppLogger
): Promise<{ url: string | null; isSocial: boolean }> {
  const query = encodeURIComponent(`"${businessName}" ${city}`)
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) return { url: null, isSocial: false }

  const html = await res.text()
  const matches = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/g)]

  const nameFragment = normalizeForMatch(businessName)

  for (const m of matches.slice(0, 5)) {
    let href = m[1]
    const uddgMatch = href.match(/uddg=([^&]+)/)
    if (uddgMatch) href = decodeURIComponent(uddgMatch[1])

    let domain: string
    try {
      domain = new URL(href).hostname.replace('www.', '')
    } catch {
      continue
    }

    if (EXCLUDED_DOMAINS.some(d => domain.includes(d))) {
      // Social domains are worth noting separately even though they're excluded as "website"
      if (SOCIAL_DOMAINS.some(d => domain.includes(d))) {
        logger.debug({ href, domain }, 'Found social presence via DuckDuckGo')
        return { url: null, isSocial: true }
      }
      continue
    }

    // Positive signal check: the domain should contain a recognizable fragment
    // of the business name to count as "their own site" — otherwise it's likely
    // an unlisted directory, review aggregator, or unrelated result.
    const domainNormalized = normalizeForMatch(domain)
    if (nameFragment.length >= 4 && !domainNormalized.includes(nameFragment.slice(0, Math.min(nameFragment.length, 8)))) {
      logger.debug({ href, domain, businessName }, 'Skipping DuckDuckGo result — domain does not match business name')
      continue
    }

    logger.debug({ href, domain }, 'Found likely website via DuckDuckGo')
    return { url: href, isSocial: false }
  }

  return { url: null, isSocial: false }
}

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

async function checkViaPlaywright(mapsUrl: string, logger: AppLogger): Promise<string | null> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()

    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', r => r.abort())
    await page.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })

    const websiteEl = await page.$('a[data-item-id="authority"]')
    if (websiteEl) {
      const href = await websiteEl.getAttribute('href')
      if (href && !href.includes('google.com/maps')) {
        return href
      }
    }

    return null
  } finally {
    await browser.close()
  }
}

function generateGuessedUrls(businessName: string): string[] {
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '')
    .slice(0, 30)

  if (!slug) return []

  return [
    `https://www.${slug}.com`,
    `https://${slug}.com`,
    `https://www.${slug}.ng`,
    `https://${slug}.ng`,
    `https://www.${slug}.co`,
  ]
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    })
  } finally {
    clearTimeout(timer)
  }
}
