import { prisma, createLogger } from '@leadforge/shared'
import crypto from 'crypto'

const logger = createLogger('billing-service')

const PAYSTACK_BASE_URL = 'https://api.paystack.co'
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!
const PLAN_CODE = process.env.PAYSTACK_PLAN_CODE!
const FRONTEND_URL = process.env.FRONTEND_URL!

async function paystackFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await res.json()
  if (!res.ok || !data.status) {
    logger.error({ path, status: res.status, data }, 'Paystack API error')
    throw { statusCode: 502, message: data.message ?? 'Payment provider error — please try again' }
  }
  return data.data
}

export class BillingService {
  async createCheckoutSession(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { statusCode: 404, message: 'User not found' }

    const session = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: user.email,
        plan: PLAN_CODE,
        amount: '150000', // ₦1,500 in kobo — required even with a plan code
        callback_url: `${FRONTEND_URL}/dashboard?subscribed=true`,
        metadata: { userId },
      }),
    })

    logger.info({ userId, reference: session.reference }, 'Checkout initialized')
    return { checkout_url: session.authorization_url, reference: session.reference }
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto.createHmac('sha512', SECRET_KEY).update(rawBody).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  }

  async handleWebhookEvent(event: any) {
    const { event: eventType, data } = event
    logger.info({ eventType }, 'Received Paystack webhook event')

    // This Paystack account is shared with CourseVault — only act on events
    // tied to LeadForge's plan. Everything else is silently ignored.
    const planCode = data.plan?.plan_code ?? data.plan_code
    if (planCode && planCode !== PLAN_CODE) {
      logger.debug({ planCode }, 'Event belongs to a different product — ignoring')
      return
    }

    const userId = data.metadata?.userId

    switch (eventType) {
      case 'charge.success':
      case 'subscription.create': {
        if (!userId) {
          logger.warn({ event }, 'Webhook missing metadata.userId — cannot map to user')
          return
        }
        const expiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionExpiresAt: expiresAt,
            bachsCustomerId: data.customer?.customer_code ?? undefined,
          },
        })
        logger.info({ userId, expiresAt }, 'Subscription activated')
        break
      }

      case 'subscription.disable':
      case 'invoice.payment_failed': {
        // These events reference the subscription's customer, not our
        // metadata directly — look up by customer code if userId absent.
        const customerCode = data.customer?.customer_code
        const user = userId
          ? { id: userId }
          : await prisma.user.findFirst({ where: { bachsCustomerId: customerCode } })

        if (!user) {
          logger.warn({ event }, 'Could not map webhook event to a user')
          return
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus: 'EXPIRED' },
        })
        logger.info({ userId: user.id }, 'Subscription marked expired')
        break
      }

      default:
        logger.debug({ eventType }, 'Unhandled webhook event type — ignoring')
    }
  }
}
