import { prisma, redis, publish, QUEUES, createLogger } from '@leadforge/shared'
import type { CreateJobInput } from '@leadforge/shared'

const logger = createLogger('jobs-service')

export class JobsService {
  async createJob(userId: string, input: CreateJobInput) {
    const job = await prisma.$transaction(async (tx) => {
      const j = await tx.job.create({
        data: {
          userId, keyword: input.keyword, city: input.city,
          country: input.country, radius: input.radius,
          maxResults: input.maxResults,
          telegramDestination: input.telegramDestination ?? null,
          useEmailEnrichment: input.useEmailEnrichment,
          leadScoreThreshold: input.leadScoreThreshold,
        },
      })
      await tx.jobProgress.create({ data: { jobId: j.id } })
      return j
    }, { timeout: 15000 })

    publish(QUEUES.JOB, {
      jobId: job.id, userId, keyword: job.keyword, city: job.city,
      country: job.country, radius: job.radius, maxResults: job.maxResults,
    }, job.id)

    logger.info({ jobId: job.id, userId }, 'Job created and queued')
    return job
  }

  async getJobs(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' },
        skip, take: limit,
        include: { _count: { select: { businesses: true } } },
      }),
      prisma.job.count({ where: { userId } }),
    ])
    return { jobs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
  }

  async getJobById(jobId: string, userId: string) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, userId },
      include: { jobProgress: true, _count: { select: { businesses: true } } },
    })
    if (!job) throw { statusCode: 404, message: 'Job not found' }
    const liveProgress = await redis.get(`job:progress:${jobId}`)
    return { ...job, liveProgress }
  }

  async pauseJob(jobId: string, userId: string) {
    const job = await this.findOrThrow(jobId, userId)
    if (job.status !== 'RUNNING') throw { statusCode: 400, message: 'Only running jobs can be paused' }
    return prisma.job.update({ where: { id: jobId }, data: { status: 'PAUSED' } })
  }

  async resumeJob(jobId: string, userId: string) {
    const job = await this.findOrThrow(jobId, userId)
    if (job.status !== 'PAUSED') throw { statusCode: 400, message: 'Only paused jobs can be resumed' }
    const updated = await prisma.job.update({ where: { id: jobId }, data: { status: 'PENDING' } })
    publish(QUEUES.JOB, {
      jobId: job.id, userId, keyword: job.keyword, city: job.city,
      country: job.country, radius: job.radius, maxResults: job.maxResults,
    }, job.id)
    return updated
  }

  async cancelJob(jobId: string, userId: string) {
    const job = await this.findOrThrow(jobId, userId)
    if (['COMPLETED', 'CANCELLED'].includes(job.status)) {
      throw { statusCode: 400, message: 'Job already completed or cancelled' }
    }
    return prisma.job.update({ where: { id: jobId }, data: { status: 'CANCELLED', completedAt: new Date() } })
  }

  async deleteJob(jobId: string, userId: string) {
    const job = await this.findOrThrow(jobId, userId)
    if (job.status === 'RUNNING') throw { statusCode: 400, message: 'Cancel the job before deleting' }
    await prisma.job.delete({ where: { id: jobId } })
    await redis.del(`job:progress:${jobId}`)
  }

  async getDashboardStats(userId: string) {
    const [jobStats, totalBusinesses, qualifiedLeads] = await Promise.all([
      prisma.job.groupBy({ by: ['status'], where: { userId }, _count: true }),
      prisma.business.count({ where: { job: { userId } } }),
      prisma.business.count({ where: { job: { userId }, status: 'QUALIFIED' } }),
    ])
    const stats = { activeJobs: 0, completedJobs: 0, failedJobs: 0, totalBusinesses, qualifiedLeads }
    for (const s of jobStats) {
      if (s.status === 'RUNNING') stats.activeJobs = s._count
      if (s.status === 'COMPLETED') stats.completedJobs = s._count
      if (s.status === 'FAILED') stats.failedJobs = s._count
    }
    return stats
  }

  private async findOrThrow(jobId: string, userId: string) {
    const job = await prisma.job.findFirst({ where: { id: jobId, userId } })
    if (!job) throw { statusCode: 404, message: 'Job not found' }
    return job
  }
}
