// workers/search-worker/src/scorer.ts
import type { RawBusiness } from './extractor'

const CHAIN_KEYWORDS = [
  'mcdonald', 'kfc', "domino's", 'dominos', 'chicken republic',
  'sweet sensation', 'tastee fried chicken', 'subway', 'pizza hut',
  'shoprite', 'game stores', 'burger king', 'cold stone',
  'coldstone', 'chicken licken', 'nando', 'ice cream factory',
]

/**
 * Score a lead 0–100.
 *
 * "Qualified" = no website (the entry gate — set elsewhere in the pipeline).
 * This score answers a DIFFERENT question: given no website, how good a
 * PROSPECT is this business — i.e. would they actually buy web/marketing
 * services, and can we actually reach them?
 *
 * Design principle: this is NOT a "data completeness" score. A business
 * with 6,000 reviews and a 4.8 rating is easy to find data on, but it's
 * a corporate/established operation — not our buyer. A business with
 * 8 reviews and a working phone number is a much warmer prospect.
 */
export function scoreLead(business: RawBusiness): number {
  // Has a website = disqualified. Don't even bother scoring further.
  if (business.hasWebsite) return 0

  let score = 25 // base for clearing the no-website gate

  // Contactability — can we actually reach them?
  if (business.phone) score += 15

  // Review count sweet spot — small-to-medium, active, but not corporate
  const reviews = business.reviewCount ?? 0
  if (reviews >= 5 && reviews <= 150) {
    score += 25 // ideal: established enough to be real, small enough to need help
  } else if (reviews > 150 && reviews <= 400) {
    score += 10 // borderline — may already have some marketing traction
  } else if (reviews > 400) {
    score -= 15 // likely large/established — probably not our ICP
  } else if (reviews > 0 && reviews < 5) {
    score += 5 // very new, lower confidence but still worth a look
  }
  // reviews === 0 (no reviews at all) — no bonus, no penalty, base score only

  // Quality signal — legitimate, active operation
  if (business.rating) {
    if (business.rating >= 4.0) score += 15
    else if (business.rating >= 3.0) score += 5
    // below 3.0: struggling business — may not have budget for marketing either
  }

  // Chain/franchise penalty — heavy, since these are almost never a fit
  if (isLikelyChain(business.name)) score -= 40

  // Physical presence + indexed listing — minor signals
  if (business.address) score += 10
  if (business.category) score += 5

  return Math.max(0, Math.min(score, 100))
}

function isLikelyChain(name: string): boolean {
  const lower = name.toLowerCase()
  return CHAIN_KEYWORDS.some(kw => lower.includes(kw))
}
