import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { config, env } from './config'
import { createLogger } from '@leadforge/shared'
import { registerErrorHandler } from './middleware/errorHandler'
import { authRoutes } from './modules/auth/auth.routes'
import { jobRoutes } from './modules/jobs/jobs.routes'
import { businessRoutes } from './modules/businesses/businesses.routes'

const logger = createLogger('leadforge-api')

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }
    user: { sub: string }
  }
}

export async function buildApp() {
  const fastify = Fastify({
    logger: false,
    genReqId: () => crypto.randomUUID(),
  })

  await fastify.register(helmet, { contentSecurityPolicy: false })

  await fastify.register(cors, {
    origin: env.NODE_ENV === 'production' ? env.FRONTEND_URL : true,
    credentials: true,
  })

  await fastify.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: () => ({ success: false, message: 'Too many requests.' }),
  })

  await fastify.register(jwt, { secret: config.JWT_SECRET })

  registerErrorHandler(fastify)

  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'leadforge-api',
    env: env.NODE_ENV,
  }))

  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(jobRoutes, { prefix: '/api/jobs' })
  await fastify.register(businessRoutes, { prefix: '/api/businesses' })

  fastify.addHook('onRequest', (req, _reply, done) => {
    logger.info({ method: req.method, url: req.url, reqId: req.id }, 'Incoming')
    done()
  })

  fastify.addHook('onResponse', (req, reply, done) => {
    logger.info({ method: req.method, url: req.url, status: reply.statusCode, ms: reply.elapsedTime }, 'Done')
    done()
  })

  return fastify
}
