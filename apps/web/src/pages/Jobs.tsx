import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pause, Play, X, Trash2, ArrowRight, Briefcase } from 'lucide-react'
import { jobsApi, type CreateJobInput } from '../lib/api'
import { StatusBadge, ProgressBar, Modal, Spinner, EmptyState, cn } from '../components/ui'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const DEFAULT: CreateJobInput = {
  keyword: '', city: '', country: 'NG', radius: 10,
  maxResults: 100, telegramDestination: '',
  useEmailEnrichment: false, leadScoreThreshold: 50,
}

interface Props { _externalOpen?: boolean; onClose?: () => void }

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
          <div className="flex items-center justify-between">
            <div>
              <p className="label mb-1">Jobs</p>
              <h1 className="text-2xl font-bold text-chalk tracking-tight">Search Jobs</h1>
            </div>
            <button onClick={() => setOpen(true)} className="btn-primary">
              <Plus size={14} /> New Job
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size={20} /></div>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase size={36} />}
              title="No jobs yet"
              description="Create a search job and LeadForge will find businesses automatically."
              action={<button onClick={() => setOpen(true)} className="btn-primary"><Plus size={14} />Create job</button>}
            />
          ) : (
            <div className="card divide-y rule">
              {jobs.map((job: any) => (
                <div key={job.id} className="flex items-center gap-4 px-6 py-4 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-chalk">{job.keyword}</span>
                      <span className="text-chalk-muted text-sm">in {job.city}, {job.country}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    {job.status === 'RUNNING' && (
                      <div className="mb-2 max-w-sm">
                        <ProgressBar value={job.progress} />
                        <p className="text-2xs text-chalk-muted mt-1">{job.progress}% · {job.totalBusinesses} found</p>
                      </div>
                    )}
                    <p className="text-2xs text-chalk-muted">
                      {(job._count?.businesses ?? 0).toLocaleString()} businesses ·{' '}
                      <span className="text-signal">{job.qualifiedBusinesses} qualified</span> ·{' '}
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
                    {['RUNNING','PAUSED','PENDING'].includes(job.status) && (
                      <button onClick={act(() => jobsApi.cancel(job.id), 'Cancelled')} className="btn-danger px-3 py-2">
                        <X size={13} />
                      </button>
                    )}
                    {['COMPLETED','FAILED','CANCELLED'].includes(job.status) && (
                      <button onClick={act(() => jobsApi.delete(job.id), 'Deleted')} className="btn-danger px-3 py-2">
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
              <input className="input" placeholder="e.g. Hair Salon"
                value={form.keyword} onChange={e => set('keyword', e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label">City *</label>
              <input className="input" placeholder="e.g. Lagos"
                value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" placeholder="NG"
                value={form.country} onChange={e => set('country', e.target.value)} />
            </div>
            <div>
              <label className="label">Radius (km)</label>
              <input type="number" className="input" value={form.radius}
                onChange={e => set('radius', Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Max Results</label>
              <input type="number" className="input" value={form.maxResults}
                onChange={e => set('maxResults', Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Min Score (0–100)</label>
              <input type="number" className="input" min={0} max={100}
                value={form.leadScoreThreshold}
                onChange={e => set('leadScoreThreshold', Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="label">Telegram Chat ID</label>
            <input className="input" placeholder="e.g. 123456789"
              value={form.telegramDestination}
              onChange={e => set('telegramDestination', e.target.value)} />
            <p className="text-2xs text-chalk-muted mt-1.5">Qualified leads will be sent here.</p>
          </div>

          <label className="flex items-center gap-3 cursor-pointer py-1">
            <div
              onClick={() => set('useEmailEnrichment', !form.useEmailEnrichment)}
              className={cn(
                'w-9 h-5 rounded-full transition-colors relative shrink-0 cursor-pointer',
                form.useEmailEnrichment ? 'bg-signal' : 'bg-ink-4'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                form.useEmailEnrichment ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </div>
            <div>
              <p className="text-sm text-chalk font-medium">Email enrichment</p>
              <p className="text-2xs text-chalk-muted">Uses Hunter.io to find email addresses</p>
            </div>
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={close} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.keyword || !form.city || createMutation.isPending}
              className="btn-primary flex-1 justify-center"
            >
              {createMutation.isPending ? <Spinner size={14} /> : 'Start Job →'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
