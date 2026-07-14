import amqp, { Channel } from 'amqplib'
import { env } from '../env'

export { Channel }

export const QUEUES = {
  JOB: 'job.queue',
  BUSINESS: 'business.queue',
  WEBSITE: 'website.queue',
  EMAIL: 'email.queue',
  TELEGRAM: 'telegram.queue',
  EXPORT: 'export.queue',
  RETRY: 'retry.queue',
  DEAD_LETTER: 'dead.letter.queue',
} as const

export const EXCHANGES = {
  LEADFORGE: 'leadforge.direct',
  DEAD_LETTER: 'leadforge.dlx',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null
let channel: Channel | null = null

const BASE_QUEUES_TO_ASSERT = [
  QUEUES.JOB,
  QUEUES.BUSINESS,
  QUEUES.WEBSITE,
  QUEUES.EMAIL,
  QUEUES.TELEGRAM,
  QUEUES.EXPORT,
]

export async function connectRabbitMQ(
  logger: { info: Function; error: Function; warn: Function },
  extraQueues: string[] = []
): Promise<Channel> {
  connection = await amqp.connect(env.CLOUDAMQP_URL)
  channel = await connection.createChannel()

  await channel.prefetch(1)

  // Exchanges
  await channel.assertExchange(EXCHANGES.DEAD_LETTER, 'direct', { durable: true })
  await channel.assertExchange(EXCHANGES.LEADFORGE, 'direct', { durable: true })

  const queueOpts = {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': EXCHANGES.DEAD_LETTER,
      'x-dead-letter-routing-key': QUEUES.DEAD_LETTER,
      'x-message-ttl': 1000 * 60 * 60 * 24,
    },
  }

  for (const q of [...BASE_QUEUES_TO_ASSERT, ...extraQueues]) {
    await channel.assertQueue(q, queueOpts)
  }
  await channel.assertQueue(QUEUES.DEAD_LETTER, { durable: true })

  connection.on('error', (err) => {
    logger.error({ err }, 'RabbitMQ connection error')
    setTimeout(() => connectRabbitMQ(logger, extraQueues), 5000)
  })
  connection.on('close', () => {
    logger.warn('RabbitMQ closed — reconnecting in 5s')
    setTimeout(() => connectRabbitMQ(logger, extraQueues), 5000)
  })

  logger.info('RabbitMQ connected (CloudAMQP)')
  return channel
}

export async function closeRabbitMQ() {
  await channel?.close()
  await connection?.close()
}

export function publish(queue: string, message: unknown, correlationId?: string): boolean {
  if (!channel) throw new Error('RabbitMQ channel not initialized')
  return channel.sendToQueue(
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