import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rawBody from 'fastify-raw-body'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { config, env } from './config'
import { createLogger } from '@leadforge/shared'
import { registerErrorHandler } from './middleware/errorHandler'
import { authRoutes } from './modules/auth/auth.routes'
import { jobRoutes } from './modules/jobs/jobs.routes'
import { businessRoutes } from './modules/businesses/businesses.routes'
import { billingRoutes } from './modules/billing/billing.routes'

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

  // Needed so webhook signature verification (Bachs) can access the exact
  // raw bytes of the request body — JSON.stringify(req.body) after Fastify's
  // default parser has already touched it is NOT guaranteed to match the
  // bytes the signature was computed over.
  await fastify.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  })

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
  await fastify.register(billingRoutes, { prefix: '/api/billing' })

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
