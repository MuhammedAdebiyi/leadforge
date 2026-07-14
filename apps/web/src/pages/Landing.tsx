import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Globe2, Layers, BrainCircuit, Send, Table2,
  ArrowRight, Star, Search, Phone, XCircle,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Scroll-triggered reveal — small IntersectionObserver hook used by  */
/*  the stats counters and the lead-card cascade.                     */
/* ------------------------------------------------------------------ */

function useInView<T extends HTMLElement>(threshold = 0.4) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, inView }
}

/* ------------------------------------------------------------------ */
/*  Ticker — the "★ NO WEBSITE ★ QUALIFIED LEAD ★" scrolling band       */
/*  This is the signature element: doubled content + -50% translate    */
/*  gives a seamless loop without measuring widths at runtime.         */
/* ------------------------------------------------------------------ */



/* ------------------------------------------------------------------ */
/*  Shared script: the exact numbers from the brief (200 → 80          */
/*  qualified), reused by the hero terminal and the live demo so       */
/*  every number on the page agrees with every other number.          */
/* ------------------------------------------------------------------ */

const BUSINESSES = ["Bella's Hair Studio", 'Crown & Curl', 'Glow Salon Lagos', 'Radiant Cuts']

type Line = { text: string; kind: 'label' | 'item' | 'space' }

function buildScript(): Line[] {
  return [
    { text: 'Job started…', kind: 'label' },
    { text: 'Hair Salon · Lagos · 25km', kind: 'item' },
    { text: '', kind: 'space' },
    { text: 'Scraping Google Maps…', kind: 'label' },
    { text: '✓ 200 businesses found', kind: 'item' },
    { text: '', kind: 'space' },
    { text: 'Deduplicating…', kind: 'label' },
    { text: '✓ 175 duplicates removed', kind: 'item' },
    { text: '', kind: 'space' },
    { text: 'Checking websites…', kind: 'label' },
    ...BUSINESSES.map(b => ({ text: `✗ ${b} — no website`, kind: 'item' as const })),
    { text: '', kind: 'space' },
    { text: 'Qualifying…', kind: 'label' },
    { text: '✓ 80 qualified leads', kind: 'item' },
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
      <div className="flex items-center gap-1.5 px-4 py-3 border-b-3 border-ink bg-paper-1">
        <span className="w-2.5 h-2.5 border-2 border-ink bg-rust" />
        <span className="w-2.5 h-2.5 border-2 border-ink bg-gold" />
        <span className="w-2.5 h-2.5 border-2 border-ink bg-ink" />
        <span className="ml-2 text-2xs font-mono text-ink-muted tracking-wide uppercase">job #2841 — live</span>
      </div>
      <div className="p-5 font-mono text-[13px] leading-6 h-[360px] overflow-hidden">
        {script.slice(0, visible).map((line, idx) => {
          if (line.kind === 'space') return <div key={idx} className="h-2" />
          if (line.kind === 'label') {
            return (
              <div key={idx} className="text-ink-dim mt-1">
                {line.text}
                {idx === visible - 1 && <span className="inline-block w-1.5 h-3.5 bg-gold ml-1 animate-pulse align-middle" />}
              </div>
            )
          }
          const isQualCount = /qualified/.test(line.text)
          return (
            <div key={idx} className={`animate-slide-up ${isQualCount ? 'text-rust font-semibold pl-1' : 'text-ink pl-1'}`}>
              {line.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Floating job-status card — overlaps the terminal, bottom-left      */
/* ------------------------------------------------------------------ */

function FloatingJobStatus() {
  const [pct, setPct] = useState(12)

  useEffect(() => {
    const id = setInterval(() => {
      setPct(prev => (prev >= 87 ? 12 : prev + Math.ceil(Math.random() * 9)))
    }, 900)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="card hidden sm:block absolute -bottom-8 -left-8 w-64 p-4 bg-paper">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-gold opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
        </span>
        <p className="text-2xs font-mono font-semibold text-ink uppercase tracking-widest">Running</p>
      </div>
      <p className="text-sm text-ink-dim mb-3 flex items-center gap-1.5">
        <Search size={12} className="text-ink-muted" /> Hair Salon · Lagos
      </p>
      <div className="h-2 border-2 border-ink bg-paper-1 overflow-hidden mb-1.5">
        <div
          className="h-full bg-gold transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-2xs text-ink-muted font-mono tabular-nums text-right">{pct}%</p>
    </div>
  )
}



function Navbar() {
  const navigate = useNavigate()

  const navLinks = [
    { label: 'Pipeline',  href: '#pipeline' },
    { label: 'Lifecycle', href: '#lifecycle' },
    { label: 'Pricing',   href: '#' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-paper border-b-3 border-ink">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

        {/* ★ Logo — star + wordmark */}
        <button
          onClick={() => navigate('/')}
          className="font-display font-bold text-ink tracking-tight flex items-center gap-1.5"
        >
          <Star size={14} className="text-gold" fill="currentColor" strokeWidth={0} />
          Lead Forge
        </button>

        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map(link => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs font-mono uppercase tracking-wide text-ink-dim hover:text-ink transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Sign in → login mode */}
          <button
            onClick={() => navigate('/login')}
            className="btn-ghost text-xs px-4 py-2"
          >
            Sign in
          </button>
          {/* Start Free → signup mode via location state */}
          <button
            onClick={() => navigate('/login', { state: { mode: 'signup' } })}
            className="btn-primary text-xs px-4 py-2"
          >
            Start Free
          </button>
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  const navigate = useNavigate()
  return (
    <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid md:grid-cols-2 gap-14 items-center">
      <div className="animate-fade-in">
        <p className="label mb-4">For agencies doing local outreach</p>
        <h1 className="text-4xl md:text-[3.1rem] font-display font-bold text-ink tracking-tight leading-[1.05] mb-6">
          Find the businesses that don't have a website yet.
        </h1>
        <p className="text-ink-dim text-base leading-relaxed mb-8 max-w-md">
          You already know the pitch writes itself. Maps Lead Scraper finds
          them for you — searches Google Maps, checks every business for a
          website, and drops the ones without one straight into your Telegram.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login', { state: { mode: 'signup' } })}
            className="btn-primary text-sm px-5 py-2.5"
          >
            Start Free <ArrowRight size={14} />
          </button>
          <a href="#pipeline" className="btn-ghost text-sm px-5 py-2.5">See the pipeline</a>
        </div>
      </div>
      <div className="relative">
        <HeroTerminal />
        <FloatingJobStatus />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Pipeline                                                           */
/* ------------------------------------------------------------------ */

const PIPELINE = [
  { icon: MapPin, label: 'Google Maps', sub: 'Raw listings, scraped' },
  { icon: Layers, label: 'Deduplicate', sub: 'By Place ID, not name' },
  { icon: Globe2, label: 'Website check', sub: 'Flags the ones with none' },
  { icon: BrainCircuit, label: 'Qualify', sub: 'No-website = qualified' },
  { icon: Send, label: 'Telegram', sub: 'Pushed the moment it qualifies' },
  { icon: Table2, label: 'CSV export', sub: 'Ready for outreach' },
]

function Pipeline() {
  return (
    <section id="pipeline" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-24">
      <p className="label mb-2">How a job runs</p>
      <h2 className="text-2xl font-display font-bold text-ink tracking-tight mb-12">
        One queue per stage. Nothing blocks an API request.
      </h2>
      <div className="grid md:grid-cols-6 gap-4">
        {PIPELINE.map((step, idx) => (
          <div key={step.label} className="flex md:flex-col items-center md:items-start gap-4 md:gap-3">
            <div className="card p-4 flex-1 w-full hover:-translate-y-0.5 hover:shadow-brut-gold transition-all">
              <step.icon size={18} className="text-rust mb-3" strokeWidth={1.75} />
              <p className="text-sm font-semibold text-ink mb-0.5">{step.label}</p>
              <p className="text-xs text-ink-muted leading-snug">{step.sub}</p>
            </div>
            {idx < PIPELINE.length - 1 && (
              <ArrowRight size={16} className="text-ink-muted shrink-0 md:hidden" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Live search demo — progress bar + counting toward 80 qualified     */
/* ------------------------------------------------------------------ */

const COUNT_STEPS = [1, 6, 18, 34, 52, 80]

function LiveSearchDemo() {
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStepIdx(prev => (prev + 1) % (COUNT_STEPS.length + 3)) // pause a beat at 80, then reset
    }, 650)
    return () => clearInterval(id)
  }, [])

  const count = COUNT_STEPS[Math.min(stepIdx, COUNT_STEPS.length - 1)]
  const pct = Math.round((count / 80) * 100)

  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <div className="card p-8 md:p-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="label mb-2">Live progress</p>
          <h2 className="text-2xl font-display font-bold text-ink tracking-tight mb-4">
            Watch a job qualify leads in real time.
          </h2>
          <p className="text-ink-dim text-sm leading-relaxed max-w-sm">
            Jobs are resumable — if a worker dies at business #384, it picks
            back up from #385. You never restart from zero.
          </p>
        </div>
        <div className="font-mono">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-ink-muted uppercase tracking-wide">Hair Salon · Lagos</span>
            <span className="text-2xs text-ink-muted">{pct}%</span>
          </div>
          <div className="h-2.5 border-2 border-ink bg-paper-1 overflow-hidden mb-4">
            <div
              className="h-full bg-gold transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-5xl font-display font-bold text-ink tabular-nums tracking-tight">
            {count}
            <span className="text-lg text-ink-muted font-sans font-medium ml-2">qualified leads</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Lead card feed — every card qualifies for the same reason: no site */
/* ------------------------------------------------------------------ */

const LEAD_FEED = [
  { name: "Bella's Hair Studio", category: 'Hair Salon', score: 92, phone: true },
  { name: 'Crown & Curl', category: 'Hair Salon', score: 88, phone: true },
  { name: 'Glow Salon Lagos', category: 'Hair Salon', score: 81, phone: false },
  { name: 'Radiant Cuts', category: 'Hair Salon', score: 74, phone: true },
]

function LeadCard({ lead, delayMs }: { lead: typeof LEAD_FEED[number]; delayMs: number }) {
  const scoreColor = lead.score >= 85 ? 'text-rust' : lead.score >= 70 ? 'text-gold-1' : 'text-ink-muted'
  return (
    <div
      className="card p-5 opacity-0 animate-slide-up"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-ink">{lead.name}</p>
          <p className="text-xs text-ink-muted">{lead.category}</p>
        </div>
        <div className={`text-2xl font-display font-bold tabular-nums ${scoreColor}`}>{lead.score}</div>
      </div>
      <div className="flex gap-2 mb-3">
        <span className="tag flex items-center gap-1 bg-gold-soft border-ink">
          <XCircle size={11} /> No website
        </span>
      </div>
      <div className="flex gap-3 text-xs text-ink-muted">
        <span className={`flex items-center gap-1 ${lead.phone ? 'text-ink-dim' : 'opacity-40'}`}>
          <Phone size={11} /> Phone
        </span>
      </div>
    </div>
  )
}

function LeadFeed() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2)
  const [cycle, setCycle] = useState(0)

  useEffect(() => {
    if (!inView) return
    const cascadeMs = LEAD_FEED.length * 140 + 900
    const id = setInterval(() => setCycle(c => c + 1), cascadeMs + 2200)
    return () => clearInterval(id)
  }, [inView])

  return (
    <section ref={ref} className="max-w-6xl mx-auto px-6 py-20">
      <p className="label mb-2">Every lead, qualified the same way</p>
      <h2 className="text-2xl font-display font-bold text-ink tracking-tight mb-10">
        No website. That's the whole filter.
      </h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        {inView && LEAD_FEED.map((lead, i) => (
          <LeadCard key={`${lead.name}-${cycle}`} lead={lead} delayMs={i * 140} />
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Lifecycle — the one place numbering is earned: this is a real,    */
/*  literal state machine every business moves through, not decoration */
/* ------------------------------------------------------------------ */

const LIFECYCLE = [
  { n: '01', label: 'Discovered', sub: 'Found on Google Maps, deduped by Place ID' },
  { n: '02', label: 'Website checked', sub: 'Verified live, not just guessed from a listing' },
  { n: '03', label: 'Qualified', sub: 'No website found — this is a real lead' },
  { n: '04', label: 'Sent', sub: 'Pushed to Telegram the moment it qualifies' },
  { n: '05', label: 'Exported', sub: 'Available as CSV, ready for outreach' },
]

function Lifecycle() {
  return (
    <section id="lifecycle" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-24">
      <p className="label mb-2">Business lifecycle</p>
      <h2 className="text-2xl font-display font-bold text-ink tracking-tight mb-12">
        Every business moves through five states. No shortcuts.
      </h2>
      <div className="grid md:grid-cols-5 gap-4">
        {LIFECYCLE.map(stage => (
          <div key={stage.n} className="card-flat p-5">
            <p className="step-num mb-3">{stage.n}</p>
            <p className="text-sm font-semibold text-ink mb-1">{stage.label}</p>
            <p className="text-xs text-ink-muted leading-snug">{stage.sub}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, active: boolean, duration = 1700) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active) return
    let raf: number
    let start: number | null = null

    const tick = (ts: number) => {
      if (start === null) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])

  return value
}

type Stat = { target: number; suffix?: string; prefix?: string; label: string }

const STATS: Stat[] = [
  { target: 500, suffix: '/hr', label: 'Businesses scraped' },
  { target: 100, suffix: '%', label: 'Deduped by Place ID' },
  { target: 3, suffix: ' retries', label: 'Before dead-letter' },
  { target: 0, prefix: '<', suffix: 's', label: 'API blocking time' },
]

function StatCard({ stat, active }: { stat: Stat; active: boolean }) {
  const value = useCountUp(stat.target, active)
  const display = Math.round(value).toString()
  return (
    <div className="card-flat py-8 text-center">
      <div className="text-3xl font-display font-bold text-ink tracking-tight tabular-nums mb-1">
        {stat.prefix}{display}{stat.suffix}
      </div>
      <div className="text-xs text-ink-muted uppercase tracking-wide font-mono">{stat.label}</div>
    </div>
  )
}

function Stats() {
  const { ref, inView } = useInView<HTMLDivElement>(0.5)
  return (
    <section ref={ref} className="max-w-6xl mx-auto px-6 py-20">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATS.map(stat => (
          <StatCard key={stat.label} stat={stat} active={inView} />
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Final CTA                                                          */
/* ------------------------------------------------------------------ */

function FinalCta() {
  const navigate = useNavigate()
  return (
    <section className="max-w-6xl mx-auto px-6 pt-4 pb-24 text-center">
      <h2 className="text-3xl font-display font-bold text-ink tracking-tight mb-4">
        Your next 80 leads are sitting on Google Maps.
      </h2>
      <p className="text-ink-dim text-sm mb-8">Give it a keyword and a city. It does the rest.</p>
      <button
        onClick={() => navigate('/login', { state: { mode: 'signup' } })}
        className="btn-primary text-sm px-6 py-3 mx-auto"
      >
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
     
      <Navbar />
      <Hero />
      <div className="rule border-t" />
      <Pipeline />
      <div className="rule border-t" />
      <LiveSearchDemo />
      <div className="rule border-t" />
      <LeadFeed />
      <div className="rule border-t" />
      <Lifecycle />
      <div className="rule border-t" />
      <Stats />
      <FinalCta />
      
    </div>
  )
}