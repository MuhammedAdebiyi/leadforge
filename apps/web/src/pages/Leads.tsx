import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Star, Phone, Mail, MapPin, ExternalLink, Send } from 'lucide-react'
import { businessApi } from '../lib/api'
import toast from 'react-hot-toast'

// ── Local ui primitives (paper/ink/gold) ──────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-ink-muted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  )
}

const STATUS_STYLES: Record<string, string> = {
  QUALIFIED:        'bg-gold-soft border-gold text-ink',
  DISCOVERED:       'border-ink bg-paper-1 text-ink-dim',
  WEBSITE_CHECKED:  'border-ink bg-paper-1 text-ink-dim',
  EMAIL_ENRICHED:   'border-ink bg-paper text-rust',
  SENT_TO_TELEGRAM: 'border-ink bg-paper text-rust',
  EXPORTED:         'border-ink bg-paper-2 text-ink-dim',
  ARCHIVED:         'border-ink bg-paper-2 text-ink-muted',
}

function StatusTag({ status }: { status: string }) {
  return (
    <span className={`tag border-2 ${STATUS_STYLES[status] ?? 'border-ink bg-paper-1 text-ink-dim'}`}>
      {status.replace(/_/g, ' ')}
    </span>
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

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="card flex flex-col items-center justify-center py-24 text-center px-8">
      <Building2 size={36} className="text-ink-muted mb-5" strokeWidth={1.5} />
      <p className="font-display font-bold text-ink text-lg mb-1">{title}</p>
      <p className="text-ink-muted text-sm max-w-xs leading-relaxed">{description}</p>
    </div>
  )
}

// ── Filters ───────────────────────────────────────────────────────────────────

const FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Qualified', value: 'QUALIFIED' },
  { label: 'Sent',      value: 'SENT_TO_TELEGRAM' },
  { label: 'Enriched',  value: 'EMAIL_ENRICHED' },
  { label: 'Exported',  value: 'EXPORTED' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export function Leads() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['businesses', status, page],
    queryFn: () =>
      businessApi.list({ status: status || undefined, page, limit: 30 }).then(r => r.data.data),
    refetchInterval: 15000,
  })

  const businesses = data?.businesses ?? []
  const pagination  = data?.pagination

  const retry = async (id: string) => {
    try { await businessApi.retryTelegram(id); toast.success('Queued for Telegram') }
    catch { toast.error('Failed') }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap border-b-3 border-ink pb-6">
        <div>
          <p className="label mb-1">Qualified leads</p>
          <h1 className="text-3xl font-display font-bold text-ink tracking-tight">
            Leads
          </h1>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setStatus(f.value); setPage(1) }}
              className={
                status === f.value
                  ? 'font-mono text-xs uppercase tracking-wide px-3 py-1.5 border-3 border-ink bg-ink text-paper'
                  : 'font-mono text-xs uppercase tracking-wide px-3 py-1.5 border-3 border-ink bg-paper text-ink hover:bg-paper-1 transition-colors'
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : businesses.length === 0 ? (
        <EmptyState
          title="No leads here"
          description="Leads appear as jobs complete. Start a search job to find businesses."
        />
      ) : (
        <>
          {/* Lead rows */}
          <div className="card divide-y-3 divide-ink">
            {businesses.map((b: any) => (
              <div key={b.id} className="px-6 py-5 hover:bg-paper-1 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">

                    {/* Name + category */}
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <span className="font-display font-bold text-ink text-base">{b.name}</span>
                      {b.category && (
                        <span className="font-mono text-2xs uppercase tracking-wide text-ink-muted border-2 border-ink px-2 py-0.5 bg-paper-1">
                          {b.category}
                        </span>
                      )}
                    </div>

                    {/* Contact row */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-dim mb-3 font-mono">
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
                          <Star size={10} className="fill-gold text-gold shrink-0" />
                          {b.rating} · {b.reviewCount?.toLocaleString()} reviews
                        </span>
                      )}
                    </div>

                    <StatusTag status={b.status} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <ScorePill score={b.leadScore} />
                    {b.mapsUrl && (
                      <a
                        href={b.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost px-2.5 py-2 text-xs"
                        title="Open in Maps"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {b.status === 'QUALIFIED' && (
                      <button
                        onClick={() => retry(b.id)}
                        className="btn-ghost px-2.5 py-2 text-xs"
                        title="Send to Telegram"
                      >
                        <Send size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost text-xs px-4 py-2 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-xs font-mono text-ink-muted tabular-nums">
                {page} / {pagination.pages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="btn-ghost text-xs px-4 py-2 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}