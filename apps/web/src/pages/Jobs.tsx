import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pause, Play, X, Trash2, ArrowRight, Briefcase, Star } from 'lucide-react'
import { jobsApi, type CreateJobInput } from '../lib/api'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'


function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

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
    <span className={cn('tag border-2', STATUS_STYLES[status] ?? 'border-ink bg-paper-1 text-ink-dim')}>
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
    <div className="h-2 border-2 border-ink bg-paper-1 overflow-hidden">
      <div className="h-full bg-gold transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  )
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center py-24 text-center px-8">
      <Briefcase size={36} className="text-ink-muted mb-5" strokeWidth={1.5} />
      <p className="font-display font-bold text-ink text-lg mb-1">{title}</p>
      <p className="text-ink-muted text-sm max-w-xs leading-relaxed mb-5">{description}</p>
      {action}
    </div>
  )
}

// Brutalist modal — hard border, offset shadow, no blur/rounding
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className="relative card w-full max-w-lg bg-paper animate-slide-up">
        <div className="flex items-center justify-between px-6 py-5 border-b-3 border-ink">
          <h2 className="font-display font-bold text-ink text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center border-2 border-ink text-ink hover:bg-ink hover:text-paper transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full bg-paper border-3 border-ink px-3 py-2.5 text-sm text-ink placeholder-ink-muted ' +
  'outline-none focus:shadow-brut transition-shadow font-sans rounded-none'

// ── Form defaults ────────────────────────────────────────────────────────────

const DEFAULT: CreateJobInput = {
  keyword: '', city: '', country: 'NG', radius: 10,
  maxResults: 100, telegramDestination: '',
  useEmailEnrichment: false, leadScoreThreshold: 50,
}

interface Props { _externalOpen?: boolean; onClose?: () => void }

// ── Page ──────────────────────────────────────────────────────────────────────

export function Jobs({ _externalOpen, onClose }: Props = {}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(_externalOpen ?? false)
  const [form, setForm] = useState<CreateJobInput>(DEFAULT)
  const set = (k: keyof CreateJobInput, v: any) => setForm(f => ({ ...f, [k]: v }))

  const close = () => { setOpen(false); onClose?.() }

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', 1],
    queryFn: () => jobsApi.list(1, 50).then(r => r.data.data),
    refetchInterval: 8000,
    enabled: !_externalOpen,
  })

  const jobs = data?.jobs ?? []

  const act = (fn: () => Promise<any>, msg: string) => async () => {
    try { await fn(); toast.success(msg); qc.invalidateQueries({ queryKey: ['jobs'] }) }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Action failed') }
  }

  const createMutation = useMutation({
    mutationFn: () => jobsApi.create(form),
    onSuccess: (res) => {
      toast.success('Job created — scraper is running')
      qc.invalidateQueries({ queryKey: ['jobs'] })
      close()
      setForm(DEFAULT)
      navigate(`/jobs/${res.data.data.id}`)
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed'),
  })

  return (
    <>
      {/* Page content — only when not used as modal trigger from Dashboard */}
      {!_externalOpen && (
        <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">

          <div className="flex items-center justify-between border-b-3 border-ink pb-6">
            <div>
              <p className="label mb-1">Jobs</p>
              <h1 className="text-3xl font-display font-bold text-ink tracking-tight">Search Jobs</h1>
            </div>
            <button onClick={() => setOpen(true)} className="btn-primary text-sm px-5 py-2.5">
              <Plus size={14} /> New Job
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner /></div>
          ) : jobs.length === 0 ? (
            <EmptyState
              title="No jobs yet"
              description="Create a search job and LeadForge will find businesses automatically."
              action={
                <button onClick={() => setOpen(true)} className="btn-primary text-sm px-5 py-2.5 mx-auto">
                  <Plus size={14} /> Create job
                </button>
              }
            />
          ) : (
            <div className="card divide-y-3 divide-ink">
              {jobs.map((job: any) => (
                <div key={job.id} className="flex items-center gap-4 px-6 py-4 hover:bg-paper-1 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <span className="font-display font-bold text-ink text-sm">{job.keyword}</span>
                      <span className="text-ink-muted text-sm font-mono">in {job.city}, {job.country}</span>
                      <StatusTag status={job.status} />
                    </div>
                    {job.status === 'RUNNING' && (
                      <div className="mb-2 max-w-sm">
                        <ProgressBar value={job.progress} />
                        <p className="text-2xs font-mono text-ink-muted mt-1">
                          {job.progress}% · {job.totalBusinesses} found
                        </p>
                      </div>
                    )}
                    <p className="text-2xs font-mono text-ink-muted">
                      {(job._count?.businesses ?? 0).toLocaleString()} businesses ·{' '}
                      <span className="text-rust font-semibold">{job.qualifiedBusinesses} qualified</span> ·{' '}
                      {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link to={`/jobs/${job.id}`} className="btn-ghost px-3 py-2">
                      <ArrowRight size={13} />
                    </Link>
                    {job.status === 'RUNNING' && (
                      <button onClick={act(() => jobsApi.pause(job.id), 'Paused')} className="btn-ghost px-3 py-2">
                        <Pause size={13} />
                      </button>
                    )}
                    {job.status === 'PAUSED' && (
                      <button onClick={act(() => jobsApi.resume(job.id), 'Resumed')} className="btn-ghost px-3 py-2">
                        <Play size={13} />
                      </button>
                    )}
                    {['RUNNING', 'PAUSED', 'PENDING'].includes(job.status) && (
                      <button
                        onClick={act(() => jobsApi.cancel(job.id), 'Cancelled')}
                        className="border-3 border-rust text-rust px-3 py-2 hover:bg-rust hover:text-paper transition-colors"
                      >
                        <X size={13} />
                      </button>
                    )}
                    {['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status) && (
                      <button
                        onClick={act(() => jobsApi.delete(job.id), 'Deleted')}
                        className="border-3 border-rust text-rust px-3 py-2 hover:bg-rust hover:text-paper transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New job modal */}
      <Modal open={open || !!_externalOpen} onClose={close} title="New Search Job">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Keyword *</label>
              <input className={inputCls} placeholder="e.g. Hair Salon"
                value={form.keyword} onChange={e => set('keyword', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">City *</label>
              <input className={inputCls} placeholder="e.g. Lagos"
                value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className={inputCls} placeholder="NG"
                value={form.country} onChange={e => set('country', e.target.value)} />
            </div>
            <div>
              <label className="label">Radius (km)</label>
              <input type="number" className={inputCls} value={form.radius}
                onChange={e => set('radius', Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Max Results</label>
              <input type="number" className={inputCls} value={form.maxResults}
                onChange={e => set('maxResults', Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Min Score (0–100)</label>
              <input type="number" className={inputCls} min={0} max={100}
                value={form.leadScoreThreshold}
                onChange={e => set('leadScoreThreshold', Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="label">Telegram Chat ID</label>
            <input className={inputCls} placeholder="e.g. 123456789"
              value={form.telegramDestination}
              onChange={e => set('telegramDestination', e.target.value)} />
            <p className="text-2xs text-ink-muted mt-1.5 font-mono">Qualified leads will be sent here.</p>
          </div>

          {/* Toggle — brutalist square switch, not a rounded pill */}
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <div
              onClick={() => set('useEmailEnrichment', !form.useEmailEnrichment)}
              className={cn(
                'w-10 h-5 border-2 border-ink relative shrink-0 cursor-pointer transition-colors',
                form.useEmailEnrichment ? 'bg-gold' : 'bg-paper-1'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-3.5 h-3.5 border-2 border-ink bg-paper transition-transform',
                form.useEmailEnrichment ? 'translate-x-[19px]' : 'translate-x-0.5'
              )} />
            </div>
            <div>
              <p className="text-sm text-ink font-semibold">Email enrichment</p>
              <p className="text-2xs text-ink-muted font-mono">Uses Hunter.io to find email addresses</p>
            </div>
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={close} className="btn-ghost flex-1 justify-center py-2.5">Cancel</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.keyword || !form.city || createMutation.isPending}
              className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending ? <Spinner /> : 'Start Job →'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}