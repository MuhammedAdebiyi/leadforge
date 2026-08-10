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
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const URL_REGEX = /https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s"'<>]*)?/g

const CONFIRM_THRESHOLD = 70
const REVIEW_THRESHOLD = 40
const FUZZY_NAME_THRESHOLD = 0.55

const FREE_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'yahoo.co.uk']

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
      // not reachable
    }
  }

  // Name-based search on both engines, plus phone/address as standalone
  // queries — a website often ranks for its phone number or street address
  // even when the business name search buries it under directories.
  const searchTasks: Promise<{ url: string | null; similarity: number; socialUrl: string | null; source: string }>[] = [
    runSearch('duckduckgo', `"${businessName}" ${city}`, businessName, logger),
    runSearch('bing', `"${businessName}" ${city}`, businessName, logger),
  ]
  if (phone) {
    searchTasks.push(runSearch('duckduckgo', `"${phone}"`, businessName, logger, 'duckduckgo_phone'))
  }
  if (address) {
    searchTasks.push(runSearch('bing', `"${address}"`, businessName, logger, 'bing_address'))
  }

  const searchResults = await Promise.allSettled(searchTasks)
  const resolved = searchResults
    .filter((r): r is PromiseFulfilledResult<Awaited<typeof searchTasks[0]>> => r.status === 'fulfilled')
    .map(r => r.value)

  for (const r of resolved) {
    if (r.socialUrl && !scrapedSocialUrl) {
      hasSocialPresence = true
      scrapedSocialUrl = r.socialUrl
    }
    if (r.url) {
      const isReverseSearch = r.source.includes('phone') || r.source.includes('address')
      const base = isReverseSearch ? 65 : (r.similarity >= FUZZY_NAME_THRESHOLD ? 80 : 40)
      candidates.push({ url: r.url, confidence: base, source: r.source })
    }
  }

  // Cross-reference: if two independent sources agree on the same domain,
  // boost confidence for that shared candidate.
  boostCrossReferenced(candidates)

  // Social bio — scrape for BOTH an email and a listed website link, not
  // just email. Many bios list a "website" field distinct from contact email.
  let scrapedEmail: string | null = null
  if (scrapedSocialUrl) {
    const bio = await scrapeSocialBio(scrapedSocialUrl, logger)
    scrapedEmail = bio.email

    if (bio.website) {
      candidates.push({ url: bio.website, confidence: 75, source: 'social_bio_link' })
    }

    // A custom email domain (not gmail/yahoo/etc) is itself evidence of an
    // owned domain — worth trying as a website candidate directly.
    if (bio.email) {
      const emailDomain = bio.email.split('@')[1]?.toLowerCase()
      if (emailDomain && !FREE_EMAIL_DOMAINS.includes(emailDomain)) {
        candidates.push({ url: `https://${emailDomain}`, confidence: 65, source: 'email_domain' })
      }
    }
  }

  boostCrossReferenced(candidates)
  candidates.sort((a, b) => b.confidence - a.confidence)
  const best = candidates[0]

  if (!best) {
    return {
      hasWebsite: false, hasSocialPresence, url: null, scrapedEmail,
      confidence: 0, possibleUrl: null, reason: 'No candidates found from any source', checkedAt,
    }
  }

  const enriched = await enrichAndVerify(best, businessName, phone, address, scrapedEmail, logger)

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
  const reason = [`Source: ${best.source} (base ${best.confidence})`, ...enriched.reasons].join('; ')

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

function boostCrossReferenced(candidates: Candidate[]): void {
  const byDomain = new Map<string, Candidate[]>()
  for (const c of candidates) {
    const d = domainOf(c.url)
    if (!d) continue
    if (!byDomain.has(d)) byDomain.set(d, [])
    byDomain.get(d)!.push(c)
  }
  for (const [, group] of byDomain) {
    if (group.length > 1) {
      const uniqueSources = new Set(group.map(c => c.source.split('_')[0]))
      if (uniqueSources.size > 1) {
        for (const c of group) c.confidence = Math.min(100, c.confidence + 15)
      }
    }
  }
}

async function enrichAndVerify(
  candidate: Candidate,
  businessName: string,
  phone: string | null,
  address: string | null,
  scrapedEmail: string | null,
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

  // Email-domain cross-check: does the found email's domain match this
  // candidate's domain? If someone's email is info@thisdomain.com, that's
  // strong confirmation this is genuinely their site.
  if (scrapedEmail) {
    const emailDomain = scrapedEmail.split('@')[1]?.toLowerCase()
    const candidateDomain = domainOf(candidate.url)
    if (emailDomain && candidateDomain && emailDomain === candidateDomain) {
      bonus += 20
      reasons.push('Email domain matches website domain')
    }
  }

  // Also check for any email on the page itself matching the candidate's own domain
  const pageEmails = html.match(EMAIL_REGEX) ?? []
  const candidateDomain = domainOf(candidate.url)
  if (candidateDomain && pageEmails.some(e => e.split('@')[1]?.toLowerCase() === candidateDomain)) {
    if (!reasons.includes('Email domain matches website domain')) {
      bonus += 10
      reasons.push('Page has email on same domain')
    }
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
      // malformed — skip
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

function levenshteinSimilarity(a: string, b: string): number {
  const na = normalizeForMatch(a)
  const nb = normalizeForMatch(b)
  if (na === nb) return 1
  if (na.length === 0 || nb.length === 0) return 0
  const dist = levenshteinDistance(na, nb)
  return 1 - dist / Math.max(na.length, nb.length)
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

const SOCIAL_DOMAINS = ['facebook.com', 'instagram.com', 'wa.me', 'linktr.ee']

const EXCLUDED_DOMAINS = [
  'jumia.com', 'duckduckgo.com', 'google.com', 'bing.com', 'msn.com', 'yellowpages',
  'businesslist', 'nairaland.com', 'connectnigeria.com',
  'vconnect.com', 'finelib.com', 'nigeriagalleria.com', 'jiji.ng',
  'africabz.com', 'zaubee.com', 'cybo.com', 'mynigeriabusiness.ng',
  'ngcontacts.com.ng', '9jadirectory.org', 'nigeriadirectory.com.ng',
  'tripadvisor.com', 'foursquare.com', 'yelp.com', 'facebook.com',
  'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
]

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return null
  }
}

async function runSearch(
  engine: 'duckduckgo' | 'bing',
  query: string,
  businessName: string,
  logger: AppLogger,
  sourceOverride?: string
): Promise<{ url: string | null; similarity: number; socialUrl: string | null; source: string }> {
  try {
    const result = engine === 'duckduckgo'
      ? await searchDuckDuckGo(query, logger)
      : await searchBing(query, logger)

    const similarity = result.url ? levenshteinSimilarity(domainOf(result.url)?.split('.')[0] ?? '', normalizeForMatch(businessName)) : 0
    return { ...result, similarity, source: sourceOverride ?? engine }
  } catch (err) {
    logger.warn({ err, engine, query }, 'Search failed')
    return { url: null, similarity: 0, socialUrl: null, source: sourceOverride ?? engine }
  }
}

async function searchDuckDuckGo(query: string, logger: AppLogger): Promise<{ url: string | null; socialUrl: string | null }> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return { url: null, socialUrl: null }
  const html = await res.text()
  const matches = [...html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/g)]
  return pickBestResult(matches.map(m => m[1]), extractDdgUrl)
}

async function searchBing(query: string, logger: AppLogger): Promise<{ url: string | null; socialUrl: string | null }> {
  const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return { url: null, socialUrl: null }
  const html = await res.text()
  const matches = [...html.matchAll(/<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]+href="([^"]+)"/g)]
  return pickBestResult(matches.map(m => m[1]), (href) => href)
}

function extractDdgUrl(href: string): string {
  const uddgMatch = href.match(/uddg=([^&]+)/)
  return uddgMatch ? decodeURIComponent(uddgMatch[1]) : href
}

function pickBestResult(
  rawHrefs: string[],
  resolve: (href: string) => string
): { url: string | null; socialUrl: string | null } {
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
    return { url: href, socialUrl }
  }
  return { url: null, socialUrl }
}

/**
 * Scrapes a social bio for BOTH a contact email and a listed website link.
 * Bio "website" fields are distinct from contact email and often the
 * business's actual site — a gap the old email-only scrape missed.
 */
async function scrapeSocialBio(socialUrl: string, logger: AppLogger): Promise<{ email: string | null; website: string | null }> {
  try {
    const res = await fetch(socialUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return { email: null, website: null }

    const html = await res.text()
    const metaMatch = html.match(/<meta property="og:description" content="([^"]*)"/)
    const bioText = metaMatch?.[1] ?? ''

    const emailMatch = bioText.match(EMAIL_REGEX) ?? html.match(EMAIL_REGEX)
    const email = emailMatch ? emailMatch[0] : null

    // Look for a URL in the bio text first (most reliable), then fall
    // back to scanning nearby HTML for an external "website" link element.
    let website: string | null = null
    const bioUrls = bioText.match(URL_REGEX)
    if (bioUrls) {
      website = bioUrls.find(u => {
        const d = domainOf(u)
        return d && !SOCIAL_DOMAINS.some(sd => d.includes(sd)) && !EXCLUDED_DOMAINS.some(ed => d.includes(ed))
      }) ?? null
    }

    if (!website) {
      // Facebook "Website" field often appears as a plain external link
      // elsewhere in the page HTML — best-effort scan, capped for safety.
      const htmlUrls = html.slice(0, 100_000).match(URL_REGEX)
      if (htmlUrls) {
        website = htmlUrls.find(u => {
          const d = domainOf(u)
          return d && !SOCIAL_DOMAINS.some(sd => d.includes(sd)) && !EXCLUDED_DOMAINS.some(ed => d.includes(ed)) && !u.includes('cdninstagram') && !u.includes('fbcdn')
        }) ?? null
      }
    }

    return { email, website }
  } catch (err) {
    logger.debug({ err, socialUrl }, 'Social bio scrape failed')
    return { email: null, website: null }
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
