import { useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { CreditCard, MailWarning } from 'lucide-react'
import { billingApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import toast from 'react-hot-toast'

export function AccountGate() {
  const [params] = useSearchParams()

  const reason = params.get('reason')

  const logout = useAuthStore(s => s.logout)

  const checkoutMutation = useMutation({
    mutationFn: () => billingApi.checkout(),

    onSuccess: (res) => {
      window.location.href = res.data.data.checkout_url
    },

    onError: () => {
      toast.error(
        'Could not start checkout — try again shortly'
      )
    },
  })


  const isUnverified = reason === 'EMAIL_NOT_VERIFIED'


  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 max-w-md w-full space-y-6">


        {isUnverified ? (
          <>
            <div className="flex items-center gap-3">
              <MailWarning
                size={24}
                className="text-signal"
              />

              <h1 className="text-xl font-semibold text-ink">
                Verify your email
              </h1>
            </div>


            <p className="text-sm text-ink-muted leading-relaxed">
              We sent a verification link to your inbox when you signed up.
              Click it to activate your account.
            </p>


            <p className="text-sm text-ink-muted leading-relaxed">
              Didn't get it? Check spam, or contact support.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <CreditCard
                size={24}
                className="text-signal"
              />

              <h1 className="text-xl font-semibold text-ink">
                Your subscription has ended
              </h1>
            </div>


            <p className="text-sm text-ink-muted leading-relaxed">
              Resubscribe for ₦1,600/month to keep receiving qualified leads
              on Telegram.
            </p>


            <button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
              className="btn-primary w-full justify-center py-3 disabled:opacity-50"
            >
              {checkoutMutation.isPending
                ? 'Redirecting…'
                : 'Resubscribe — ₦1,600/month'}
            </button>


            <p className="text-xs text-ink-muted">
              Once active, message{' '}
              
              <a
                href="https://t.me/leadforge_scraper_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-ink"
              >
                @leadforge_scraper_bot ↗
              </a>{' '}
              to start receiving leads.
            </p>
          </>
        )}


        <button
          onClick={() => {
            logout()
            window.location.href = '/login'
          }}
          className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
        >
          Sign out
        </button>

      </div>
    </div>
  )
}