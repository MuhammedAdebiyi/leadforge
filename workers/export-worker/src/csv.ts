import { stringify } from 'csv-stringify/sync'
import type { Business } from '@prisma/client'

export function generateCsv(businesses: Business[]): Buffer {
  const rows = businesses.map(b => ({
    Name: b.name,
    Category: b.category ?? '',
    Phone: b.phone ?? '',
    WhatsApp: b.whatsapp ?? '',
    Email: b.email ?? '',
    Address: b.address ?? '',
    Rating: b.rating ?? '',
    Reviews: b.reviewCount ?? '',
    'Maps URL': b.mapsUrl ?? '',
    'Lead Score': b.leadScore,
    Status: b.status,
    'Found At': b.createdAt.toISOString(),
  }))

  const output = stringify(rows, { header: true })
  return Buffer.from(output, 'utf-8')
}
