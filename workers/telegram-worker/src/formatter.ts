import type { Business } from '@prisma/client'

/**
 * Formats a qualified lead into a Telegram message.
 * Uses Telegram HTML parse mode for clean formatting.
 */
export function formatLeadMessage(business: Business): string {
  const stars = business.rating ? '⭐'.repeat(Math.round(business.rating)) : ''
  const rating = business.rating ? `${business.rating} ${stars}` : 'N/A'
  const reviews = business.reviewCount ? `${business.reviewCount} reviews` : 'No reviews'
  const phone = business.phone ?? 'Not available'
  const whatsapp = business.whatsapp ?? business.phone ?? 'Not available'
  const email = business.email ?? 'Not found'
  const address = business.address ?? 'Not available'
  const category = business.category ?? 'Unknown'
  const score = business.leadScore

  const scoreEmoji = score >= 80 ? '🔥' : score >= 60 ? '⚡' : '📋'

  return [
    `${scoreEmoji} <b>New Qualified Lead</b>`,
    ``,
    `<b>🏢 Business</b>: ${escapeHtml(business.name)}`,
    `<b>📂 Category</b>: ${escapeHtml(category)}`,
    ``,
    `<b>📞 Phone</b>: ${escapeHtml(phone)}`,
    `<b>💬 WhatsApp</b>: ${escapeHtml(whatsapp)}`,
    `<b>📧 Email</b>: ${escapeHtml(email)}`,
    ``,
    `<b>📍 Address</b>: ${escapeHtml(address)}`,
    `<b>⭐ Rating</b>: ${rating}`,
    `<b>💬 Reviews</b>: ${reviews}`,
    ``,
    business.mapsUrl ? `<b>🗺 Google Maps</b>: <a href="${business.mapsUrl}">Open in Maps</a>` : '',
    ``,
    `<b>🎯 Lead Score</b>: ${score}/100`,
    `<b>✅ Status</b>: No website found`,
  ].filter(line => line !== null).join('\n')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
