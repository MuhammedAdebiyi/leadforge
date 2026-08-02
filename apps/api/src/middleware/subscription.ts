import type { FastifyRequest, FastifyReply } from 'fastify'
import { ensureSubscriptionStatus } from '@leadforge/shared'

/**
 * Runs AFTER `authenticate` — assumes req.user is already populated.
 * Blocks access to gated routes unless the user's subscription is ACTIVE.
 * Never apply this to /api/auth or /api/billing routes — those must stay
 * reachable regardless of subscription status (you need auth to log in,
 * and billing to pay in the first place).
 */
export async function requireActiveSubscription(req: FastifyRequest, reply: FastifyReply) {
  const status = await ensureSubscriptionStatus(req.user.sub)

  if (status !== 'ACTIVE') {
    return reply.code(402).send({
      success: false,
      message: 'Your subscription has ended. Please resubscribe to continue.',
      subscriptionStatus: status,
    })
  }
}
