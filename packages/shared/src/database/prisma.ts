import { PrismaClient } from '@prisma/client'
import type { AppLogger } from '../logger'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export async function connectDatabase(logger: AppLogger): Promise<void> {
  try {
    await prisma.$connect()
    logger.info(' Database connected (Supabase)')
  } catch (error) {
    logger.error({ error }, ' Database connection failed')
    process.exit(1)
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}
