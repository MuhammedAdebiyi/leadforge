import type { FastifyInstance } from 'fastify'
import { BillingService } from './billing.service'

export async function billingRoutes(fastify: FastifyInstance) {
  const svc = new BillingService()

  fastify.post('/checkout', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const session = await svc.createCheckoutSession(req.user.sub)
    return reply.send({ success: true, data: session })
  })

  // Raw body needed for signature verification — bypass the default JSON parser for this route.
  fastify.post('/webhook', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const signature = req.headers['x-bachs-signature'] as string | undefined
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body)

    if (!signature || !svc.verifyWebhookSignature(rawBody, signature)) {
      return reply.code(401).send({ success: false, message: 'Invalid signature' })
    }

    await svc.handleWebhookEvent(req.body)
    return reply.send({ received: true })
  })
}
