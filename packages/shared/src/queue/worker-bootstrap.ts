import { connectDatabase, disconnectDatabase } from '../database/prisma'
import { connectRabbitMQ, closeRabbitMQ } from './rabbitmq'
import { createLogger, AppLogger } from '../logger'
import type { Channel, ConsumeMessage } from 'amqplib'

export interface WorkerConfig {
  name: string
  queue: string
  onMessage: (msg: ConsumeMessage, channel: Channel, logger: AppLogger) => Promise<void>
  onStart?: (logger: AppLogger) => Promise<void>
  onShutdown?: (logger: AppLogger) => Promise<void>
  maxRetries?: number
  baseBackoffMs?: number
}

export async function createWorker(config: WorkerConfig): Promise<void> {
  const { name, queue, onMessage, onStart, onShutdown, maxRetries = 3, baseBackoffMs = 5000 } = config
  const logger = createLogger(name)

  logger.info(` ${name} starting...`)

  await connectDatabase(logger)

  const setupConsumer = async (ch: Channel): Promise<void> => {
    logger.info(` Listening on queue: ${queue}`)

    await ch.consume(queue, async (msg) => {
      if (!msg) return

      try {
        await onMessage(msg, ch, logger)
        ch.ack(msg)
      } catch (err) {
        logger.error({ err }, `${name}: message failed`)

        const retryCount = ((msg.properties.headers?.['x-retry-count'] as number) ?? 0)

        if (retryCount < maxRetries) {
          const backoffMs = Math.pow(2, retryCount) * baseBackoffMs
          logger.warn({ retryCount, backoffMs }, 'Requeueing with backoff')
          setTimeout(() => {
            ch.sendToQueue(queue, msg.content, {
              persistent: true,
              headers: { 'x-retry-count': retryCount + 1 },
              contentType: msg.properties.contentType,
            })
          }, backoffMs)
          ch.ack(msg)
        } else {
          logger.error({ retryCount }, 'Max retries exceeded → DLQ')
          ch.nack(msg, false, false)
        }
      }
    })
  }

  await connectRabbitMQ(logger, [], setupConsumer)

  if (onStart) await onStart(logger)

  const shutdown = async (sig: string) => {
    logger.info({ sig }, `Shutting down ${name}...`)
    if (onShutdown) await onShutdown(logger)
    await closeRabbitMQ()
    await disconnectDatabase()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('uncaughtException', (err) => { logger.error({ err }, 'Uncaught exception'); process.exit(1) })
  process.on('unhandledRejection', (r) => { logger.error({ r }, 'Unhandled rejection'); process.exit(1) })
}
