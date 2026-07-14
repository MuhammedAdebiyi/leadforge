import { useQuery } from '@tanstack/react-query'
import { Plus, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { jobsApi } from '../lib/api'
import { StatCard, StatusBadge, ProgressBar, Spinner } from '../components/ui'
import { useAuthStore } from '../stores/auth'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import { Jobs } from './Jobs'

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

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="label mb-1">Overview</p>
          <h1 className="text-2xl font-bold text-chalk tracking-tight">
            {greeting()}, {user?.name?.split(' ')[0]}.
          </h1>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus size={14} /> New job
        </button>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={20} /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Active Jobs"      value={stats?.activeJobs ?? 0} />
          <StatCard label="Completed"        value={stats?.completedJobs ?? 0} />
          <StatCard label="Businesses Found" value={(stats?.totalBusinesses ?? 0).toLocaleString()} />
          <StatCard label="Qualified Leads"  value={(stats?.qualifiedLeads ?? 0).toLocaleString()} signal />
        </div>
      )}

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="label">Recent Jobs</p>
          <Link to="/jobs" className="text-2xs text-chalk-muted hover:text-chalk transition-colors flex items-center gap-1">
            View all <ArrowRight size={11} />
          </Link>
        </div>

        {recentJobs.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="text-chalk-muted text-sm mb-4">No jobs yet. Create one to start finding leads.</p>
            <button onClick={() => setShowNew(true)} className="btn-primary mx-auto">
              <Plus size={14} /> Create first job
            </button>
          </div>
        ) : (
          <div className="card divide-y rule">
            {recentJobs.map((job: any) => (
              <Link key={job.id} to={`/jobs/${job.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-ink-2 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-sm font-medium text-chalk">
                      {job.keyword} · {job.city}
                    </span>
                    <StatusBadge status={job.status} />
                  </div>
                  {job.status === 'RUNNING' && (
                    <div className="mt-2 max-w-xs mb-1">
                      <ProgressBar value={job.progress} />
                    </div>
                  )}
                  <p className="text-2xs text-chalk-muted">
                    {(job._count?.businesses ?? 0).toLocaleString()} found ·{' '}
                    {job.qualifiedBusinesses} qualified ·{' '}
                    {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <ArrowRight size={14} className="text-ink-4 group-hover:text-chalk-muted transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Reuse Jobs modal */}
      {showNew && <Jobs _externalOpen onClose={() => setShowNew(false)} />}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
