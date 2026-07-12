import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { logger } from '../lib/logger'

export function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error, request, reply) => {
    const correlationId = request.id

    if (error instanceof ZodError) {
      return reply.code(400).send({
        success: false,
        message: 'Validation failed',
        errors: error.flatten().fieldErrors,
        correlationId,
      })
    }

    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ success: false, message: error.message, correlationId })
    }

    logger.error({ error, correlationId, path: request.url }, 'Unhandled error')
    return reply.code(500).send({ success: false, message: 'Internal server error', correlationId })
  })
}
