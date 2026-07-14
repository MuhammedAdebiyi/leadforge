import bcrypt from 'bcryptjs'
import { prisma, redis, TTL, createLogger } from '@leadforge/shared'
import type { RegisterInput, LoginInput } from '@leadforge/shared'
import type { FastifyInstance } from 'fastify'

const logger = createLogger('auth-service')

export class AuthService {
  constructor(private fastify: FastifyInstance) {}

  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } })
    if (existing) throw { statusCode: 409, message: 'Email already registered' }

    const passwordHash = await bcrypt.hash(input.password, 12)
    const user = await prisma.user.create({
      data: { email: input.email, passwordHash, name: input.name },
      select: { id: true, email: true, name: true, createdAt: true },
    })

    logger.info({ userId: user.id }, 'User registered')
    const tokens = await this.generateTokens(user.id)
    return { user, ...tokens }
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } })
    if (!user) throw { statusCode: 401, message: 'Invalid credentials' }

    const valid = await bcrypt.compare(input.password, user.passwordHash)
    if (!valid) throw { statusCode: 401, message: 'Invalid credentials' }

    logger.info({ userId: user.id }, 'User logged in')
    const tokens = await this.generateTokens(user.id)
    return {
      user: { id: user.id, email: user.email, name: user.name, telegramChatId: user.telegramChatId },
      ...tokens,
    }
  }

  async refreshTokens(token: string) {
    const stored = await prisma.refreshToken.findUnique({ where: { token }, include: { user: true } })
    if (!stored || stored.expiresAt < new Date()) {
      throw { statusCode: 401, message: 'Invalid or expired refresh token' }
    }
    await prisma.refreshToken.delete({ where: { token } })
    return this.generateTokens(stored.userId)
  }

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, telegramChatId: true,
        isVerified: true, createdAt: true,
        _count: { select: { jobs: true } },
      },
    })
    if (!user) throw { statusCode: 404, message: 'User not found' }
    return user
  }

  async connectTelegram(userId: string, chatId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: chatId },
      select: { id: true, telegramChatId: true },
    })
  }

  private async generateTokens(userId: string) {
    const accessToken = this.fastify.jwt.sign({ sub: userId }, { expiresIn: '15m' })
    const refreshToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    await prisma.refreshToken.create({ data: { token: refreshToken, userId, expiresAt } })
    await redis.setex(`session:${userId}`, TTL.SESSION, userId)

    return { accessToken, refreshToken }
  }
}
