import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { authApi } from '../lib/api'

export function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      return
    }
    authApi.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="card max-w-md w-full p-8 text-center space-y-5">
        {status === 'loading' && (
          <>
            <Loader2 size={40} className="mx-auto text-ink-muted animate-spin" />
            <p className="text-sm text-ink-muted">Verifying your email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={40} className="mx-auto text-signal" />
            <h1 className="text-xl font-display font-bold text-ink">Email verified</h1>
            <p className="text-sm text-ink-muted leading-relaxed">Your account is confirmed. You can log in now.</p>
            <Link to="/login" className="btn-primary w-full justify-center py-3 inline-flex">Go to login</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={40} className="mx-auto text-rust" />
            <h1 className="text-xl font-display font-bold text-ink">Link invalid or expired</h1>
            <p className="text-sm text-ink-muted leading-relaxed">
              This verification link no longer works. Log in and we'll help you get a new one.
            </p>
            <Link to="/login" className="btn-primary w-full justify-center py-3 inline-flex">Go to login</Link>
          </>
        )}
      </div>
    </div>
  )
}
