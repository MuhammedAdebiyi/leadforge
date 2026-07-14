import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Star, ArrowRight } from 'lucide-react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import toast from 'react-hot-toast'

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setAuth = useAuthStore(s => s.setAuth)

  
  const initialMode = (location.state as any)?.mode === 'signup' ? 'register' : 'login'
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
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
    <div className="min-h-screen bg-paper flex flex-col">

     
      <header className="border-b-3 border-ink bg-paper">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="font-display font-bold text-ink tracking-tight flex items-center gap-1.5"
          >
            <Star size={14} className="text-gold" fill="currentColor" strokeWidth={0} />
            MAPS LEAD SCRAPER
          </button>
          <button
            onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
            className="text-xs font-mono uppercase tracking-wide text-ink-dim hover:text-ink transition-colors"
          >
            {mode === 'login' ? 'No account? Sign up →' : 'Have an account? Sign in →'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex">

        {/* Left — editorial panel */}
        <div className="hidden lg:flex w-1/2 flex-col justify-between p-14 border-r-3 border-ink bg-paper-1">

          <div>
            <p className="label mb-6">FOR AGENCIES DOING LOCAL OUTREACH</p>
            <h1 className="text-4xl font-display font-bold text-ink tracking-tight leading-[1.08] mb-6">
              {mode === 'login'
                ? <>Welcome back.<br /><span className="text-ink-dim">Your leads are waiting.</span></>
                : <>Find 1,000 businesses<br /><span className="text-ink-dim">without a website.</span></>
              }
            </h1>
            <p className="text-ink-dim text-sm leading-relaxed max-w-sm">
              {mode === 'login'
                ? 'Sign back in to resume your jobs, check your qualified leads, and send the next batch to Telegram.'
                : 'Search Google Maps, filter out the ones with websites, score what remains, and push qualified leads straight to Telegram.'
              }
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {[
              ['Google Maps scraper', 'Keyword + city → raw listings'],
              ['No-website filter', 'Only businesses you can actually pitch'],
              ['Lead scoring', '0–100 quality score per business'],
              ['Telegram delivery', 'Pushed the moment a lead qualifies'],
            ].map(([title, sub]) => (
              <div key={title} className="flex items-start gap-3">
                <Star size={11} className="text-gold mt-0.5 shrink-0" fill="currentColor" strokeWidth={0} />
                <div>
                  <p className="text-xs font-semibold text-ink uppercase tracking-wide font-mono">{title}</p>
                  <p className="text-xs text-ink-muted">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-2xs font-mono text-ink-muted uppercase tracking-widest">
            Maps Lead Scraper · Built for agencies
          </p>
        </div>

        {/* Right — form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-sm">

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-1.5 mb-8">
              <Star size={14} className="text-gold" fill="currentColor" strokeWidth={0} />
              <span className="font-display font-bold text-ink text-sm uppercase tracking-tight">
                Maps Lead Scraper
              </span>
            </div>

            <h2 className="text-2xl font-display font-bold text-ink tracking-tight mb-1">
              {mode === 'login' ? 'Sign in.' : 'Get started.'}
            </h2>
            <p className="text-sm text-ink-muted mb-8">
              {mode === 'login'
                ? 'Enter your credentials to continue.'
                : 'Create a free account to start scraping.'}
            </p>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="label">Name</label>
                  <input
                    className="w-full bg-paper border-3 border-ink px-3 py-2.5 text-sm text-ink
                               placeholder-ink-muted outline-none focus:shadow-brut transition-shadow
                               font-sans rounded-none"
                    placeholder="Your name"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="w-full bg-paper border-3 border-ink px-3 py-2.5 text-sm text-ink
                             placeholder-ink-muted outline-none focus:shadow-brut transition-shadow
                             font-sans rounded-none"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="w-full bg-paper border-3 border-ink px-3 py-2.5 text-sm text-ink
                             placeholder-ink-muted outline-none focus:shadow-brut transition-shadow
                             font-sans rounded-none"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center py-3 mt-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <Spinner />
                  : mode === 'login'
                    ? <>Sign in <ArrowRight size={14} /></>
                    : <>Create account <ArrowRight size={14} /></>
                }
              </button>
            </form>

            <p className="text-center text-sm text-ink-muted mt-6">
              {mode === 'login' ? "No account? " : 'Have an account? '}
              <button
                onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
                className="text-ink font-semibold hover:text-rust transition-colors underline underline-offset-2"
              >
                {mode === 'login' ? 'Sign up free' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}