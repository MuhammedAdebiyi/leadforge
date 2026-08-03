import { useState } from 'react'
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
  const [loading, setLoading] = useState(false)

  const checkoutMutation = useMutation({
    mutationFn: () => billingApi.checkout(),
    onSuccess: (res) => {
      window.location.href = res.data.data.checkout_url
    },
    onError: () => {
      toast.error('Could not start checkout — try again shortly')
      setLoading(false)
    },
  })

  const isUnverified = reason === 'EMAIL_NOT_VERIFIED'

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="card max-w-md w-full p-8 text-center space-y-5">
        {isUnverified ? (
          <>
            <MailWarning size={40} className="mx-auto text-gold" />
            <h1 className="text-xl font-display font-bold text-ink">Verify your email</h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              We sent a verification link to your inbox when you signed up. Click it to activate your account.
              Didn't get it? Check spam, or contact support.
            </p>
          </>
        ) : (
          <>
            <CreditCard size={40} className="mx-auto text-rust" />
            <h1 className="text-xl font-display font-bold text-ink">Your subscription has ended</h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              Resubscribe for ₦1,500/month to keep receiving qualified leads on Telegram.
            </p>
            <button
              onClick={() => { setLoading(true); checkoutMutation.mutate() }}
              disabled={loading}
              className="btn-primary w-full justify-center py-3 disabled:opacity-50"
            >
              {loading ? 'Redirecting…' : 'Resubscribe — ₦1,500/month'}
            </button>
          </>
        )}

        <button
          onClick={() => { logout(); window.location.href = '/login' }}
          className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
