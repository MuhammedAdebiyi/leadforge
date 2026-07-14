import { chromium } from 'playwright'
import type { AppLogger } from '@leadforge/shared'

export interface WebsiteCheckResult {
  hasWebsite: boolean
  url: string | null
  checkedAt: Date
}

const TIMEOUT = 10000

/**
 * Three-layer website detection:
 * 1. Check the mapsUrl page for a website link
 * 2. Try common URLs: businessname.com, businessname.ng etc.
 * 3. DNS lookup via fetch HEAD request
 */
export async function checkWebsite(
  mapsUrl: string,
  businessName: string,
  logger: AppLogger
): Promise<WebsiteCheckResult> {
  const checkedAt = new Date()

  // Layer 1: try a lightweight HEAD request first (cheapest)
  const guessedUrls = generateGuessedUrls(businessName)
  for (const url of guessedUrls) {
    try {
      const res = await fetchWithTimeout(url, 5000)
      if (res.ok || res.status === 301 || res.status === 302 || res.status === 403) {
        logger.debug({ url, status: res.status }, 'Website found via HEAD request')
        return { hasWebsite: true, url, checkedAt }
      }
    } catch {
      // URL not reachable — continue
    }
  }

  // Layer 2: Playwright — visit the Google Maps listing and check for website link
  if (mapsUrl) {
    try {
      const result = await checkViaPlaywright(mapsUrl, logger)
      if (result) return { hasWebsite: true, url: result, checkedAt }
    } catch (err) {
      logger.warn({ err, mapsUrl }, 'Playwright check failed — assuming no website')
    }
  }

  return { hasWebsite: false, url: null, checkedAt }
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

    // Block heavy assets
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', r => r.abort())

    await page.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })

    // Look for website link in the listing
    const websiteEl = await page.$('a[data-item-id="authority"]')
    if (websiteEl) {
      const href = await websiteEl.getAttribute('href')
      if (href && !href.includes('google.com/maps')) {
        logger.debug({ href }, 'Website found via Playwright')
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
