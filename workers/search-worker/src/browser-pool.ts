import { chromium, Browser, BrowserContext } from 'playwright'
import { logger } from './logger'

interface PooledBrowser {
  browser: Browser
  inUse: boolean
  id: number
}

const POOL_SIZE = parseInt(process.env.BROWSER_POOL_SIZE ?? '3')

let pool: PooledBrowser[] = []
let initialized = false

export async function initBrowserPool(): Promise<void> {
  if (initialized) return
  logger.info({ poolSize: POOL_SIZE }, 'Initializing browser pool')

  for (let i = 0; i < POOL_SIZE; i++) {
    const browser = await launchBrowser(i)
    pool.push({ browser, inUse: false, id: i })
  }

  initialized = true
  logger.info(' Browser pool ready')
}

async function launchBrowser(id: number): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--safebrowsing-disable-auto-update',
    ],
  }).then(b => {
    logger.debug({ browserId: id }, 'Browser launched')
    return b
  })
}

export async function acquireBrowser(): Promise<{ browser: Browser; context: BrowserContext; release: () => Promise<void> }> {
  // Wait for a free browser (poll every 500ms)
  let slot: PooledBrowser | undefined

  while (!slot) {
    slot = pool.find(b => !b.inUse && b.browser.isConnected())
    if (!slot) {
      await sleep(500)
    }
  }

  slot.inUse = true

  const context = await slot.browser.newContext({
    userAgent: randomUserAgent(),
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'Africa/Lagos',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  const release = async () => {
    try {
      await context.close()
    } catch {
      // context already closed
    }
    slot!.inUse = false

    // Restart browser if it crashed
    if (!slot!.browser.isConnected()) {
      logger.warn({ browserId: slot!.id }, 'Browser crashed — restarting')
      try {
        slot!.browser = await launchBrowser(slot!.id)
      } catch (err) {
        logger.error({ err, browserId: slot!.id }, 'Failed to restart browser')
      }
    }
  }

  return { browser: slot.browser, context, release }
}

export async function closeBrowserPool(): Promise<void> {
  logger.info('Closing browser pool')
  await Promise.all(pool.map(({ browser }) => browser.close().catch(() => {})))
  pool = []
  initialized = false
}

function randomUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  ]
  return agents[Math.floor(Math.random() * agents.length)]
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}