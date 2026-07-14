import amqp, { Channel } from 'amqplib'
import { env } from '../config/env'
import { QUEUES, EXCHANGES } from '../constants/queues'
import type { AppLogger } from '../logger'

export type { Channel }

let _channel: Channel | null = null

const BASE_QUEUES = [
  QUEUES.JOB, QUEUES.BUSINESS, QUEUES.WEBSITE,
  QUEUES.EMAIL, QUEUES.TELEGRAM, QUEUES.EXPORT,
]

const QUEUE_OPTS = {
  durable: true,
  arguments: {
    'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER,
    'x-dead-letter-routing-key': QUEUES.DEAD_LETTER,
    'x-message-ttl': 1000 * 60 * 60 * 24,
  },
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function connectRabbitMQ(
  logger: AppLogger,
  extraQueues: string[] = []
): Promise<Channel> {
  while (true) {
    try {
      const connection = await amqp.connect(env.CLOUDAMQP_URL)
      const channel = await connection.createChannel()

      await channel.prefetch(1)
      await channel.assertExchange(EXCHANGES.DEAD_LETTER, 'direct', { durable: true })
      await channel.assertExchange(EXCHANGES.LEADFORGE, 'direct', { durable: true })

      for (const q of [...BASE_QUEUES, ...extraQueues]) {
        await channel.assertQueue(q, QUEUE_OPTS)
      }
      await channel.assertQueue(QUEUES.DEAD_LETTER, { durable: true })

      connection.on('error', (err) => logger.error({ err }, 'RabbitMQ error'))
      connection.on('close', () => {
        logger.warn('RabbitMQ closed — reconnecting in 5s')
        _channel = null
        connectRabbitMQ(logger, extraQueues)
          .then(ch => { _channel = ch })
          .catch(err => logger.error({ err }, 'Reconnect failed'))
      })

      _channel = channel
      logger.info(' RabbitMQ connected (CloudAMQP)')
      return channel
    } catch (err) {
      logger.warn({ err }, 'RabbitMQ unavailable — retrying in 5s')
      await sleep(5000)
    }
  }
}

export async function closeRabbitMQ(): Promise<void> {
  await _channel?.close()
  _channel = null
}

export function publish(queue: string, message: unknown, correlationId?: string): boolean {
  if (!_channel) throw new Error('RabbitMQ channel not initialized')
  return _channel.sendToQueue(
    queue,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: true,
      contentType: 'application/json',
      correlationId: correlationId ?? crypto.randomUUID(),
      timestamp: Date.now(),
    }
  )
}
