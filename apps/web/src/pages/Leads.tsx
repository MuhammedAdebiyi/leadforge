import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Star, Phone, Mail, MapPin, ExternalLink, Send } from 'lucide-react'
import { businessApi } from '../lib/api'
import { StatusBadge, ScorePill, Spinner, EmptyState } from '../components/ui'
import toast from 'react-hot-toast'

const FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Qualified', value: 'QUALIFIED' },
  { label: 'Sent',      value: 'SENT_TO_TELEGRAM' },
  { label: 'Enriched',  value: 'EMAIL_ENRICHED' },
  { label: 'Exported',  value: 'EXPORTED' },
]

export function Leads() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['businesses', status, page],
    queryFn: () => businessApi.list({ status: status || undefined, page, limit: 30 }).then(r => r.data.data),
    refetchInterval: 15000,
  })

  const businesses = data?.businesses ?? []
  const pagination = data?.pagination

  const retry = async (id: string) => {
    try { await businessApi.retryTelegram(id); toast.success('Queued for Telegram') }
    catch { toast.error('Failed') }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Leads</p>
          <h1 className="text-2xl font-bold text-chalk tracking-tight">Qualified Leads</h1>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
                status === f.value
                  ? 'bg-chalk text-ink'
                  : 'text-chalk-muted hover:text-chalk bg-ink-2 border border-white/[0.07]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size={20} /></div>
      ) : businesses.length === 0 ? (
        <EmptyState
          icon={<Building2 size={36} />}
          title="No leads here"
          description="Leads appear as jobs complete. Start a search job to find businesses."
        />
      ) : (
        <>
          <div className="card divide-y rule">
            {businesses.map((b: any) => (
              <div key={b.id} className="px-6 py-5 hover:bg-ink-2 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Name + category */}
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <span className="font-semibold text-chalk">{b.name}</span>
                      {b.category && (
                        <span className="text-2xs text-chalk-muted bg-ink-3 px-2 py-0.5 rounded-md border border-white/[0.06]">
                          {b.category}
                        </span>
                      )}
                    </div>

                    {/* Contact info */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-chalk-muted mb-2">
                      {b.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone size={10} className="shrink-0" /> {b.phone}
                        </span>
                      )}
                      {b.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail size={10} className="shrink-0" /> {b.email}
                        </span>
                      )}
                      {b.address && (
                        <span className="flex items-center gap-1.5 truncate">
                          <MapPin size={10} className="shrink-0" />
                          <span className="truncate max-w-xs">{b.address}</span>
                        </span>
                      )}
                      {b.rating && (
                        <span className="flex items-center gap-1.5">
                          <Star size={10} className="fill-warn text-warn shrink-0" />
                          {b.rating} · {b.reviewCount?.toLocaleString()} reviews
                        </span>
                      )}
                    </div>

                    <StatusBadge status={b.status} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <ScorePill score={b.leadScore} />
                    {b.mapsUrl && (
                      <a href={b.mapsUrl} target="_blank" rel="noopener noreferrer"
                        className="btn-ghost px-2.5 py-2" title="Open in Maps">
                        <ExternalLink size={12} />
                      </a>
                    )}
                    {b.status === 'QUALIFIED' && (
                      <button onClick={() => retry(b.id)} className="btn-ghost px-2.5 py-2" title="Send to Telegram">
                        <Send size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost px-4">← Prev</button>
              <span className="text-xs text-chalk-muted font-mono">{page} / {pagination.pages}</span>
              <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="btn-ghost px-4">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
