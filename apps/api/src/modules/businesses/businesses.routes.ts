import type { FastifyInstance } from 'fastify'
import { BusinessesService } from './businesses.service'
import { paginationSchema, exportSchema } from '@leadforge/shared'
import { authenticate } from '../../middleware/auth'
import { z } from 'zod'

const filterSchema = z.object({
  jobId: z.string().optional(),
  status: z.string().optional(),
  hasWebsite: z.coerce.boolean().optional(),
})

export async function businessRoutes(fastify: FastifyInstance) {
  const svc = new BusinessesService()
  fastify.addHook('preHandler', authenticate)

  fastify.get('/', async (req, reply) => {
    const { page, limit } = paginationSchema.parse(req.query)
    const filters = filterSchema.parse(req.query)
    return reply.send({ success: true, data: await svc.getBusinesses(req.user.sub, { ...filters, page, limit }) })
  })

  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send({ success: true, data: await svc.getBusinessById(id, req.user.sub) })
  })

  fastify.post('/export', async (req, reply) => {
    const { format } = exportSchema.parse(req.body)
    const { jobId } = req.body as { jobId: string }
    if (!jobId) return reply.code(400).send({ success: false, message: 'jobId required' })
    return reply.send({ success: true, data: await svc.exportBusinesses(req.user.sub, jobId, format) })
  })

  fastify.post('/:id/retry-telegram', async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send({ success: true, data: await svc.retryTelegram(id, req.user.sub) })
  })
}
