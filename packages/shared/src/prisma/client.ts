import { PrismaClient } from '@prisma/client'

// Singleton — safe to import in any worker
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export async function connectDatabase(logger: { info: Function; error: Function }) {
  try {
    await prisma.$connect()
    logger.info('Database connected (Supabase)')
  } catch (error) {
    logger.error({ error }, ' Database connection failed')
    process.exit(1)
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect()
}