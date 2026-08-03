import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'

export function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!token) return
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      toast.success('Password reset — log in with your new password')
      navigate('/login')
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Link invalid or expired')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
        <div className="card max-w-md w-full p-8 text-center space-y-4">
          <p className="text-sm text-ink-muted">This reset link is missing a token.</p>
          <Link to="/forgot-password" className="btn-primary inline-flex justify-center py-3">Request a new link</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="card max-w-md w-full p-8 space-y-5">
        <h1 className="text-xl font-display font-bold text-ink">Set a new password</h1>
        <input
          className="input w-full"
          type="password"
          placeholder="New password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button onClick={submit} disabled={!password || loading} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
          {loading ? 'Saving…' : 'Reset password'}
        </button>
      </div>
    </div>
  )
}
