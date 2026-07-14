import { buildApp } from './app'
import { connectDatabase, disconnectDatabase, testRedisConnection,
         connectRabbitMQ, closeRabbitMQ, createLogger } from '@leadforge/shared'
import { env } from './config'

const logger = createLogger('leadforge-api')

async function start() {
  logger.info(' Starting LeadForge API...')

  await connectDatabase(logger)
  await testRedisConnection(logger)
  await connectRabbitMQ(logger)

  const app = await buildApp()

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    logger.info(`LeadForge API on :${env.PORT} [${env.NODE_ENV}]`)
  } catch (err) {
    logger.error({ err }, 'Failed to start')
    process.exit(1)
  }
}

const shutdown = async (sig: string) => {
  logger.info({ sig }, 'Shutting down')
  await disconnectDatabase()
  await closeRabbitMQ()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', (err) => { logger.error({ err }, 'Uncaught'); process.exit(1) })
process.on('unhandledRejection', (r) => { logger.error({ r }, 'Unhandled'); process.exit(1) })

start()
