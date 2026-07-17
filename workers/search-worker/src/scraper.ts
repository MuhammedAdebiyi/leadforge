import { BrowserContext, Page } from 'playwright'
import selectors from './selectors.json'
import { extractBusinessFromPage, RawBusiness } from './extractor'
import { createLogger } from '@leadforge/shared'

const logger = createLogger('search-worker:scraper')

export interface ScrapeOptions {
  keyword: string
  city: string
  country: string
  radius: number
  maxResults: number
  jobId: string
  onBusiness: (b: RawBusiness, index: number) => Promise<void>
  onProgress: (processed: number, total: number, currentStep: string) => Promise<void>
  shouldStop: () => Promise<boolean>
}

const SCROLL_DELAY_MS = 1500
const PAGE_LOAD_TIMEOUT = 15000
const MIN_DELAY = parseInt(process.env.SCRAPE_DELAY_MIN_MS ?? '1500')
const MAX_DELAY = parseInt(process.env.SCRAPE_DELAY_MAX_MS ?? '4000')

export async function scrapeGoogleMaps(context: BrowserContext, opts: ScrapeOptions): Promise<number> {
  const { keyword, city, country, maxResults, jobId, onBusiness, onProgress, shouldStop } = opts

  const query = encodeURIComponent(`${keyword} in ${city}, ${country}`)
  const searchUrl = `https://www.google.com/maps/search/${query}?hl=en&gl=us`

  logger.info({ jobId, query: `${keyword} in ${city}` }, 'Starting scrape')

  const page = await context.newPage()

  try {
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot}', r => r.abort())
    await page.route('**/maps/api/js*', r => r.continue())

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT })
    await acceptCookies(page)
    await page.waitForSelector(selectors.search.resultsContainer, { timeout: PAGE_LOAD_TIMEOUT })

    await onProgress(0, maxResults, 'Scrolling results')

    const listingUrls = await collectListingUrls(page, maxResults, jobId, shouldStop, onProgress)

    logger.info({ jobId, found: listingUrls.length }, 'Collected listing URLs')
    await onProgress(0, listingUrls.length, `Found ${listingUrls.length} listings — visiting each`)

    let processed = 0

    for (const url of listingUrls) {
      if (await shouldStop()) {
        logger.info({ jobId }, 'Stop signal received — halting scrape')
        break
      }

      await onProgress(processed, listingUrls.length, `Visiting: ${url.slice(0, 60)}...`)

      const listingPage = await context.newPage()
      try {
        await listingPage.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', r => r.abort())
        await listingPage.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT })

        const business = await extractBusinessFromPage(listingPage, url)
        if (business) {
          await onBusiness(business, processed)
        }
      } catch (err) {
        logger.warn({ err, url, jobId }, 'Failed to visit listing — skipping')
      } finally {
        await listingPage.close()
      }

      processed++
      await randomDelay(MIN_DELAY, MAX_DELAY)
    }

    return processed
  } finally {
    await page.close()
  }
}

async function collectListingUrls(
  page: Page,
  maxResults: number,
  jobId: string,
  shouldStop: () => Promise<boolean>,
  onProgress: (processed: number, total: number, currentStep: string) => Promise<void>
): Promise<string[]> {
  const urls = new Set<string>()
  let previousCount = 0
  let staleScrolls = 0
  const MAX_STALE = 5

  while (urls.size < maxResults && !(await shouldStop())) {
    const links = await page.$$eval(
      `${selectors.search.resultsContainer} a[href*="/maps/place/"]`,
      els => els.map(el => (el as HTMLAnchorElement).href)
    )

    for (const link of links) {
      if (urls.size >= maxResults) break
      urls.add(link.split('?')[0])
    }

    logger.debug({ jobId, collected: urls.size, target: maxResults }, 'Scrolling...')

    await onProgress(urls.size, maxResults, `Scrolling — found ${urls.size} so far`)

    if (urls.size === previousCount) {
      staleScrolls++
      if (staleScrolls >= MAX_STALE) {
        logger.info({ jobId }, 'No more results to scroll')
        break
      }
    } else {
      staleScrolls = 0
    }

    previousCount = urls.size

    await page.evaluate((containerSel) => {
      const el = document.querySelector(containerSel)
      if (el) el.scrollBy(0, 800)
    }, selectors.search.scrollContainer)

    await randomDelay(SCROLL_DELAY_MS, SCROLL_DELAY_MS + 500)

    const endText = await page.$eval('body', b => b.innerText).catch(() => '')
    if (endText.includes("You've reached the end of the list")) break
  }

  return Array.from(urls).slice(0, maxResults)
}

async function acceptCookies(page: Page): Promise<void> {
  try {
    // Google's consent interstitial redirects through consent.google.com
    // regardless of language — check the URL first, this is more reliable
    // than matching button text which varies by locale (EN/DE/FR/etc).
    if (page.url().includes('consent.google.com')) {
      const buttons = await page.$$('button')
      for (const btn of buttons) {
        const text = (await btn.innerText()).toLowerCase()
        if (/accept|akzeptieren|accepter|aceptar|accetta/.test(text)) {
          await btn.click()
          await page.waitForNavigation({ timeout: 5000 }).catch(() => {})
          return
        }
      }
    }

    // Fallback: try the common English selector directly on the Maps page itself
    const acceptBtn = await page.$('button[aria-label="Accept all"]')
    if (acceptBtn) {
      await acceptBtn.click()
      return
    }
  } catch {
    // no cookie banner present — safe to continue
  }
}

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(r => setTimeout(r, ms))
}
