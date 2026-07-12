import * as amqp from 'amqplib'
import type { Channel, ChannelModel } from 'amqplib'
import { config } from '../../config'
import { logger } from '../logger'
import { QUEUES, EXCHANGES } from '@leadforge/shared'

let connection: ChannelModel | null = null
let channel: Channel | null = null

async function connect(): Promise<void> {
  try {
    const conn = await amqp.connect(config.CLOUDAMQP_URL)
    connection = conn

    const ch = await conn.createChannel()
    channel = ch

    logger.info('RabbitMQ connected (CloudAMQP)')

    await ch.assertExchange(EXCHANGES.DEAD_LETTER, 'direct', { durable: true })
    await ch.assertExchange(EXCHANGES.LEADFORGE, 'direct', { durable: true })

    const opts = {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER,
        'x-dead-letter-routing-key': QUEUES.DEAD_LETTER,
        'x-message-ttl': 1000 * 60 * 60 * 24,
      },
    }

    for (const q of [
      QUEUES.JOB,
      QUEUES.BUSINESS,
      QUEUES.WEBSITE,
      QUEUES.EMAIL,
      QUEUES.TELEGRAM,
      QUEUES.EXPORT,
    ]) {
      await ch.assertQueue(q, opts)
    }

    await ch.assertQueue(QUEUES.DEAD_LETTER, { durable: true })
    await ch.prefetch(1)

    conn.on('error', (err) => {
      logger.error({ err }, 'RabbitMQ error')
      setTimeout(connect, 5000)
    })

    conn.on('close', () => {
      logger.warn('RabbitMQ closed — reconnecting')
      setTimeout(connect, 5000)
    })
  } catch (error) {
    logger.error({ error }, 'RabbitMQ failed — retrying in 5s')
    setTimeout(connect, 5000)
  }
}

export const connectRabbitMQ = connect

export function getChannel(): Channel {
  if (!channel) throw new Error('RabbitMQ channel not initialized')
  return channel
}

export async function publishToQueue(queue: string, message: unknown, opts?: { correlationId?: string }): Promise<boolean> {
  const ch = getChannel()
  return ch.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
    contentType: 'application/json',
    correlationId: opts?.correlationId ?? crypto.randomUUID(),
    timestamp: Date.now(),
  })
}

export async function closeRabbitMQ(): Promise<void> {
  await channel?.close()
  await connection?.close()
}
