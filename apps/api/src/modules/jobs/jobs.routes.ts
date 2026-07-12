import type { FastifyInstance } from 'fastify'
import { JobsService } from './jobs.service'
import { createJobSchema, paginationSchema } from '@leadforge/shared'
import { authenticate } from '../../middleware/auth'

export async function jobRoutes(fastify: FastifyInstance) {
  const svc = new JobsService()
  fastify.addHook('preHandler', authenticate)

  fastify.get('/dashboard', async (req, reply) => {
    return reply.send({ success: true, data: await svc.getDashboardStats(req.user.sub) })
  })

  fastify.post('/', async (req, reply) => {
    const job = await svc.createJob(req.user.sub, createJobSchema.parse(req.body))
    return reply.code(201).send({ success: true, data: job })
  })

  fastify.get('/', async (req, reply) => {
    const { page, limit } = paginationSchema.parse(req.query)
    return reply.send({ success: true, data: await svc.getJobs(req.user.sub, page, limit) })
  })

  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send({ success: true, data: await svc.getJobById(id, req.user.sub) })
  })

  fastify.post('/:id/pause', async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send({ success: true, data: await svc.pauseJob(id, req.user.sub) })
  })

  fastify.post('/:id/resume', async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send({ success: true, data: await svc.resumeJob(id, req.user.sub) })
  })

  fastify.post('/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send({ success: true, data: await svc.cancelJob(id, req.user.sub) })
  })

  fastify.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await svc.deleteJob(id, req.user.sub)
    return reply.code(204).send()
  })
}
