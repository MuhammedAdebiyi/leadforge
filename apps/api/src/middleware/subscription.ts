import type { FastifyRequest, FastifyReply } from 'fastify'
import { ensureSubscriptionStatus, prisma } from '@leadforge/shared'

/**
 * Runs AFTER `authenticate`. Blocks access unless BOTH:
 * 1. Email is verified
 * 2. Subscription is ACTIVE
 * Never apply to /api/auth or /api/billing routes.
 */
export async function requireActiveSubscription(req: FastifyRequest, reply: FastifyReply) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { isVerified: true },
  })

  if (!user?.isVerified) {
    return reply.code(403).send({
      success: false,
      message: 'Please verify your email before continuing. Check your inbox for the verification link.',
      reason: 'EMAIL_NOT_VERIFIED',
    })
  }

  const status = await ensureSubscriptionStatus(req.user.sub)

  if (status !== 'ACTIVE') {
    return reply.code(402).send({
      success: false,
      message: 'Your subscription has ended. Please resubscribe to continue.',
      reason: 'SUBSCRIPTION_INACTIVE',
      subscriptionStatus: status,
    })
  }
}
