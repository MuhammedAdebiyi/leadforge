import { prisma, createLogger } from '@leadforge/shared'
import crypto from 'crypto'

const logger = createLogger('billing-service')

const BACHS_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.bachs.io/v1'
  : 'https://sandbox-api.bachs.io/v1'

const SECRET_KEY = process.env.BACHS_SECRET_KEY!
const PRODUCT_ID = process.env.BACHS_PRODUCT_ID!
const WEBHOOK_SECRET = process.env.BACHS_WEBHOOK_SECRET!

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
    throw { statusCode: 502, message: 'Payment provider error — please try again' }
  }
  return data
}

export class BillingService {
  async createCheckoutSession(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw { statusCode: 404, message: 'User not found' }

    // NOTE: endpoint path inferred from Bachs' documented /v1/ REST pattern
    // and their SDK's checkout.create() naming — not yet confirmed against
    // a real successful call. Verify with a sandbox test before trusting
    // this in production.
    const session = await bachsFetch('/checkout/sessions', {
      method: 'POST',
      body: JSON.stringify({
        product: PRODUCT_ID,
        billing: 'subscription',
        tax: 'auto',
        crypto: true,
        settlement: 'NGN',
        customer_email: user.email,
        metadata: { userId },
      }),
    })

    logger.info({ userId, sessionId: session.id }, 'Checkout session created')
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

    // NOTE: field names below (event.type, event.data, customer_email,
    // current_period_end) are best-guess based on common webhook conventions
    // and Bachs' documented event names. Confirm against a real test webhook
    // delivery from the Bachs dashboard before going live.
    const eventType = event.type ?? event.event
    const data = event.data?.object ?? event.data

    switch (eventType) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const email = data.customer_email ?? data.customer?.email
        const expiresAt = data.current_period_end
          ? new Date(data.current_period_end * 1000)
          : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000)

        if (!email) {
          logger.warn({ event }, 'Webhook missing customer email — cannot map to user')
          return
        }

        await prisma.user.updateMany({
          where: { email },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionExpiresAt: expiresAt,
            bachsCustomerId: data.customer ?? data.customer_id ?? undefined,
          },
        })
        logger.info({ email, expiresAt }, 'Subscription activated/updated')
        break
      }

      case 'customer.subscription.deleted': {
        const email = data.customer_email ?? data.customer?.email
        if (!email) return

        await prisma.user.updateMany({
          where: { email },
          data: { subscriptionStatus: 'EXPIRED' },
        })
        logger.info({ email }, 'Subscription marked expired')
        break
      }

      default:
        logger.debug({ eventType }, 'Unhandled webhook event type — ignoring')
    }
  }
}
