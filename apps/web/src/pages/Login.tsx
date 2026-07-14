import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import toast from 'react-hot-toast'
import { Spinner } from '../components/ui'

export function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = mode === 'login'
        ? await authApi.login({ email: form.email, password: form.password })
        : await authApi.register(form)
      const { user, accessToken, refreshToken } = res.data.data
      setAuth(user, accessToken, refreshToken)
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink flex">
      {/* Left — branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 border-r rule">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-signal flex items-center justify-center">
            <Zap size={14} className="text-ink fill-ink" />
          </div>
          <span className="font-bold text-chalk">LeadForge</span>
        </div>

        <div>
          <p className="text-5xl font-bold text-chalk leading-[1.1] tracking-tight mb-6">
            Find businesses.<br />
            <span className="text-chalk-dim">Skip the grind.</span>
          </p>
          <p className="text-chalk-muted leading-relaxed max-w-sm">
            Automated lead generation for web agencies. Discover local businesses
            without websites — delivered straight to Telegram.
          </p>

          <div className="mt-10 space-y-3">
            {[
              'Scrapes Google Maps automatically',
              'Filters out businesses with websites',
              'Scores and ranks every lead',
              'Sends qualified leads to Telegram',
            ].map(f => (
              <div key={f} className="flex items-center gap-3 text-sm text-chalk-dim">
                <span className="w-1.5 h-1.5 rounded-full bg-signal shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="text-2xs text-chalk-muted">LeadForge · Built for agencies</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-6 h-6 rounded-md bg-signal flex items-center justify-center">
              <Zap size={12} className="text-ink fill-ink" />
            </div>
            <span className="font-bold text-chalk text-sm">LeadForge</span>
          </div>

          <h1 className="text-2xl font-bold text-chalk mb-1 tracking-tight">
            {mode === 'login' ? 'Welcome back.' : 'Get started.'}
          </h1>
          <p className="text-sm text-chalk-muted mb-8">
            {mode === 'login' ? 'Sign in to your account.' : 'Create your free account.'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Name</label>
                <input className="input" placeholder="Your name"
                  value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="••••••••"
                value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
              {loading ? <Spinner size={14} /> : mode === 'login' ? 'Sign in →' : 'Create account →'}
            </button>
          </form>

          <p className="text-center text-sm text-chalk-muted mt-6">
            {mode === 'login' ? "No account? " : 'Have an account? '}
            <button onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
              className="text-chalk hover:text-signal transition-colors font-medium">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
