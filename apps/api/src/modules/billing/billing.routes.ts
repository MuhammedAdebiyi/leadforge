import type { FastifyInstance } from 'fastify'
import { BillingService } from './billing.service'
import { authenticate } from '../../middleware/auth'

export async function billingRoutes(fastify: FastifyInstance) {
  const svc = new BillingService()

  // Checkout requires a logged-in user — but NOT an active subscription,
  // obviously, since this is how they get one.
  fastify.post('/checkout', { preHandler: authenticate }, async (req, reply) => {
    const session = await svc.createCheckoutSession(req.user.sub)
    return reply.send({ success: true, data: session })
  })

  // Webhook is called by Bachs directly, never by a logged-in browser —
  // no auth hook here. Signature verification is the security boundary.
  fastify.post('/webhook', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const signature = req.headers['x-paystack-signature'] as string | undefined
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body)

    if (!signature || !svc.verifyWebhookSignature(rawBody, signature)) {
      return reply.code(401).send({ success: false, message: 'Invalid signature' })
    }

    await svc.handleWebhookEvent(req.body)
    return reply.send({ received: true })
  })
}
