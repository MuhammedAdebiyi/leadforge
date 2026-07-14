import type { RawBusiness } from './extractor'

/**
 * Score a lead 0–100.
 * Higher = better quality prospect for web design outreach.
 */
export function scoreLead(business: RawBusiness): number {
  let score = 0

  // Has no website — that's the whole point (base qualifier)
  if (!business.hasWebsite) score += 30

  // Phone number available (can be contacted)
  if (business.phone) score += 20

  // Has reviews (established business, not a ghost listing)
  if (business.reviewCount && business.reviewCount > 0) {
    if (business.reviewCount >= 50) score += 20
    else if (business.reviewCount >= 10) score += 15
    else score += 5
  }

  // Good rating (reputable business, worth approaching)
  if (business.rating) {
    if (business.rating >= 4.5) score += 15
    else if (business.rating >= 4.0) score += 10
    else if (business.rating >= 3.5) score += 5
  }

  // Has address (physical presence)
  if (business.address) score += 10

  // Has category (well-indexed listing)
  if (business.category) score += 5

  return Math.min(score, 100)
}