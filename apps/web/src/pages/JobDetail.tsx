import { useParams, Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Star, Users, Download } from 'lucide-react'
import { jobsApi, businessApi } from '../lib/api'
import { StatusBadge, ProgressBar, ScorePill, Spinner } from '../components/ui'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

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
    <div className="flex justify-center py-20"><Spinner size={24} /></div>
  )
  if (!job) return <div className="p-6 text-gray-500">Job not found</div>

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
      <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-200 transition-colors">
        <ArrowLeft size={14} /> All Jobs
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-white tracking-tight">
                {job.keyword} · {job.city}
              </h1>
              <StatusBadge status={job.status} />
            </div>
            <p className="text-sm text-gray-500">
              {job.country} · {job.radius}km radius · max {job.maxResults} results ·{' '}
              created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
            </p>
          </div>

          {leads.length > 0 && (
            <div className="flex gap-2">
              <button onClick={() => handleExport('csv')} className="btn-secondary text-xs">
                <Download size={12} /> CSV
              </button>
              <button onClick={() => handleExport('excel')} className="btn-secondary text-xs">
                <Download size={12} /> Excel
              </button>
            </div>
          )}
        </div>

        {/* Live progress */}
        {job.status === 'RUNNING' && (
          <div className="space-y-2 mb-5">
            <div className="flex justify-between text-xs text-gray-400">
              <span className="font-mono">{live?.currentStep ?? 'Searching...'}</span>
              <span className="font-mono">{live?.pct ?? job.progress}%</span>
            </div>
            <ProgressBar value={live?.pct ?? job.progress} />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-lg overflow-hidden">
          {[
            { label: 'Found', value: job.totalBusinesses },
            { label: 'Qualified', value: job.qualifiedBusinesses, accent: true },
            { label: 'Score threshold', value: `${job.leadScoreThreshold}/100` },
          ].map(s => (
            <div key={s.label} className="bg-surface-1 px-5 py-4">
              <p className={`text-2xl font-bold font-mono ${s.accent ? 'text-accent' : 'text-white'}`}>
                {s.value}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Leads */}
      <div className="card">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
            Leads · {leads.length}
          </h2>
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-16">
            <Users size={28} className="mx-auto mb-3 text-gray-600" />
            <p className="text-sm text-gray-500">
              {job.status === 'RUNNING' ? 'Workers are searching — leads appear here in real-time' : 'No leads found'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {leads.map((b: any) => (
              <div key={b.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{b.name}</span>
                    {b.category && (
                      <span className="text-xs text-gray-500 bg-surface-3 px-2 py-0.5 rounded-full">{b.category}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    {b.phone && <span>{b.phone}</span>}
                    {b.email && <span>{b.email}</span>}
                    {b.rating && (
                      <span className="flex items-center gap-1">
                        <Star size={9} className="fill-yellow-400 text-yellow-400" />
                        {b.rating} · {b.reviewCount} reviews
                      </span>
                    )}
                    {b.address && <span className="truncate max-w-sm">{b.address}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ScorePill score={b.leadScore} />
                  <StatusBadge status={b.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
