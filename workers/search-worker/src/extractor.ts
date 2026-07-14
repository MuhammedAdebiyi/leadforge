import { Page } from 'playwright'
import selectors from './selectors.json'
import { logger } from './logger'

export interface RawBusiness {
  placeId: string
  name: string
  phone: string | null
  address: string | null
  website: string | null
  hasWebsite: boolean
  category: string | null
  rating: number | null
  reviewCount: number | null
  mapsUrl: string
  latitude: number | null
  longitude: number | null
}

export async function extractBusinessFromPage(page: Page, mapsUrl: string): Promise<RawBusiness | null> {
  try {
    await page.waitForSelector(selectors.listing.name, { timeout: 10000 })

    const [name, category, address, phone, website, ratingText, reviewText] = await Promise.all([
      getText(page, selectors.listing.name),
      getText(page, selectors.listing.category),
      getText(page, selectors.listing.address),
      getText(page, selectors.listing.phone),
      getAttribute(page, selectors.listing.websiteHref, 'href'),
      getText(page, selectors.listing.rating),
      getAttribute(page, selectors.listing.reviewCount, 'aria-label'),
    ])

    if (!name) {
      logger.warn({ mapsUrl }, 'Could not extract business name — skipping')
      return null
    }

    // Extract place ID from URL
    const placeId = extractPlaceId(page.url()) ?? slugify(name + (address ?? ''))

    // Parse coordinates from URL
    const coords = extractCoords(page.url())

    // Parse rating
    const rating = ratingText ? parseFloat(ratingText) : null

    // Parse review count: "132 reviews" → 132
    const reviewCount = reviewText
      ? parseInt(reviewText.replace(/[^0-9]/g, ''), 10) || null
      : null

    const hasWebsite = !!website && !website.includes('google.com/maps')

    return {
      placeId,
      name: name.trim(),
      phone: phone?.trim() ?? null,
      address: address?.trim() ?? null,
      website: hasWebsite ? website : null,
      hasWebsite,
      category: category?.trim() ?? null,
      rating: isNaN(rating!) ? null : rating,
      reviewCount,
      mapsUrl,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
    }
  } catch (err) {
    logger.error({ err, mapsUrl }, 'Failed to extract business data')
    return null
  }
}

async function getText(page: Page, selector: string): Promise<string | null> {
  try {
    return await page.$eval(selector, el => el.textContent?.trim() ?? null)
  } catch {
    return null
  }
}

async function getAttribute(page: Page, selector: string, attr: string): Promise<string | null> {
  try {
    return await page.$eval(selector, (el, a) => el.getAttribute(a), attr)
  } catch {
    return null
  }
}

function extractPlaceId(url: string): string | null {
  // https://www.google.com/maps/place/.../@.../data=...!1s0x...
  const match = url.match(/!1s(0x[0-9a-f]+:[0-9a-f]+)/i)
  return match ? match[1] : null
}

function extractCoords(url: string): { lat: number; lng: number } | null {
  // /@6.5244,3.3792,17z
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (!match) return null
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) }
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 64)
}