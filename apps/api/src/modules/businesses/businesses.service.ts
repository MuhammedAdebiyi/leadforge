import { prisma, publish, QUEUES, createLogger } from '@leadforge/shared'

const logger = createLogger('businesses-service')

export class BusinessesService {
  async getBusinesses(userId: string, opts: { jobId?: string; status?: string; hasWebsite?: boolean; page: number; limit: number }) {
    const { jobId, status, hasWebsite, page, limit } = opts
    const where = {
      job: { userId },
      ...(jobId && { jobId }),
      ...(status && { status: status as any }),
      ...(hasWebsite !== undefined && { hasWebsite }),
    }
    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where, orderBy: { leadScore: 'desc' },
        skip: (page - 1) * limit, take: limit,
        select: {
          id: true, name: true, phone: true, email: true, address: true,
          category: true, rating: true, reviewCount: true, mapsUrl: true,
          leadScore: true, status: true, hasWebsite: true, createdAt: true,
        },
      }),
      prisma.business.count({ where }),
    ])
    return { businesses, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
  }

  async getBusinessById(id: string, userId: string) {
    const b = await prisma.business.findFirst({ where: { id, job: { userId } }, include: { telegramLogs: true } })
    if (!b) throw { statusCode: 404, message: 'Business not found' }
    return b
  }

  async exportBusinesses(userId: string, jobId: string, format: 'csv' | 'excel') {
    const job = await prisma.job.findFirst({ where: { id: jobId, userId } })
    if (!job) throw { statusCode: 404, message: 'Job not found' }
    publish(QUEUES.EXPORT, { jobId, userId, format })
    return { message: 'Export queued — you will be notified via Telegram when ready.' }
  }

  async retryTelegram(businessId: string, userId: string) {
    const b = await prisma.business.findFirst({
      where: { id: businessId, job: { userId } },
      include: { job: { select: { telegramDestination: true } } },
    })
    if (!b) throw { statusCode: 404, message: 'Business not found' }
    if (!b.job.telegramDestination) throw { statusCode: 400, message: 'No Telegram destination on this job' }
    publish(QUEUES.TELEGRAM, { businessId, chatId: b.job.telegramDestination, retryCount: 0 })
    return { message: 'Queued for Telegram delivery' }
  }
}
