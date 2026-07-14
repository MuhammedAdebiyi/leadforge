import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Loader2 } from 'lucide-react'

export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn('animate-spin text-chalk-dim', className)} />
}

// ── Stat card ─────────────────────────────────────────────────────
export function StatCard({ label, value, sub, signal }: {
  label: string; value: string | number; sub?: string; signal?: boolean
}) {
  return (
    <div className="card px-6 py-5">
      <p className="label">{label}</p>
      <p className={cn('text-3xl font-bold font-mono tracking-tight mt-1', signal ? 'text-signal' : 'text-chalk')}>
        {value}
      </p>
      {sub && <p className="text-2xs text-chalk-muted mt-1.5">{sub}</p>}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────
const S: Record<string, string> = {
  PENDING:          'bg-warn/10 text-warn border border-warn/20',
  RUNNING:          'bg-brand/10 text-indigo-400 border border-brand/20',
  PAUSED:           'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  COMPLETED:        'bg-signal/10 text-signal border border-signal/20',
  FAILED:           'bg-danger/10 text-danger border border-danger/20',
  CANCELLED:        'bg-white/5 text-chalk-muted border border-white/10',
  QUALIFIED:        'bg-signal/10 text-signal border border-signal/20',
  DISCOVERED:       'bg-white/5 text-chalk-muted border border-white/10',
  WEBSITE_CHECKED:  'bg-white/5 text-chalk-muted border border-white/10',
  EMAIL_ENRICHED:   'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
  SENT_TO_TELEGRAM: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  EXPORTED:         'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  ARCHIVED:         'bg-white/5 text-chalk-muted border border-white/10',
}

const DOTS: Record<string, string> = {
  RUNNING:   'bg-indigo-400 animate-pulse-dot',
  COMPLETED: 'bg-signal',
  FAILED:    'bg-danger',
  PAUSED:    'bg-orange-400',
  PENDING:   'bg-warn',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', S[status] ?? 'bg-white/5 text-chalk-muted border border-white/10')}>
      {DOTS[status] && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOTS[status])} />}
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Progress bar ──────────────────────────────────────────────────
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div className="h-[3px] w-full bg-ink-3 rounded-full overflow-hidden">
      <div
        className="h-full bg-signal rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Score pill ────────────────────────────────────────────────────
export function ScorePill({ score }: { score: number }) {
  const style = score >= 80
    ? 'text-signal border-signal/30 bg-signal/10'
    : score >= 60
    ? 'text-warn border-warn/30 bg-warn/10'
    : 'text-chalk-muted border-white/10 bg-white/5'

  return (
    <span className={cn('font-mono text-2xs font-semibold border px-2 py-0.5 rounded-md', style)}>
      {score}
    </span>
  )
}

// ── Empty state ───────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-8">
      {icon && <div className="text-ink-4 mb-5">{icon}</div>}
      <p className="text-chalk font-semibold mb-1">{title}</p>
      <p className="text-chalk-muted text-sm max-w-xs leading-relaxed">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-lg animate-slide-up shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-6 py-5 border-b rule">
          <h2 className="font-semibold text-chalk">{title}</h2>
          <button onClick={onClose} className="text-chalk-muted hover:text-chalk transition-colors text-lg leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
