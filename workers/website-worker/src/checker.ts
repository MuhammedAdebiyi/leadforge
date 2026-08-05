import { chromium } from 'playwright'
import type { AppLogger } from '@leadforge/shared'

export interface WebsiteCheckResult {
  hasWebsite: boolean
  hasSocialPresence: boolean
  url: string | null
  scrapedEmail: string | null
  confidence: number
  possibleUrl: string | null
  reason: string
  checkedAt: Date
}

const TIMEOUT = 10000
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

const CONFIRM_THRESHOLD = 70
const REVIEW_THRESHOLD = 40
const FUZZY_NAME_THRESHOLD = 0.55 // similarity score 0-1, tuned loose since domains truncate/abbreviate names

interface Candidate {
  url: string
  confidence: number
  source: string
}

export async function checkWebsite(
  mapsUrl: string,
  businessName: string,
  city: string,
  phone: string | null,
  address: string | null,
  logger: AppLogger
): Promise<WebsiteCheckResult> {
  const checkedAt = new Date()
  const candidates: Candidate[] = []
  let hasSocialPresence = false
  let scrapedSocialUrl: string | null = null

  if (mapsUrl) {
    try {
      const authorityUrl = await checkViaPlaywright(mapsUrl, logger)
      if (authorityUrl) {
        candidates.push({ url: authorityUrl, confidence: 90, source: 'maps_authority' })
      }
    } catch (err) {
      logger.warn({ err, mapsUrl }, 'Playwright check failed — continuing')
    }
  }

  for (const url of generateGuessedUrls(businessName)) {
    try {
      const res = await fetchWithTimeout(url, 5000, 'HEAD')
      if (res.ok) {
        candidates.push({ url, confidence: 55, source: 'guessed_domain' })
        break
      }
    } catch {
      // not reachable — continue
    }
  }

  // Run both search engines in parallel — best-effort, one failing doesn't
  // block the other. Cross-referencing (same domain from both) is a strong
  // signal, so we check for that after gathering both result sets.
  const [ddgResult, bingResult] = await Promise.allSettled([
    searchDuckDuckGo(businessName, city, logger),
    searchBing(businessName, city, logger),
  ])

  const ddg = ddgResult.status === 'fulfilled' ? ddgResult.value : { url: null, similarity: 0, socialUrl: null }
  const bing = bingResult.status === 'fulfilled' ? bingResult.value : { url: null, similarity: 0, socialUrl: null }

  if (ddgResult.status === 'rejected') logger.warn({ err: ddgResult.reason }, 'DuckDuckGo search failed')
  if (bingResult.status === 'rejected') logger.warn({ err: bingResult.reason }, 'Bing search failed')

  if (ddg.socialUrl) { hasSocialPresence = true; scrapedSocialUrl = ddg.socialUrl }
  if (bing.socialUrl && !scrapedSocialUrl) { hasSocialPresence = true; scrapedSocialUrl = bing.socialUrl }

  const sameDomain = ddg.url && bing.url && domainOf(ddg.url) === domainOf(bing.url)

  if (ddg.url) {
    let conf = ddg.similarity >= FUZZY_NAME_THRESHOLD ? 80 : 40
    if (sameDomain) conf += 15 // cross-referenced by a second independent engine
    candidates.push({ url: ddg.url, confidence: Math.min(100, conf), source: sameDomain ? 'duckduckgo+bing' : 'duckduckgo' })
  }
  if (bing.url && !sameDomain) {
    const conf = bing.similarity >= FUZZY_NAME_THRESHOLD ? 80 : 40
    candidates.push({ url: bing.url, confidence: conf, source: 'bing' })
  }

  candidates.sort((a, b) => b.confidence - a.confidence)
  const best = candidates[0]

  let scrapedEmail: string | null = null
  if (!best || best.confidence < CONFIRM_THRESHOLD) {
    if (scrapedSocialUrl) {
      scrapedEmail = await scrapeSocialBioEmail(scrapedSocialUrl, logger)
    }
  }

  if (!best) {
    return {
      hasWebsite: false, hasSocialPresence, url: null, scrapedEmail,
      confidence: 0, possibleUrl: null, reason: 'No candidates found from any source', checkedAt,
    }
  }

  const enriched = await enrichAndVerify(best, businessName, phone, address, logger)

  if (!enriched.reachable) {
    logger.debug({ url: best.url, source: best.source }, 'Top candidate unreachable')
    const secondBest = candidates[1]
    if (secondBest && secondBest.confidence >= REVIEW_THRESHOLD) {
      return {
        hasWebsite: false, hasSocialPresence, url: null, scrapedEmail,
        confidence: secondBest.confidence, possibleUrl: secondBest.url,
        reason: `Top candidate (${best.url}) unreachable — fallback needs review`, checkedAt,
      }
    }
    return {
      hasWebsite: false, hasSocialPresence, url: null, scrapedEmail,
      confidence: 0, possibleUrl: null, reason: `Best candidate (${best.url}) unreachable, no fallback`, checkedAt,
    }
  }

  const finalConfidence = Math.min(100, best.confidence + enriched.bonus)
  const reasonParts = [`Source: ${best.source} (base ${best.confidence})`, ...enriched.reasons]
  const reason = reasonParts.join('; ')

  if (finalConfidence >= CONFIRM_THRESHOLD) {
    logger.info({ url: best.url, confidence: finalConfidence, reason }, 'Website confirmed')
    return {
      hasWebsite: true, hasSocialPresence, url: best.url, scrapedEmail: null,
      confidence: finalConfidence, possibleUrl: null, reason, checkedAt,
    }
  }

  if (finalConfidence >= REVIEW_THRESHOLD) {
    logger.debug({ url: best.url, confidence: finalConfidence, reason }, 'Medium-confidence — flagged for review')
    return {
      hasWebsite: false, hasSocialPresence, url: null, scrapedEmail,
      confidence: finalConfidence, possibleUrl: best.url, reason, checkedAt,
    }
  }

  return {
    hasWebsite: false, hasSocialPresence, url: null, scrapedEmail,
    confidence: finalConfidence, possibleUrl: null, reason, checkedAt,
  }
}

async function enrichAndVerify(
  candidate: Candidate,
  businessName: string,
  phone: string | null,
  address: string | null,
  logger: AppLogger
): Promise<{ reachable: boolean; bonus: number; reasons: string[] }> {
  let html: string
  try {
    const res = await fetchWithTimeout(candidate.url, 6000, 'GET')
    if (!res.ok) return { reachable: false, bonus: 0, reasons: [] }
    html = (await res.text()).slice(0, 200_000)
  } catch (err) {
    logger.debug({ err, url: candidate.url }, 'Homepage fetch failed')
    return { reachable: false, bonus: 0, reasons: [] }
  }

  let bonus = 0
  const reasons: string[] = []

  const jsonLd = extractJsonLd(html)
  if (jsonLd) {
    const nameMatch = jsonLd.name && levenshteinSimilarity(jsonLd.name, businessName) >= FUZZY_NAME_THRESHOLD
    const phoneMatch = phone && jsonLd.telephone && phonesMatch(phone, jsonLd.telephone)
    const addressMatch = address && jsonLd.address && addressesMatch(address, jsonLd.address)

    if (nameMatch) { bonus += 15; reasons.push('JSON-LD name matches') }
    if (phoneMatch) { bonus += 25; reasons.push('JSON-LD phone matches') }
    if (addressMatch) { bonus += 15; reasons.push('JSON-LD address matches') }
    if (jsonLd.name || jsonLd.telephone) reasons.push('LocalBusiness schema found')
  }

  if (phone && !reasons.some(r => r.includes('JSON-LD phone'))) {
    if (phonesMatch(phone, html)) { bonus += 25; reasons.push('Phone number found on page') }
  }

  if (address && !reasons.some(r => r.includes('JSON-LD address'))) {
    if (addressesMatch(address, html)) { bonus += 15; reasons.push('Address tokens found on page') }
  }

  return { reachable: true, bonus, reasons }
}

interface JsonLdBusiness { name?: string; telephone?: string; address?: string }

function extractJsonLd(html: string): JsonLdBusiness | null {
  const scriptMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]

  for (const m of scriptMatches) {
    try {
      const parsed = JSON.parse(m[1].trim())
      const items = Array.isArray(parsed) ? parsed : [parsed]

      for (const item of items) {
        const type = item['@type']
        const typeStr = Array.isArray(type) ? type.join(',') : String(type ?? '')
        if (/LocalBusiness|Organization|Store|Restaurant|ProfessionalService/i.test(typeStr)) {
          const addr = item.address
          const addressStr = typeof addr === 'string'
            ? addr
            : addr ? [addr.streetAddress, addr.addressLocality, addr.addressRegion].filter(Boolean).join(', ') : undefined

          return { name: item.name, telephone: item.telephone, address: addressStr }
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }
  return null
}

function phonesMatch(a: string, b: string): boolean {
  const digitsA = a.replace(/\D/g, '').slice(-8)
  if (digitsA.length < 7) return false
  return b.replace(/\D/g, '').includes(digitsA)
}

function addressesMatch(a: string, b: string): boolean {
  const wordsA = a.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3)
  const bLower = b.toLowerCase()
  const matchCount = wordsA.filter(w => bLower.includes(w)).length
  return wordsA.length > 0 && matchCount / wordsA.length >= 0.4
}

/**
 * Normalized Levenshtein similarity, 0 (nothing alike) to 1 (identical).
 * Cheap, dependency-free — no embeddings API needed. Compares normalized
 * strings so "The Hair Palace Lagos" vs "Hair Palace" score reasonably
 * high despite not being an exact substring match.
 */
function levenshteinSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a)
  const nb = normalizeForMatch(b)
  if (na === nb) return 1
  if (na.length === 0 || nb.length === 0) return 0

  const dist = levenshteinDistance(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  return 1 - dist / maxLen
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  return dp[m][n]
}

const SOCIAL_DOMAINS = ['facebook.com', 'instagram.com', 'wa.me', 'linktr.ee']

const EXCLUDED_DOMAINS = [
  'jumia.com', 'duckduckgo.com', 'google.com', 'bing.com', 'yellowpages',
  'businesslist', 'nairaland.com', 'connectnigeria.com',
  'vconnect.com', 'finelib.com', 'nigeriagalleria.com', 'jiji.ng',
  'africabz.com', 'zaubee.com', 'cybo.com', 'mynigeriabusiness.ng',
  'ngcontacts.com.ng', '9jadirectory.org', 'nigeriadirectory.com.ng',
  'tripadvisor.com', 'foursquare.com', 'yelp.com', 'facebook.com',
  'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'msn.com',
]

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return null
  }
}

async function searchDuckDuckGo(
  businessName: string, city: string, logger: AppLogger
): Promise<{ url: string | null; similarity: number; socialUrl: string | null }> {
  const query = encodeURIComponent(`"${businessName}" ${city}`)
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return { url: null, similarity: 0, socialUrl: null }

  const html = await res.text()
  const matches = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/g)]
  return pickBestResult(matches.map(m => m[1]), businessName, extractDdgUrl)
}

async function searchBing(
  businessName: string, city: string, logger: AppLogger
): Promise<{ url: string | null; similarity: number; socialUrl: string | null }> {
  const query = encodeURIComponent(`"${businessName}" ${city}`)
  const res = await fetch(`https://www.bing.com/search?q=${query}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return { url: null, similarity: 0, socialUrl: null }

  const html = await res.text()
  // Bing's organic results sit in <li class="b_algo"><h2><a href="...">
  const matches = [...html.matchAll(/<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]+href="([^"]+)"/g)]
  return pickBestResult(matches.map(m => m[1]), businessName, (href) => href)
}

function extractDdgUrl(href: string): string {
  const uddgMatch = href.match(/uddg=([^&]+)/)
  return uddgMatch ? decodeURIComponent(uddgMatch[1]) : href
}

function pickBestResult(
  rawHrefs: string[],
  businessName: string,
  resolve: (href: string) => string
): { url: string | null; similarity: number; socialUrl: string | null } {
  let socialUrl: string | null = null

  for (const raw of rawHrefs.slice(0, 5)) {
    const href = resolve(raw)
    const domain = domainOf(href)
    if (!domain) continue

    if (SOCIAL_DOMAINS.some(d => domain.includes(d)) && !socialUrl) {
      socialUrl = href
      continue
    }
    if (EXCLUDED_DOMAINS.some(d => domain.includes(d))) continue

    const similarity = levenshteinSimilarity(domain.split('.')[0], normalizeForMatch(businessName))
    return { url: href, similarity, socialUrl }
  }

  return { url: null, similarity: 0, socialUrl }
}

async function scrapeSocialBioEmail(socialUrl: string, logger: AppLogger): Promise<string | null> {
  try {
    const res = await fetch(socialUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const metaMatch = html.match(/<meta property="og:description" content="([^"]*)"/)
    const bioText = metaMatch?.[1] ?? html
    const emailMatch = bioText.match(EMAIL_REGEX)
    return emailMatch ? emailMatch[0] : null
  } catch (err) {
    logger.debug({ err, socialUrl }, 'Social bio scrape failed')
    return null
  }
}

function normalizeForMatch(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '')
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
      if (href && !href.includes('google.com/maps')) return href
    }
    return null
  } finally {
    await browser.close()
  }
}

function generateGuessedUrls(businessName: string): string[] {
  const slug = businessName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '').slice(0, 30)
  if (!slug) return []
  return [
    `https://www.${slug}.com`, `https://${slug}.com`,
    `https://www.${slug}.ng`, `https://${slug}.ng`, `https://www.${slug}.co`,
  ]
}

async function fetchWithTimeout(url: string, timeoutMs: number, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      method, signal: controller.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36' },
    })
  } finally {
    clearTimeout(timer)
  }
}
