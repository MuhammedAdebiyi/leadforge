import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { createLogger } from '@leadforge/shared'

const logger = createLogger('leadforge-api')

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

    // Our manually thrown errors: throw { statusCode: 404, message: '...' }
    if (
      error !== null &&
      typeof error === 'object' &&
      'statusCode' in error &&
      typeof (error as any).statusCode === 'number'
    ) {
      const e = error as { statusCode: number; message?: string }
      return reply.code(e.statusCode).send({
        success: false,
        message: e.message ?? 'Error',
        correlationId,
      })
    }

    logger.error({ error, correlationId, path: request.url }, 'Unhandled error')
    return reply.code(500).send({
      success: false,
      message: 'Internal server error',
      correlationId,
    })
  })
}
