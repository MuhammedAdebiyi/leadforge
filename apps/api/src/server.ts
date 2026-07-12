import { buildApp } from './app'
import { connectDatabase, disconnectDatabase } from './lib/prisma'
import { testRedisConnection } from './lib/redis/client'
import { connectRabbitMQ, closeRabbitMQ } from './lib/rabbitmq/client'
import { config } from './config'
import { logger } from './lib/logger'

async function start() {
  logger.info(' Starting LeadForge API...')

  await connectDatabase()
  await testRedisConnection()
  await connectRabbitMQ()

  const app = await buildApp()

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
    logger.info(` LeadForge API on :${config.PORT} [${config.NODE_ENV}]`)
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
process.on('unhandledRejection', (r) => { logger.error({ r }, 'Unhandled rejection'); process.exit(1) })

start()
