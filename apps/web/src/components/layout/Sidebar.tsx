import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Briefcase, Building2, Settings, Zap, LogOut } from 'lucide-react'
import { cn } from '../ui'
import { useAuthStore } from '../../stores/auth'

const NAV = [
  { to: '/',       icon: LayoutDashboard, label: 'Overview' },
  { to: '/jobs',   icon: Briefcase,       label: 'Jobs' },
  { to: '/leads',  icon: Building2,       label: 'Leads' },
]

export function Sidebar() {
  const logout = useAuthStore(s => s.logout)
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()

  return (
    <aside className="w-52 border-r rule flex flex-col h-screen sticky top-0 bg-ink-1">
      {/* Logo */}
      <div className="px-5 py-6 border-b rule">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-signal flex items-center justify-center shrink-0">
            <Zap size={12} className="text-ink fill-ink" />
          </div>
          <span className="font-bold text-chalk tracking-tight text-sm">LeadForge</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="label px-2 mb-3">Navigation</p>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-100',
              isActive
                ? 'bg-chalk text-ink font-semibold'
                : 'text-chalk-dim hover:text-chalk hover:bg-ink-3'
            )}
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}

        <div className="pt-4 mt-4 border-t rule">
          <NavLink
            to="/settings"
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
              isActive ? 'bg-chalk text-ink font-semibold' : 'text-chalk-dim hover:text-chalk hover:bg-ink-3'
            )}
          >
            <Settings size={15} />
            Settings
          </NavLink>
        </div>
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t rule">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-chalk truncate">{user?.name}</p>
            <p className="text-2xs text-chalk-muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="p-1.5 rounded-md text-chalk-muted hover:text-chalk hover:bg-ink-3 transition-all shrink-0"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
