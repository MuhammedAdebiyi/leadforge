import { useEffect, useRef, useState } from 'react'
import {
  MapPin, Globe2, Mail, BrainCircuit, Send, Table2,
  ArrowRight, Star, Phone,
} from 'lucide-react'


const BUSINESSES = ['Alice Garden', 'Cactus', 'Cilantro', 'Commint Buka', 'Sunburst Diner', 'The Yellow Chilli']
const DOMAINS = ['alicegarden.com', 'cactuslagos.com', 'cilantro.ng', 'comminbuka.com']
const SCORES = [95, 90, 85, 65]

type Line = { text: string; kind: 'label' | 'item' | 'space' }

function buildScript(): Line[] {
  return [
    { text: 'Searching…', kind: 'label' },
    { text: 'Restaurants in Lagos', kind: 'item' },
    { text: '', kind: 'space' },
    ...BUSINESSES.slice(0, 4).map(b => ({ text: `✓ ${b}`, kind: 'item' as const })),
    { text: '', kind: 'space' },
    { text: 'Finding websites…', kind: 'label' },
    ...DOMAINS.map(d => ({ text: `✓ ${d}`, kind: 'item' as const })),
    { text: '', kind: 'space' },
    { text: 'Checking contact info…', kind: 'label' },
    { text: '✓ Email found', kind: 'item' },
    { text: '✓ Phone found', kind: 'item' },
    { text: '', kind: 'space' },
    { text: 'Scoring quality…', kind: 'label' },
    ...SCORES.map(s => ({ text: `${s}`, kind: 'item' as const })),
    { text: '', kind: 'space' },
    { text: 'Sending to Telegram…', kind: 'label' },
    { text: '✓ Done', kind: 'item' },
  ]
}

/* ------------------------------------------------------------------ */
/*  Hero terminal — types the script line by line, holds, then resets */
/* ------------------------------------------------------------------ */

function HeroTerminal() {
  const script = useRef(buildScript()).current
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    let i = 0
    let timeout: ReturnType<typeof setTimeout>

    const step = () => {
      i += 1
      setVisible(i)
      if (i >= script.length) {
        timeout = setTimeout(() => { i = 0; setVisible(0); step() }, 1800)
      } else {
        const line = script[i - 1]
        const delay = line.kind === 'label' ? 420 : line.kind === 'space' ? 80 : 260
        timeout = setTimeout(step, delay)
      }
    }
    timeout = setTimeout(step, 500)
    return () => clearTimeout(timeout)
  }, [script])

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.07] bg-ink-2">
        <span className="w-2.5 h-2.5 rounded-full bg-danger/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-warn/60" />
        <span className="w-2.5 h-2.5 rounded-full bg-signal/60" />
        <span className="ml-2 text-2xs font-mono text-chalk-muted tracking-wide">leadforge — live search</span>
      </div>
      <div className="p-5 font-mono text-[13px] leading-6 h-[360px] overflow-hidden">
        {script.slice(0, visible).map((line, idx) => {
          if (line.kind === 'space') return <div key={idx} className="h-2" />
          if (line.kind === 'label') {
            return (
              <div key={idx} className="text-chalk-dim mt-1">
                {line.text}
                {idx === visible - 1 && <span className="inline-block w-1.5 h-3.5 bg-signal/70 ml-1 animate-pulse-dot align-middle" />}
              </div>
            )
          }
          const isScore = /^\d+$/.test(line.text)
          return (
            <div key={idx} className={`animate-slide-up ${isScore ? 'text-warn pl-4' : 'text-signal pl-1'}`}>
              {line.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 grid md:grid-cols-2 gap-14 items-center">
      <div>
        <p className="label mb-4">Lead generation, automated</p>
        <h1 className="text-4xl md:text-[3.25rem] font-bold text-chalk tracking-tight leading-[1.05] mb-6">
          Find 1,000 qualified businesses while you sleep.
        </h1>
        <p className="text-chalk-dim text-base leading-relaxed mb-8 max-w-md">
          LeadForge scrapes Google Maps, verifies every website and contact,
          scores each lead, and drops the good ones straight into your Telegram.
        </p>
        <div className="flex items-center gap-3">
          <button className="btn-primary text-sm px-5 py-2.5">
            Start Free <ArrowRight size={14} />
          </button>
          <button className="btn-ghost text-sm px-5 py-2.5">See how it works</button>
        </div>
      </div>
      <HeroTerminal />
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Pipeline                                                           */
/* ------------------------------------------------------------------ */

const PIPELINE = [
  { icon: MapPin, label: 'Google Maps', sub: 'Raw business listings' },
  { icon: Globe2, label: 'Website scraper', sub: 'Finds & verifies domains' },
  { icon: Mail, label: 'Contact finder', sub: 'Email + phone' },
  { icon: BrainCircuit, label: 'AI qualification', sub: 'Scores fit, 0–100' },
  { icon: Send, label: 'Telegram', sub: 'Pushed the moment it qualifies' },
  { icon: Table2, label: 'CSV / CRM export', sub: 'Ready for outreach' },
]

function Pipeline() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <p className="label mb-2">How it works</p>
      <h2 className="text-2xl font-bold text-chalk tracking-tight mb-12">One pipeline, zero manual work.</h2>
      <div className="grid md:grid-cols-6 gap-4">
        {PIPELINE.map((step, idx) => (
          <div key={step.label} className="flex md:flex-col items-center md:items-start gap-4 md:gap-3">
            <div className="card p-4 flex-1 w-full">
              <step.icon size={18} className="text-signal mb-3" strokeWidth={1.75} />
              <p className="text-sm font-semibold text-chalk mb-0.5">{step.label}</p>
              <p className="text-xs text-chalk-muted leading-snug">{step.sub}</p>
            </div>
            {idx < PIPELINE.length - 1 && (
              <ArrowRight size={16} className="text-chalk-muted shrink-0 md:hidden" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Live search demo — progress bar + counting total                  */
/* ------------------------------------------------------------------ */

const COUNT_STEPS = [1, 5, 12, 38, 76, 100]

function LiveSearchDemo() {
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx(prev => (prev + 1) % (COUNT_STEPS.length + 3)) // pause a beat at 100, then reset
    }, 650)
    return () => clearInterval(id)
  }, [])

  const count = COUNT_STEPS[Math.min(stepIdx, COUNT_STEPS.length - 1)]
  const pct = Math.round((count / 100) * 100)

  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <div className="card p-8 md:p-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="label mb-2">Live search</p>
          <h2 className="text-2xl font-bold text-chalk tracking-tight mb-4">Watch it work in real time.</h2>
          <p className="text-chalk-dim text-sm leading-relaxed max-w-sm">
            Every search streams results the moment they're found — no waiting
            for a batch job to finish before you see a single lead.
          </p>
        </div>
        <div className="font-mono">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-chalk-muted">Restaurant · Lagos</span>
            <span className="text-2xs text-chalk-muted">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-ink-3 overflow-hidden mb-4">
            <div
              className="h-full bg-signal transition-all duration-500 ease-out rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-5xl font-bold text-chalk tabular-nums tracking-tight">
            {count}
            <span className="text-lg text-chalk-muted font-medium ml-2">leads found</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Lead card feed — new card slides in every few seconds             */
/* ------------------------------------------------------------------ */

const LEAD_FEED = [
  { name: 'Alice Garden', category: 'Restaurant', score: 95, phone: true, website: true },
  { name: 'Cactus', category: 'Restaurant', score: 90, phone: true, website: true },
  { name: 'Cilantro', category: 'Restaurant', score: 85, phone: true, website: false },
  { name: 'Commint Buka', category: 'Restaurant', score: 65, phone: false, website: true },
]

function LeadCard({ lead }: { lead: typeof LEAD_FEED[number] }) {
  const scoreColor = lead.score >= 85 ? 'text-signal' : lead.score >= 70 ? 'text-warn' : 'text-chalk-muted'
  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-chalk">{lead.name}</p>
          <p className="text-xs text-chalk-muted">{lead.category}</p>
        </div>
        <div className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{lead.score}</div>
      </div>
      <div className="flex items-center gap-1 mb-3 text-warn">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={11} fill="currentColor" strokeWidth={0} />
        ))}
      </div>
      <div className="flex gap-3 text-xs text-chalk-muted">
        <span className={`flex items-center gap-1 ${lead.phone ? 'text-chalk-dim' : 'opacity-40'}`}>
          <Phone size={11} /> Phone
        </span>
        <span className={`flex items-center gap-1 ${lead.website ? 'text-chalk-dim' : 'opacity-40'}`}>
          <Globe2 size={11} /> Website
        </span>
      </div>
    </div>
  )
}

function LeadFeed() {
  const [count, setCount] = useState(1)

  useEffect(() => {
    const id = setInterval(() => {
      setCount(prev => (prev >= LEAD_FEED.length ? 1 : prev + 1))
    }, 2200)
    return () => clearInterval(id)
  }, [])

  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <p className="label mb-2">Every lead, qualified</p>
      <h2 className="text-2xl font-bold text-chalk tracking-tight mb-10">Not just contacts — scored contacts.</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        {LEAD_FEED.slice(0, count).map(lead => (
          <LeadCard key={lead.name} lead={lead} />
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

const STATS = [
  { value: '2.1M', label: 'Businesses indexed' },
  { value: '40', label: 'Countries covered' },
  { value: '95%', label: 'Contact accuracy' },
  { value: '<2 min', label: 'Average search time' },
]

function Stats() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map(stat => (
          <div key={stat.label} className="card-flat py-8 text-center">
            <div className="text-3xl font-bold text-chalk tracking-tight tabular-nums mb-1">{stat.value}</div>
            <div className="text-xs text-chalk-muted">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Final CTA                                                          */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-4 pb-28 text-center">
      <h2 className="text-3xl font-bold text-chalk tracking-tight mb-4">
        Your next 1,000 leads are already out there.
      </h2>
      <p className="text-chalk-dim text-sm mb-8">LeadForge just has to go find them.</p>
      <button className="btn-primary text-sm px-6 py-3 mx-auto">
        Start Free <ArrowRight size={14} />
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function Landing() {
  return (
    <div className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <span className="text-sm font-bold text-chalk tracking-tight">LeadForge</span>
        <button className="btn-ghost text-xs px-4 py-2">Sign in</button>
      </header>
      <Hero />
      <div className="rule border-t" />
      <Pipeline />
      <div className="rule border-t" />
      <LiveSearchDemo />
      <div className="rule border-t" />
      <LeadFeed />
      <div className="rule border-t" />
      <Stats />
      <FinalCta />
    </div>
  )
}