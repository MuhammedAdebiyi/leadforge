import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pause, Play, X, Trash2, Eye, Briefcase } from 'lucide-react'
import { jobsApi, type CreateJobInput } from '../lib/api'
import { StatusBadge, ProgressBar, Modal, Spinner, EmptyState } from '../components/ui'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

const DEFAULT_FORM: CreateJobInput = {
  keyword: '', city: '', country: 'NG', radius: 10,
  maxResults: 100, telegramDestination: '',
  useEmailEnrichment: false, leadScoreThreshold: 50,
}

export function Jobs() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<CreateJobInput>(DEFAULT_FORM)

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', 1],
    queryFn: () => jobsApi.list(1, 50).then(r => r.data.data),
    refetchInterval: 8000,
  })

  const jobs = data?.jobs ?? []

  const mutate = (fn: () => Promise<any>, msg: string) => async () => {
    try { await fn(); toast.success(msg); qc.invalidateQueries({ queryKey: ['jobs'] }) }
    catch (e: any) { toast.error(e.response?.data?.message ?? 'Failed') }
  }

  const createMutation = useMutation({
    mutationFn: () => jobsApi.create(form),
    onSuccess: (res) => {
      toast.success('Job created — workers are on it!')
      qc.invalidateQueries({ queryKey: ['jobs'] })
      setShowNew(false)
      setForm(DEFAULT_FORM)
      navigate(`/jobs/${res.data.data.id}`)
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create job'),
  })

  const set = (k: keyof CreateJobInput, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Jobs</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus size={14} /> New Job
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size={24} /></div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={40} />}
          title="No jobs yet"
          description="Create a search job to start finding businesses without websites."
          action={
            <button onClick={() => setShowNew(true)} className="btn-primary">
              <Plus size={14} /> Create Job
            </button>
          }
        />
      ) : (
        <div className="card divide-y divide-white/[0.04]">
          {jobs.map((job: any) => (
            <div key={job.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white text-sm">
                    {job.keyword} · {job.city}, {job.country}
                  </span>
                  <StatusBadge status={job.status} />
                </div>
                {job.status === 'RUNNING' && (
                  <div className="mb-1.5 max-w-xs">
                    <ProgressBar value={job.progress} />
                    <p className="text-xs text-gray-500 mt-0.5">{job.progress}% complete</p>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  {job._count?.businesses ?? 0} businesses found ·{' '}
                  {job.qualifiedBusinesses} qualified ·{' '}
                  {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Link to={`/jobs/${job.id}`} className="btn-secondary px-2.5 py-1.5">
                  <Eye size={13} />
                </Link>
                {job.status === 'RUNNING' && (
                  <button onClick={mutate(() => jobsApi.pause(job.id), 'Job paused')} className="btn-secondary px-2.5 py-1.5">
                    <Pause size={13} />
                  </button>
                )}
                {job.status === 'PAUSED' && (
                  <button onClick={mutate(() => jobsApi.resume(job.id), 'Job resumed')} className="btn-secondary px-2.5 py-1.5">
                    <Play size={13} />
                  </button>
                )}
                {['RUNNING', 'PAUSED', 'PENDING'].includes(job.status) && (
                  <button onClick={mutate(() => jobsApi.cancel(job.id), 'Job cancelled')} className="btn-danger px-2.5 py-1.5">
                    <X size={13} />
                  </button>
                )}
                {['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status) && (
                  <button onClick={mutate(() => jobsApi.delete(job.id), 'Job deleted')} className="btn-danger px-2.5 py-1.5">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Job Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Search Job">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Keyword *</label>
              <input className="input" placeholder="Hair Salon" value={form.keyword}
                onChange={e => set('keyword', e.target.value)} />
            </div>
            <div>
              <label className="label">City *</label>
              <input className="input" placeholder="Lagos" value={form.city}
                onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" placeholder="NG" value={form.country}
                onChange={e => set('country', e.target.value)} />
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
              <label className="label">Min Lead Score</label>
              <input type="number" className="input" min={0} max={100} value={form.leadScoreThreshold}
                onChange={e => set('leadScoreThreshold', Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className="label">Telegram Chat ID (for notifications)</label>
            <input className="input" placeholder="-1001234567890" value={form.telegramDestination}
              onChange={e => set('telegramDestination', e.target.value)} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.useEmailEnrichment}
              onChange={e => set('useEmailEnrichment', e.target.checked)} />
            <span className="text-sm text-gray-300">Enable email enrichment (Hunter.io)</span>
          </label>

          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowNew(false)} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.keyword || !form.city || createMutation.isPending}
              className="btn-primary flex-1 justify-center"
            >
              {createMutation.isPending ? <Spinner size={14} /> : 'Start Job'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
