import { prisma, createLogger } from '@leadforge/shared'
import crypto from 'crypto'

const logger = createLogger('billing-service')

const BACHS_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.bachs.io'
  : 'https://sandbox-api.bachs.io'

const SECRET_KEY = process.env.BACHS_SECRET_KEY!
const PRODUCT_ID = process.env.BACHS_PRODUCT_ID!
const WEBHOOK_SECRET = process.env.BACHS_WEBHOOK_SECRET!
const FRONTEND_URL = process.env.FRONTEND_URL!

async function bachsFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BACHS_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await res.json()
  if (!res.ok) {
    logger.error({ path, status: res.status, data }, 'Bachs API error')
    throw { statusCode: 502, message: data.detail ?? 'Payment provider error — please try again' }
  }
  return data
}

export class BillingService {
  async createCheckoutSession(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { statusCode: 404, message: 'User not found' }

    const customer = user.bachsCustomerId
      ? { customer_id: user.bachsCustomerId }
      : { email: user.email, name: user.name }

    const session = await bachsFetch('/v1/checkout-sessions', {
      method: 'POST',
      body: JSON.stringify({
        customer,
        product_cart: [{ product_id: PRODUCT_ID, quantity: 1 }],
        success_url: `${FRONTEND_URL}/dashboard?subscribed=true`,
        cancel_url: `${FRONTEND_URL}/settings`,
        metadata: { userId },
        reference: userId,
      }),
    })

    logger.info({ userId, checkoutId: session.checkout_id }, 'Checkout session created')
    return session
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  }

  async handleWebhookEvent(event: any) {
    logger.info({ type: event.type ?? event.event }, 'Received Bachs webhook event')

    // NOTE: field names here are still best-guess — the confirmed OpenAPI spec
    // we pulled covers checkout-sessions, not the webhook payload shape itself.
    // Send a real test event from the Bachs dashboard (Developer Portal →
    // Webhooks → your endpoint → Send test event) and compare against what
    // actually arrives before trusting this in production.
    const eventType = event.type ?? event.event
    const data = event.data?.object ?? event.data

    switch (eventType) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const userId = data.metadata?.userId
        const expiresAt = data.current_period_end
          ? new Date(data.current_period_end * 1000)
          : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)

        if (!userId) {
          logger.warn({ event }, 'Webhook missing metadata.userId — cannot map to user')
          return
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionExpiresAt: expiresAt,
            bachsCustomerId: data.customer_id ?? data.customer ?? undefined,
          },
        })
        logger.info({ userId, expiresAt }, 'Subscription activated/updated')
        break
      }

      case 'customer.subscription.deleted': {
        const userId = data.metadata?.userId
        if (!userId) return

        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionStatus: 'EXPIRED' },
        })
        logger.info({ userId }, 'Subscription marked expired')
        break
      }

      default:
        logger.debug({ eventType }, 'Unhandled webhook event type — ignoring')
    }
  }
}
