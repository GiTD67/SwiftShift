import { useState, useEffect, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'
import './index.css'
import confetti from 'canvas-confetti'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTimesheet } from './hooks/useTimesheet'
import { Rewards } from './components/Rewards'
import { LootDrop } from './components/LootDrop'
import { Tour } from './components/Tour'
import { FeaturePreview } from './components/FeaturePreview'
import { BreakReminderModal } from './components/BreakReminderModal'
import { STATE_BREAK_RULES, STATE_CODES } from './data/stateBreakRules'

const API_BASE = (() => {
  const m = window.location.pathname.match(/^(\/hackathon\/preview\/[^/]+)/)
  return m ? m[1] : ''
})()

type View = 'clock' | 'timesheet' | 'rewards' | 'admin' | 'profile' | 'insurance' | 'orgchart' | 'taxes' | 'groktax' | 'grokky' | 'applications' | 'jobs' | 'schedules' | 'payroll' | 'reports' | 'leaves' | 'compliance' | 'hiring'

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function longDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function payPeriodFor(date: Date): { start: Date; end: Date } {
  // Anchor: Mar 22, 2026 start of day
  const anchor = new Date(2026, 2, 22) // month is 0-indexed
  const msPerDay = 86400000
  const daysSince = Math.floor((date.getTime() - anchor.getTime()) / msPerDay)
  const periodIndex = Math.floor(daysSince / 14)
  const periodStart = new Date(anchor.getTime() + periodIndex * 14 * msPerDay)
  const periodEnd = new Date(periodStart.getTime() + 13 * msPerDay) // 14 days inclusive
  return { start: periodStart, end: periodEnd }
}

// ===== Org Tree Chart (Vertical Tree) =====
function OctopusChart({ node, expanded, setExpanded, search, expandedAll }: {
  node: any
  expanded: Set<string>
  setExpanded: (s: Set<string>) => void
  search: string
  expandedAll: boolean
}) {
  const [hovered, setHovered] = useState<any | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<any | null>(null)

  const toggle = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExpanded(next)
  }

  const NodeCard = ({ n }: { n: any }) => {
    const h = search && (n.name.toLowerCase().includes(search.toLowerCase()) || n.title.toLowerCase().includes(search.toLowerCase()))
    const exp = expandedAll || expanded.has(n.id)
    const handleEnter = (e: React.MouseEvent) => { setHovered(n); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setHoverPos({ x: r.left + 95, y: r.top }) }
    const handleLeave = () => { setHovered(null); setHoverPos(null) }
    return (
      <div onMouseEnter={handleEnter} onMouseLeave={handleLeave} onClick={() => setSelected(n)} className={`cursor-pointer transition-all w-[170px] ${h ? 'ring-2' : ''}`} style={h ? { outline: '2px solid var(--accent-color)', borderRadius: '12px' } : undefined}>
        <div className="glass rounded-xl p-2 border hover:border-white/30 transition-all hover:-translate-y-0.5 shadow-xl" style={{ borderColor: h ? 'color-mix(in srgb, var(--accent-color) 60%, transparent)' : 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-start gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 ${n.reportsTo === null ? 'text-black' : 'bg-white/10'}`} style={n.reportsTo === null ? { backgroundColor: 'var(--accent-color)' } : undefined}>
              {n.reportsTo === null ? '👑' : '👤'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs leading-tight truncate" style={{ color: h ? 'var(--accent-color)' : undefined }}>{n.name}</div>
              <div className="text-[10px] font-medium truncate neon-green">{n.title}</div>
              <div className="text-[9px] text-zinc-500 mt-0.5">{n.dept}</div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-white/10">
            {n.children?.length > 0 && (
              <button onClick={toggle(n.id)} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 flex items-center gap-1">
                {exp ? '▼' : '▶'} {n.children.length}
              </button>
            )}
            {n.teamSize > 0 && <div className="text-[9px] text-zinc-400">👥 {n.teamSize}</div>}
          </div>
        </div>
      </div>
    )
  }

  // Recursive vertical tree renderer
  const TreeNode = ({ n }: { n: any }) => {
    const exp = expandedAll || expanded.has(n.id)
    const hasKids = n.children && n.children.length > 0 && exp
    return (
      <div className="flex flex-col items-center">
        <NodeCard n={n} />
        {hasKids && (
          <div className="relative flex flex-col items-center mt-3">
            {/* vertical line from parent */}
            <div className="w-px h-4 bg-white/20" />
            {/* horizontal connector bar */}
            <div className="h-px bg-white/20" style={{ width: (n.children.length - 1) * 190 + 80 }} />
            <div className="flex gap-5">
              {n.children.map((child: any) => (
                <div key={child.id} className="flex flex-col items-center relative">
                  {/* vertical line to child */}
                  <div className="w-px h-4 bg-white/20" />
                  <TreeNode n={child} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="py-4">
      <TreeNode n={node} />

      {/* Hover Tooltip */}
      {hovered && hoverPos && (
        <div
          className="fixed z-[60] glass rounded-xl p-3 border border-white/20 shadow-2xl w-64 pointer-events-none"
          style={{ left: Math.min(hoverPos.x + 25, (window as any).innerWidth - 280), top: Math.max(hoverPos.y - 110, 20) }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl">👤</div>
            <div>
              <div className="font-semibold text-base">{hovered.name}</div>
              <div className="text-xs neon-green">{hovered.title}</div>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <div><span className="text-zinc-500">Dept:</span> {hovered.dept}</div>
            <div><span className="text-zinc-500">Email:</span> <span className="font-mono">{hovered.email}</span></div>
            <div><span className="text-zinc-500">Reports to:</span> {hovered.reportsTo || ''}</div>
            <div><span className="text-zinc-500">Team:</span> {hovered.teamSize || 0} direct</div>
          </div>
        </div>
      )}

      {/* Click Modal */}
      {selected && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70" onClick={() => setSelected(null)}>
          <div className="glass rounded-2xl p-6 w-80 border border-white/20" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-3xl">👤</div>
              <div>
                <div className="font-semibold text-xl">{selected.name}</div>
                <div className="text-sm neon-green">{selected.title}</div>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div><div className="text-xs text-zinc-500">Department</div><div>{selected.dept}</div></div>
              <div><div className="text-xs text-zinc-500">Email</div><div className="font-mono">{selected.email}</div></div>
              <div><div className="text-xs text-zinc-500">Reports To</div><div>{selected.reportsTo || ''}</div></div>
              <div><div className="text-xs text-zinc-500">Team Size</div><div>{selected.teamSize || 0} direct reports</div></div>
            </div>
            <button onClick={() => setSelected(null)} className="mt-6 w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== Timesheet helpers =====
function entryKey(weekId: string, dayIndex: number): string {
  return `${weekId}-${dayIndex}`
}

function parseHours(s: string): number {
  if (!s || !s.trim()) return 0
  // support comma as decimal separator
  const normalized = s.trim().replace(',', '.')
  const v = parseFloat(normalized)
  if (isNaN(v)) return 0
  return Math.max(0, Math.min(24, v))
}

function fmtRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`
}

function usePayPeriodRange(periodOffset: number) {
  return useMemo(() => {
    // Same anchor as payPeriodFor: Mar 22, 2026
    const anchor = new Date(2026, 2, 22)
    const msPerDay = 86400000
    const periodStart = new Date(anchor.getTime() + periodOffset * 14 * msPerDay)
    periodStart.setHours(0, 0, 0, 0)
    const periodEnd = new Date(periodStart.getTime() + 13 * msPerDay)
    const dayDates = Array.from({ length: 14 }, (_, i) => new Date(periodStart.getTime() + i * msPerDay))
    const periodId = periodStart.toISOString().slice(0, 10) // YYYY-MM-DD of period start
    return { start: periodStart, end: periodEnd, dayDates, periodId }
  }, [periodOffset])
}

// ===== TimesheetView component =====
function TimesheetView({ user }: { user: any }) {
  const [periodOffset, setPeriodOffset] = useState(0)
  const [entries, setEntries] = useState<Record<string, string>>({})
  const [certified, setCertified] = useState(false)
  const [submittedPeriods, setSubmittedPeriods] = useState<Set<string>>(new Set())
  const [draftMessage, setDraftMessage] = useState<string | null>(null)

  const { start, end, dayDates, periodId } = usePayPeriodRange(periodOffset)

  // Reset certified when periodId changes
  useEffect(() => {
    setCertified(false)
  }, [periodId])

  // Auto-clear draft flash
  useEffect(() => {
    if (draftMessage) {
      const t = setTimeout(() => setDraftMessage(null), 3200)
      return () => clearTimeout(t)
    }
  }, [draftMessage])

  // Fetch clock sessions for this user and populate entries from DB
  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    fetch(`${API_BASE}/api/clock-sessions?employee_id=${uid}`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        // Build map: YYYY-MM-DD -> total minutes
        const byDate: Record<string, number> = {}
        for (const row of rows) {
          if (!row.clock_in) continue
          const d = row.clock_in.slice(0, 10) // YYYY-MM-DD
          const mins = Number(row.duration_minutes) || 0
          byDate[d] = (byDate[d] || 0) + mins
        }
        // Map to entries keyed by entryKey(periodId, dayIndex)
        const next: Record<string, string> = {}
        dayDates.forEach((d, i) => {
          const key = entryKey(periodId, i)
          const dateStr = d.toISOString().slice(0, 10)
          const mins = byDate[dateStr] || 0
          if (mins > 0) {
            next[key] = (mins / 60).toFixed(1)
          }
        })
        setEntries(next)
      })
      .catch(() => {})
  }, [user?.id, periodId, dayDates])

  // Derived totals
  const dayHours = dayDates.map((_, i) => parseHours(entries[entryKey(periodId, i)] || ''))
  const totalHours = dayHours.reduce((a, b) => a + b, 0)
  const regularHours = dayHours.reduce((sum, h) => sum + Math.min(h, 8), 0)
  const overtimeHours = dayHours.reduce((sum, h) => sum + Math.max(0, h - 8) * 1.5, 0)

  const isSubmitted = submittedPeriods.has(periodId)

  // Handlers
  const setDayHours = (i: number, val: string) => {
    setEntries(prev => ({ ...prev, [entryKey(periodId, i)]: val }))
  }

  const handleSaveDraft = () => {
    setDraftMessage('Draft saved')
    toast.success('Draft saved! ✓', { description: 'Your hours are saved. Submit when ready.' })
  }

  const handleSubmit = () => {
    if (certified && !isSubmitted) {
      setSubmittedPeriods(prev => new Set(prev).add(periodId))
      toast.success('Timesheet submitted! 🎉', { description: 'Your manager will review it shortly.' })
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } })
      setTimeout(() => confetti({ particleCount: 100, spread: 70, angle: 75, origin: { x: 0.2, y: 0.6 } }), 150)
      setTimeout(() => confetti({ particleCount: 100, spread: 70, angle: 105, origin: { x: 0.8, y: 0.6 } }), 300)
    }
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2 neon-green">Timesheet</h1>
        <p className="text-zinc-400 mb-6">Log your hours for the 2-week pay period. Hours accept decimals (e.g., 8 or 7.5).</p>
      </div>

      {/* Submitted banner */}
      {isSubmitted && (
        <div className="glass rounded-2xl px-4 py-3 text-white flex items-center gap-2">
          ✓ Submitted for approval
        </div>
      )}

      {/* Draft flash */}
      {draftMessage && (
        <div className="glass rounded-2xl px-4 py-3 text-amber-400 flex items-center gap-2">
          {draftMessage}
        </div>
      )}

      {/* Period picker (2-week) */}
      <div className="glass rounded-3xl p-4 flex items-center justify-between">
        <button
          onClick={() => setPeriodOffset(o => o - 1)}
          className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5"
        >
          ← Prev
        </button>
        <div className="text-lg font-medium">
          {fmtRange(start, end)} <span className="text-zinc-500 text-sm">({periodId})</span>
        </div>
        <button
          onClick={() => setPeriodOffset(o => o + 1)}
          className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5"
        >
          Next →
        </button>
      </div>

      {/* Summary */}
      <div className="glass rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="text-sm text-zinc-400">Employee</div>
          <div className="font-medium">{user.first_name} {user.last_name}</div>
          <div className="text-sm text-zinc-500">{user.job_role || ''}</div>
        </div>
        <div>
          <div className="text-sm text-zinc-400">Approver</div>
          <div className="font-medium">Taylor Brooks</div>
          <div className="text-sm text-zinc-500">Engineering Manager</div>
        </div>
        <div>
          <div className="flex flex-wrap gap-3">
            <div className="px-3 py-1 rounded-full text-sm border border-white/10">
              Total: <span className="font-mono">{totalHours.toFixed(1)}</span> h
            </div>
            <div className="px-3 py-1 rounded-full text-sm border border-white/10">
              Regular: <span className="font-mono">{regularHours.toFixed(1)}</span> h
            </div>
            <div className="px-3 py-1 rounded-full text-sm border border-white/10">
              OT×1.5: <span className="font-mono">{overtimeHours.toFixed(1)}</span> h
            </div>
            <div className="px-3 py-1 rounded-full text-sm border border-white/10 text-zinc-400">
              PTO: 0.0 h
            </div>
          </div>
        </div>
      </div>

      {/* Timecards table (14-day period) */}
      <div className="glass rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="px-6 py-3 border-b border-white/10 flex justify-between text-xs uppercase tracking-[1px] text-zinc-400" style={{ minWidth: '700px' }}>
          {dayNames.map((n, i) => (
            <div key={i} className="text-center">{n}</div>
          ))}
        </div>
        <div className="px-6 py-4 flex justify-between gap-3" style={{ minWidth: '700px' }}>
          {dayDates.map((d, i) => {
            const key = entryKey(periodId, i)
            const val = entries[key] || ''
            const h = parseHours(val)
            const isOT = h > 8
            return (
              <div key={i} className="text-center">
                <div className="text-xs text-zinc-500 mb-1">
                  {d.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => setDayHours(i, e.target.value)}
                  className={`w-full text-center font-mono rounded-xl bg-black/40 border ${isOT ? 'border-amber-400/60' : 'border-white/10'} px-2 py-2 focus:outline-none focus:border-white/30`}
                  placeholder="0"
                  disabled={isSubmitted}
                />
                <div className="text-[10px] text-zinc-500 mt-1">{h.toFixed(1)} h</div>
              </div>
            )
          })}
        </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="glass rounded-3xl p-4">
        <label className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            checked={certified}
            onChange={(e) => setCertified(e.target.checked)}
            disabled={isSubmitted}
            className="w-4 h-4 accent-white"
          />
          <span className="text-sm">I certify this timesheet is accurate and complete.</span>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSaveDraft}
            className="px-5 py-2.5 rounded-xl border border-white/20 hover:bg-white/5"
          >
            Save draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={!certified || isSubmitted}
            className="glass-btn-green px-5 py-2.5 rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit timesheet
          </button>
        </div>

        <p className="text-[11px] text-zinc-500 mt-4">
          Once submitted, this week is locked for editing until approval or rejection.
        </p>
      </div>
    </div>
  )
}

// ===== Logo SVG =====
function LogoSVG({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none" className={className}>
      <circle cx="100" cy="100" r="86" stroke="white" strokeWidth="2"/>
      <path d="M 116 28 L 70 108 L 102 108 L 80 172 L 146 90 L 112 90 Z" fill="white"/>
    </svg>
  )
}

function getThemeAccentHex(theme: string): string {
  if (theme === 'white') return '#E5E7EB'
  if (theme === 'orange') return '#F97316'
  if (theme === 'cyan') return '#51FEFE'
  if (theme === 'pink') return '#FE51D7'
  if (theme === 'purple') return '#9B51FE'
  return '#D7FE51'
}

// ===== Auth pages =====
function LoginPage() {
  const [email, setEmail] = useState(() => localStorage.getItem('lastEmail') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [shockwaveActive] = useState(false)
  const [showFeaturePreview, setShowFeaturePreview] = useState(false)

  const isReturningUser = !!localStorage.getItem('lastEmail')
  const loginAccentHex = getThemeAccentHex(localStorage.getItem('theme') || 'green')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Access denied. Check credentials.')
      } else {
        localStorage.setItem('user', JSON.stringify(data))
        localStorage.setItem('lastEmail', email)
        window.location.href = '.'
      }
    } catch {
      setError('Connection to Grok system failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative flex">
      {/* Animated background layer */}
      <div className="absolute inset-0 bg-[radial-gradient(#0a1629_0.8px,transparent_1px)] bg-[length:4px_4px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0A0F1E] to-black" />
      {/* Subtle neural grid */}
      <div className={`absolute inset-0 transition-all duration-300 ${shockwaveActive ? 'opacity-[0.18] scale-[1.015]' : 'opacity-[0.06]'}`} style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
        backgroundSize: '48px 48px'
      }} />
      {/* Subtle ambient glow */}
      <div className="absolute top-1/2 right-[18%] -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-white opacity-[0.015] blur-[120px]" />

      {/* Shockwave ripple */}
      {shockwaveActive && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="w-0 h-0 rounded-full border-[2px] border-[#D7FE51] animate-[shockwave_900ms_ease-out_forwards]" style={{ boxShadow: '0 0 60px 10px #D7FE51, 0 0 120px 30px rgba(215,254,81,0.3)' }} />
        </div>
      )}

      {/* Left: Brand + System Identity */}
      <div className="hidden lg:flex w-5/12 flex-col justify-between p-10 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <LogoSVG className="h-9 w-auto" />
            <span className="font-semibold text-2xl tracking-[1px]">SWIFTSHIFT</span>
          </div>
          <div className="max-w-[380px]">
            <div className="uppercase tracking-[4px] text-xs text-zinc-500 mb-3"><span style={{ color: loginAccentHex }}>AI POWERED</span> HR ENTERPRISE PLATFORM</div>
            <h1 className="text-[60px] leading-[1.05] font-semibold tracking-tighter mb-5">
              Time is money.
            </h1>
            <div className="text-base text-zinc-400 space-y-2">
              <div>Log in one time, and STAY logged in.</div>
              <div>Effortless navigation.</div>
              <div>Frictionless clock in.</div>
              <div>Real time visualized earnings.</div>
              <div>Find the best-matched jobs.</div>
              <div>Taxes filed instantly with AI.</div>
              <div>AI assisted HR support with Swifty.</div>
            </div>
          </div>
        </div>

        {/* Signature: System Status */}
        <div className="flex items-center gap-3 text-sm">
          <div className="w-2 h-2 rounded-full bg-[#D7FE51] animate-pulse" />
          <span className="text-white/60 tracking-wide">System Status: Online</span>
        </div>
      </div>

      {/* Right: Control Panel */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="glass w-full max-w-[380px] rounded-3xl p-8 border border-white/10">
          {/* Header */}
          <div className="mb-6">
            <div className="text-xs tracking-[2px] text-[#D7FE51] mb-1.5 uppercase">Sign In to SwiftShift</div>
            <h2 className="text-3xl font-semibold tracking-tight mb-1.5">Welcome back</h2>
            {isReturningUser && (
              <p className="text-zinc-400 text-sm">Good to see you. Ready to clock in?</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1 tracking-wide">EMAIL</label>
              <div className={`relative transition-all ${focusedField === 'email' ? 'scale-[1.01]' : ''}`}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className="glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)] outline-none transition-all"
                  placeholder="you@company.com"
                  required
                  autoFocus={!isReturningUser}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1 tracking-wide">PASSWORD</label>
              <div className={`relative transition-all ${focusedField === 'password' ? 'scale-[1.01]' : ''}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className="glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)] outline-none pr-12 transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm text-red-400 flex items-center gap-2 bg-red-950/40 border border-red-900/60 rounded-xl px-4 py-2">
                ⚠ {error}
              </div>
            )}

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className="glass-btn-green w-full py-3.5 rounded-2xl text-base font-semibold tracking-[0.5px] mt-1 transition-all active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-[0_0_30px_-8px_rgba(215,254,81,0.6)]"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            {/* Links */}
            <div className="flex justify-between text-sm pt-1">
              <a href="#" className="text-zinc-500 hover:text-white transition-colors">Forgot password?</a>
              <a href="signup" className="text-zinc-400 hover:text-white underline underline-offset-4">Create account</a>
            </div>

            {/* Tour button */}
            <div className="text-center mt-1">
              <button
                type="button"
                onClick={() => setShowFeaturePreview(true)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Explore features →
              </button>
            </div>
          </form>

          {/* Footer hint */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center text-[10px] text-zinc-500 tracking-[1px]">
            Secure · Encrypted · Audited
          </div>
        </div>
      </div>

      {/* Footer: bottom right corner */}
      <div className="absolute bottom-6 right-0 p-4 text-[10px] text-zinc-600">
        © 2026 SwiftShift. All rights reserved.
      </div>

      {showFeaturePreview && (
        <FeaturePreview
          onClose={() => setShowFeaturePreview(false)}
          accentHex={loginAccentHex}
        />
      )}
    </div>
  )
}

function SignupPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [shockwaveActive] = useState(false)
  const [showFeaturePreview, setShowFeaturePreview] = useState(false)
  const signupAccentHex = getThemeAccentHex(localStorage.getItem('theme') || 'green')
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.')
      } else {
        localStorage.setItem('user', JSON.stringify(data))
        localStorage.setItem('lastEmail', email)
        localStorage.setItem('swiftshift-tour-pending', '1')
        window.location.href = '.'
      }
    } catch {
      setError('Connection to Grok system failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative flex">
      {/* Animated background layer */}
      <div className="absolute inset-0 bg-[radial-gradient(#0a1629_0.8px,transparent_1px)] bg-[length:4px_4px]" />
      <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0A0F1E] to-black" />
      {/* Subtle neural grid */}
      <div className={`absolute inset-0 transition-all duration-300 ${shockwaveActive ? 'opacity-[0.18] scale-[1.015]' : 'opacity-[0.06]'}`} style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
        backgroundSize: '48px 48px'
      }} />
      {/* Radial glow */}
      <div className="absolute top-1/2 right-[18%] -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-white opacity-[0.035] blur-[120px]" />

      {/* Left: Brand + System Identity */}
      <div className="hidden lg:flex w-5/12 flex-col justify-between p-10 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <LogoSVG className="h-9 w-auto" />
            <span className="font-semibold text-2xl tracking-[1px]">SWIFTSHIFT</span>
          </div>
          <div className="max-w-[380px]">
            <div className="uppercase tracking-[4px] text-xs text-zinc-500 mb-3"><span style={{ color: signupAccentHex }}>AI POWERED</span> HR ENTERPRISE PLATFORM</div>
            <h1 className="text-[60px] leading-[1.05] font-semibold tracking-tighter mb-5">
              Time is money.
            </h1>
            <div className="text-base text-zinc-400 space-y-2">
              <div>Log in one time, and STAY logged in.</div>
              <div>Effortless navigation.</div>
              <div>Frictionless clock in.</div>
              <div>Real time visualized earnings.</div>
              <div>Find the best-matched jobs.</div>
              <div>Taxes filed instantly with AI.</div>
              <div>AI assisted HR support with Swifty.</div>
            </div>
          </div>
        </div>

        {/* Signature: System Status */}
        <div className="flex items-center gap-3 text-sm">
          <div className="w-2 h-2 rounded-full bg-[#D7FE51] animate-pulse" />
          <span className="text-white/60 tracking-wide">System Status: Online</span>
        </div>
      </div>

      {/* Right: Control Panel */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="glass w-full max-w-[380px] rounded-3xl p-8 border border-white/10">
          <div className="mb-6">
            <div className="text-xs tracking-[2px] text-[#D7FE51] mb-1.5 uppercase">Create Your Account</div>
            <h2 className="text-3xl font-semibold tracking-tight mb-1.5">Get started</h2>
            <p className="text-zinc-400 text-sm">Set up your account in seconds.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1 tracking-wide">FIRST NAME</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  onFocus={() => setFocusedField('first')}
                  onBlur={() => setFocusedField(null)}
                  className={`glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)] outline-none transition-all ${focusedField === 'first' ? 'scale-[1.01]' : ''}`}
                  placeholder="Alex"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1 tracking-wide">LAST NAME</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  onFocus={() => setFocusedField('last')}
                  onBlur={() => setFocusedField(null)}
                  className={`glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)] outline-none transition-all ${focusedField === 'last' ? 'scale-[1.01]' : ''}`}
                  placeholder="Rivera"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1 tracking-wide">WORK EMAIL</label>
              <div className={`relative transition-all ${focusedField === 'email' ? 'scale-[1.01]' : ''}`}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className="glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)] outline-none transition-all"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-zinc-400 mb-1 tracking-wide">PASSWORD</label>
              <div className={`relative transition-all ${focusedField === 'password' ? 'scale-[1.01]' : ''}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className="glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)] outline-none pr-12 transition-all"
                  placeholder="Min 8 characters"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-400 flex items-center gap-2 bg-red-950/40 border border-red-900/60 rounded-xl px-4 py-2">
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="glass-btn-green w-full py-3.5 rounded-2xl text-base font-semibold tracking-[0.5px] mt-1 transition-all active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-[0_0_30px_-8px_#D7FE51]"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            <div className="text-center text-sm pt-1">
              <a href="login" className="text-zinc-400 hover:text-white underline underline-offset-4">Already have an account?</a>
            </div>

            {/* Tour button */}
            <div className="text-center mt-1">
              <button
                type="button"
                onClick={() => setShowFeaturePreview(true)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Explore features →
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 text-center text-[10px] text-zinc-500 tracking-[1px]">
            Secure · Encrypted · Audited
          </div>
        </div>
      </div>

      {/* Footer: bottom right corner */}
      <div className="absolute bottom-6 right-0 p-4 text-[10px] text-zinc-600">
        © 2026 SwiftShift. All rights reserved.
      </div>

      {showFeaturePreview && (
        <FeaturePreview
          onClose={() => setShowFeaturePreview(false)}
          accentHex={signupAccentHex}
        />
      )}
    </div>
  )
}

// ===== Main App (existing) =====
export default function App() {
  const pathname = window.location.pathname
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : null

  // Route: auth pages (handle subpath deployments like /hackathon/preview/doesitworkday/)
  const isRoot = pathname === '/' || pathname.endsWith('/')
  const isLogin = pathname === '/login' || pathname.endsWith('/login')
  const isSignup = pathname === '/signup' || pathname.endsWith('/signup')
  const isAdmin = pathname === '/admin' || pathname.endsWith('/admin')

  if (isSignup) return <SignupPage />

  // Gate: nothing visible without login
  if (!user) {
    if (isLogin || isRoot) {
      return <LoginPage />
    }
    // Any other path (admin, profile, etc.) without auth → login
    return <LoginPage />
  }

  // If logged in and on login page, fall through to main app
  if (isLogin || isRoot) {
    // already logged in, continue
  }

  // Main app
  const [activeView, setActiveView] = useState<View>('clock')
  const [showTour, setShowTour] = useState(() => localStorage.getItem('swiftshift-tour-pending') === '1')
  const [chatMessage, setChatMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [attachedFile, setAttachedFile] = useState<{ file_id: string; filename: string } | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [theme, setTheme] = useState<'green' | 'white' | 'orange' | 'cyan' | 'pink' | 'purple'>(() => {
    const saved = localStorage.getItem('theme')
    return (saved === 'green' || saved === 'white' || saved === 'orange' || saved === 'cyan' || saved === 'pink' || saved === 'purple') ? saved : 'green'
  })
  const [orgExpanded, setOrgExpanded] = useState<Set<string>>(new Set())
  const [orgExpandedAll, setOrgExpandedAll] = useState(true)
  const [orgSearch, setOrgSearch] = useState('')
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set())
  const [instaJobs, setInstaJobs] = useState<any[]>([])
  const [instaUploading, setInstaUploading] = useState(false)

  // Grok Tax - document upload + AI-filled 1040
  const [taxUploadedFiles, setTaxUploadedFiles] = useState<string[]>([])
  const [taxFormData, setTaxFormData] = useState<any | null>(null)
  const [taxLoading, setTaxLoading] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<{ label: string; content: string } | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navTo = (view: View) => {
    setActiveView(view)
    setMobileMenuOpen(false)
  }

  const orgData = {
    id: 'ceo',
    name: 'Trevor Dixon',
    title: 'CEO & Founder',
    dept: 'Executive',
    email: 'co-founders@swiftshift.com',
    reportsTo: null,
    teamSize: 5,
    children: [
      {
        id: 'eng',
        name: 'Jordan Lee',
        title: 'CTO',
        dept: 'Engineering',
        email: 'jordan@swiftshift.com',
        reportsTo: 'Alex Rivera',
        teamSize: 3,
        children: [
          { id: 'fe', name: 'Sam Chen', title: 'Frontend Lead', dept: 'Engineering', email: 'sam@swiftshift.com', reportsTo: 'Jordan Lee', teamSize: 3, children: [
            { id: 'fe1', name: 'Parker Kim', title: 'Senior Frontend Engineer', dept: 'Engineering', email: 'parker@swiftshift.com', reportsTo: 'Sam Chen', teamSize: 0, children: [] },
            { id: 'fe2', name: 'Quinn Torres', title: 'Frontend Engineer', dept: 'Engineering', email: 'quinn@swiftshift.com', reportsTo: 'Sam Chen', teamSize: 0, children: [] },
          ] },
          { id: 'be', name: 'Taylor Kim', title: 'Backend Lead', dept: 'Engineering', email: 'taylor@swiftshift.com', reportsTo: 'Jordan Lee', teamSize: 4, children: [
            { id: 'be1', name: 'Cameron Ellis', title: 'Senior Backend Engineer', dept: 'Engineering', email: 'cameron@swiftshift.com', reportsTo: 'Taylor Kim', teamSize: 0, children: [] },
            { id: 'be2', name: 'Jordan Vale', title: 'Backend Engineer', dept: 'Engineering', email: 'jordanv@swiftshift.com', reportsTo: 'Taylor Kim', teamSize: 0, children: [] },
            { id: 'be3', name: 'Morgan Ellis', title: 'Backend Engineer', dept: 'Engineering', email: 'morgan@swiftshift.com', reportsTo: 'Taylor Kim', teamSize: 0, children: [] },
          ] },
          { id: 'infra', name: 'Casey Brooks', title: 'Infra Lead', dept: 'Engineering', email: 'casey@swiftshift.com', reportsTo: 'Jordan Lee', teamSize: 2, children: [
            { id: 'inf1', name: 'Riley Voss', title: 'DevOps Engineer', dept: 'Engineering', email: 'rileyv@swiftshift.com', reportsTo: 'Casey Brooks', teamSize: 0, children: [] },
          ] },
        ]
      },
      {
        id: 'sales',
        name: 'Casey Morgan',
        title: 'VP Sales',
        dept: 'Sales',
        email: 'casey@swiftshift.com',
        reportsTo: 'Alex Rivera',
        teamSize: 2,
        children: [
          { id: 'na', name: 'Jamie Quinn', title: 'North America Sales', dept: 'Sales', email: 'jamie@swiftshift.com', reportsTo: 'Casey Morgan', teamSize: 5, children: [
            { id: 'na1', name: 'Skyler Reed', title: 'Account Executive', dept: 'Sales', email: 'skyler@swiftshift.com', reportsTo: 'Jamie Quinn', teamSize: 0, children: [] },
            { id: 'na2', name: 'Avery Lane', title: 'Account Executive', dept: 'Sales', email: 'avery@swiftshift.com', reportsTo: 'Jamie Quinn', teamSize: 0, children: [] },
          ] },
          { id: 'eu', name: 'Riley Patel', title: 'Europe Sales', dept: 'Sales', email: 'riley@swiftshift.com', reportsTo: 'Casey Morgan', teamSize: 4, children: [
            { id: 'eu1', name: 'Dakota Lane', title: 'Account Executive', dept: 'Sales', email: 'dakota@swiftshift.com', reportsTo: 'Riley Patel', teamSize: 0, children: [] },
          ] },
        ]
      },
      {
        id: 'hr',
        name: 'Dana Morales',
        title: 'VP People',
        dept: 'HR',
        email: 'dana@swiftshift.com',
        reportsTo: 'Alex Rivera',
        teamSize: 3,
        children: [
          { id: 'hr1', name: 'Peyton Blake', title: 'HR Manager', dept: 'HR', email: 'peyton@swiftshift.com', reportsTo: 'Dana Morales', teamSize: 2, children: [] },
          { id: 'hr2', name: 'Sage Rivera', title: 'Recruiter', dept: 'HR', email: 'sage@swiftshift.com', reportsTo: 'Dana Morales', teamSize: 0, children: [] },
        ]
      },
      {
        id: 'mkt',
        name: 'Drew Ellis',
        title: 'VP Marketing',
        dept: 'Marketing',
        email: 'drew@swiftshift.com',
        reportsTo: 'Alex Rivera',
        teamSize: 3,
        children: [
          { id: 'mkt1', name: 'Harper Vale', title: 'Growth Lead', dept: 'Marketing', email: 'harper@swiftshift.com', reportsTo: 'Drew Ellis', teamSize: 2, children: [] },
          { id: 'mkt2', name: 'Rowan Knox', title: 'Brand Designer', dept: 'Marketing', email: 'rowan@swiftshift.com', reportsTo: 'Drew Ellis', teamSize: 0, children: [] },
        ]
      },
      {
        id: 'fin',
        name: 'Emerson Holt',
        title: 'CFO',
        dept: 'Finance',
        email: 'emerson@swiftshift.com',
        reportsTo: 'Alex Rivera',
        teamSize: 2,
        children: [
          { id: 'fin1', name: 'Finley Quinn', title: 'Controller', dept: 'Finance', email: 'finley@swiftshift.com', reportsTo: 'Emerson Holt', teamSize: 1, children: [] },
        ]
      },
    ]
  }

  useTimesheet() // runs side effects (seeding)

  // Clear tour-pending flag and mark as seen once tour is displayed
  useEffect(() => {
    if (showTour) {
      localStorage.removeItem('swiftshift-tour-pending')
    }
  }, [showTour])

  // Handle /admin URL
  useEffect(() => {
    if (isAdmin) setActiveView('admin')
  }, [isAdmin])

  // Load existing tax files for Grok Tax (check s3/<user_id> via fill-1040)
  useEffect(() => {
    if (activeView === 'groktax' && user?.id && taxUploadedFiles.length === 0 && !taxFormData) {
      handleFill1040()
    }
  }, [activeView, user?.id])

  // Persist theme
  useEffect(() => {
    localStorage.setItem('theme', theme)
  }, [theme])

  // Update favicon dynamically when theme changes
  useEffect(() => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="14" fill="#0a0a0a"/><circle cx="32" cy="32" r="27" stroke="white" stroke-width="1.5"/><path d="M 37 9 L 22 35 L 33 35 L 26 55 L 47 29 L 35 29 Z" fill="white"/></svg>`
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = url
  }, [])

  const cycleTheme = () => {
    setTheme(t => t === 'green' ? 'white' : t === 'white' ? 'orange' : t === 'orange' ? 'cyan' : t === 'cyan' ? 'pink' : t === 'pink' ? 'purple' : 'green')
  }

  const themeLabel = theme === 'green' ? 'Green' : theme === 'white' ? 'White' : theme === 'orange' ? 'Orange' : theme === 'cyan' ? 'Cyan' : theme === 'pink' ? 'Pink' : 'Purple'
  const themeDotColor = theme === 'green' ? 'bg-[#D7FE51]' : theme === 'white' ? 'bg-white' : theme === 'orange' ? 'bg-orange-400' : theme === 'cyan' ? 'bg-[#51FEFE]' : theme === 'pink' ? 'bg-[#FE51D7]' : 'bg-[#9B51FE]'
  const themeAccentHex = theme === 'green' ? '#D7FE51' : theme === 'white' ? '#E5E7EB' : theme === 'orange' ? '#F97316' : theme === 'cyan' ? '#51FEFE' : theme === 'pink' ? '#FE51D7' : '#9B51FE'

  // Load users for admin
  useEffect(() => {
    if (activeView === 'admin') {
      fetch(`${API_BASE}/api/users`)
        .then(r => (r.ok ? r.json() : []))
        .then(data => setUsers(Array.isArray(data) ? data : []))
        .catch(() => setUsers([]))
    }
  }, [activeView])

  // Clock state
  const [clockInAt, setClockInAt] = useState<Date | null>(null)
  const [breakStartedAt, setBreakStartedAt] = useState<Date | null>(null)
  const [breakMsAccum, setBreakMsAccum] = useState(0)
  const [todayWorkedMs, setTodayWorkedMs] = useState(0)
  const [now, setNow] = useState(new Date())
  const [_shockwaveActive, setShockwaveActive] = useState(false)
  const [ripplePos, setRipplePos] = useState<{ x: number; y: number } | null>(null)

  // Milestone tracking refs (persist across renders, reset on new clock session)
  const hoursMilestoneFiredRef = useRef<Set<number>>(new Set())
  const earningsMilestoneFiredRef = useRef<Set<number>>(new Set())
  const progressMilestoneFiredRef = useRef<Set<number>>(new Set())
  const loginWelcomeShownRef = useRef(false)

  // LootDrop modal state (shown after clock out)
  const [showLootDrop, setShowLootDrop] = useState(false)
  const [lootEarnings, setLootEarnings] = useState(0)
  const [lootPtoHours, setLootPtoHours] = useState(0)
  const [lootDurationMin, setLootDurationMin] = useState(0)

  // Target Ring confetti fired flag (once per session)
  const [targetRingConfettiFired, setTargetRingConfettiFired] = useState(false)
  const [overdriveConfettiFired, setOverdriveConfettiFired] = useState(false)

  // State-specific break reminder
  const [workState, setWorkState] = useState<string>(() => localStorage.getItem('swiftshift-work-state') || 'CA')
  const [showBreakReminder, setShowBreakReminder] = useState(false)
  const [breakReminderIsSecond, setBreakReminderIsSecond] = useState(false)
  // Tracks which reminder thresholds have already fired this clock session (reset on clock-in)
  const breakReminderFiredRef = useRef<Set<string>>(new Set())

  // Daily streak counter (gamified punctuality)
  const [streak, setStreak] = useState<number>(() => {
    const saved = localStorage.getItem('streak')
    return saved ? parseInt(saved, 10) : 0
  })
  const [lastStreakDate, setLastStreakDate] = useState<string>(() => {
    return localStorage.getItem('lastStreakDate') || ''
  })

  // Restore clock state from DB on login / user change
  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    Promise.all([
      fetch(`${API_BASE}/api/clock-sessions?employee_id=${uid}&active=1`),
      fetch(`${API_BASE}/api/clock-sessions?employee_id=${uid}`),
    ])
      .then(([activeRes, allRes]) => Promise.all([activeRes.json(), allRes.json()]))
      .then(([activeRows, allRows]) => {
        const active = Array.isArray(activeRows) && activeRows.length ? activeRows[0] : null
        const todayStr = new Date().toISOString().slice(0, 10)

        // Sum duration_minutes for today's completed sessions
        let todayMs = 0
        for (const row of allRows) {
          if (!row.clock_in) continue
          const d = row.clock_in.slice(0, 10)
          if (d === todayStr) {
            const mins = Number(row.duration_minutes) || 0
            todayMs += mins * 60 * 1000
          }
        }

        // If active session exists (clock_out IS NULL), restore clockInAt
        if (active && active.clock_in) {
          const clockInDate = new Date(active.clock_in)
          const activeElapsedMs = Math.max(0, Date.now() - clockInDate.getTime())
          // Add elapsed to today if clock_in is today
          if (active.clock_in.slice(0, 10) === todayStr) {
            todayMs += activeElapsedMs
          }
          setClockInAt(clockInDate)
          setBreakStartedAt(null)
          setBreakMsAccum(0)
        } else {
          setClockInAt(null)
        }

        setTodayWorkedMs(todayMs)
      })
      .catch(() => {})
  }, [user?.id])

  // Live clock tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Derived clock values
  const isClockedIn = clockInAt !== null
  const isOnBreak = breakStartedAt !== null
  const activeBreakMs = isOnBreak ? Math.max(0, now.getTime() - breakStartedAt.getTime()) : 0
  const sessionWorkedMs = isClockedIn
    ? Math.max(0, now.getTime() - clockInAt.getTime() - breakMsAccum - activeBreakMs)
    : 0
  const todayTotalMs = todayWorkedMs + sessionWorkedMs

  const statusText = !isClockedIn
    ? 'Not clocked in'
    : isOnBreak
      ? 'On break'
      : `Clocked in since ${clockInAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  // One-time login welcome toast
  useEffect(() => {
    if (!loginWelcomeShownRef.current) {
      loginWelcomeShownRef.current = true
      const hour = new Date().getHours()
      const g = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
      setTimeout(() => {
        toast.success(`Good ${g}, ${user.first_name}! 👋`, {
          description: streak > 0 ? `${streak}-day streak — keep it going!` : 'Ready to clock in?',
          duration: 8000,
          style: {
            background: '#111111',
            border: `1px solid ${getThemeAccentHex(theme)}`,
            color: '#ffffff',
          },
        })
      }, 1000)
    }
  }, [])

  // Hourly milestone toasts (fire each time a new whole hour is crossed)
  useEffect(() => {
    if (!isClockedIn) return
    const hoursWorked = Math.floor(todayTotalMs / 3600000)
    if (hoursWorked >= 1 && !hoursMilestoneFiredRef.current.has(hoursWorked)) {
      hoursMilestoneFiredRef.current.add(hoursWorked)
      const hourMsgs: Record<number, string> = {
        1: '1 hour in — nice start!',
        2: '2 hours down!',
        3: '3 hours — you\'re in the zone!',
        4: 'Halfway there — 4 hours! 💪',
        5: '5 hours — almost done!',
        6: '6 hours — strong work!',
        7: '7 hours — one more to go!',
        8: 'Full 8-hour day complete! 🎉',
      }
      toast.success(hourMsgs[hoursWorked] || `${hoursWorked} hours worked!`, {
        description: `Keep it up, ${user.first_name}!`,
      })
    }
  }, [Math.floor(todayTotalMs / 3600000)])

  // 25% / 50% / 75% daily goal progress toasts
  useEffect(() => {
    if (!isClockedIn) return
    const EIGHT_HOURS_MS = 8 * 3600000
    const pct = Math.floor((todayTotalMs / EIGHT_HOURS_MS) * 100)
    const milestones = [25, 50, 75]
    for (const m of milestones) {
      if (pct >= m && !progressMilestoneFiredRef.current.has(m)) {
        progressMilestoneFiredRef.current.add(m)
        const msgs: Record<number, string> = {
          25: '25% of your day done! 🏁',
          50: 'Halfway through your day! ⚡',
          75: '75% complete — almost there! 🚀',
        }
        toast.success(msgs[m], { description: `${user.first_name}, you're crushing it!` })
        confetti({ particleCount: 40, spread: 45, origin: { y: 0.75 }, colors: [themeAccentHex] })
        break
      }
    }
  }, [Math.floor((todayTotalMs / (8 * 3600000)) * 4)])

  // Earnings milestone toasts ($50, $100, $200, $400)
  useEffect(() => {
    if (!isClockedIn) return
    const earnings = (todayTotalMs / 3600000) * 65
    const milestones = [50, 100, 200, 400]
    for (const m of milestones) {
      if (earnings >= m && !earningsMilestoneFiredRef.current.has(m)) {
        earningsMilestoneFiredRef.current.add(m)
        toast.success(`$${m} earned today! 💰`, { description: 'Your wallet is growing.' })
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 }, colors: [themeAccentHex, '#FFD700'] })
        break
      }
    }
  }, [Math.floor((todayTotalMs / 3600000) * 65 / 50)])

  // Pay period
  const period = useMemo(() => payPeriodFor(now), [now])
  const periodLabel = `${period.start.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })} – ${period.end.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })}`
  const periodHours = (todayTotalMs / 3600000).toFixed(1)

  // Actions
  const handleClockIn = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!isClockedIn) {
      setClockInAt(now)
      setBreakStartedAt(null)

      // Update daily streak (freeze over weekends)
      const todayStr = now.toISOString().slice(0, 10)
      const todayDay = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
      const isWeekday = todayDay >= 1 && todayDay <= 5
      if (isWeekday) {
        let newStreak = 1
        if (lastStreakDate) {
          const lastDate = new Date(lastStreakDate)
          const lastDay = lastDate.getDay()
          const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / 86400000)
          // Continue streak if: yesterday (weekday) or Friday→Monday (weekend freeze)
          if (diffDays === 1 && lastDay >= 1 && lastDay <= 5) {
            newStreak = streak + 1
          } else if (diffDays <= 3 && lastDay === 5 && todayDay === 1) {
            // Friday to Monday (weekend freeze)
            newStreak = streak + 1
          }
        }
        setStreak(newStreak)
        setLastStreakDate(todayStr)
        localStorage.setItem('streak', String(newStreak))
        localStorage.setItem('lastStreakDate', todayStr)

        // Streak milestone celebrations
        if ([5, 10, 20, 30, 50].includes(newStreak)) {
          setTimeout(() => {
            confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: [themeAccentHex, '#FFD700', '#FF6B6B'] })
            setTimeout(() => confetti({ particleCount: 200, spread: 80, origin: { y: 0.65 }, colors: [themeAccentHex, '#FFD700'] }), 200)
          }, 400)
          toast.success(`🔥 ${newStreak}-day streak milestone!`, {
            description: newStreak >= 20 ? 'You\'re absolutely legendary!' : newStreak >= 10 ? 'You\'re on fire! Incredible consistency!' : 'High five! Keep that streak alive!',
          })
        } else {
          // Regular clock-in toast
          toast.success(`Clocked in! Let's go, ${user.first_name}!`, {
            description: newStreak > 1 ? `${newStreak}-day streak 🔥` : 'Time to make it count!',
          })
        }
      } else {
        // Weekend clock-in toast (no streak tracking)
        toast.success(`Clocked in! Working the weekend, ${user.first_name}?`, {
          description: 'Dedication noted! 💪',
        })
      }

      // Reset milestone trackers for new session
      hoursMilestoneFiredRef.current = new Set()
      earningsMilestoneFiredRef.current = new Set()
      progressMilestoneFiredRef.current = new Set()

      // Capture button center for ripple origin
      if (e?.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect()
        setRipplePos({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      } else {
        setRipplePos(null)
      }
      // Trigger shockwave
      setShockwaveActive(true)
      setTimeout(() => {
        setShockwaveActive(false)
        setRipplePos(null)
      }, 900)
    }
  }

  const handleStartBreak = () => {
    if (isClockedIn && !isOnBreak) {
      setBreakStartedAt(now)
    }
  }

  const handleEndBreak = () => {
    if (isOnBreak && breakStartedAt) {
      const delta = Math.max(0, now.getTime() - breakStartedAt.getTime())
      setBreakMsAccum(v => v + delta)
      setBreakStartedAt(null)
      const breakMins = Math.round(delta / 60000)
      const msgs = [
        "You're back — let's get it!",
        "Refreshed and ready to crush it!",
        "Break over — back to greatness!",
        "Recharged! Time to earn! ⚡",
        "Welcome back — you've got this!",
      ]
      toast.success(msgs[Math.floor(Math.random() * msgs.length)], {
        description: `Break: ${breakMins} min`,
      })
    }
  }

  // Persist work state to localStorage
  useEffect(() => {
    localStorage.setItem('swiftshift-work-state', workState)
  }, [workState])

  // Reset break reminder tracking when clocking in
  useEffect(() => {
    if (isClockedIn) {
      breakReminderFiredRef.current = new Set()
      setShowBreakReminder(false)
    }
  }, [isClockedIn])

  // State-specific break reminder logic
  useEffect(() => {
    if (!isClockedIn || isOnBreak) return
    const rule = STATE_BREAK_RULES[workState]
    if (!rule || rule.triggerAfterHours === 0) return

    const hoursWorked = sessionWorkedMs / 3600000

    // First meal break check
    if (hoursWorked >= rule.triggerAfterHours && !breakReminderFiredRef.current.has('first')) {
      breakReminderFiredRef.current.add('first')
      setBreakReminderIsSecond(false)
      setShowBreakReminder(true)
    }

    // Second meal break check (California and similar states)
    if (
      rule.secondBreakTriggerHours > 0 &&
      hoursWorked >= rule.secondBreakTriggerHours &&
      !breakReminderFiredRef.current.has('second')
    ) {
      breakReminderFiredRef.current.add('second')
      setBreakReminderIsSecond(true)
      setShowBreakReminder(true)
    }
  }, [sessionWorkedMs, isClockedIn, isOnBreak, workState])

  const handleClockOut = () => {
    if (isClockedIn) {
      // If currently on break, close it first
      let accum = breakMsAccum
      if (isOnBreak && breakStartedAt) {
        accum += Math.max(0, now.getTime() - breakStartedAt.getTime())
      }
      const session = Math.max(0, now.getTime() - clockInAt!.getTime() - accum)
      setTodayWorkedMs(v => v + session)
      setClockInAt(null)
      setBreakStartedAt(null)
      setBreakMsAccum(0)

      // Show LootDrop modal with earnings and PTO
      const hourlyRate = 65
      const ptoAccrualRate = 0.0385
      const hoursWorked = session / 3600000
      setLootEarnings(Math.round(hoursWorked * hourlyRate * 100) / 100)
      setLootPtoHours(Math.round(hoursWorked * ptoAccrualRate * 100) / 100)
      setLootDurationMin(Math.round(session / 60000))
      setShowLootDrop(true)
    }
  }

  const handleSendChat = async () => {
    const msg = chatMessage.trim()
    if ((!msg && !attachedFile) || chatLoading) return
    setChatLoading(true)
    const display = attachedFile ? `${msg ? msg + ' ' : ''}[${attachedFile.filename}]` : msg
    setChatHistory(h => [...h, { role: 'user', content: display }])
    const fileId = attachedFile?.file_id
    setChatMessage('')
    setAttachedFile(null)
    try {
      const res = await fetch(`${API_BASE}/api/grok/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, file_id: fileId, user_id: user?.id }),
      })
      const data = await res.json()
      const reply = res.ok ? (data.response || 'No response') : `Error: ${data.error || 'request failed'}`
      setChatHistory(h => [...h, { role: 'assistant', content: reply }])
    } catch (e) {
      const err = 'Error: network error'
      setChatHistory(h => [...h, { role: 'assistant', content: err }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleSuggestion = (suggestion: string) => {
    setChatMessage(suggestion)
    setTimeout(() => {
      handleSendChat()
    }, 50)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    if (user?.id) form.append('user_id', String(user.id))
    try {
      const res = await fetch(`${API_BASE}/api/grok/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.file_id) {
        setAttachedFile({ file_id: data.file_id, filename: data.filename || file.name })
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch {
      alert('Upload error')
    }
    e.target.value = ''
  }

  const handleTaxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setTaxLoading(true)
    const form = new FormData()
    form.append('file', file)
    form.append('user_id', String(user.id))
    try {
      const res = await fetch(`${API_BASE}/api/grok/tax/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) {
        setTaxUploadedFiles(prev => [...prev, file.name])
        // Auto-fill 1040 after upload
        await handleFill1040()
      } else {
        alert(data.error || 'Upload failed')
      }
    } catch {
      alert('Upload error')
    } finally {
      setTaxLoading(false)
      e.target.value = ''
    }
  }

  const handleFill1040 = async () => {
    if (!user?.id) return
    setTaxLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/grok/tax/fill-1040`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setTaxFormData(data)
        if (data.source_files?.length) setTaxUploadedFiles(data.source_files)
      } else {
        alert(data.error || 'Failed to fill 1040')
      }
    } catch {
      alert('Error filling form')
    } finally {
      setTaxLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    window.location.href = 'login'
  }

  return (
    <div className="ta-app" data-theme={theme}>
      <nav className="ta-navbar">
        <div className="flex items-center gap-2">
          {/* Hamburger (mobile only) */}
          <button
            className="ta-hamburger"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="ta-navbar-brand cursor-pointer" onClick={() => navTo('clock')}>
            <LogoSVG className="h-10 w-auto" />
            <span>SwiftShift</span>
          </div>
        </div>
        <div className="ta-navbar-user">
          {/* Daily streak counter */}
          <div className="flex items-center gap-1.5 px-3 py-1 text-sm text-white/60 border border-white/10 rounded-full">
            <span style={{ color: 'var(--accent-color)' }}>{streak > 0 ? '🔥' : '○'}</span>
            <span className="font-semibold" style={{ color: 'var(--accent-color)' }}>{streak}</span>
            <span className="text-white/40 ta-streak-label">day streak</span>
          </div>
          {/* User menu dropdown */}
          <div className="relative group">
            <span className="text-sm text-zinc-400 cursor-pointer">Hi, {user.first_name} ▾</span>
            <div className="absolute right-0 top-full w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-lg hidden group-hover:block z-50 pt-1">
              <button
                onClick={() => navTo('profile')}
                className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 rounded-t-xl"
              >
                Profile
              </button>
              <button
                onClick={() => setShowTour(true)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-white/5"
              >
                Take tour
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 text-zinc-400 cursor-not-allowed"
                disabled
              >
                Settings
              </button>
              <div className="px-4 py-2 text-sm border-t border-white/10 flex items-center gap-2">
                <div className="text-zinc-400">Theme:</div>
                <button
                  onClick={cycleTheme}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-white/80 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${themeDotColor}`} />
                  <span>{themeLabel}</span>
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 text-red-400 rounded-b-xl border-t border-white/10"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile sidebar backdrop */}
      <div
        className={`ta-sidebar-backdrop ${mobileMenuOpen ? 'mobile-open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={`ta-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <nav className="ta-nav">
          <button
            className={`ta-nav-btn ${activeView === 'clock' ? 'active' : ''}`}
            onClick={() => navTo('clock')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Time Clock
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'timesheet' ? 'active' : ''}`}
            onClick={() => navTo('timesheet')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            Timesheet
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'rewards' ? 'active' : ''}`}
            onClick={() => navTo('rewards')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
            Rewards
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'insurance' ? 'active' : ''}`}
            onClick={() => navTo('insurance')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Insurance &amp; Benefits
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'orgchart' ? 'active' : ''}`}
            onClick={() => navTo('orgchart')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <rect x="8" y="2" width="8" height="4" rx="1"/><rect x="2" y="14" width="8" height="4" rx="1"/><rect x="14" y="14" width="8" height="4" rx="1"/><line x1="12" y1="6" x2="12" y2="11"/><line x1="6" y1="14" x2="6" y2="11"/><line x1="18" y1="14" x2="18" y2="11"/><line x1="6" y1="11" x2="18" y2="11"/>
            </svg>
            Org Chart
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'taxes' ? 'active' : ''}`}
            onClick={() => navTo('taxes')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            Files
          </button>
          <button
            className={`ta-nav-btn mb-2 ${activeView === 'groktax' ? 'active' : ''}`}
            onClick={() => navTo('groktax')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
            </svg>
            Swifty - AI Tax Filing
          </button>
          <div className="ta-nav-section">Job Applications</div>
          <button
            className={`ta-nav-btn mb-2 ${activeView === 'applications' ? 'active' : ''}`}
            onClick={() => navTo('applications')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            InstaApply
          </button>
          <div className="ta-nav-section">Admin</div>
          <button
            className={`ta-nav-btn ${activeView === 'admin' ? 'active' : ''}`}
            onClick={() => navTo('admin')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Manage Users
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'schedules' ? 'active' : ''}`}
            onClick={() => navTo('schedules')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Schedule Management
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'payroll' ? 'active' : ''}`}
            onClick={() => navTo('payroll')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
            Payroll
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'reports' ? 'active' : ''}`}
            onClick={() => navTo('reports')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Reports &amp; Analytics
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'leaves' ? 'active' : ''}`}
            onClick={() => navTo('leaves')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            Leave Management
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'compliance' ? 'active' : ''}`}
            onClick={() => navTo('compliance')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            Compliance &amp; Audit
          </button>
          <button
            className={`ta-nav-btn ${activeView === 'hiring' ? 'active' : ''}`}
            onClick={() => navTo('hiring')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            Hiring &amp; Onboarding
          </button>
        </nav>
        <div className="mt-auto pt-4">
          <button
            className={`ta-nav-btn ${activeView === 'grokky' ? 'active' : ''}`}
            onClick={() => navTo('grokky')}
            style={{ color: 'var(--accent-color)', textShadow: '0 0 8px var(--accent-color)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
              <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1a7 7 0 01-7 7H9a7 7 0 01-7-7H1a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>
            </svg>
            Swifty - AI Assistant
          </button>
        </div>
      </aside>

      <div className="ta-content">
        <main className="ta-main">
          {activeView === 'clock' && (
            <>
              <div className="flex flex-col xl:flex-row gap-6 items-stretch max-w-[1200px] mx-auto">
              {/* Left: Dashboard */}
              <div className="flex-1 space-y-6">
                {/* Dashboard card */}
                <div className="glass rounded-3xl p-5 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-10">
                    {/* Left: Greeting, Time, Status, Buttons */}
                    <div className="flex-1">
                      <div className="text-sm text-zinc-400 mb-1">{longDate(now)}</div>
                      <div className="text-2xl font-semibold mb-6 neon-green">
                        {greeting(now.getHours())}, {user.first_name}
                      </div>

                      <div className="font-mono text-4xl sm:text-6xl tabular-nums tracking-[2px] mb-6">
                        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>

                      <div className="mb-4 text-sm">
                        <span className="text-zinc-400">Status: </span>
                        <span className={isOnBreak ? 'text-amber-400' : isClockedIn ? 'neon-green' : 'text-zinc-400'}>
                          {statusText}
                        </span>
                      </div>

                  <div className="flex flex-wrap gap-3">
                    {!isClockedIn && (
                      <motion.button
                        onClick={handleClockIn}
                        className="glass-btn-green px-5 py-2.5 rounded-xl font-semibold active:scale-[0.96] transition-all duration-75"
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        animate={{ boxShadow: ['0 0 0px rgba(var(--accent-color-rgb),0)', '0 0 18px 4px rgba(var(--accent-color-rgb),0.35)', '0 0 0px rgba(var(--accent-color-rgb),0)'] }}
                        transition={{ boxShadow: { repeat: Infinity, duration: 2, ease: 'easeInOut' } }}
                      >
                        Clock in
                      </motion.button>
                    )}
                    {isClockedIn && !isOnBreak && (
                      <>
                        <motion.button onClick={handleStartBreak} className="px-5 py-2.5 rounded-xl border border-white/20 hover:bg-white/5" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          Start break
                        </motion.button>
                        <motion.button onClick={handleClockOut} className="px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 text-white" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          Clock out
                        </motion.button>
                      </>
                    )}
                    {isOnBreak && (
                      <>
                        <motion.button onClick={handleEndBreak} className="px-5 py-2.5 rounded-xl border border-white/20 hover:bg-white/5" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          End break
                        </motion.button>
                        <motion.button onClick={handleClockOut} className="px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 text-white" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          Clock out
                        </motion.button>
                      </>
                    )}
                  </div>

                  {/* Work state selector for break law compliance */}
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Work state:</span>
                    <select
                      value={workState}
                      onChange={e => setWorkState(e.target.value)}
                      className="text-xs bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-zinc-300 focus:border-white/30 focus:outline-none"
                    >
                      {STATE_CODES.map(code => (
                        <option key={code} value={code}>
                          {code} — {STATE_BREAK_RULES[code].name}
                        </option>
                      ))}
                    </select>
                    {STATE_BREAK_RULES[workState]?.triggerAfterHours > 0 ? (
                      <span className="text-xs text-zinc-500">
                        · {STATE_BREAK_RULES[workState].mealBreakMinutes}-min break required by hour {STATE_BREAK_RULES[workState].triggerAfterHours + 1}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">· No state break law</span>
                    )}
                  </div>
                    </div>

                    {/* Right: Target Ring - 8-hour daily goal */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center">
                      {(() => {
                        const EIGHT_HOURS_MS = 8 * 3600000
                        const rawProgress = todayTotalMs / EIGHT_HOURS_MS
                        const progress = Math.min(rawProgress, 1.5) // allow overdrive up to 150%
                        const isOverdrive = rawProgress > 1
                        const remainingMs = Math.max(0, EIGHT_HOURS_MS - todayTotalMs)
                        const hh = Math.floor(remainingMs / 3600000)
                        const mm = Math.floor((remainingMs % 3600000) / 60000)
                        const ss = Math.floor((remainingMs % 60000) / 1000)
                        const countdown = `${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`

                        // Fire confetti once at 100%
                        if (rawProgress >= 1 && !targetRingConfettiFired) {
                          setTimeout(() => {
                            confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: [themeAccentHex, '#39FF14', '#00CC00'] })
                            confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 }, colors: [themeAccentHex, '#39FF14'] })
                          }, 100)
                          setTargetRingConfettiFired(true)
                        }

                        // Fire gold confetti on entering overdrive
                        if (isOverdrive && !overdriveConfettiFired) {
                          setTimeout(() => {
                            confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#FFAA00', '#FFD700', '#FFA500'] })
                            confetti({ particleCount: 180, spread: 80, origin: { y: 0.6 }, colors: ['#FFAA00', '#FFD700'] })
                          }, 150)
                          setOverdriveConfettiFired(true)
                        }

                        const radius = 82
                        const circumference = 2 * Math.PI * radius
                        // Progress ring: empty at 0, full at 100%
                        const offset = circumference * (1 - Math.min(progress, 1))

                        return (
                          <div className="relative w-[200px] h-[200px] flex items-center justify-center">
                            <svg width="200" height="200" className="absolute" style={isOverdrive ? { filter: 'drop-shadow(0 0 12px #FFAA00) drop-shadow(0 0 24px #FFD700)' } : undefined}>
                              {/* Background ring */}
                              <circle cx="100" cy="100" r={radius} fill="none" stroke="#222" strokeWidth="10" />
                              {/* Progress arc */}
                              <motion.circle
                                cx="100" cy="100" r={radius}
                                fill="none"
                                stroke={isOverdrive ? '#FFAA00' : 'var(--accent-color)'}
                                strokeWidth={isOverdrive ? 12 : 10}
                                strokeLinecap="round"
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: offset }}
                                transition={{ type: 'spring', stiffness: isOverdrive ? 100 : 70, damping: isOverdrive ? 15 : 20 }}
                                style={{ strokeDasharray: circumference }}
                              />
                            </svg>
                            {/* Center content */}
                            <div className="text-center z-10">
                              <div className={`text-[10px] uppercase tracking-[2px] mb-1 ${isOverdrive ? 'text-[#FFAA00]' : 'text-zinc-500'}`}>
                                {isOverdrive ? 'OVERDRIVE' : 'Time Remaining'}
                              </div>
                              <div className={`font-mono text-2xl tabular-nums tracking-[1px] ${isOverdrive ? 'text-[#FFAA00]' : 'text-white'}`}>
                                {isOverdrive ? `+${formatMs(todayTotalMs - EIGHT_HOURS_MS)}` : countdown}
                              </div>
                              <div className="text-[10px] text-zinc-500 mt-1">{isOverdrive ? 'time-and-a-half' : '8-hour day'}</div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div className="glass rounded-2xl p-4">
                      <div className="text-zinc-400 mb-1">Session</div>
                      <motion.div
                        key={Math.floor(sessionWorkedMs / 60000)}
                        initial={isClockedIn && !isOnBreak ? { opacity: 0.6 } : false}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="font-mono text-xl neon-green"
                      >
                        {formatMs(sessionWorkedMs)}
                      </motion.div>
                    </div>
                    <div className="glass rounded-2xl p-4">
                      <div className="text-zinc-400 mb-1">Breaks</div>
                      <div className="font-mono text-xl neon-green">{formatMs(breakMsAccum + activeBreakMs)}</div>
                    </div>
                    <div className="glass rounded-2xl p-4">
                      <div className="text-zinc-400 mb-1">Today</div>
                      <div className="font-mono text-xl neon-green">{formatMs(todayTotalMs)}</div>
                    </div>
                  </div>
                  {/* Day progress bar */}
                  {isClockedIn && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>Daily goal progress</span>
                        <span>{Math.min(100, Math.round((todayTotalMs / (8 * 3600000)) * 100))}%</span>
                      </div>
                      <div className="crystal-progress">
                        <motion.div
                          className="crystal-progress-fill"
                          animate={{ width: `${Math.min(100, (todayTotalMs / (8 * 3600000)) * 100)}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Right sidebar: This pay period + Real Time Rewards */}
              <aside className="xl:w-80 shrink-0 flex flex-col sm:flex-row xl:flex-col gap-4">
                <div className="glass rounded-3xl p-8 flex-1">
                  <div className="text-sm uppercase tracking-[2px] text-white mb-3">This pay period</div>
                  <div className="text-lg font-medium mb-2 neon-green">{periodLabel}</div>
                  <div className="text-sm text-zinc-400 mb-4">Regular hours: <span className="font-mono neon-green">{periodHours}</span> hrs</div>
                  <button
                    onClick={() => navTo('timesheet')}
                    className="text-sm underline decoration-white/30 hover:decoration-white"
                  >
                    See my time →
                  </button>
                </div>

                {/* Real Time Rewards module */}
                <div className="glass rounded-3xl p-8 flex-1">
                  <div className="text-sm uppercase tracking-[2px] text-white mb-3">Real Time Rewards</div>
                  <div className="mb-3">
                    <div className="text-xs text-zinc-400 mb-1">Today's Earnings</div>
                    <motion.div
                      key={Math.floor((todayTotalMs / 3600000) * 65 * 10)}
                      initial={isClockedIn ? { scale: 1.08, color: 'var(--accent-color)' } : false}
                      animate={{ scale: 1, color: 'var(--accent-color)' }}
                      transition={{ duration: 0.25 }}
                      className="font-mono text-2xl font-semibold tabular-nums neon-green"
                    >
                      ${((todayTotalMs / 3600000) * 65).toFixed(2)}
                    </motion.div>
                    {isClockedIn && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full animate-pulse inline-block"
                          style={{ background: '#22ff7a', boxShadow: '0 0 8px #22ff7a, 0 0 16px #22ff7a60' }}
                        />
                        <span className="text-xs uppercase tracking-widest text-zinc-300 font-medium">live</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-zinc-400">PTO Accrued:</div>
                    <div className="text-sm font-semibold neon-green">
                      {((todayTotalMs / 3600000) / 30).toFixed(3)} hrs
                    </div>
                  </div>
                  <button
                    onClick={() => navTo('rewards')}
                    className="text-sm underline decoration-white/30 hover:decoration-white"
                  >
                    See rewards →
                  </button>
                </div>
              </aside>
            </div>
            </>
          )}

          {activeView === 'timesheet' && (
            <TimesheetView user={user} />
          )}
          {activeView === 'rewards' && (
            <Rewards
              totalHours={todayTotalMs / 3600000}
              elapsedSeconds={Math.floor(sessionWorkedMs / 1000)}
              isClockedIn={isClockedIn}
              theme={theme}
              user={user}
            />
          )}
          {activeView === 'admin' && (
            <div className="max-w-5xl mx-auto">
              <div className="glass rounded-3xl p-8">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h1 className="text-2xl font-semibold neon-green">Admin: Manage Users</h1>
                  <button
                    onClick={() => {
                      users.forEach(u => {
                        fetch(`${API_BASE}/api/users/${u.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ first_name: u.first_name, last_name: u.last_name, email: u.email, job_role: u.job_role, manager_name: u.manager_name, is_fulltime: u.is_fulltime, pay: u.pay, salary: u.salary }),
                        })
                      })
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}
                  >
                    Save Changes
                  </button>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: '700px' }}>
                  <thead>
                    <tr className="text-zinc-400 border-b border-white/10">
                      <th className="text-left py-1">First Name</th>
                      <th className="text-left py-1">Last Name</th>
                      <th className="text-left py-1">Email</th>
                      <th className="text-left py-1">Job Role</th>
                      <th className="text-left py-1">Manager</th>
                      <th className="text-left py-1">Fulltime</th>
                      <th className="text-left py-1">Pay (hr)</th>
                      <th className="text-left py-1">Salary (yr)</th>
                      <th className="text-left py-1">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-white/10">
                        <td className="py-1">
                          <input
                            className="bg-black/40 border border-white/10 rounded px-2 py-0.5 w-20"
                            value={u.first_name}
                            onChange={(e) => setUsers(users.map(x => x.id === u.id ? { ...x, first_name: e.target.value } : x))}
                          />
                        </td>
                        <td className="py-1">
                          <input
                            className="bg-black/40 border border-white/10 rounded px-2 py-0.5 w-20"
                            value={u.last_name}
                            onChange={(e) => setUsers(users.map(x => x.id === u.id ? { ...x, last_name: e.target.value } : x))}
                          />
                        </td>
                        <td className="py-1">
                          <input
                            className="bg-black/40 border border-white/10 rounded px-2 py-0.5 w-32"
                            value={u.email}
                            onChange={(e) => setUsers(users.map(x => x.id === u.id ? { ...x, email: e.target.value } : x))}
                          />
                        </td>
                        <td className="py-1">
                          <input
                            className="bg-black/40 border border-white/10 rounded px-2 py-0.5 w-24"
                            value={u.job_role || ''}
                            onChange={(e) => setUsers(users.map(x => x.id === u.id ? { ...x, job_role: e.target.value } : x))}
                          />
                        </td>
                        <td className="py-1">
                          <select
                            className="bg-black/40 border border-white/10 rounded px-2 py-0.5 w-28"
                            value={u.manager_name || ''}
                            onChange={(e) => setUsers(users.map(x => x.id === u.id ? { ...x, manager_name: e.target.value } : x))}
                          >
                            <option value="">Select</option>
                            {users.filter(x => x.id !== u.id).map(m => (
                              <option key={m.id} value={`${m.first_name} ${m.last_name}`}>
                                {m.first_name} {m.last_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1">
                          <select
                            className="bg-black/40 border border-white/10 rounded px-2 py-0.5 w-16"
                            value={u.is_fulltime ? '1' : '0'}
                            onChange={(e) => setUsers(users.map(x => x.id === u.id ? { ...x, is_fulltime: e.target.value === '1' ? 1 : 0 } : x))}
                          >
                            <option value="1">Yes</option>
                            <option value="0">No</option>
                          </select>
                        </td>
                        <td className="py-1">
                          <input
                            type="number"
                            step="0.01"
                            className="bg-black/40 border border-white/10 rounded px-2 py-0.5 w-16"
                            value={u.pay ?? ''}
                            onChange={(e) => setUsers(users.map(x => x.id === u.id ? { ...x, pay: e.target.value ? parseFloat(e.target.value) : null } : x))}
                          />
                        </td>
                        <td className="py-1">
                          <input
                            type="number"
                            step="0.01"
                            className="bg-black/40 border border-white/10 rounded px-2 py-0.5 w-20"
                            value={u.salary ?? ''}
                            onChange={(e) => setUsers(users.map(x => x.id === u.id ? { ...x, salary: e.target.value ? parseFloat(e.target.value) : null } : x))}
                          />
                        </td>
                        <td className="py-1">
                          <button
                            onClick={() => {
                              if (!confirm(`Delete ${u.first_name} ${u.last_name}?`)) return
                              fetch(`${API_BASE}/api/users/${u.id}`, { method: 'DELETE' })
                                .then(() => setUsers(users.filter(x => x.id !== u.id)))
                            }}
                            className="px-2 py-0.5 rounded bg-red-600/80 hover:bg-red-600 text-xs text-white"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {users.length === 0 && <div className="text-zinc-400 mt-4">No users yet.</div>}
              </div>
            </div>
          )}
          {activeView === 'schedules' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold neon-green">Schedule Management</h1>
                  <p className="text-sm text-zinc-400">Manage shifts and employee schedules</p>
                </div>
                <button className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                  + Add Shift
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="glass rounded-2xl p-3">
                    <div className="text-xs font-semibold text-zinc-400 mb-2 uppercase">{day}</div>
                    {['Morning 6–2', 'Afternoon 2–10'].map((shift, i) => (
                      <div key={i} className="text-xs rounded-lg px-2 py-1.5 mb-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: 'var(--accent-color-dim)', borderLeft: '3px solid var(--accent-color)', color: 'var(--accent-color)' }}>
                        {shift}
                        <div className="text-zinc-400 mt-0.5">{i === 0 ? '3 assigned' : '2 assigned'}</div>
                      </div>
                    ))}
                    <div className="text-xs text-zinc-600 mt-2 text-center cursor-pointer hover:text-zinc-400">+ add</div>
                  </div>
                ))}
              </div>
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Shift Coverage Summary</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[['Total Shifts This Week', '14'], ['Filled Shifts', '11'], ['Open Shifts', '3']].map(([label, val]) => (
                    <div key={label} className="bg-white/5 rounded-2xl p-4 text-center">
                      <div className="text-2xl font-bold" style={{ color: 'var(--accent-color)' }}>{val}</div>
                      <div className="text-xs text-zinc-400 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeView === 'payroll' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold neon-green">Payroll</h1>
                  <p className="text-sm text-zinc-400">Current pay period: Apr 15 – Apr 30, 2026</p>
                </div>
                <button className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                  Run Payroll
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[['Total Payroll', '$48,320'], ['Employees Paid', '24'], ['Avg Hours/Employee', '38.5h'], ['Overtime Hours', '42h']].map(([label, val]) => (
                  <div key={label} className="glass rounded-2xl p-4 text-center">
                    <div className="text-2xl font-bold" style={{ color: 'var(--accent-color)' }}>{val}</div>
                    <div className="text-xs text-zinc-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Employee Payroll Summary</h2>
                <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '500px' }}>
                  <thead>
                    <tr className="text-zinc-400 border-b border-white/10 text-left">
                      <th className="py-2">Employee</th>
                      <th className="py-2">Role</th>
                      <th className="py-2">Hours</th>
                      <th className="py-2">Rate</th>
                      <th className="py-2">Gross Pay</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Alex Rivera', 'Co-Founder', '80h', '$85/hr', '$6,800', 'Processed'],
                      ['Jordan Lee', 'Engineering Lead', '76h', '$72/hr', '$5,472', 'Processed'],
                      ['Dana Morales', 'HR Director', '78h', '$65/hr', '$5,070', 'Pending'],
                      ['Casey Morgan', 'Sales Lead', '82h', '$60/hr', '$4,920', 'Pending'],
                    ].map(([name, role, hrs, rate, gross, status]) => (
                      <tr key={name} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 font-medium">{name}</td>
                        <td className="py-2 text-zinc-400">{role}</td>
                        <td className="py-2">{hrs}</td>
                        <td className="py-2">{rate}</td>
                        <td className="py-2 font-semibold" style={{ color: 'var(--accent-color)' }}>{gross}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status === 'Processed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}
          {activeView === 'reports' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-semibold neon-green">Reports &amp; Analytics</h1>
                <p className="text-sm text-zinc-400">Workforce performance and operational insights</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { title: 'Hours Worked (This Month)', value: '1,842h', change: '+4.2%', sub: 'vs last month' },
                  { title: 'Labor Cost (This Month)', value: '$94,600', change: '+1.8%', sub: 'vs last month' },
                  { title: 'Absenteeism Rate', value: '2.1%', change: '-0.4%', sub: 'improvement' },
                  { title: 'Overtime Rate', value: '8.3%', change: '+1.1%', sub: 'above target' },
                ].map(({ title, value, change, sub }) => (
                  <div key={title} className="glass rounded-2xl p-5">
                    <div className="text-sm text-zinc-400 mb-1">{title}</div>
                    <div className="text-3xl font-bold mb-1" style={{ color: 'var(--accent-color)' }}>{value}</div>
                    <div className="text-xs text-zinc-500"><span className={change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}>{change}</span> {sub}</div>
                  </div>
                ))}
              </div>
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Department Hours Breakdown</h2>
                <div className="space-y-3">
                  {[['Engineering', 680, 800], ['Sales', 420, 500], ['HR', 210, 240], ['Marketing', 190, 200], ['Finance', 140, 160]].map(([dept, used, total]) => (
                    <div key={dept}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{dept}</span>
                        <span className="text-zinc-400">{used}h / {total}h</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(((used as number) / (total as number)) * 100)}%`, backgroundColor: 'var(--accent-color)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeView === 'leaves' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold neon-green">Leave Management</h1>
                  <p className="text-sm text-zinc-400">Manage PTO requests and absence tracking</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[['Pending Requests', '5'], ['Approved This Month', '12'], ['Denied This Month', '2'], ['Avg PTO Balance', '14.2 days']].map(([label, val]) => (
                  <div key={label} className="glass rounded-2xl p-4 text-center">
                    <div className="text-2xl font-bold" style={{ color: 'var(--accent-color)' }}>{val}</div>
                    <div className="text-xs text-zinc-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Pending Leave Requests</h2>
                <div className="space-y-3">
                  {[
                    { name: 'Parker Kim', type: 'Vacation', dates: 'May 5–9, 2026', days: 5, status: 'Pending' },
                    { name: 'Quinn Torres', type: 'Sick Leave', dates: 'Apr 24, 2026', days: 1, status: 'Pending' },
                    { name: 'Skyler Reed', type: 'Personal', dates: 'May 12, 2026', days: 1, status: 'Pending' },
                    { name: 'Avery Lane', type: 'Vacation', dates: 'May 19–23, 2026', days: 5, status: 'Pending' },
                    { name: 'Dakota Lane', type: 'Bereavement', dates: 'Apr 25–27, 2026', days: 3, status: 'Pending' },
                  ].map(({ name, type, dates, days }) => (
                    <div key={name} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                      <div>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-zinc-400">{type} · {dates} · {days} day{days > 1 ? 's' : ''}</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Approve</button>
                        <button className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Deny</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeView === 'compliance' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-semibold neon-green">Compliance &amp; Audit</h1>
                <p className="text-sm text-zinc-400">Policy compliance, certifications, and audit logs</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[['Compliance Score', '94%'], ['Open Incidents', '2'], ['Overdue Trainings', '7']].map(([label, val]) => (
                  <div key={label} className="glass rounded-2xl p-4 text-center">
                    <div className="text-3xl font-bold" style={{ color: 'var(--accent-color)' }}>{val}</div>
                    <div className="text-xs text-zinc-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Recent Audit Log</h2>
                <div className="space-y-2">
                  {[
                    { time: 'Today 09:14', event: 'User role updated', user: 'Admin', severity: 'Info' },
                    { time: 'Today 08:52', event: 'Failed login attempt (3x)', user: 'unknown@email.com', severity: 'Warning' },
                    { time: 'Yesterday 17:30', event: 'Payroll run initiated', user: 'Dana Morales', severity: 'Info' },
                    { time: 'Yesterday 14:00', event: 'Employee record exported', user: 'Jordan Lee', severity: 'Info' },
                    { time: 'Apr 21 11:15', event: 'Incident report filed', user: 'Peyton Blake', severity: 'High' },
                  ].map(({ time, event, user, severity }) => (
                    <div key={time + event} className="flex items-center gap-4 bg-white/5 rounded-xl px-4 py-2.5 text-sm">
                      <span className="text-zinc-500 w-36 flex-shrink-0">{time}</span>
                      <span className="flex-1">{event}</span>
                      <span className="text-zinc-400 w-32 flex-shrink-0">{user}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${severity === 'High' ? 'bg-red-500/20 text-red-400' : severity === 'Warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{severity}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Required Certifications</h2>
                <div className="space-y-2">
                  {[
                    { cert: 'Workplace Safety Training', due: 'May 1, 2026', completed: 17, total: 24 },
                    { cert: 'Data Privacy & GDPR', due: 'Jun 15, 2026', completed: 22, total: 24 },
                    { cert: 'Anti-Harassment Policy', due: 'Apr 30, 2026', completed: 21, total: 24 },
                  ].map(({ cert, due, completed, total }) => (
                    <div key={cert} className="bg-white/5 rounded-xl px-4 py-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{cert}</span>
                        <span className="text-zinc-400">Due {due} · {completed}/{total} completed</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(completed / total * 100)}%`, backgroundColor: 'var(--accent-color)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeView === 'hiring' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold neon-green">Hiring &amp; Onboarding</h1>
                  <p className="text-sm text-zinc-400">Recruitment pipeline and new hire management</p>
                </div>
                <button className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                  + Post Job
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[['Open Positions', '6'], ['Active Applicants', '38'], ['Interviews This Week', '9'], ['Offers Pending', '3']].map(([label, val]) => (
                  <div key={label} className="glass rounded-2xl p-4 text-center">
                    <div className="text-2xl font-bold" style={{ color: 'var(--accent-color)' }}>{val}</div>
                    <div className="text-xs text-zinc-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="glass rounded-3xl p-6">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Hiring Pipeline</h2>
                  <div className="space-y-3">
                    {[
                      { role: 'Senior Backend Engineer', dept: 'Engineering', stage: 'Final Interview', applicants: 12 },
                      { role: 'Product Designer', dept: 'Design', stage: 'Phone Screen', applicants: 8 },
                      { role: 'Account Executive', dept: 'Sales', stage: 'Offer Sent', applicants: 5 },
                      { role: 'HR Coordinator', dept: 'HR', stage: 'Application Review', applicants: 7 },
                    ].map(({ role, dept, stage, applicants }) => (
                      <div key={role} className="bg-white/5 rounded-xl px-4 py-3">
                        <div className="font-medium text-sm">{role}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-zinc-400">{dept} · {applicants} applicants</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-color-dim)', color: 'var(--accent-color)' }}>{stage}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass rounded-3xl p-6">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Onboarding Queue</h2>
                  <div className="space-y-3">
                    {[
                      { name: 'Sam Carter', role: 'Frontend Engineer', start: 'May 5, 2026', progress: 30 },
                      { name: 'Mia Thompson', role: 'Product Designer', start: 'May 12, 2026', progress: 0 },
                      { name: 'Leo Kim', role: 'Account Executive', start: 'Apr 28, 2026', progress: 65 },
                    ].map(({ name, role, start, progress }) => (
                      <div key={name} className="bg-white/5 rounded-xl px-4 py-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium text-sm">{name}</div>
                            <div className="text-xs text-zinc-400">{role} · Starts {start}</div>
                          </div>
                          <span className="text-xs" style={{ color: 'var(--accent-color)' }}>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: 'var(--accent-color)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeView === 'insurance' && (
            <div className="max-w-[1200px] mx-auto space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold neon-green">Insurance & Benefits</h1>
                  <p className="text-sm text-zinc-400">Your coverage and benefit plans</p>
                </div>
                <div className="text-right text-sm">
                  <div className="text-zinc-400">Open Enrollment</div>
                  <div className="neon-green font-medium">Nov 1 – Nov 15</div>
                </div>
              </div>

              {/* Benefit summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass rounded-3xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <i className="bx bx-heart text-2xl" style={{ color: 'var(--accent-color)' }} />
                    </div>
                    <div>
                      <div className="font-semibold">Health</div>
                      <div className="text-xs text-zinc-500">PPO Plan</div>
                    </div>
                  </div>
                  <div className="text-3xl font-medium mb-1 neon-green">$2,450</div>
                  <div className="text-sm text-zinc-400 mb-2">Annual deductible</div>
                  <div className="text-xs text-zinc-500">Deductible met: $1,200 (49%)</div>
                  <div className="h-1.5 bg-white/10 rounded mt-2 overflow-hidden">
                    <div className="h-full w-1/2 rounded" style={{ background: 'var(--accent-color)' }} />
                  </div>
                </div>

                <div className="glass rounded-3xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <i className="bx bx-smile text-2xl" style={{ color: 'var(--accent-color)' }} />
                    </div>
                    <div>
                      <div className="font-semibold">Dental</div>
                      <div className="text-xs text-zinc-500">Delta Dental</div>
                    </div>
                  </div>
                  <div className="text-3xl font-medium mb-1 neon-green">100%</div>
                  <div className="text-sm text-zinc-400 mb-2">Preventive coverage</div>
                  <div className="text-xs text-zinc-500">2 cleanings + X-rays per year</div>
                </div>

                <div className="glass rounded-3xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <i className="bx bx-glasses text-2xl" style={{ color: 'var(--accent-color)' }} />
                    </div>
                    <div>
                      <div className="font-semibold">Vision</div>
                      <div className="text-xs text-zinc-500">VSP Choice</div>
                    </div>
                  </div>
                  <div className="text-3xl font-medium mb-1 neon-green">$180</div>
                  <div className="text-sm text-zinc-400 mb-2">Frame allowance</div>
                  <div className="text-xs text-zinc-500">Exam + lenses covered 100%</div>
                </div>

                <div className="glass rounded-3xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <i className="bx bx-piggy-bank text-2xl" style={{ color: 'var(--accent-color)' }} />
                    </div>
                    <div>
                      <div className="font-semibold">401(k)</div>
                      <div className="text-xs text-zinc-500">Fidelity</div>
                    </div>
                  </div>
                  <div className="text-3xl font-medium mb-1 neon-green">$48,320</div>
                  <div className="text-sm text-zinc-400 mb-2">Balance</div>
                  <div className="text-xs text-zinc-500">6% match • 12% total contrib.</div>
                </div>
              </div>

              {/* Additional benefit modules */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Life & Disability */}
                <div className="glass rounded-3xl p-4">
                  <div className="text-sm uppercase tracking-[2px] text-white mb-3">Life & Disability</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Life Insurance</div>
                        <div className="text-xs text-zinc-500">2× salary</div>
                      </div>
                      <div className="text-lg font-medium neon-green">$240k</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Short-Term Disability</div>
                        <div className="text-xs text-zinc-500">60% salary • 26 weeks</div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded bg-white/10">Active</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Long-Term Disability</div>
                        <div className="text-xs text-zinc-500">60% salary • to age 65</div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded bg-white/10">Active</div>
                    </div>
                  </div>
                </div>

                {/* Claims & Reimbursements */}
                <div className="glass rounded-3xl p-4">
                  <div className="text-sm uppercase tracking-[2px] text-white mb-3">Recent Claims</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between py-1.5 border-b border-white/10">
                      <div>
                        <div>Dr. Patel: Checkup</div>
                        <div className="text-xs text-zinc-500">Oct 12, 2025</div>
                      </div>
                      <div className="text-right">
                        <div className="neon-green">+$45</div>
                        <div className="text-xs text-zinc-400">Reimbursed</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/10">
                      <div>
                        <div>Delta Dental: Cleaning</div>
                        <div className="text-xs text-zinc-500">Sep 28, 2025</div>
                      </div>
                      <div className="text-right">
                        <div className="neon-green">+$95</div>
                        <div className="text-xs text-zinc-400">Reimbursed</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <div>
                        <div>Eye Exam (VSP)</div>
                        <div className="text-xs text-zinc-500">Aug 15, 2025</div>
                      </div>
                      <div className="text-right">
                        <div className="neon-green">+$25</div>
                        <div className="text-xs text-zinc-400">Reimbursed</div>
                      </div>
                    </div>
                  </div>
                  <button className="mt-2 text-xs underline decoration-white/30 hover:decoration-white">View all claims →</button>
                </div>
              </div>
            </div>
          )}
          {activeView === 'orgchart' && (
            <div className="flex-1 flex flex-col">
              {/* Header bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10">
                <div>
                  <p className="text-xs text-zinc-400">Tap/hover for details • Tap ▶ to expand</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search..."
                    className="bg-white/5 rounded-xl px-3 py-1.5 text-sm focus:bg-white/10 focus:outline-none flex-1 sm:w-56"
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                  />
                  <button
                    onClick={() => setOrgExpandedAll(!orgExpandedAll)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors whitespace-nowrap"
                  >
                    {orgExpandedAll ? 'Collapse All' : 'Expand All'}
                  </button>
                </div>
              </div>

              {/* Tree chart - fills remaining space */}
              <div className="flex-1 overflow-auto p-4">
                <div className="flex justify-center">
                  <OctopusChart
                    node={orgData}
                    expanded={orgExpanded}
                    setExpanded={setOrgExpanded}
                    search={orgSearch}
                    expandedAll={orgExpandedAll}
                  />
                </div>
              </div>
            </div>
          )}
          {activeView === 'taxes' && (
            <div className="max-w-5xl mx-auto">
              <div className="glass rounded-3xl p-8">
                <h1 className="text-2xl font-semibold mb-2 neon-green">Files</h1>
                <p className="text-sm text-zinc-400 mb-6">Quick access to all your documents</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: 'Latest Paystub', desc: 'Oct 2025 • PDF' },
                    { label: 'W-2 (2024)', desc: 'Tax year 2024 • PDF' },
                    { label: '1099-MISC', desc: 'Freelance income • PDF' },
                    { label: 'Benefits Summary', desc: 'Current coverage • PDF' },
                    { label: '401(k) Statement', desc: 'Q3 2025 • PDF' },
                    { label: 'PTO History', desc: 'Last 12 months • CSV' },
                  ].map((doc, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        const contents: Record<string, string> = {
                          'Latest Paystub': 'Pay Period: Oct 1–15, 2025\n\nGross Pay: $4,250.00\nDeductions:\n  Federal Tax: $680.00\n  Social Security: $263.50\n  Medicare: $61.63\n  401(k): $255.00\nNet Pay: $2,989.87\n\nEmployer: Acme Corp',
                          'W-2 (2024)': 'Form W-2 Wage and Tax Statement\nTax Year: 2024\n\nEmployer: Acme Corp\nEIN: 12-3456789\n\nWages, tips: $98,500.00\nFederal income tax withheld: $14,200.00\nSocial Security wages: $98,500.00\nMedicare wages: $98,500.00\nState wages: $98,500.00',
                          '1099-MISC': 'Form 1099-MISC\nTax Year: 2024\n\nPayer: Freelance Design LLC\n\nNonemployee compensation: $12,450.00\nPrizes/awards: $0.00\nOther income: $0.00\n\nNote: Report on Schedule C',
                          'Benefits Summary': 'Benefits Enrollment: Current Year\n\nMedical: Anthem PPO (Employee + Family)\nDental: Delta Dental\nVision: VSP\nLife Insurance: 2× salary\nDisability: Short-term + Long-term\n\n401(k) Match: 4% of eligible compensation\nHSA Contribution: $1,650 (employer)',
                          '401(k) Statement': '401(k) Account Statement\nQuarter: Q3 2025\n\nBeginning Balance: $119,200.00\nContributions: $4,875.00\nEmployer Match: $1,950.00\nInvestment Gains: $2,865.00\nEnding Balance: $128,890.00\n\nYTD Contributions: $14,625.00',
                          'PTO History': 'PTO Usage: Last 12 Months\n\nJan: 8 hrs used\nFeb: 16 hrs used\nMar: 0 hrs used\nApr: 24 hrs used\nMay: 8 hrs used\nJun: 0 hrs used\nJul: 32 hrs used\nAug: 8 hrs used\nSep: 0 hrs used\nOct: 16 hrs used\nNov: 8 hrs used\nDec: 0 hrs used\n\nTotal used: 120 hrs\nBalance: 40 hrs remaining',
                        }
                        setSelectedDoc({ label: doc.label, content: contents[doc.label] || 'Demo content unavailable.' })
                      }}
                      className="glass rounded-2xl p-5 cursor-pointer hover:scale-[1.01] transition-all border border-white/10 hover:border-white/30"
                    >
                      <div className="font-semibold">{doc.label}</div>
                      <div className="text-sm text-zinc-400">{doc.desc}</div>
                      <div className="mt-4 text-xs text-zinc-500 flex items-center gap-1">
                        Click to view
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 text-xs text-zinc-500">
                  All files are stored securely and available for 7 years. Need something older? <span className="underline cursor-pointer">Contact HR</span>.
                </div>
              </div>

              {/* File preview modal */}
              {selectedDoc && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
                  onClick={() => setSelectedDoc(null)}
                >
                  <div
                    className="glass rounded-3xl p-6 max-w-2xl w-[90%] max-h-[80vh] overflow-auto border border-white/20"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="font-semibold text-lg">{selectedDoc.label}</div>
                      <button
                        onClick={() => setSelectedDoc(null)}
                        className="text-zinc-400 hover:text-white text-xl leading-none"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-zinc-200 font-mono bg-black/40 rounded-xl p-4">
                      {selectedDoc.content}
                    </pre>
                    <div className="mt-4 text-[10px] text-zinc-500">Demo file. No real data.</div>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeView === 'groktax' && (
            <div className="max-w-5xl mx-auto">
              <div className="glass rounded-3xl flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                    <i className="bx bx-receipt text-xl" style={{ color: 'var(--accent-color)' }} />
                  </div>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--accent-color)' }}>Shifty AI Tax Filing</div>
                    <div className="text-xs text-zinc-500">AI-powered tax filing</div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {taxUploadedFiles.length === 0 && !taxFormData ? (
                    /* Empty state - upload prompt */
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="h-12 mb-6" />
                      <div className="text-2xl font-semibold mb-2 neon-green">Upload your tax documents</div>
                      <div className="text-zinc-400 max-w-md mb-8">Drop W-2s, 1099s, receipts, or any tax-related PDFs. Swifty will analyze and pre-fill your 1040.</div>
                      <label className="cursor-pointer px-6 py-3 rounded-2xl font-medium flex items-center gap-2" style={{ background: 'var(--accent-color)', color: '#000' }}>
                        <span>Upload Documents</span>
                        <input type="file" className="hidden" onChange={handleTaxUpload} disabled={taxLoading} />
                      </label>
                      {taxLoading && <div className="mt-4 text-sm text-zinc-500">Processing…</div>}
                    </div>
                  ) : (
                    /* After upload: show 1040 form + savings */
                    <div className="max-w-4xl mx-auto space-y-6">
                      {/* Uploaded files */}
                      <div className="glass rounded-2xl p-4">
                        <div className="text-sm uppercase tracking-[1px] text-zinc-500 mb-2">Source Documents</div>
                        <div className="flex flex-wrap gap-2">
                          {taxUploadedFiles.map((fn, i) => (
                            <div key={i} className="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10">{fn}</div>
                          ))}
                          <label className="px-3 py-1 text-xs rounded-full border border-white/10 hover:bg-white/5 cursor-pointer text-[var(--accent-color)]">
                            + Add more
                            <input type="file" className="hidden" onChange={handleTaxUpload} disabled={taxLoading} />
                          </label>
                        </div>
                      </div>

                      {/* 1040 Mock Form */}
                      <div className="glass rounded-3xl p-8">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <div className="text-lg font-medium">Form 1040: U.S. Individual Income Tax Return</div>
                            <div className="text-xs text-zinc-500">Pre-filled from your documents via RAG</div>
                          </div>
                          <div className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400">AI-Completed</div>
                        </div>

                        {taxFormData ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="bg-white/5 rounded-xl p-4">
                              <div className="text-xs text-zinc-500 mb-1">Line 1: Wages, salaries, tips</div>
                              <div className="font-mono text-xl neon-green">${taxFormData.form?.line_1_wages?.toLocaleString()}</div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                              <div className="text-xs text-zinc-500 mb-1">Line 12: Standard deduction</div>
                              <div className="font-mono text-xl">${taxFormData.form?.line_12_standard_deduction?.toLocaleString()}</div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                              <div className="text-xs text-zinc-500 mb-1">Line 13: Itemized / Other deductions</div>
                              <div className="font-mono text-xl neon-green">${taxFormData.form?.line_13_itemized_deductions?.toLocaleString()}</div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                              <div className="text-xs text-zinc-500 mb-1">Line 15: Taxable income</div>
                              <div className="font-mono text-xl">${taxFormData.form?.line_15_taxable_income?.toLocaleString()}</div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                              <div className="text-xs text-zinc-500 mb-1">Line 16: Tax</div>
                              <div className="font-mono text-xl">${taxFormData.form?.line_16_tax?.toLocaleString()}</div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                              <div className="text-xs text-zinc-500 mb-1">Line 34: Refund</div>
                              <div className="font-mono text-xl neon-green">${taxFormData.form?.line_34_refund?.toLocaleString()}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-zinc-400">Loading form…</div>
                        )}

                        {/* Expected Savings */}
                        {taxFormData?.form?.expected_savings && (
                          <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                            <div>
                              <div className="text-sm text-emerald-400">Expected savings</div>
                              <div className="text-xs text-zinc-500">Based on RAG-detected deductions</div>
                            </div>
                            <div className="text-2xl font-semibold text-emerald-400">+${taxFormData.form.expected_savings}</div>
                          </div>
                        )}

                        <div className="mt-4 text-[10px] text-zinc-500">Chunks used: {taxFormData?.chunks_used ?? 0} • Files: {(taxFormData?.source_files || []).join(', ') || ''}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="p-4 border-t border-white/10 flex items-center justify-between">
                  <div className="text-xs text-zinc-500">Your data stays local. ChromaDB per user.</div>
                  {taxUploadedFiles.length > 0 && (
                    <button onClick={handleFill1040} disabled={taxLoading} className="text-xs px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 disabled:opacity-40">
                      Re-analyze
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {activeView === 'grokky' && (
            <div className="max-w-3xl mx-auto h-[calc(100vh-140px)] flex flex-col">
              <div className="glass rounded-3xl flex flex-col h-full overflow-hidden">
                {/* HEADER - simplified */}
                <div className="px-6 py-5 border-b border-white/10 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                    <i className="bx bx-bot text-xl" style={{ color: 'var(--accent-color)' }} />
                  </div>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--accent-color)' }}>Swifty</div>
                    <div className="text-xs text-zinc-500">AI assistant</div>
                  </div>
                </div>

                {/* SUGGESTIONS - minimal */}
                <div className="px-6 py-3 border-b border-white/10 flex gap-2 flex-wrap">
                  {[
                    "Check my hours",
                    "Request PTO",
                    "Show overtime",
                  ].map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(s)}
                      disabled={chatLoading}
                      className="px-3 py-1 text-xs rounded-full border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* CHAT FEED - cleaner */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
                  {chatHistory.length === 0 && !chatLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <i className="bx bx-bot text-4xl mb-3 opacity-50" style={{ color: 'var(--accent-color)' }} />
                      <div className="mb-1" style={{ color: 'var(--accent-color)' }}>Hi {user.first_name}, how can I help?</div>
                      <div className="text-sm text-zinc-500">Ask about hours, PTO, or policies</div>
                    </div>
                  )}
                  {chatHistory.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`}>
                      {m.role === 'assistant' && (
                        <div className="w-7 h-7 mt-0.5 mr-2.5 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center">
                          <i className="bx bx-bot" />
                        </div>
                      )}
                      <div className={`max-w-[80%] px-4 py-3 rounded-2xl prose prose-invert prose-sm ${m.role === 'user' ? 'bg-white text-black' : 'bg-white/5 text-zinc-200'}`}>
                        {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                        <i className="bx bx-bot" />
                      </div>
                      <span>Thinking…</span>
                    </div>
                  )}
                </div>

                {/* INPUT - simple */}
                <div className="p-4 border-t border-white/10">
                  {attachedFile && (
                    <div className="mb-2 flex items-center gap-2 text-xs text-[var(--accent-color)]">
                      <span>📎 {attachedFile.filename}</span>
                      <button className="underline" onClick={() => setAttachedFile(null)} disabled={chatLoading}>remove</button>
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <label className="cursor-pointer px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-[var(--accent-color)]" title="Attach file">
                      📎
                      <input type="file" className="hidden" onChange={handleFileSelect} disabled={chatLoading} />
                    </label>
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
                      placeholder="Ask Swifty…"
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-[var(--accent-color)] focus:outline-none focus:border-[var(--accent-color)]"
                      disabled={chatLoading}
                    />
                    <button
                      onClick={handleSendChat}
                      disabled={chatLoading || (!chatMessage.trim() && !attachedFile)}
                      className="px-5 rounded-xl text-sm font-medium disabled:opacity-40" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeView === 'profile' && (
            <div className="max-w-5xl mx-auto">
              <div className="glass rounded-3xl p-8">
                <h1 className="text-2xl font-semibold mb-6 neon-green">Profile</h1>

                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{user.first_name} {user.last_name}</div>
                    <div className="text-sm text-zinc-400 mt-1">{user.job_role || 'Employee'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass rounded-2xl p-4">
                    <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-1">Email</div>
                    <div className="text-base">{user.email || ''}</div>
                  </div>
                  <div className="glass rounded-2xl p-4">
                    <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-1">Manager</div>
                    <div className="text-base">{user.manager_name || ''}</div>
                  </div>
                  <div className="glass rounded-2xl p-4">
                    <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-1">User ID</div>
                    <div className="text-base font-mono">{user.id}</div>
                  </div>
                  <div className="glass rounded-2xl p-4">
                    <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-1">Role</div>
                    <div className="text-base">{user.job_role || ''}</div>
                  </div>
                </div>

                <div className="mt-6 text-xs text-zinc-500">
                  Profile information is pulled from your account. Contact HR to update.
                </div>
              </div>
            </div>
          )}
          {activeView === 'applications' && (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Intro */}
              <div className="glass rounded-3xl p-8">
                <h1 className="text-2xl font-semibold mb-2 neon-green">InstaApply</h1>
                <p className="text-zinc-400 mb-6">Find the best-matched jobs for your skills and experience.</p>
              </div>

              {/* Resume Upload */}
              <div className="glass rounded-3xl p-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Your Resume</div>
                  <div className="text-sm text-zinc-500">Upload once, apply everywhere</div>
                </div>
                <label className="cursor-pointer px-5 py-2 rounded-2xl font-medium flex items-center gap-2" style={{ background: instaJobs.length > 0 ? '#22c55e' : 'var(--accent-color)', color: '#000' }}>
                  <span>{instaUploading ? 'Processing…' : (instaJobs.length > 0 ? 'Resume uploaded ✓' : 'Upload Resume')}</span>
                  {instaUploading && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                  <input type="file" className="hidden" disabled={instaUploading} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user?.id || instaUploading) return;
                    setInstaUploading(true);
                    try {
                      const form = new FormData();
                      form.append('file', file);
                      form.append('user_id', String(user.id));
                      const res = await fetch(`${API_BASE}/api/grok/tax/upload`, { method: 'POST', body: form });
                      if (res.ok) {
                        const jobsPayload = [
                          { id: 1, title: 'Member of Technical Staff, Grok', company: 'xAI', location: 'San Francisco, CA', salary: '$320k–$420k', desc: 'Grok ML infrastructure' },
                          { id: 2, title: 'Software Engineer, X (Platform)', company: 'xAI', location: 'Palo Alto, CA', salary: '$280k–$360k', desc: 'X platform infra' },
                          { id: 3, title: 'Research Engineer, Grok Safety', company: 'xAI', location: 'San Francisco, CA', salary: '$310k–$400k', desc: 'AI safety research' },
                          { id: 4, title: 'Software Engineer, X Search', company: 'xAI', location: 'Remote (US)', salary: '$260k–$340k', desc: 'Search infra' },
                          { id: 5, title: 'Member of Technical Staff, Grok Voice', company: 'xAI', location: 'San Francisco, CA', salary: '$300k–$390k', desc: 'Voice AI' },
                          { id: 6, title: 'Software Engineer, X Infra', company: 'xAI', location: 'Austin, TX', salary: '$250k–$330k', desc: 'Infra' },
                          { id: 7, title: 'Research Scientist, Grok', company: 'xAI', location: 'San Francisco, CA', salary: '$340k–$450k', desc: 'LLM research' },
                        ];
                        const mres = await fetch(`${API_BASE}/api/grok/match-jobs`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ user_id: user.id, jobs: jobsPayload }),
                        });
                        const mdata = await mres.json();
                        if (mdata.jobs) {
                          const enriched = mdata.jobs.map((r: any) => ({ ...r.job, score: r.score, label: r.label }));
                          setInstaJobs(enriched);
                        }
                      }
                    } catch {}
                    setInstaUploading(false);
                    e.target.value = '';
                  }} />
                </label>
              </div>

              {/* Open Positions */}
              <div className="glass rounded-3xl p-8">
                <h2 className="text-lg font-medium mb-4">Open Positions</h2>
                <div className="grid grid-cols-1 gap-4">
                  {(instaJobs.length ? instaJobs : [
                    { id: 2, title: 'Software Engineer, X (Platform)', company: 'xAI', location: 'Palo Alto, CA', salary: '$280k–$360k', desc: 'X platform infra' },
                    { id: 3, title: 'Research Engineer, Grok Safety', company: 'xAI', location: 'San Francisco, CA', salary: '$310k–$400k', desc: 'AI safety research' },
                    { id: 4, title: 'Software Engineer, X Search', company: 'xAI', location: 'Remote (US)', salary: '$260k–$340k', desc: 'Search infra' },
                    { id: 5, title: 'Member of Technical Staff, Grok Voice', company: 'xAI', location: 'San Francisco, CA', salary: '$300k–$390k', desc: 'Voice AI' },
                    { id: 6, title: 'Software Engineer, X Infra', company: 'xAI', location: 'Austin, TX', salary: '$250k–$330k', desc: 'Infra' },
                    { id: 7, title: 'Research Scientist, Grok', company: 'xAI', location: 'San Francisco, CA', salary: '$340k–$450k', desc: 'LLM research' },
                  ]).map((job: any) => {
                    const isExpanded = expandedJobs.has(job.id)
                    const truncated = job.desc.length > 200 ? job.desc.slice(0, 200) + '…' : job.desc
                    return (
                      <div
                        key={job.id}
                        onClick={() => setExpandedJobs(prev => {
                          const next = new Set(prev)
                          if (next.has(job.id)) next.delete(job.id)
                          else next.add(job.id)
                          return next
                        })}
                        className="bg-white/5 rounded-2xl p-6 cursor-pointer hover:bg-white/10 transition"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-lg text-white">{job.title}</div>
                              {job.label && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  job.label === 'Best Match' ? 'bg-emerald-600 text-white' :
                                  job.label === 'Strong Match' ? 'bg-emerald-500/80 text-white' :
                                  job.label === 'Good Match' ? 'bg-blue-500/80 text-white' :
                                  job.label === 'Fair Match' ? 'bg-amber-500/80 text-white' :
                                  'bg-zinc-700 text-zinc-300'
                                }`}>{job.label}</span>
                              )}
                              {job.score !== undefined && <span className="text-xs text-zinc-500">({job.score})</span>}
                            </div>
                            <div className="text-sm text-zinc-400">{job.company} • {job.location} • {job.salary}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{isExpanded ? '▲' : '▼'}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); toast.success('Application submitted for ' + job.title) }}
                              className="px-4 py-2 text-sm rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 text-sm text-zinc-300 whitespace-pre-line leading-relaxed">
                          {isExpanded ? job.desc : truncated}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Quick Tips */}
              <div className="glass rounded-3xl p-8 pb-6">
                <h2 className="text-lg font-medium mb-4">Tips for Success</h2>
                <ul className="space-y-2 text-sm text-zinc-400 list-disc pl-5">
                  <li>Tailor your resume keywords to each job posting before applying</li>
                  <li>Follow up within 5 days if you haven't heard back</li>
                  <li>Schedule interviews in the morning; hiring managers are fresher</li>
                  <li>Prepare 3–5 questions to ask at the end of every interview</li>
                </ul>
              </div>
            </div>
          )}
          {activeView === 'jobs' && (
            <div className="max-w-5xl mx-auto">
              <div className="glass rounded-3xl p-8">
                <h1 className="text-2xl font-semibold mb-2 neon-green">Jobs</h1>
                <p className="text-zinc-400 mb-6">Post open roles or browse available jobs.</p>

                {/* Post a job form */}
                <div className="mb-8">
                  <h2 className="text-lg font-medium mb-3">Post a Job</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const form = e.currentTarget
                      const data = {
                        description: (form.elements.namedItem('description') as HTMLTextAreaElement)?.value,
                        hiring_manager_id: user?.id,
                        salary: (form.elements.namedItem('salary') as HTMLInputElement)?.value,
                        location: (form.elements.namedItem('location') as HTMLInputElement)?.value,
                      }
                      fetch(`${API_BASE}/api/jobs`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                      })
                        .then(r => r.json())
                        .then(() => { alert('Job posted!'); form.reset() })
                        .catch(() => alert('Failed to post job'))
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs uppercase tracking-[1px] text-zinc-500 mb-1">Description</label>
                      <textarea name="description" required className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-sm" placeholder="Job description, requirements…" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs uppercase tracking-[1px] text-zinc-500 mb-1">Salary</label>
                        <input name="salary" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm" placeholder="e.g. $120,000" />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-[1px] text-zinc-500 mb-1">Location</label>
                        <input name="location" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm" placeholder="e.g. Remote / San Francisco" />
                      </div>
                    </div>
                    <button type="submit" className="glass-btn-green px-5 py-2 rounded-xl font-semibold">
                      Post Job
                    </button>
                  </form>
                </div>

                <div className="text-xs text-zinc-500">
                  Jobs are stored in the database and visible to other users.
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Guided tour modal */}
        {showTour && (
          <Tour
            onClose={() => {
              setShowTour(false)
              localStorage.setItem('swiftshift-tour-seen', '1')
            }}
            accentHex={themeAccentHex}
          />
        )}

        {/* State-specific meal break reminder */}
        <BreakReminderModal
          isOpen={showBreakReminder}
          rule={STATE_BREAK_RULES[workState]}
          hoursWorked={sessionWorkedMs / 3600000}
          isSecondBreak={breakReminderIsSecond}
          onStartBreak={() => {
            setShowBreakReminder(false)
            handleStartBreak()
          }}
          onDismiss={() => setShowBreakReminder(false)}
        />

        {/* Clock-out Loot Drop modal */}
        <LootDrop
          isOpen={showLootDrop}
          onClose={() => setShowLootDrop(false)}
          earnings={lootEarnings}
          ptoHours={lootPtoHours}
          durationMin={lootDurationMin}
          theme={theme}
        />

        {/* Shockwave ripple on clock in */}
        {_shockwaveActive && (
          <div
            className="fixed w-0 h-0 rounded-full border-[3px] pointer-events-none z-[90] animate-[shockwave_900ms_ease-out_forwards]"
            style={{
              left: ripplePos ? ripplePos.x : '50%',
              top: ripplePos ? ripplePos.y : '50%',
              transform: 'translate(-50%, -50%)',
              borderColor: 'var(--accent-color)',
              boxShadow: '0 0 60px 10px var(--accent-color), 0 0 120px 30px var(--accent-color-dim, rgba(215,254,81,0.3))',
              background: 'radial-gradient(circle, transparent 40%, var(--accent-color) 70%, transparent 100%)',
              opacity: 0.35,
            }}
          />
        )}
      </div>
    </div>
  )
}
