import { useParams, Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Star, Users, Download } from 'lucide-react'
import { jobsApi, businessApi } from '../lib/api'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'


function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-ink-muted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
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

function StatusTag({ status }: { status: string }) {
  return (
    <span className={`tag border-2 ${STATUS_STYLES[status] ?? 'border-ink bg-paper-1 text-ink-dim'}`}>
      {status === 'RUNNING' && (
        <span className="relative flex h-1.5 w-1.5 mr-1">
          <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold" />
        </span>
      )}
      {status}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div className="h-2.5 border-2 border-ink bg-paper-1 overflow-hidden">
      <div className="h-full bg-gold transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  )
}

function ScorePill({ score }: { score: number }) {
  const style =
    score >= 80 ? 'text-rust border-rust bg-gold-soft' :
    score >= 60 ? 'text-gold-1 border-gold bg-gold-soft' :
                  'text-ink-muted border-ink bg-paper-1'
  return (
    <span className={`font-mono text-sm font-bold border-2 px-2.5 py-0.5 rounded-none ${style}`}>
      {score}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function JobDetail() {
  const { id } = useParams<{ id: string }>()

  // Guard — "new" is not a valid job ID
  if (!id || id === 'new') return <Navigate to="/jobs" replace />

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(id).then(r => r.data.data),
    refetchInterval: 5000,
  })

  const { data: leadsData } = useQuery({
    queryKey: ['businesses', id],
    queryFn: () => businessApi.list({ jobId: id, limit: 50 }).then(r => r.data.data),
    refetchInterval: 10000,
    enabled: !!id,
  })

  const leads = leadsData?.businesses ?? []

  if (isLoading) return (
    <div className="flex justify-center py-20"><Spinner /></div>
  )
  if (!job) return <div className="p-8 text-ink-muted font-mono">Job not found</div>

  const live = job.liveProgress as any

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      await businessApi.export(id, format)
      toast.success('Export queued — check your Telegram')
    } catch {
      toast.error('Export failed')
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-mono uppercase tracking-wide text-ink-muted hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} /> All Jobs
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <h1 className="text-2xl font-display font-bold text-ink tracking-tight">
                {job.keyword} · {job.city}
              </h1>
              <StatusTag status={job.status} />
            </div>
            <p className="text-sm text-ink-muted font-mono">
              {job.country} · {job.radius}km radius · max {job.maxResults} results ·{' '}
              created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </p>
          </div>

          {leads.length > 0 && (
            <div className="flex gap-2">
              <button onClick={() => handleExport('csv')} className="btn-ghost text-xs px-3 py-2">
                <Download size={12} /> CSV
              </button>
              <button onClick={() => handleExport('excel')} className="btn-ghost text-xs px-3 py-2">
                <Download size={12} /> Excel
              </button>
            </div>
          )}
        </div>

        {/* Live progress */}
        {job.status === 'RUNNING' && (
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs font-mono text-ink-dim">
              <span>{live?.currentStep ?? 'Searching...'}</span>
              <span>{live?.pct ?? job.progress}%</span>
            </div>
            <ProgressBar value={live?.pct ?? job.progress} />
          </div>
        )}

        {/* Stats — brutalist grid with hard dividers */}
        <div className="grid grid-cols-3 border-3 border-ink divide-x-3 divide-ink">
          {[
            { label: 'Found', value: job.totalBusinesses },
            { label: 'Qualified', value: job.qualifiedBusinesses, accent: true },
            { label: 'Score threshold', value: `${job.leadScoreThreshold}/100` },
          ].map(s => (
            <div key={s.label} className={`px-5 py-4 ${s.accent ? 'bg-gold-soft' : 'bg-paper'}`}>
              <p className={`text-2xl font-display font-bold tabular-nums ${s.accent ? 'text-rust' : 'text-ink'}`}>
                {s.value}
              </p>
              <p className="label mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Leads */}
      <div className="card">
        <div className="px-6 py-4 border-b-3 border-ink">
          <h2 className="text-sm font-mono font-semibold text-ink uppercase tracking-widest">
            Leads · {leads.length}
          </h2>
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-16">
            <Users size={28} className="mx-auto mb-3 text-ink-muted" strokeWidth={1.5} />
            <p className="text-sm text-ink-muted">
              {job.status === 'RUNNING'
                ? 'Workers are searching — leads appear here in real-time'
                : 'No leads found'}
            </p>
          </div>
        ) : (
          <div className="divide-y-3 divide-ink">
            {leads.map((b: any) => (
              <div key={b.id} className="flex items-center gap-4 px-6 py-4 hover:bg-paper-1 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="font-display font-bold text-ink text-sm">{b.name}</span>
                    {b.category && (
                      <span className="font-mono text-2xs uppercase tracking-wide text-ink-muted border-2 border-ink px-2 py-0.5 bg-paper-1">
                        {b.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-ink-dim font-mono flex-wrap">
                    {b.phone && <span>{b.phone}</span>}
                    {b.email && <span>{b.email}</span>}
                    {b.rating && (
                      <span className="flex items-center gap-1">
                        <Star size={9} className="fill-gold text-gold" />
                        {b.rating} · {b.reviewCount} reviews
                      </span>
                    )}
                    {b.address && <span className="truncate max-w-sm">{b.address}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ScorePill score={b.leadScore} />
                  <StatusTag status={b.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}