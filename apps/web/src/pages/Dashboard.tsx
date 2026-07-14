import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, ArrowRight, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { jobsApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { formatDistanceToNow } from 'date-fns'
import { Jobs } from './Jobs'

// ── Local ui primitives (paper/ink/gold) ──────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-ink-muted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

// Brutalist stat card — hard border, mono number, gold accent for the signal stat
function StatCard({
  label, value, accent = false,
}: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? 'bg-gold-soft border-gold' : ''}`}>
      <p className="label mb-2">{label}</p>
      <p className={`text-3xl font-display font-bold tracking-tight tabular-nums ${accent ? 'text-rust' : 'text-ink'}`}>
        {value}
      </p>
    </div>
  )
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:   'border-ink bg-paper-1 text-ink-dim',
  RUNNING:   'border-gold bg-gold-soft text-ink',
  PAUSED:    'border-ink bg-paper-1 text-ink-dim',
  COMPLETED: 'border-ink bg-paper text-rust',
  FAILED:    'border-rust bg-paper text-rust',
  CANCELLED: 'border-ink bg-paper-2 text-ink-muted',
}

const STATUS_DOT: Record<string, string> = {
  RUNNING:   'bg-gold animate-ping',
  COMPLETED: 'bg-rust',
  FAILED:    'bg-rust',
  PENDING:   'bg-ink-dim',
}

function StatusTag({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 tag border-2 ${STATUS_STYLES[status] ?? 'border-ink bg-paper-1 text-ink-dim'}`}>
      {STATUS_DOT[status] && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {status === 'RUNNING' && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${STATUS_DOT[status]}`} />
        </span>
      )}
      {status}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div className="h-2 border-2 border-ink bg-paper-1 overflow-hidden">
      <div
        className="h-full bg-gold transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const user = useAuthStore(s => s.user)
  const [showNew, setShowNew] = useState(false)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => jobsApi.dashboard().then(r => r.data.data),
    refetchInterval: 10000,
  })

  const { data: jobsData } = useQuery({
    queryKey: ['jobs', 1],
    queryFn: () => jobsApi.list(1, 5).then(r => r.data.data),
    refetchInterval: 8000,
  })

  const recentJobs = jobsData?.jobs ?? []
  const firstName = user?.name?.split(' ')[0] ?? 'there'

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b-3 border-ink pb-6">
        <div>
          <p className="label mb-1">Overview</p>
          <h1 className="text-3xl font-display font-bold text-ink tracking-tight">
            {greeting()}, {firstName}.
          </h1>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm px-5 py-2.5">
          <Plus size={14} /> New job
        </button>
      </div>

      {/* ── Stats ── */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Active Jobs"       value={stats?.activeJobs ?? 0} />
          <StatCard label="Completed"         value={stats?.completedJobs ?? 0} />
          <StatCard label="Businesses Found"  value={(stats?.totalBusinesses ?? 0).toLocaleString()} />
          <StatCard label="Qualified Leads"   value={(stats?.qualifiedLeads ?? 0).toLocaleString()} accent />
        </div>
      )}

      {/* ── Recent jobs ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="label">Recent Jobs</p>
          <Link
            to="/jobs"
            className="font-mono text-2xs uppercase tracking-wide text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
          >
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {recentJobs.length === 0 ? (
          <div className="card px-6 py-14 text-center">
            <Star size={28} className="text-gold mx-auto mb-4" fill="currentColor" strokeWidth={0} />
            <p className="font-display font-bold text-ink mb-1">No jobs yet</p>
            <p className="text-ink-muted text-sm mb-5">
              Create a search job and LeadForge will find businesses automatically.
            </p>
            <button onClick={() => setShowNew(true)} className="btn-primary text-sm px-5 py-2.5 mx-auto">
              <Plus size={14} /> Create first job
            </button>
          </div>
        ) : (
          <div className="card divide-y-3 divide-ink">
            {recentJobs.map((job: any) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-paper-1 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                    <span className="font-display font-bold text-ink text-sm">
                      {job.keyword}
                    </span>
                    <span className="text-ink-muted text-sm font-mono">· {job.city}</span>
                    <StatusTag status={job.status} />
                  </div>

                  {/* Progress bar for running jobs */}
                  {job.status === 'RUNNING' && (
                    <div className="mt-2 max-w-xs mb-2">
                      <ProgressBar value={job.progress} />
                      <p className="text-2xs font-mono text-ink-muted mt-1 tabular-nums">
                        {job.progress}%
                      </p>
                    </div>
                  )}

                  {/* Meta */}
                  <p className="text-2xs font-mono text-ink-muted">
                    {(job._count?.businesses ?? 0).toLocaleString()} found ·{' '}
                    <span className="text-rust font-semibold">{job.qualifiedBusinesses} qualified</span>
                    {' '}· {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                  </p>
                </div>

                <ArrowRight
                  size={14}
                  className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </Link>
            ))}
          </div>
        )}
      </div>

      {showNew && <Jobs _externalOpen onClose={() => setShowNew(false)} />}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}