import bcrypt from 'bcryptjs'
import { sendVerificationEmail, sendPasswordResetEmail } from '../email/email.service'
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

    const verificationToken = crypto.randomUUID()
    await prisma.emailVerificationToken.create({
      data: {
        token: verificationToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
    await sendVerificationEmail(user.email, user.name, verifyUrl)

    logger.info({ userId: user.id }, 'User registered')
    const tokens = await this.generateTokens(user.id)
    return { user, ...tokens }
  }

  async verifyEmail(token: string) {
    const record = await prisma.emailVerificationToken.findUnique({ where: { token } })
    if (!record || record.expiresAt < new Date()) {
      throw { statusCode: 400, message: 'Verification link is invalid or expired' }
    }

    await prisma.user.update({ where: { id: record.userId }, data: { isVerified: true } })
    await prisma.emailVerificationToken.delete({ where: { token } })

    return { success: true }
  }

  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    // Always return success even if no user found — don't leak which
    // emails are registered.
    if (!user) return { success: true }

    const token = crypto.randomUUID()
    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    })

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`
    await sendPasswordResetEmail(user.email, user.name, resetUrl)

    logger.info({ userId: user.id }, 'Password reset requested')
    return { success: true }
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordResetToken.findUnique({ where: { token } })
    if (!record || record.expiresAt < new Date()) {
      throw { statusCode: 400, message: 'Reset link is invalid or expired' }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: record.userId }, data: { passwordHash } })
    await prisma.passwordResetToken.delete({ where: { token } })

    // Invalidate all existing sessions on password change — good security practice.
    await prisma.refreshToken.deleteMany({ where: { userId: record.userId } })

    logger.info({ userId: record.userId }, 'Password reset completed')
    return { success: true }
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
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } })
    if (!user) throw { statusCode: 404, message: 'User not found' }
    if (user.telegramChatId) {
      throw { statusCode: 400, message: 'Telegram is already connected and cannot be changed. Contact support if you need this updated.' }
    }

    const existing = await prisma.user.findUnique({ where: { telegramChatId: chatId }, select: { id: true } })
    if (existing) {
      throw { statusCode: 409, message: 'This Telegram chat ID is already connected to another account.' }
    }

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
