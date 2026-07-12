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
