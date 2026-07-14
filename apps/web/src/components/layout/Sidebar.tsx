import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Settings,
  Star,
  LogOut,
} from 'lucide-react'
import { cn } from '../ui'
import { useAuthStore } from '../../stores/auth'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/leads', icon: Building2, label: 'Leads' },
]

export function Sidebar() {
  const logout = useAuthStore(s => s.logout)
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()

  return (
    <aside className="w-64 bg-paper border-r-3 border-ink flex flex-col h-screen sticky top-0">

      {/* Logo */}
      <div className="px-6 py-6 border-b-3 border-ink">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <Star
            size={15}
            className="text-gold"
            fill="currentColor"
            strokeWidth={0}
          />

          <span className="font-display font-bold tracking-tight text-ink uppercase">
            LeadForge
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">

        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink-muted mb-5">
          Navigation
        </p>

        <div className="space-y-2">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 border-3 border-transparent px-4 py-3 font-medium transition-all',
                  isActive
                    ? 'bg-gold text-ink border-ink shadow-brut'
                    : 'text-ink-muted hover:text-ink hover:border-ink hover:bg-paper-1'
                )
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t-3 border-ink">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 border-3 border-transparent px-4 py-3 font-medium transition-all',
                isActive
                  ? 'bg-gold text-ink border-ink shadow-brut'
                  : 'text-ink-muted hover:text-ink hover:border-ink hover:bg-paper-1'
              )
            }
          >
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </div>

      </nav>

      {/* User */}
      <div className="border-t-3 border-ink p-5">

        <div className="mb-4">
          <p className="font-semibold text-sm text-ink truncate">
            {user?.name}
          </p>

          <p className="text-xs text-ink-muted truncate">
            {user?.email}
          </p>
        </div>

        <button
          onClick={() => {
            logout()
            navigate('/login')
          }}
          className="w-full flex items-center justify-center gap-2 border-3 border-ink bg-rust text-paper py-3 font-semibold hover:shadow-brut transition-all"
        >
          <LogOut size={16} />
          Sign out
        </button>

      </div>

    </aside>
  )
}