import ExcelJS from 'exceljs'
import type { Business } from '@prisma/client'

export async function generateExcel(businesses: Business[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LeadForge'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Qualified Leads', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // Header row with styling
  sheet.columns = [
    { header: 'Business Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'WhatsApp', key: 'whatsapp', width: 18 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Address', key: 'address', width: 35 },
    { header: 'Rating', key: 'rating', width: 10 },
    { header: 'Reviews', key: 'reviewCount', width: 10 },
    { header: 'Lead Score', key: 'leadScore', width: 12 },
    { header: 'Maps URL', key: 'mapsUrl', width: 40 },
    { header: 'Found At', key: 'createdAt', width: 22 },
  ]

  // Style header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 24

  // Add data rows
  for (const b of businesses) {
    const row = sheet.addRow({
      name: b.name,
      category: b.category ?? '',
      phone: b.phone ?? '',
      whatsapp: b.whatsapp ?? b.phone ?? '',
      email: b.email ?? '',
      address: b.address ?? '',
      rating: b.rating ?? '',
      reviewCount: b.reviewCount ?? '',
      leadScore: b.leadScore,
      mapsUrl: b.mapsUrl ?? '',
      createdAt: b.createdAt.toISOString().slice(0, 19).replace('T', ' '),
    })

    // Colour code by lead score
    const scoreCell = row.getCell('leadScore')
    if (b.leadScore >= 80) {
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22c55e' } }
      scoreCell.font = { color: { argb: 'FFFFFFFF' }, bold: true }
    } else if (b.leadScore >= 60) {
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf59e0b' } }
    }

    // Make Maps URL a hyperlink
    if (b.mapsUrl) {
      const urlCell = row.getCell('mapsUrl')
      urlCell.value = { text: 'Open in Maps', hyperlink: b.mapsUrl }
      urlCell.font = { color: { argb: 'FF3b82f6' }, underline: true }
    }
  }

  // Auto-filter on header row
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  }

  return workbook.xlsx.writeBuffer() as Promise<Buffer>
}
