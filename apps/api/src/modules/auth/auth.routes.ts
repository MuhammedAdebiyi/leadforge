import type { FastifyInstance } from 'fastify'
import { AuthService } from './auth.service'
import { registerSchema, loginSchema } from '@leadforge/shared'
import { authenticate } from '../../middleware/auth'

export async function authRoutes(fastify: FastifyInstance) {
  const svc = new AuthService(fastify)

  fastify.post('/register', async (req, reply) => {
    const input = registerSchema.parse(req.body)
    const result = await svc.register(input)
    return reply.code(201).send({ success: true, data: result })
  })

  fastify.post('/login', async (req, reply) => {
    const input = loginSchema.parse(req.body)
    const result = await svc.login(input)
    return reply.send({ success: true, data: result })
  })

  fastify.post('/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }
    if (!refreshToken) return reply.code(400).send({ success: false, message: 'refreshToken required' })
    const result = await svc.refreshTokens(refreshToken)
    return reply.send({ success: true, data: result })
  })

  fastify.post('/logout', { preHandler: [authenticate] }, async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }
    await svc.logout(refreshToken)
    return reply.send({ success: true, message: 'Logged out' })
  })

  fastify.get('/me', { preHandler: [authenticate] }, async (req, reply) => {
    const user = await svc.getProfile(req.user.sub)
    return reply.send({ success: true, data: user })
  })

  fastify.patch('/telegram', { preHandler: [authenticate] }, async (req, reply) => {
    const { chatId } = req.body as { chatId: string }
    if (!chatId) return reply.code(400).send({ success: false, message: 'chatId required' })
    const result = await svc.connectTelegram(req.user.sub, chatId)
    return reply.send({ success: true, data: result })
  })

  fastify.post('/verify-email', async (req, reply) => {
    const { token } = req.body as { token: string }
    if (!token) return reply.code(400).send({ success: false, message: 'token required' })
    const result = await svc.verifyEmail(token)
    return reply.send({ success: true, data: result })
  })

  fastify.post('/forgot-password', async (req, reply) => {
    const { email } = req.body as { email: string }
    if (!email) return reply.code(400).send({ success: false, message: 'email required' })
    const result = await svc.requestPasswordReset(email)
    return reply.send({ success: true, data: result })
  })

  fastify.post('/reset-password', async (req, reply) => {
    const { token, password } = req.body as { token: string; password: string }
    if (!token || !password) return reply.code(400).send({ success: false, message: 'token and password required' })
    const result = await svc.resetPassword(token, password)
    return reply.send({ success: true, data: result })
  })
}
