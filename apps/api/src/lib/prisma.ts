import { PrismaClient } from '@prisma/client'
import { logger } from './logger'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  prisma.$on('query', (e) => {
    logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'DB Query')
  })
}

export async function connectDatabase() {
  try {
    await prisma.$connect()
    logger.info('✅ Database connected (Supabase)')
  } catch (error) {
    logger.error({ error }, '❌ Database connection failed')
    process.exit(1)
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect()
}
