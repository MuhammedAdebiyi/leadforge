import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      toast.error('Something went wrong — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="card max-w-md w-full p-8 space-y-5">
        <h1 className="text-xl font-display font-bold text-ink">Reset your password</h1>

        {sent ? (
          <p className="text-sm text-ink-muted leading-relaxed">
            If an account exists for {email}, we've sent a reset link — check your inbox.
          </p>
        ) : (
          <>
            <input
              className="input w-full"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <button onClick={submit} disabled={!email || loading} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}

        <Link to="/login" className="block text-center text-xs text-ink-muted underline underline-offset-2">
          Back to login
        </Link>
      </div>
    </div>
  )
}
