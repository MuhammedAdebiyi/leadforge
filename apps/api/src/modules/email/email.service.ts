import { Resend } from 'resend'
import { createLogger } from '@leadforge/shared'

const logger = createLogger('email-service')
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'LeadForge <notifications@leadforge.cv>'

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Verify your LeadForge account',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Welcome to LeadForge, ${name}</h2>
          <p>Confirm your email to secure your account:</p>
          <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:4px;">Verify Email</a></p>
          <p style="color:#666;font-size:13px;">This link expires in 24 hours.</p>
        </div>
      `,
    })
    logger.info({ to }, 'Verification email sent')
  } catch (err) {
    logger.error({ err, to }, 'Failed to send verification email')
  }
}

export async function sendPaymentConfirmedEmail(to: string, name: string, expiresAt: Date) {
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Payment confirmed — your LeadForge account is live',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>You're all set, ${name}</h2>
          <p>Your payment was confirmed and your LeadForge account is active.</p>
          <p>Next: connect your Telegram in Settings to start receiving leads.</p>
          <p style="color:#666;font-size:13px;">Your subscription renews on ${expiresAt.toLocaleDateString()}.</p>
        </div>
      `,
    })
    logger.info({ to }, 'Payment confirmation email sent')
  } catch (err) {
    logger.error({ err, to }, 'Failed to send payment confirmation email')
  }
}
