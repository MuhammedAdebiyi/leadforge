import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'

import { config } from './config'
import { logger } from './lib/logger'

import { registerErrorHandler } from './middleware/errorHandler'
import { authRoutes } from './modules/auth/auth.routes'
import { jobRoutes } from './modules/jobs/jobs.routes'
import { businessRoutes } from './modules/businesses/businesses.routes'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string
    }

    user: {
      sub: string
    }
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: false,
    genReqId: () => crypto.randomUUID(),
  })

  //
  // Security
  //
  await app.register(helmet, {
    contentSecurityPolicy: false,
  })

  await app.register(cors, {
    origin:
      config.NODE_ENV === 'production'
        ? config.FRONTEND_URL
        : true,
    credentials: true,
  })

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: () => ({
      success: false,
      message: 'Too many requests.',
    }),
  })

  await app.register(jwt, {
    secret: config.JWT_SECRET,
  })

  //
  // Swagger
  //
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',

      info: {
        title: 'LeadForge API',
        description:
          'Distributed lead generation platform API.',
        version: '1.0.0',
      },

      servers: [
        {
          url: `http://localhost:${config.PORT}`,
        },
      ],

      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },

      security: [
        {
          BearerAuth: [],
        },
      ],
    },
  })

  await app.register(swaggerUI, {
    routePrefix: '/docs',

    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },

    staticCSP: true,
    transformSpecificationClone: true,
  })

  registerErrorHandler(app)

  //
  // Health
  //
  app.get('/health', async () => ({
    status: 'ok',
    service: 'leadforge-api',
    timestamp: new Date().toISOString(),
  }))

  //
  // Routes
  //
  await app.register(authRoutes, {
    prefix: '/api/auth',
  })

  await app.register(jobRoutes, {
    prefix: '/api/jobs',
  })

  await app.register(businessRoutes, {
    prefix: '/api/businesses',
  })

  //
  // Logging
  //
  app.addHook('onRequest', (req, _, done) => {
    logger.info(
      {
        method: req.method,
        url: req.url,
        reqId: req.id,
      },
      'Incoming request'
    )

    done()
  })

  app.addHook('onResponse', (req, reply, done) => {
    logger.info(
      {
        method: req.method,
        url: req.url,
        status: reply.statusCode,
        duration: reply.elapsedTime,
      },
      'Request completed'
    )

    done()
  })

  return app
}