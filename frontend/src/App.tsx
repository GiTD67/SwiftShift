import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'
import './index.css'
import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useTimesheet } from './hooks/useTimesheet'
import { Rewards } from './components/Rewards'
import { XPCenter } from './components/XPCenter'
import { LootDrop } from './components/LootDrop'
import { Tour } from './components/Tour'
import { FeaturePreview } from './components/FeaturePreview'
import { BreakReminderModal } from './components/BreakReminderModal'
import { SalesKPI } from './components/SalesKPI'
import { STATE_BREAK_RULES, STATE_CODES } from './data/stateBreakRules'

const API_BASE = ''

type View = 'clock' | 'timesheet' | 'rewards' | 'xpcenter' | 'admin' | 'profile' | 'insurance' | 'orgchart' | 'taxes' | 'groktax' | 'grokky' | 'applications' | 'jobs' | 'schedules' | 'payroll' | 'reports' | 'leaves' | 'compliance' | 'hiring' | 'kpi' | 'teamkpi' | 'announcements'

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
          <div className="glass rounded-2xl p-6 w-80 border border-white/20" onClick={(e) => e.stopPropagation()} style={{ boxShadow: '0 0 80px -20px rgba(var(--accent-color-rgb), 0.21), 0 28px 72px -14px rgba(0,0,0,0.85)' }}>
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
    const anchor = new Date(2026, 2, 22)
    const msPerDay = 86400000
    const periodStart = new Date(anchor.getTime() + periodOffset * 14 * msPerDay)
    periodStart.setHours(0, 0, 0, 0)
    const periodEnd = new Date(periodStart.getTime() + 13 * msPerDay)
    const dayDates = Array.from({ length: 14 }, (_, i) => new Date(periodStart.getTime() + i * msPerDay))
    const periodId = periodStart.toISOString().slice(0, 10)
    return { start: periodStart, end: periodEnd, dayDates, periodId }
  }, [periodOffset])
}

// ===== NLP Parser =====
// Returns { dayIndex: number (0-13), hours: number } or null
function parseNLPEntry(text: string, dayDates: Date[]): { dayIndex: number; hours: number } | null {
  const t = text.toLowerCase().trim()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const DAY_NAMES: Record<string, number> = {
    monday: 0, mon: 0, tuesday: 1, tue: 1, wednesday: 2, wed: 2,
    thursday: 3, thu: 3, friday: 4, fri: 4,
    saturday: 5, sat: 5, sunday: 6, sun: 6,
  }

  // Find day reference in text
  let targetDayIndex: number | null = null

  // "today"
  if (t.includes('today')) {
    const todayStr = today.toISOString().slice(0, 10)
    const idx = dayDates.findIndex(d => d.toISOString().slice(0, 10) === todayStr)
    if (idx !== -1) targetDayIndex = idx
  }

  // "yesterday"
  if (targetDayIndex === null && t.includes('yesterday')) {
    const yest = new Date(today.getTime() - 86400000)
    const yestStr = yest.toISOString().slice(0, 10)
    const idx = dayDates.findIndex(d => d.toISOString().slice(0, 10) === yestStr)
    if (idx !== -1) targetDayIndex = idx
  }

  // "tomorrow"
  if (targetDayIndex === null && t.includes('tomorrow')) {
    const tom = new Date(today.getTime() + 86400000)
    const tomStr = tom.toISOString().slice(0, 10)
    const idx = dayDates.findIndex(d => d.toISOString().slice(0, 10) === tomStr)
    if (idx !== -1) targetDayIndex = idx
  }

  // Day names like "monday", "tuesday" (also handles "last monday", "next friday")
  // DAY_NAMES: 0=Mon,1=Tue,...,6=Sun; JS getDay(): 0=Sun,1=Mon,...,6=Sat
  const dowToJsDay: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 0 }
  if (targetDayIndex === null) {
    for (const [name, dow] of Object.entries(DAY_NAMES)) {
      if (t.includes(name)) {
        const jsDay = dowToJsDay[dow]
        // For "last X", prefer earlier occurrence; for "next X", prefer later; default: first match
        const isLast = t.includes(`last ${name}`)
        const isNext = t.includes(`next ${name}`)
        const matches = dayDates.reduce<number[]>((acc, d, i) => {
          if (d.getDay() === jsDay) acc.push(i)
          return acc
        }, [])
        if (matches.length > 0) {
          if (isLast) targetDayIndex = matches[0]
          else if (isNext) targetDayIndex = matches[matches.length - 1]
          else targetDayIndex = matches[0]
          break
        }
      }
    }
  }

  // If no day found, default to today if the sentence is about hours worked
  if (targetDayIndex === null) {
    const workedMatch = t.match(/(?:worked|logged|clocked|did|put in|had)\s+.*?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)/)
    if (workedMatch) {
      const todayStr = today.toISOString().slice(0, 10)
      const idx = dayDates.findIndex(d => d.toISOString().slice(0, 10) === todayStr)
      if (idx !== -1) targetDayIndex = idx
    }
  }

  if (targetDayIndex === null) return null

  // Extract hours
  let hours: number | null = null

  // "from 9am to 5pm", "from 9:00 to 17:00", "from 9 to 5"
  const fromToMatch = t.match(/from\s+(\d+)(?::(\d+))?\s*(am|pm)?\s+to\s+(\d+)(?::(\d+))?\s*(am|pm)?/)
  if (fromToMatch) {
    let startH = parseFloat(fromToMatch[1])
    const startMin = fromToMatch[2] ? parseFloat(fromToMatch[2]) / 60 : 0
    const startSuffix = fromToMatch[3]
    let endH = parseFloat(fromToMatch[4])
    const endMin = fromToMatch[5] ? parseFloat(fromToMatch[5]) / 60 : 0
    const endSuffix = fromToMatch[6]
    if (startSuffix === 'pm' && startH < 12) startH += 12
    if (endSuffix === 'pm' && endH < 12) endH += 12
    if (!endSuffix && endH <= startH) endH += 12
    hours = Math.max(0, (endH + endMin) - (startH + startMin))
  }

  // "half a day" / "half day" = 4 hours
  if (hours === null && (t.includes('half a day') || t.includes('half day') || t.includes('half-day'))) {
    hours = 4
  }

  // "a full day" / "full day" / "whole day" = 8 hours
  if (hours === null && (t.includes('full day') || t.includes('whole day') || t.includes('all day'))) {
    hours = 8
  }

  // "X hours" or "X hrs" or just a plain number like "set monday to 7.5"
  if (hours === null) {
    const numMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/)
    if (numMatch) hours = parseFloat(numMatch[1])
  }

  // Plain number fallback (e.g. "monday 8" or "set monday to 8")
  if (hours === null) {
    const numMatch = t.match(/(?:to|:|\bat\b|=)\s*(\d+(?:\.\d+)?)/) || t.match(/(\d+(?:\.\d+)?)$/)
    if (numMatch) hours = parseFloat(numMatch[1])
  }

  if (hours === null || isNaN(hours)) return null
  return { dayIndex: targetDayIndex, hours: Math.max(0, Math.min(24, hours)) }
}

// ===== Gamification hook =====
const XP_LEVELS = [
  { level: 1, name: 'Rookie', xpNeeded: 0 },
  { level: 2, name: 'Tracker', xpNeeded: 100 },
  { level: 3, name: 'Logger', xpNeeded: 250 },
  { level: 4, name: 'Hustler', xpNeeded: 450 },
  { level: 5, name: 'Pro', xpNeeded: 700 },
  { level: 6, name: 'Expert', xpNeeded: 1000 },
  { level: 7, name: 'Veteran', xpNeeded: 1400 },
  { level: 8, name: 'Elite', xpNeeded: 1900 },
  { level: 9, name: 'Master', xpNeeded: 2500 },
  { level: 10, name: 'Legend', xpNeeded: 3200 },
]

const ACHIEVEMENTS = [
  { id: 'first_timer', icon: '◎', name: 'First Timer', desc: 'Submit your first timesheet', check: (s: GamificationState) => s.submits >= 1 },
  { id: 'overtime_warrior', icon: '↑', name: 'Overtime Warrior', desc: 'Log more than 80h in a period', check: (s: GamificationState) => s.maxPeriodHours >= 80 },
  { id: 'speed_logger', icon: '»', name: 'Speed Logger', desc: 'Use NLP 10 times', check: (s: GamificationState) => s.nlpUses >= 10 },
  { id: 'perfect_period', icon: '◆', name: 'Perfect Period', desc: 'Log hours every day in a period', check: (s: GamificationState) => s.perfectPeriods >= 1 },
  { id: 'hat_trick', icon: '▲', name: 'Hat Trick', desc: 'Submit 3 periods in a row', check: (s: GamificationState) => s.streak >= 3 },
  { id: 'marathon', icon: '→', name: 'Marathon', desc: 'Earn 500 XP total', check: (s: GamificationState) => s.totalXP >= 500 },
  { id: 'consistency', icon: '★', name: 'Consistency', desc: 'Submit 5 timesheets', check: (s: GamificationState) => s.submits >= 5 },
  { id: 'century', icon: '◉', name: 'Century Club', desc: 'Earn 1000 XP total', check: (s: GamificationState) => s.totalXP >= 1000 },
  { id: 'level5', icon: '✦', name: 'Level 5', desc: 'Reach level 5', check: (s: GamificationState) => s.totalXP >= 700 },
  { id: 'legend', icon: '⬡', name: 'Legend', desc: 'Reach max level', check: (s: GamificationState) => s.totalXP >= 3200 },
]

interface GamificationState {
  totalXP: number
  streak: number
  submits: number
  nlpUses: number
  maxPeriodHours: number
  perfectPeriods: number
  unlockedAchievements: string[]
  weekSubmitStreak: number
  lastSubmitDate: string
  weeklyChallenge: { weekId: string; targetHours: number; bonusXP: number; completed: boolean } | null
  bossChallenge: { fromLevel: number; toLevel: number; req: string; progress: number; target: number; completed: boolean } | null
  customAccentColor: string
}

function getWeekMondayId(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  return monday.toISOString().slice(0, 10)
}

function useGamification() {
  const [gState, setGState] = useState<GamificationState>(() => {
    const saved = localStorage.getItem('swiftshift-gamification')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        totalXP: parsed.totalXP || 0,
        streak: parsed.streak || 0,
        submits: parsed.submits || 0,
        nlpUses: parsed.nlpUses || 0,
        maxPeriodHours: parsed.maxPeriodHours || 0,
        perfectPeriods: parsed.perfectPeriods || 0,
        unlockedAchievements: parsed.unlockedAchievements || [],
        weekSubmitStreak: parsed.weekSubmitStreak || 0,
        lastSubmitDate: parsed.lastSubmitDate || '',
        weeklyChallenge: parsed.weeklyChallenge || null,
        bossChallenge: parsed.bossChallenge || null,
        customAccentColor: parsed.customAccentColor || '',
      }
    }
    return { totalXP: 0, streak: 0, submits: 0, nlpUses: 0, maxPeriodHours: 0, perfectPeriods: 0, unlockedAchievements: [], weekSubmitStreak: 0, lastSubmitDate: '', weeklyChallenge: null, bossChallenge: null, customAccentColor: '' }
  })
  const [floatingXP, setFloatingXP] = useState<{ id: number; amount: number; x: number; y: number }[]>([])
  const streakNotifiedRef = useRef(false)

  useEffect(() => {
    localStorage.setItem('swiftshift-gamification', JSON.stringify(gState))
  }, [gState])

  const currentLevel = useMemo(() => {
    const lvl = [...XP_LEVELS].reverse().find(l => gState.totalXP >= l.xpNeeded)
    return lvl || XP_LEVELS[0]
  }, [gState.totalXP])

  const nextLevel = useMemo(() => XP_LEVELS.find(l => l.xpNeeded > gState.totalXP) || XP_LEVELS[XP_LEVELS.length - 1], [gState.totalXP])

  const xpProgress = useMemo(() => {
    if (currentLevel.level === 10) return 100
    const range = nextLevel.xpNeeded - currentLevel.xpNeeded
    const earned = gState.totalXP - currentLevel.xpNeeded
    return Math.min(100, Math.round((earned / range) * 100))
  }, [gState.totalXP, currentLevel, nextLevel])

  const getStreakMultiplier = useCallback(() => {
    return currentLevel.level >= 5 && gState.weekSubmitStreak >= 2 ? 1.5 : 1
  }, [currentLevel.level, gState.weekSubmitStreak])

  const addXP = useCallback((rawAmount: number, x = 50, y = 50) => {
    const multiplier = currentLevel.level >= 5 && gState.weekSubmitStreak >= 2 ? 1.5 : 1
    const amount = Math.round(rawAmount * multiplier)
    if (multiplier > 1 && !streakNotifiedRef.current) {
      streakNotifiedRef.current = true
      toast.info('🔥 Streak bonus! 1.5× XP', { description: 'Submit weekly to keep your multiplier' })
    }
    const prevLevel = [...XP_LEVELS].reverse().find(l => gState.totalXP >= l.xpNeeded)!
    const prevMilestone = Math.floor(gState.totalXP / 1000)
    const nextTotal = gState.totalXP + amount
    const nextMilestone = Math.floor(nextTotal / 1000)
    if (nextMilestone > prevMilestone) {
      setTimeout(() => {
        toast.success('📋 HR has been notified', { description: `XP milestone: ${nextMilestone * 1000} XP reached!` })
      }, 300)
    }
    setGState(prev => {
      const next = { ...prev, totalXP: prev.totalXP + amount }
      const newUnlocks: string[] = []
      for (const ach of ACHIEVEMENTS) {
        if (!prev.unlockedAchievements.includes(ach.id) && ach.check(next)) {
          newUnlocks.push(ach.id)
        }
      }
      if (newUnlocks.length > 0) {
        next.unlockedAchievements = [...prev.unlockedAchievements, ...newUnlocks]
        setTimeout(() => {
          for (const id of newUnlocks) {
            const ach = ACHIEVEMENTS.find(a => a.id === id)!
            toast.success(`${ach.icon} Achievement unlocked!`, { description: ach.name })
          }
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
        }, 100)
      }
      return next
    })
    const newLvl = [...XP_LEVELS].reverse().find(l => gState.totalXP + amount >= l.xpNeeded)!
    if (newLvl && prevLevel && newLvl.level > prevLevel.level) {
      setTimeout(() => {
        toast.success(`🎉 Level Up! You are now ${newLvl.name}!`)
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } })
      }, 200)
    }
    const id = Date.now()
    setFloatingXP(prev => [...prev, { id, amount, x, y }])
    setTimeout(() => setFloatingXP(prev => prev.filter(f => f.id !== id)), 1500)
  }, [gState.totalXP, gState.weekSubmitStreak, currentLevel.level])

  const recordNLPUse = useCallback(() => {
    setGState(prev => ({ ...prev, nlpUses: prev.nlpUses + 1 }))
  }, [])

  const recordSubmit = useCallback((totalHours: number, allDaysLogged: boolean) => {
    setGState(prev => {
      const now = new Date().toISOString()
      const lastDate = prev.lastSubmitDate ? new Date(prev.lastSubmitDate).getTime() : 0
      const daysSinceLastSubmit = lastDate > 0 ? (Date.now() - lastDate) / (1000 * 60 * 60 * 24) : 999
      const newWeekSubmitStreak = daysSinceLastSubmit >= 7 && daysSinceLastSubmit <= 14
        ? prev.weekSubmitStreak + 1
        : 1
      return {
        ...prev,
        submits: prev.submits + 1,
        streak: prev.streak + 1,
        maxPeriodHours: Math.max(prev.maxPeriodHours, totalHours),
        perfectPeriods: allDaysLogged ? prev.perfectPeriods + 1 : prev.perfectPeriods,
        weekSubmitStreak: newWeekSubmitStreak,
        lastSubmitDate: now,
      }
    })
  }, [])

  const weeklyChallenge = useMemo(() => {
    const weekId = getWeekMondayId()
    return {
      weekId,
      targetHours: 40,
      bonusXP: 100,
      completed: gState.weeklyChallenge?.weekId === weekId && (gState.weeklyChallenge?.completed ?? false),
    }
  }, [gState.weeklyChallenge])

  const completeWeeklyChallenge = useCallback(() => {
    const weekId = getWeekMondayId()
    setGState(prev => ({
      ...prev,
      weeklyChallenge: { weekId, targetHours: 40, bonusXP: 100, completed: true },
    }))
  }, [])

  return { gState, currentLevel, nextLevel, xpProgress, floatingXP, addXP, recordNLPUse, recordSubmit, weeklyChallenge, completeWeeklyChallenge, getStreakMultiplier }
}

// ===== TimesheetView component =====
function TimesheetView({ user, gamification }: { user: any; gamification: ReturnType<typeof useGamification> }) {
  const [periodOffset, setPeriodOffset] = useState(0)
  const [entries, setEntries] = useState<Record<string, string>>(() => {
    try { const s = localStorage.getItem(`swiftshift-ts-entries-${user?.id}`); return s ? JSON.parse(s) : {} } catch { return {} }
  })
  const [clockSessionsByDate, setClockSessionsByDate] = useState<Record<string, any[]>>({})
  const [certified, setCertified] = useState(false)
  const [submittedPeriods, setSubmittedPeriods] = useState<Set<string>>(new Set())
  const [nlpInput, setNlpInput] = useState('')
  const [highlightedDay, setHighlightedDay] = useState<number | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<Record<string, Record<string, string>>>({})
  const [showPaySummary, setShowPaySummary] = useState(false)
  const [allSubmissions, setAllSubmissions] = useState<any[]>([])
  const [selectedStubPeriod, setSelectedStubPeriod] = useState<any | null>(null)
  const [customRangeStart, setCustomRangeStart] = useState('')
  const [customRangeEnd, setCustomRangeEnd] = useState('')
  const [swiftyInput, setSwiftyInput] = useState('')
  const [swiftyMessages, setSwiftyMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [swiftyLoading, setSwiftyLoading] = useState(false)
  const [showSwifty, setShowSwifty] = useState(false)
  const nlpRef = useRef<HTMLInputElement>(null)
  const swiftyRef = useRef<HTMLInputElement>(null)
  const swiftyBottomRef = useRef<HTMLDivElement>(null)

  const { gState, currentLevel, nextLevel, xpProgress, floatingXP, addXP, recordNLPUse, recordSubmit } = gamification
  const { start, end, dayDates, periodId } = usePayPeriodRange(periodOffset)

  const prevPeriod1 = usePayPeriodRange(periodOffset - 1)
  const prevPeriod2 = usePayPeriodRange(periodOffset - 2)

  const hourlyRate = user?.hourly_rate || 20

  useEffect(() => { setCertified(false) }, [periodId])

  // Persist entries to localStorage forever
  useEffect(() => {
    if (!user?.id) return
    try { localStorage.setItem(`swiftshift-ts-entries-${user.id}`, JSON.stringify(entries)) } catch {}
  }, [entries, user?.id])

  // Scroll swifty to bottom on new messages
  useEffect(() => { swiftyBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [swiftyMessages])

  // Fetch clock sessions for this user
  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    fetch(`${API_BASE}/api/clock-sessions?employee_id=${uid}`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        // Store raw sessions by date for clock-in/out display
        const byDate: Record<string, any[]> = {}
        const durationByDate: Record<string, number> = {}
        for (const row of rows) {
          if (!row.clock_in) continue
          const d = row.clock_in.slice(0, 10)
          if (!byDate[d]) byDate[d] = []
          byDate[d].push(row)
          durationByDate[d] = (durationByDate[d] || 0) + (Number(row.duration_minutes) || 0)
        }
        setClockSessionsByDate(byDate)

        // Populate entries from API — only fill blanks, preserve manual edits
        setEntries(prev => {
          const next = { ...prev }
          dayDates.forEach((d, i) => {
            const dateStr = d.toISOString().slice(0, 10)
            const mins = durationByDate[dateStr] || 0
            const key = entryKey(periodId, i)
            if (!next[key] && mins > 0) next[key] = (mins / 60).toFixed(1)
          })
          return next
        })

        // History for previous periods
        const nextHistory: Record<string, Record<string, string>> = {}
        for (const p of [prevPeriod1, prevPeriod2]) {
          const pMap: Record<string, string> = {}
          p.dayDates.forEach((d, i) => {
            const dateStr = d.toISOString().slice(0, 10)
            const mins = durationByDate[dateStr] || 0
            if (mins > 0) pMap[entryKey(p.periodId, i)] = (mins / 60).toFixed(1)
          })
          nextHistory[p.periodId] = pMap
        }
        setHistoryEntries(nextHistory)
      })
      .catch(() => {})
  }, [user?.id, periodId])

  // Fetch all submitted pay periods
  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    fetch(`${API_BASE}/api/timesheet-submissions?user_id=${uid}`)
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) => setAllSubmissions(Array.isArray(rows) ? rows : []))
      .catch(() => {})
  }, [user?.id])

  const dayHours = dayDates.map((_, i) => parseHours(entries[entryKey(periodId, i)] || ''))
  const totalHours = dayHours.reduce((a, b) => a + b, 0)
  const regularHours = dayHours.reduce((sum, h) => sum + Math.min(h, 8), 0)
  const overtimeHours = dayHours.reduce((sum, h) => sum + Math.max(0, h - 8) * 1.5, 0)
  const isSubmitted = submittedPeriods.has(periodId)

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayIndex = dayDates.findIndex(d => d.toISOString().slice(0, 10) === todayStr)

  const setDayHours = (i: number, val: string) => {
    setEntries(prev => ({ ...prev, [entryKey(periodId, i)]: val }))
  }

  // Pay calculation: gross, deductions, net
  const calcPay = (hours: number) => {
    const regularH = Math.min(hours, 80)
    const overtimeH = Math.max(0, hours - 80) * 1.5
    const gross = (regularH + overtimeH) * hourlyRate
    const federalWithholding = gross * 0.12
    const stateWithholding = gross * 0.05
    const fica = gross * 0.0765
    const deductions = federalWithholding + stateWithholding + fica
    return { gross, federalWithholding, stateWithholding, fica, deductions, net: gross - deductions }
  }

  const currentPay = calcPay(totalHours)

  const filteredSubmissions = useMemo(() => {
    if (!customRangeStart && !customRangeEnd) return allSubmissions
    return allSubmissions.filter(s => {
      if (customRangeStart && s.period_start < customRangeStart) return false
      if (customRangeEnd && s.period_end > customRangeEnd) return false
      return true
    })
  }, [allSubmissions, customRangeStart, customRangeEnd])

  const handlePrintStub = (sub: any) => {
    const p = calcPay(sub.total_hours)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Pay Stub ${sub.period_start}</title>
<style>body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:20px}h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:10px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}.bold{font-weight:bold}.section{margin:20px 0}@media print{.no-print{display:none}}</style>
</head><body>
<h1>SwiftShift Pay Stub</h1>
<div class="section">
<div class="row"><span>Employee</span><span>${user?.first_name} ${user?.last_name}</span></div>
<div class="row"><span>Role</span><span>${user?.job_role || 'N/A'}</span></div>
<div class="row"><span>Pay Period</span><span>${sub.period_start} to ${sub.period_end}</span></div>
<div class="row"><span>Submitted</span><span>${sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'N/A'}</span></div>
</div>
<div class="section"><h2 style="font-size:16px">Earnings</h2>
<div class="row"><span>Hourly Rate</span><span>$${hourlyRate.toFixed(2)}/hr</span></div>
<div class="row"><span>Regular Hours (${Math.min(sub.total_hours,80).toFixed(1)}h)</span><span>$${(Math.min(sub.total_hours,80)*hourlyRate).toFixed(2)}</span></div>
${sub.total_hours>80?`<div class="row"><span>Overtime (${(sub.total_hours-80).toFixed(1)}h × 1.5)</span><span>$${((sub.total_hours-80)*1.5*hourlyRate).toFixed(2)}</span></div>`:''}
<div class="row bold"><span>Gross Pay</span><span>$${p.gross.toFixed(2)}</span></div>
</div>
<div class="section"><h2 style="font-size:16px">Deductions</h2>
<div class="row"><span>Federal Income Tax (12%)</span><span>-$${p.federalWithholding.toFixed(2)}</span></div>
<div class="row"><span>State Income Tax (5%)</span><span>-$${p.stateWithholding.toFixed(2)}</span></div>
<div class="row"><span>FICA/SS (6.2%)</span><span>-$${(p.gross*0.062).toFixed(2)}</span></div>
<div class="row"><span>Medicare (1.45%)</span><span>-$${(p.gross*0.0145).toFixed(2)}</span></div>
<div class="row bold"><span>Total Deductions</span><span>-$${p.deductions.toFixed(2)}</span></div>
</div>
<div class="section"><div class="row bold" style="font-size:18px;border-top:2px solid #333;padding-top:10px"><span>Net Pay</span><span>$${p.net.toFixed(2)}</span></div></div>
<button class="no-print" onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#333;color:#fff;border:none;cursor:pointer;border-radius:4px">Print</button>
</body></html>`)
    win.document.close()
    win.focus()
  }

  const handleSwiftySubmit = async () => {
    if (!swiftyInput.trim() || swiftyLoading) return
    const question = swiftyInput.trim()
    setSwiftyInput('')
    setSwiftyMessages(prev => [...prev, { role: 'user', content: question }])
    setSwiftyLoading(true)
    const payContext = allSubmissions.length > 0
      ? `Employee: ${user?.first_name} ${user?.last_name}, Role: ${user?.job_role||'N/A'}, Hourly Rate: $${hourlyRate}/hr.\nPay history:\n` +
        allSubmissions.slice(0, 12).map(s => {
          const p = calcPay(s.total_hours)
          return `Period ${s.period_start}–${s.period_end}: ${s.total_hours.toFixed(1)}h, Gross $${p.gross.toFixed(2)}, Deductions $${p.deductions.toFixed(2)}, Net $${p.net.toFixed(2)}`
        }).join('\n')
      : `Employee: ${user?.first_name} ${user?.last_name}, Hourly Rate: $${hourlyRate}/hr. No submitted periods yet.`
    try {
      const res = await fetch(`${API_BASE}/api/grok/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `[PAY DATA]\n${payContext}\n\n[QUESTION]\n${question}`, user_id: user?.id }),
      })
      const data = await res.json()
      setSwiftyMessages(prev => [...prev, { role: 'assistant', content: data.response || data.error || 'No response.' }])
    } catch {
      setSwiftyMessages(prev => [...prev, { role: 'assistant', content: 'Could not reach Swifty. Check your connection.' }])
    } finally { setSwiftyLoading(false) }
  }

  const handleNLPSubmit = () => {
    if (!nlpInput.trim()) return
    const result = parseNLPEntry(nlpInput, dayDates)
    if (result) {
      setDayHours(result.dayIndex, result.hours.toFixed(1))
      setHighlightedDay(result.dayIndex)
      setTimeout(() => setHighlightedDay(null), 1200)
      toast.success(`✓ Logged ${result.hours}h on ${dayDates[result.dayIndex].toLocaleDateString([], { weekday: 'long' })}`, { description: '+5 XP' })
      addXP(5, 50, 30)
      recordNLPUse()
      setNlpInput('')
    } else {
      toast.error('Could not understand that. Try: "set monday to 8" or "I worked 7.5 hours today"')
    }
  }

  const handleSaveDraft = () => {
    toast.success('Draft saved! ✓', { description: '+15 XP' })
    addXP(15, 50, 80)
  }

  const handleSubmit = () => {
    if (certified && !isSubmitted) {
      setSubmittedPeriods(prev => new Set(prev).add(periodId))
      const allLogged = dayHours.every(h => h > 0)
      recordSubmit(totalHours, allLogged)
      addXP(50 + Math.round(totalHours * 5), 50, 60)
      toast.success('Timesheet submitted! 🎉', { description: `+${50 + Math.round(totalHours * 5)} XP earned!` })
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } })
      setTimeout(() => confetti({ particleCount: 100, spread: 70, angle: 75, origin: { x: 0.2, y: 0.6 } }), 150)
      setTimeout(() => confetti({ particleCount: 100, spread: 70, angle: 105, origin: { x: 0.8, y: 0.6 } }), 300)
      fetch(`${API_BASE}/api/timesheet-submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          period_start: start.toISOString().slice(0, 10),
          period_end: end.toISOString().slice(0, 10),
          total_hours: totalHours,
        }),
      }).then(r => r.ok ? r.json() : null).then(row => {
        if (row) setAllSubmissions(prev => {
          const exists = prev.find(s => s.period_start === row.period_start)
          return exists ? prev.map(s => s.period_start === row.period_start ? row : s) : [row, ...prev]
        })
      }).catch(() => {})
    }
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // History grid renderer — shows hours + clock in/out times
  const HistoryGrid = ({ period, pDates, pId }: { period: string; pDates: Date[]; pId: string }) => {
    const pHours = pDates.map((_, i) =>
      parseHours(historyEntries[pId]?.[entryKey(pId, i)] || '') || parseHours(entries[entryKey(pId, i)] || '')
    )
    const pTotal = pHours.reduce((a, b) => a + b, 0)
    const submitted = submittedPeriods.has(pId)
    return (
      <div className="glass rounded-2xl overflow-hidden mb-3">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <span className="text-sm font-medium text-zinc-300">{period}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 font-mono">{pTotal.toFixed(1)} h total</span>
            {pTotal > 0 && <span className="text-xs text-zinc-500 font-mono">≈ ${calcPay(pTotal).net.toFixed(2)} net</span>}
            {submitted && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white">✓ Submitted</span>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="px-4 py-3 flex gap-2" style={{ minWidth: '600px' }}>
            {pDates.map((d, i) => {
              const h = pHours[i]
              const isOT = h > 8
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              const dateStr = d.toISOString().slice(0, 10)
              const sessions = clockSessionsByDate[dateStr] || []
              return (
                <div key={i} className="flex-1 text-center min-w-[36px]">
                  <div className="text-[9px] text-zinc-500 mb-0.5">{d.toLocaleDateString([], { weekday: 'narrow' })}</div>
                  <div className="text-[9px] text-zinc-600 mb-1">{d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })}</div>
                  <div className={`text-xs font-mono py-1 rounded-lg text-center ${
                    isWeekend && h === 0 ? 'bg-white/3 text-zinc-700' :
                    isOT ? 'bg-amber-400/20 text-amber-400' :
                    h > 0 ? 'bg-white/10 text-white' : 'bg-white/5 text-zinc-600'
                  }`}>
                    {h > 0 ? h.toFixed(1) : '—'}
                  </div>
                  {sessions.length > 0 && sessions.map((s: any, si: number) => (
                    <div key={si} className="text-[8px] text-zinc-600 mt-0.5 leading-tight">
                      <span style={{ color: 'var(--accent-color)', opacity: 0.7 }}>
                        {new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {s.clock_out && <span>–{new Date(s.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5 relative">
      {/* Floating XP indicators */}
      {floatingXP.map(f => (
        <div
          key={f.id}
          className="fixed pointer-events-none z-50 font-bold text-lg"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            color: 'var(--accent-color)',
            animation: 'floatUp 1.4s ease-out forwards',
          }}
        >
          +{f.amount} XP
        </div>
      ))}

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(1.3); }
        }
        @keyframes flashCell {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); box-shadow: 0 0 12px var(--accent-color); }
        }
      `}</style>

      <div>
        <h1 className="text-2xl font-semibold mb-1 neon-green">Timesheet</h1>
        <p className="text-zinc-400 text-sm">Log hours for the 2-week pay period. Type naturally or enter hours directly.</p>
      </div>

      {/* Gamification bar */}
      <div className="glass rounded-2xl px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2" style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}>
            {currentLevel.level}
          </div>
          <div>
            <div className="text-xs font-semibold" style={{ color: 'var(--accent-color)' }}>{currentLevel.name}</div>
            <div className="text-[10px] text-zinc-500">{gState.totalXP} XP</div>
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
            <span>→ {nextLevel.name}</span>
            <span>{xpProgress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${xpProgress}%`, backgroundColor: 'var(--accent-color)' }} />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400 flex-shrink-0">
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 17h2a2.5 2.5 0 002.5-2.5c0-1.5-.5-2-1-3a6 6 0 001-6.5A6 6 0 018 7c-1 2-1.5 3.5-.5 6 .5 1.5 1 2 1 2z"/><path d="M12 22c2.5 0 4-1.5 4-4h-8c0 2.5 1.5 4 4 4z"/></svg>
            {gState.streak} streak
          </span>
          <span className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            {gState.submits} submitted
          </span>
        </div>
      </div>

      {/* NLP input bar */}
      <div className="glass rounded-2xl p-4">
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Tell me your hours in plain English</div>
        <div className="flex gap-2">
          <input
            ref={nlpRef}
            type="text"
            value={nlpInput}
            onChange={e => setNlpInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleNLPSubmit() }}
            placeholder='e.g. "I worked 8 hours today" · "set monday to 7.5" · "from 9am to 5pm friday"'
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 placeholder-zinc-600"
            disabled={isSubmitted}
          />
          <button
            onClick={handleNLPSubmit}
            disabled={isSubmitted || !nlpInput.trim()}
            className="px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent-color)', color: 'black' }}
          >
            Log it
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {['I worked 8 hours today', 'set monday to 7.5', 'from 9am to 5pm friday', 'yesterday 6', 'thursday 8.5'].map(ex => (
            <button
              key={ex}
              onClick={() => { setNlpInput(ex); nlpRef.current?.focus() }}
              className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
              disabled={isSubmitted}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Submitted banner */}
      {isSubmitted && (
        <div className="glass rounded-2xl px-4 py-3 text-white flex items-center gap-2">
          ✓ Submitted for approval
        </div>
      )}

      {/* Period picker */}
      <div className="glass rounded-2xl p-3 flex items-center justify-between">
        <button onClick={() => setPeriodOffset(o => o - 1)} className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-sm">← Prev</button>
        <div className="text-center">
          <div className="text-base font-medium">{fmtRange(start, end)}</div>
          <div className="text-[10px] text-zinc-500">{periodOffset === 0 ? 'Current Pay Period' : periodOffset > 0 ? `+${periodOffset} period${periodOffset > 1 ? 's' : ''}` : `${periodOffset} period${periodOffset < -1 ? 's' : ''}`}</div>
        </div>
        <button onClick={() => setPeriodOffset(o => o + 1)} className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-sm">Next →</button>
      </div>

      {/* Summary stats */}
      <div className="glass rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-zinc-400">Employee</div>
          <div className="font-medium text-sm">{user.first_name} {user.last_name}</div>
          <div className="text-xs text-zinc-500">{user.job_role || ''}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-400">Approver</div>
          <div className="font-medium text-sm">Taylor Brooks</div>
          <div className="text-xs text-zinc-500">Engineering Manager</div>
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            <div className="px-2.5 py-1 rounded-full text-xs border border-white/10">Total: <span className="font-mono font-semibold">{totalHours.toFixed(1)}</span> h</div>
            <div className="px-2.5 py-1 rounded-full text-xs border border-white/10">Regular: <span className="font-mono">{regularHours.toFixed(1)}</span> h</div>
            <div className="px-2.5 py-1 rounded-full text-xs border border-white/10">OT×1.5: <span className="font-mono">{overtimeHours.toFixed(1)}</span> h</div>
          </div>
          <div className="mt-2">
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
              <span>Period progress</span><span>{Math.min(100, Math.round((totalHours / 80) * 100))}% of 80h</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totalHours / 80) * 100)}%`, backgroundColor: totalHours >= 80 ? '#f59e0b' : 'var(--accent-color)' }} />
            </div>
          </div>
          <div className="mt-1.5 text-xs text-zinc-400">Est. Gross: <span className="font-mono" style={{ color: 'var(--accent-color)' }}>${currentPay.gross.toFixed(2)}</span> · Net: <span className="font-mono text-white">${currentPay.net.toFixed(2)}</span></div>
        </div>
      </div>

      {/* Timecards grid — shows hours + clock in/out times */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="px-5 py-2.5 border-b border-white/10 flex gap-2 text-xs uppercase tracking-wider text-zinc-500" style={{ minWidth: '640px' }}>
            {dayNames.map((n, i) => <div key={i} className="flex-1 text-center">{n}</div>)}
          </div>
          <div className="px-5 py-4 flex gap-2" style={{ minWidth: '640px' }}>
            {dayDates.map((d, i) => {
              const key = entryKey(periodId, i)
              const val = entries[key] || ''
              const h = parseHours(val)
              const isOT = h > 8
              const isToday = i === todayIndex
              const isHighlighted = i === highlightedDay
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              const dateStr = d.toISOString().slice(0, 10)
              const daySessions = clockSessionsByDate[dateStr] || []
              return (
                <div key={i} className="flex-1 text-center" style={isHighlighted ? { animation: 'flashCell 0.6s ease-in-out' } : undefined}>
                  <div className="text-[9px] text-zinc-500 mb-0.5" style={isToday ? { color: 'var(--accent-color)' } : undefined}>
                    {d.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </div>
                  <input type="text" inputMode="decimal" value={val}
                    onChange={e => {
                      setDayHours(i, e.target.value)
                      const hrs = parseHours(e.target.value)
                      if (hrs > 0) addXP(Math.round(hrs), 20 + (i / 14) * 60, 50)
                    }}
                    className={`w-full text-center font-mono text-sm rounded-xl bg-black/40 border px-1 py-2 focus:outline-none transition-colors ${
                      isOT ? 'border-amber-400/60 text-amber-400' :
                      isToday ? 'border-[var(--accent-color)]/40' :
                      isWeekend ? 'border-white/5 opacity-60' :
                      'border-white/10 focus:border-white/30'
                    }`}
                    placeholder="0" disabled={isSubmitted}
                  />
                  <div className="text-[9px] text-zinc-600 mt-0.5">{h > 0 ? `${h.toFixed(1)}h` : ''}</div>
                  {daySessions.map((s: any, si: number) => (
                    <div key={si} className="mt-0.5 text-[8px] bg-white/5 rounded px-0.5 leading-tight">
                      <span style={{ color: 'var(--accent-color)', opacity: 0.8 }}>
                        {new Date(s.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {s.clock_out
                        ? <span className="text-zinc-600">–{new Date(s.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        : <span className="text-amber-400"> •</span>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="glass rounded-2xl p-4">
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Achievements</div>
        <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
          {ACHIEVEMENTS.map(ach => {
            const unlocked = gState.unlockedAchievements.includes(ach.id)
            return (
              <div key={ach.id} title={`${ach.name}: ${ach.desc}`}
                className={`flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-xl text-center cursor-default transition-all ${unlocked ? 'bg-white/10' : 'bg-white/3 opacity-40'}`}>
                <span className="text-xl">{ach.icon}</span>
                <span className="text-[9px] text-zinc-400 leading-tight">{ach.name}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Previous pay periods (history) */}
      <div className="glass rounded-2xl overflow-hidden">
        <button onClick={() => setShowHistory(h => !h)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left">
          <div>
            <div className="text-sm font-medium">Previous Pay Periods</div>
            <div className="text-xs text-zinc-500">Clock in/out times and daily hours for recent periods</div>
          </div>
          <span className="text-zinc-400 text-lg">{showHistory ? '▲' : '▼'}</span>
        </button>
        {showHistory && (
          <div className="px-4 pb-4 border-t border-white/10 pt-3">
            <HistoryGrid period={fmtRange(prevPeriod1.start, prevPeriod1.end)} pDates={prevPeriod1.dayDates} pId={prevPeriod1.periodId} />
            <HistoryGrid period={fmtRange(prevPeriod2.start, prevPeriod2.end)} pDates={prevPeriod2.dayDates} pId={prevPeriod2.periodId} />
          </div>
        )}
      </div>

      {/* Pay Summary — all submitted periods */}
      <div className="glass rounded-2xl overflow-hidden">
        <button onClick={() => setShowPaySummary(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left">
          <div>
            <div className="text-sm font-medium">Pay Summary — All Periods</div>
            <div className="text-xs text-zinc-500">Gross, deductions &amp; net pay · click a row to expand · print pay stub</div>
          </div>
          <span className="text-zinc-400 text-lg">{showPaySummary ? '▲' : '▼'}</span>
        </button>
        {showPaySummary && (
          <div className="border-t border-white/10">
            {/* Custom date range filter */}
            <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-3 border-b border-white/5">
              <span className="text-xs text-zinc-400 font-medium">Filter:</span>
              <input type="date" value={customRangeStart} onChange={e => setCustomRangeStart(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none" />
              <span className="text-zinc-600 text-xs">to</span>
              <input type="date" value={customRangeEnd} onChange={e => setCustomRangeEnd(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none" />
              {(customRangeStart || customRangeEnd) && (
                <button onClick={() => { setCustomRangeStart(''); setCustomRangeEnd('') }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5">Clear</button>
              )}
              {filteredSubmissions.length > 0 && (customRangeStart || customRangeEnd) && (
                <span className="text-xs text-zinc-500">{filteredSubmissions.length} period{filteredSubmissions.length !== 1 ? 's' : ''} · Gross <span className="font-mono" style={{ color: 'var(--accent-color)' }}>${filteredSubmissions.reduce((s, r) => s + calcPay(r.total_hours).gross, 0).toFixed(2)}</span> · Net <span className="font-mono text-white">${filteredSubmissions.reduce((s, r) => s + calcPay(r.total_hours).net, 0).toFixed(2)}</span></span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: '560px' }}>
                <thead>
                  <tr className="text-zinc-500 border-b border-white/10">
                    <th className="px-4 py-2 text-left font-medium">Pay Period</th>
                    <th className="px-3 py-2 text-right font-medium">Hours</th>
                    <th className="px-3 py-2 text-right font-medium">Gross Pay</th>
                    <th className="px-3 py-2 text-right font-medium">Deductions</th>
                    <th className="px-3 py-2 text-right font-medium">Net Pay</th>
                    <th className="px-3 py-2 text-center font-medium">Stub</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No submitted pay periods yet. Submit your first timesheet above.</td></tr>
                  ) : filteredSubmissions.map((sub, idx) => {
                    const p = calcPay(sub.total_hours)
                    const isSelected = selectedStubPeriod?.period_start === sub.period_start
                    return (
                      <tr key={sub.id || idx}>
                        <td colSpan={6} className="p-0">
                          <div>
                            <button onClick={() => setSelectedStubPeriod(isSelected ? null : sub)}
                              className={`w-full text-left flex items-center border-b border-white/5 transition-colors ${isSelected ? 'bg-white/5' : 'hover:bg-white/3'}`}>
                              <span className="px-4 py-2.5 flex-1">
                                <span className="font-medium text-zinc-200">{sub.period_start} – {sub.period_end}</span>
                                <span className="text-zinc-600 text-[10px] ml-2">submitted {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : '–'}</span>
                              </span>
                              <span className="px-3 py-2.5 font-mono text-zinc-300 text-right w-16">{sub.total_hours.toFixed(1)}h</span>
                              <span className="px-3 py-2.5 font-mono text-right w-24" style={{ color: 'var(--accent-color)' }}>${p.gross.toFixed(2)}</span>
                              <span className="px-3 py-2.5 font-mono text-red-400 text-right w-24">-${p.deductions.toFixed(2)}</span>
                              <span className="px-3 py-2.5 font-mono text-white font-semibold text-right w-24">${p.net.toFixed(2)}</span>
                              <span className="px-3 py-2.5 text-center w-16">
                                <button onClick={e => { e.stopPropagation(); handlePrintStub(sub) }}
                                  className="text-[10px] px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 text-zinc-400 hover:text-white">Print</button>
                              </span>
                            </button>
                            {isSelected && (
                              <div className="bg-black/20 px-4 py-4 border-b border-white/10">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-3">
                                  <div className="bg-black/30 rounded-xl p-3">
                                    <div className="text-zinc-500 mb-1">Regular Pay</div>
                                    <div className="font-mono text-white">${(Math.min(sub.total_hours, 80) * hourlyRate).toFixed(2)}</div>
                                    <div className="text-zinc-600 text-[10px]">{Math.min(sub.total_hours, 80).toFixed(1)}h × ${hourlyRate}/hr</div>
                                  </div>
                                  {sub.total_hours > 80 && (
                                    <div className="bg-amber-400/10 rounded-xl p-3">
                                      <div className="text-amber-500 mb-1">Overtime</div>
                                      <div className="font-mono text-amber-300">${((sub.total_hours - 80) * 1.5 * hourlyRate).toFixed(2)}</div>
                                      <div className="text-zinc-600 text-[10px]">{(sub.total_hours - 80).toFixed(1)}h × 1.5×</div>
                                    </div>
                                  )}
                                  <div className="bg-black/30 rounded-xl p-3">
                                    <div className="text-zinc-500 mb-1">Federal Tax (12%)</div>
                                    <div className="font-mono text-red-400">-${p.federalWithholding.toFixed(2)}</div>
                                  </div>
                                  <div className="bg-black/30 rounded-xl p-3">
                                    <div className="text-zinc-500 mb-1">State Tax (5%)</div>
                                    <div className="font-mono text-red-400">-${p.stateWithholding.toFixed(2)}</div>
                                  </div>
                                  <div className="bg-black/30 rounded-xl p-3">
                                    <div className="text-zinc-500 mb-1">FICA (7.65%)</div>
                                    <div className="font-mono text-red-400">-${p.fica.toFixed(2)}</div>
                                    <div className="text-zinc-600 text-[10px]">SS 6.2% + Medicare 1.45%</div>
                                  </div>
                                  <div className="bg-white/5 rounded-xl p-3">
                                    <div className="text-zinc-400 mb-1 font-medium">Net Pay</div>
                                    <div className="font-mono text-white text-base font-bold">${p.net.toFixed(2)}</div>
                                  </div>
                                </div>
                                <button onClick={() => handlePrintStub(sub)}
                                  className="text-xs px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-zinc-300 transition-colors">
                                  Print Pay Stub
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {filteredSubmissions.length > 1 && (
                  <tfoot>
                    <tr className="border-t border-white/20">
                      <td className="px-4 py-2.5 text-zinc-400 font-medium">Totals ({filteredSubmissions.length} periods)</td>
                      <td className="px-3 py-2.5 text-right font-mono text-zinc-300">{filteredSubmissions.reduce((s, r) => s + r.total_hours, 0).toFixed(1)}h</td>
                      <td className="px-3 py-2.5 text-right font-mono" style={{ color: 'var(--accent-color)' }}>${filteredSubmissions.reduce((s, r) => s + calcPay(r.total_hours).gross, 0).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-400">-${filteredSubmissions.reduce((s, r) => s + calcPay(r.total_hours).deductions, 0).toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-white font-bold">${filteredSubmissions.reduce((s, r) => s + calcPay(r.total_hours).net, 0).toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Swifty Pay Assistant */}
      <div className="glass rounded-2xl overflow-hidden">
        <button onClick={() => setShowSwifty(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left">
          <div>
            <div className="text-sm font-medium flex items-center gap-2">
              <span style={{ color: 'var(--accent-color)' }}>⚡</span> Ask Swifty About Your Pay
            </div>
            <div className="text-xs text-zinc-500">Ask about earnings, deductions, overtime, or anything about your pay history</div>
          </div>
          <span className="text-zinc-400 text-lg">{showSwifty ? '▲' : '▼'}</span>
        </button>
        {showSwifty && (
          <div className="border-t border-white/10">
            {swiftyMessages.length > 0 && (
              <div className="px-4 py-3 max-h-72 overflow-y-auto space-y-3">
                {swiftyMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-white/10 text-white' : 'bg-black/40 border border-white/10 text-zinc-300'}`}>
                      {msg.role === 'assistant' ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                    </div>
                  </div>
                ))}
                {swiftyLoading && (
                  <div className="flex justify-start">
                    <div className="bg-black/40 border border-white/10 rounded-2xl px-3 py-2 text-sm text-zinc-500 italic">Swifty is thinking…</div>
                  </div>
                )}
                <div ref={swiftyBottomRef} />
              </div>
            )}
            <div className="px-4 py-3 border-t border-white/5 flex gap-2">
              <input ref={swiftyRef} type="text" value={swiftyInput}
                onChange={e => setSwiftyInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSwiftySubmit() }}
                placeholder="e.g. What was my highest earning period? How much OT did I work?"
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/30 placeholder-zinc-600"
                disabled={swiftyLoading}
              />
              <button onClick={handleSwiftySubmit} disabled={swiftyLoading || !swiftyInput.trim()}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent-color)', color: 'black' }}>
                Ask
              </button>
            </div>
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {['What was my highest earning period?', 'How much did I earn this year?', 'What are my total deductions?', 'How much overtime did I log?'].map(q => (
                <button key={q} onClick={() => { setSwiftyInput(q); swiftyRef.current?.focus() }}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors" disabled={swiftyLoading}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="glass rounded-2xl p-4">
        <label className="flex items-center gap-3 mb-4">
          <input type="checkbox" checked={certified} onChange={e => setCertified(e.target.checked)} disabled={isSubmitted} className="w-4 h-4 accent-white" />
          <span className="text-sm">I certify this timesheet is accurate and complete.</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleSaveDraft} className="px-5 py-2.5 rounded-xl border border-white/20 hover:bg-white/5 text-sm">Save draft (+15 XP)</button>
          <button onClick={handleSubmit} disabled={!certified || isSubmitted}
            className="glass-btn-green px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
            Submit timesheet
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-4">Once submitted, this period is locked until approval or rejection.</p>
      </div>
    </div>
  )
}

// ===== Logo =====
function LogoSVG({ className }: { className?: string }) {
  return (
    <img src="/logo.png" alt="SwiftShift" className={className} style={{ objectFit: 'contain' }} />
  )
}

function getThemeAccentHex(theme: string): string {
  if (theme === 'custom') return localStorage.getItem('swiftshift-custom-accent') || '#00FF88'
  if (theme === 'white') return '#E5E7EB'
  if (theme === 'orange') return '#F97316'
  if (theme === 'cyan') return '#51FEFE'
  if (theme === 'pink') return '#FE51D7'
  if (theme === 'purple') return '#9B51FE'
  if (theme === 'red') return '#EF4444'
  if (theme === 'gold') return '#F59E0B'
  if (theme === 'teal') return '#2DD4BF'
  if (theme === 'blue') return '#60A5FA'
  return '#D7FE51'
}

// ===== Forgot Password Modal =====
function ForgotPasswordModal({ onClose, accentHex }: { onClose: () => void; accentHex: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [resetUrl, setResetUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Request failed. Please try again.')
      } else {
        setSent(true)
        if (data.reset_url) setResetUrl(data.reset_url)
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass w-full max-w-[360px] rounded-3xl p-8 border border-white/10 mx-4" onClick={e => e.stopPropagation()} style={{ boxShadow: `0 0 80px -20px ${accentHex}35, 0 28px 72px -14px rgba(0,0,0,0.85)` }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold">Reset Password</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {sent ? (
          <div className="text-center py-4 space-y-3">
            <div className="text-4xl">📬</div>
            <p className="text-sm text-zinc-400">
              If that email is registered, a reset link has been generated.
            </p>
            {resetUrl && (
              <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10 text-left">
                <p className="text-[11px] text-zinc-500 mb-1.5 uppercase tracking-wider">Your reset link (demo mode)</p>
                <a
                  href={resetUrl}
                  className="text-xs break-all underline underline-offset-4 transition-colors"
                  style={{ color: accentHex }}
                >
                  {window.location.origin}/{resetUrl}
                </a>
              </div>
            )}
            <button onClick={onClose} className="mt-2 text-sm underline underline-offset-4 text-zinc-400 hover:text-white transition-colors">
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-zinc-400">Enter your email and we'll generate a password reset link.</p>
            <div>
              <label className="block text-sm text-zinc-400 mb-1 tracking-wide">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 outline-none transition-all"
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>
            {error && (
              <div className="text-sm text-red-400 flex items-center gap-2 bg-red-950/40 border border-red-900/60 rounded-xl px-4 py-2">
                ⚠ {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="glass-btn-green w-full py-3 rounded-2xl text-sm font-semibold tracking-[0.5px] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating link…' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ===== Reset Password Page =====
function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const accentHex = getThemeAccentHex(localStorage.getItem('theme') || 'green')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError("Passwords don't match"); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Reset failed. The link may have expired.')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0A0F1E] to-black" />
      <div className="glass w-full max-w-[380px] rounded-3xl p-8 border border-white/10 relative z-10" style={{ boxShadow: `0 0 80px -20px ${accentHex}35, 0 28px 72px -14px rgba(0,0,0,0.85)` }}>
        <div className="flex items-center gap-3 mb-6">
          <LogoSVG className="h-8 w-auto" />
          <span className="font-semibold text-xl tracking-[1px]">SWIFTSHIFT</span>
        </div>
        {!token ? (
          <div className="text-center py-4 space-y-3">
            <div className="flex justify-center mb-1">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <p className="text-sm text-zinc-400">Invalid reset link. Please request a new one.</p>
            <a href="login" className="inline-block text-sm underline underline-offset-4 text-zinc-400 hover:text-white transition-colors">Back to sign in</a>
          </div>
        ) : success ? (
          <div className="text-center py-4 space-y-3">
            <div className="flex justify-center mb-1">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <p className="text-sm text-zinc-400">Password updated successfully!</p>
            <a href="login" className="inline-block text-sm underline underline-offset-4 text-zinc-400 hover:text-white transition-colors">Sign in</a>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <div className="text-xs tracking-[2px] mb-1.5 uppercase" style={{ color: accentHex }}>Set New Password</div>
              <h2 className="text-2xl font-semibold tracking-tight">Choose a new password</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1 tracking-wide">NEW PASSWORD</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 outline-none transition-all pr-12"
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors" tabIndex={-1}>
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
              <div>
                <label className="block text-sm text-zinc-400 mb-1 tracking-wide">CONFIRM PASSWORD</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 outline-none transition-all"
                  placeholder="Repeat password"
                  required
                />
              </div>
              {error && (
                <div className="text-sm text-red-400 flex items-center gap-2 bg-red-950/40 border border-red-900/60 rounded-xl px-4 py-2">
                  ⚠ {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="glass-btn-green w-full py-3.5 rounded-2xl text-base font-semibold tracking-[0.5px] transition-all active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating…' : 'Update Password'}
              </button>
              <div className="text-center">
                <a href="login" className="text-sm text-zinc-400 hover:text-white underline underline-offset-4 transition-colors">Back to sign in</a>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
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
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showLoginTour, setShowLoginTour] = useState(false)

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
          <div className="flex items-center gap-3 mb-8">
            <LogoSVG className="h-9 w-auto" />
            <span className="font-semibold text-2xl tracking-[1px]">SWIFTSHIFT</span>
          </div>
          <div className="max-w-[400px]">
            <div className="uppercase tracking-[4px] text-xs text-zinc-500 mb-3"><span style={{ color: loginAccentHex }}>AI POWERED</span> HR ENTERPRISE PLATFORM</div>
            <h1 className="text-[52px] leading-[1.05] font-semibold tracking-tighter mb-5">
              Time is money.
            </h1>

            {/* Stats row */}
            <div className="flex gap-6 mb-7">
              {[['10k+', 'Employees'], ['99.9%', 'Uptime'], ['4.9★', 'Rated']].map(([val, label]) => (
                <div key={label}>
                  <div className="text-xl font-bold" style={{ color: loginAccentHex }}>{val}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Feature cards */}
            <div className="space-y-2.5">
              {[
                { icon: '⏱', title: 'One-tap Clock In', desc: 'Punch in instantly. Stay logged in.' },
                { icon: '📈', title: 'Real-Time Earnings', desc: 'Watch your pay grow live as you work.' },
                { icon: '🤖', title: 'AI Tax Filing', desc: 'Swifty auto-fills your 1040 from your W-2 — free.' },
                { icon: '🏆', title: 'Rewards & XP', desc: 'Level up and unlock perks just for showing up.' },
                { icon: '💼', title: 'InstaApply', desc: 'AI job matching with one-click applications.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ background: `${loginAccentHex}18` }}>
                    {icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white leading-tight">{title}</div>
                    <div className="text-xs text-zinc-500 leading-tight mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: Testimonial + Status */}
        <div className="space-y-4 max-w-[380px]">
          <div className="p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm text-zinc-300 italic leading-relaxed mb-2">"SwiftShift cut our payroll processing time in half. The real-time earnings view alone boosted team morale."</p>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold text-white">JM</div>
              <span className="text-xs text-zinc-500">Jamie M. · HR Director</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 rounded-full bg-[#D7FE51] animate-pulse" />
            <span className="text-white/60 tracking-wide">System Status: Online</span>
          </div>
        </div>
      </div>

      {/* Right: Control Panel */}
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-[420px] space-y-4">
          {/* Mobile-only brand header */}
          <div className="lg:hidden flex items-center justify-center gap-3 pt-2 pb-1">
            <LogoSVG className="h-12 w-auto" />
            <span className="font-semibold text-3xl tracking-[1px]">SWIFTSHIFT</span>
          </div>
          {/* Mobile-only feature highlights */}
          <div className="lg:hidden glass rounded-3xl p-5 border border-white/10">
            <div className="text-xs tracking-[3px] text-zinc-500 uppercase mb-3"><span style={{ color: loginAccentHex }}>AI POWERED</span> HR PLATFORM</div>
            <h1 className="text-2xl font-semibold tracking-tight mb-3">Time is money.</h1>
            <div className="text-sm text-zinc-400 space-y-1.5 mb-4">
              <div>⚡ Frictionless one-tap clock in</div>
              <div>📈 Real-time visualized earnings</div>
              <div>🤖 AI tax filing — free &amp; instant</div>
              <div>💼 Auto job matching &amp; InstaApply</div>
              <div>🔥 Streak rewards &amp; achievements</div>
            </div>
            <div className="flex gap-2">
              <a href="signup" className="flex-1 text-center py-2 rounded-xl text-sm font-semibold" style={{ background: loginAccentHex, color: '#000' }}>
                Create free account
              </a>
              <button type="button" onClick={() => setShowFeaturePreview(true)} className="px-4 py-2 rounded-xl text-sm border border-white/10 text-zinc-300 hover:bg-white/5">
                Preview →
              </button>
            </div>
          </div>

        <div className="glass w-full rounded-3xl p-8 border border-white/10">
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
              <button type="button" onClick={() => setShowForgotPassword(true)} className="text-zinc-500 hover:text-white transition-colors">Forgot password?</button>
              <a href="signup" className="text-zinc-400 hover:text-white underline underline-offset-4">Create account — it's free</a>
            </div>

            {/* Tour button */}
            <div className="text-center mt-1">
              <button
                type="button"
                onClick={() => setShowLoginTour(true)}
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
      {showForgotPassword && (
        <ForgotPasswordModal
          onClose={() => setShowForgotPassword(false)}
          accentHex={loginAccentHex}
        />
      )}
      {showLoginTour && (
        <Tour
          onClose={() => setShowLoginTour(false)}
          onNavigate={() => setShowLoginTour(false)}
          onComplete={() => setShowLoginTour(false)}
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
  const [showSignupTour, setShowSignupTour] = useState(false)
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
              <div>- Log in one time, and STAY logged in.</div>
              <div>- Effortless navigation.</div>
              <div>- Frictionless clock in.</div>
              <div>- Real time visualized earnings.</div>
              <div>- Find the best-matched jobs.</div>
              <div>- Taxes filed instantly with AI.</div>
              <div>- AI assisted HR support with Swifty.</div>
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
        <div className="w-full max-w-[420px] space-y-4">
          {/* Mobile-only brand header */}
          <div className="lg:hidden flex items-center justify-center gap-3 pt-2 pb-1">
            <LogoSVG className="h-12 w-auto" />
            <span className="font-semibold text-3xl tracking-[1px]">SWIFTSHIFT</span>
          </div>
          {/* Mobile-only feature highlights */}
          <div className="lg:hidden glass rounded-3xl p-5 border border-white/10">
            <div className="text-xs tracking-[3px] text-zinc-500 uppercase mb-3"><span style={{ color: signupAccentHex }}>AI POWERED</span> HR PLATFORM</div>
            <h1 className="text-2xl font-semibold tracking-tight mb-1">Time is money.</h1>
            <p className="text-sm font-semibold mb-3" style={{ color: signupAccentHex }}>100% free to create an account.</p>
            <div className="text-sm text-zinc-400 space-y-1.5 mb-4">
              <div>⚡ Frictionless one-tap clock in</div>
              <div>📈 Real-time visualized earnings</div>
              <div>🤖 AI tax filing — free &amp; instant</div>
              <div>💼 Auto job matching &amp; InstaApply</div>
              <div>🔥 Streak rewards &amp; achievements</div>
            </div>
            <div className="flex gap-2">
              <a href="login" className="flex-1 text-center py-2 rounded-xl text-sm font-semibold border border-white/10 text-zinc-300 hover:bg-white/5">
                Sign in
              </a>
              <button type="button" onClick={() => setShowFeaturePreview(true)} className="px-4 py-2 rounded-xl text-sm border border-white/10 text-zinc-300 hover:bg-white/5">
                Preview →
              </button>
            </div>
          </div>

        <div className="glass w-full rounded-3xl p-8 border border-white/10">
          <div className="mb-6">
            <div className="text-xs tracking-[2px] text-[#D7FE51] mb-1.5 uppercase">Create Your Account</div>
            <h2 className="text-3xl font-semibold tracking-tight mb-1.5">Get started</h2>
            <p className="text-zinc-400 text-sm">Set up your free account in seconds.</p>
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
                onClick={() => setShowSignupTour(true)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Explore features →
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 text-center text-[10px] text-zinc-500 tracking-[1px]">
            Secure · Encrypted · Audited · 100% Free
          </div>
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
      {showSignupTour && (
        <Tour
          onClose={() => setShowSignupTour(false)}
          onNavigate={() => setShowSignupTour(false)}
          onComplete={() => setShowSignupTour(false)}
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
  const isResetPassword = pathname === '/reset-password' || pathname.endsWith('/reset-password')

  if (isResetPassword) return <ResetPasswordPage />
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
  const [clockHourlyRate, setClockHourlyRate] = useState<number>(() => {
    // Prefer DB value, fall back to localStorage, then derive from salary/pay
    if (user?.hourly_rate != null) return Number(user.hourly_rate)
    const saved = localStorage.getItem('swiftshift-hourly-rate')
    if (saved) return parseFloat(saved)
    const salary = Number(user?.salary) || 0
    if (salary > 0) return salary / 2080
    const pay = Number(user?.pay)
    return pay > 0 ? pay : 65
  })
  const [highlightRate, setHighlightRate] = useState(false)
  const [showTour, setShowTour] = useState(() => localStorage.getItem('swiftshift-tour-pending') === '1')
  const [chatMessage, setChatMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [attachedFile, setAttachedFile] = useState<{ file_id: string; filename: string } | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [theme, setTheme] = useState<'green' | 'white' | 'orange' | 'cyan' | 'pink' | 'purple' | 'red' | 'gold' | 'teal' | 'blue' | 'custom'>(() => {
    const saved = localStorage.getItem('theme')
    return (saved === 'green' || saved === 'white' || saved === 'orange' || saved === 'cyan' || saved === 'pink' || saved === 'purple' || saved === 'red' || saved === 'gold' || saved === 'teal' || saved === 'blue' || saved === 'custom') ? saved : 'green'
  })
  const [customAccentColor, setCustomAccentColor] = useState<string>(() => localStorage.getItem('swiftshift-custom-accent') || '#00FF88')

  const gamification = useGamification()
  const { gState: appGState, currentLevel: appCurrentLevel, nextLevel: appNextLevel } = gamification
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
  const [managerSectionOpen, setManagerSectionOpen] = useState(false)

  // Profile tabs state
  const [profileTab, setProfileTab] = useState<'info' | 'schedule' | 'deposit' | 'availability'>('info')
  const [profilePicUrl, setProfilePicUrl] = useState<string>(() => localStorage.getItem('swiftshift-profile-pic') || '')
  const [profilePicZoom, setProfilePicZoom] = useState<number>(() => parseFloat(localStorage.getItem('swiftshift-profile-pic-zoom') || '1'))
  const [profilePicX, setProfilePicX] = useState<number>(() => parseFloat(localStorage.getItem('swiftshift-profile-pic-x') || '50'))
  const [profilePicY, setProfilePicY] = useState<number>(() => parseFloat(localStorage.getItem('swiftshift-profile-pic-y') || '50'))
  const [showCropModal, setShowCropModal] = useState(false)

  // Sidebar customization
  const DEFAULT_SIDEBAR_ORDER = ['clock','timesheet','rewards','kpi','insurance','orgchart','taxes','groktax','applications']
  const [sidebarOrder, setSidebarOrder] = useState<string[]>(() => {
    try { const s = localStorage.getItem('swiftshift-sidebar-order'); return s ? JSON.parse(s) : DEFAULT_SIDEBAR_ORDER } catch { return DEFAULT_SIDEBAR_ORDER }
  })
  const [favoriteTabs, setFavoriteTabs] = useState<string[]>(() => {
    try { const s = localStorage.getItem('swiftshift-favorite-tabs'); return s ? JSON.parse(s) : [] } catch { return [] }
  })
  const [draggedNavId, setDraggedNavId] = useState<string | null>(null)
  const [dragOverNavId, setDragOverNavId] = useState<string | null>(null)
  const [, setWorkSchedule] = useState<any>(null)
  const [directDeposit, setDirectDeposit] = useState<any>(null)
  const [, setWorkAvailability] = useState<any>(null)
  const [scheduleEdit, setScheduleEdit] = useState<any>(null)
  const [depositEdit, setDepositEdit] = useState<any>(null)
  const [availabilityEdit, setAvailabilityEdit] = useState<any>(null)

  // Leave Management state
  const [ptoBalance, setPtoBalance] = useState<any>(null)
  const [ptoRequests, setPtoRequests] = useState<any[]>([])
  const [ptoRequestForm, setPtoRequestForm] = useState({ start_date: '', end_date: '', request_type: 'vacation', reason: '', hours_requested: '' })
  const [showPtoForm, setShowPtoForm] = useState(false)
  const [allPtoRequests, setAllPtoRequests] = useState<any[]>([])
  const [ptoApprovalLoading, setPtoApprovalLoading] = useState<number | null>(null)

  // Schedules state
  const [shiftSwaps, setShiftSwaps] = useState<any[]>([])
  const [allShiftSwaps, setAllShiftSwaps] = useState<any[]>([])
  const [timesheetSubs, setTimesheetSubs] = useState<any[]>([])
  const [showSwapForm, setShowSwapForm] = useState(false)
  const [swapForm, setSwapForm] = useState({ shift_date: '', shift_start: '', shift_end: '', reason: '' })

  // Announcements state
  const [announcements, setAnnouncements] = useState<Array<{ id: number; title: string; body: string; author: string; priority: 'normal' | 'urgent'; created_at: string; read_by: string[] }>>([
    { id: 1, title: 'Reminder: Timesheets due Friday', body: 'Please submit your timesheets by 5 PM Friday to ensure on-time payroll processing. Late submissions may delay your payment.', author: 'Dana Morales', priority: 'urgent', created_at: '2026-04-25T09:00:00Z', read_by: [] },
    { id: 2, title: 'Team lunch — Thursday noon', body: 'We are doing a team lunch this Thursday at 12 PM in the main conference room. All hands welcome!', author: 'Alex Rivera', priority: 'normal', created_at: '2026-04-24T14:30:00Z', read_by: [] },
    { id: 3, title: 'Updated PTO policy effective May 1', body: 'Starting May 1, the PTO accrual rate increases from 1.5 to 2 days per month. See HR portal for details.', author: 'Dana Morales', priority: 'normal', created_at: '2026-04-22T11:00:00Z', read_by: [] },
  ])
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false)
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', priority: 'normal' as 'normal' | 'urgent' })

  // Onboarding tasks state
  const [onboardingTasks, setOnboardingTasks] = useState<Record<string, boolean[]>>({
    'Sam Carter': [true, true, false, false, false, false],
    'Mia Thompson': [false, false, false, false, false, false],
    'Leo Kim': [true, true, true, true, false, false],
  })

  // Payroll sign-off state
  const [payrollSignoffs, setPayrollSignoffs] = useState<Record<string, boolean>>({
    'Alex Rivera': true,
    'Jordan Lee': true,
    'Dana Morales': false,
    'Casey Morgan': false,
  })

  const navTo = (view: View) => {
    setActiveView(view)
    setMobileMenuOpen(false)
  }

  const toggleFavorite = (id: string) => {
    setFavoriteTabs(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
      localStorage.setItem('swiftshift-favorite-tabs', JSON.stringify(next))
      return next
    })
  }

  const handleNavDrop = (targetId: string) => {
    if (!draggedNavId || draggedNavId === targetId) { setDraggedNavId(null); setDragOverNavId(null); return }
    setSidebarOrder(prev => {
      const arr = [...prev]
      const fromIdx = arr.indexOf(draggedNavId)
      const toIdx = arr.indexOf(targetId)
      if (fromIdx < 0 || toIdx < 0) return prev
      arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, draggedNavId)
      localStorage.setItem('swiftshift-sidebar-order', JSON.stringify(arr))
      return arr
    })
    setDraggedNavId(null)
    setDragOverNavId(null)
  }

  const navToRewardsWithHighlight = () => {
    setHighlightRate(true)
    navTo('rewards')
  }

  // Auto-clear highlight after animation completes
  useEffect(() => {
    if (!highlightRate) return
    const timer = setTimeout(() => setHighlightRate(false), 2500)
    return () => clearTimeout(timer)
  }, [highlightRate])

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

  // Auto-open manager section when navigating to a manager view
  const managerViews: View[] = ['admin', 'schedules', 'payroll', 'reports', 'leaves', 'compliance', 'hiring', 'teamkpi', 'announcements']
  useEffect(() => {
    if (managerViews.includes(activeView)) setManagerSectionOpen(true)
  }, [activeView]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing tax files for Grok Tax (check s3/<user_id> via fill-1040)
  useEffect(() => {
    if (activeView === 'groktax' && user?.id && taxUploadedFiles.length === 0 && !taxFormData) {
      handleFill1040()
    }
  }, [activeView, user?.id])

  // Persist theme and sync to body for toast styling
  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.body.setAttribute('data-theme', theme)
  }, [theme])

  // Apply custom accent color as CSS variable when custom theme is active
  useEffect(() => {
    if (theme === 'custom') {
      document.documentElement.style.setProperty('--accent-color', customAccentColor)
      const r = parseInt(customAccentColor.slice(1, 3), 16)
      const g = parseInt(customAccentColor.slice(3, 5), 16)
      const b = parseInt(customAccentColor.slice(5, 7), 16)
      document.documentElement.style.setProperty('--accent-color-rgb', `${r}, ${g}, ${b}`)
    } else {
      document.documentElement.style.removeProperty('--accent-color')
      document.documentElement.style.removeProperty('--accent-color-rgb')
    }
  }, [theme, customAccentColor])

  // Set favicon to logo.png
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.type = 'image/png'
    link.href = '/logo.png'
  }, [])

  const themeAccentHex = theme === 'custom' ? customAccentColor : theme === 'green' ? '#D7FE51' : theme === 'white' ? '#E5E7EB' : theme === 'orange' ? '#F97316' : theme === 'cyan' ? '#51FEFE' : theme === 'pink' ? '#FE51D7' : theme === 'purple' ? '#9B51FE' : theme === 'red' ? '#EF4444' : theme === 'gold' ? '#F59E0B' : theme === 'teal' ? '#2DD4BF' : theme === 'blue' ? '#60A5FA' : '#D7FE51'

  // Load users for admin
  useEffect(() => {
    if (activeView === 'admin') {
      fetch(`${API_BASE}/api/users`)
        .then(r => (r.ok ? r.json() : []))
        .then(data => setUsers(Array.isArray(data) ? data : []))
        .catch(() => setUsers([]))
    }
  }, [activeView])

  // Load profile data when navigating to profile
  useEffect(() => {
    if (activeView !== 'profile' || !user?.id) return
    const uid = user.id
    fetch(`${API_BASE}/api/work-schedule?user_id=${uid}`).then(r => r.json()).then(d => { setWorkSchedule(d); setScheduleEdit(d) }).catch(() => {})
    fetch(`${API_BASE}/api/direct-deposit?user_id=${uid}`).then(r => r.json()).then(d => { setDirectDeposit(d); setDepositEdit(d) }).catch(() => {})
    fetch(`${API_BASE}/api/availability?user_id=${uid}`).then(r => r.json()).then(d => { setWorkAvailability(d); setAvailabilityEdit(d) }).catch(() => {})
  }, [activeView, user?.id])

  // Load leave management data
  useEffect(() => {
    if (activeView !== 'leaves' || !user?.id) return
    const uid = user.id
    fetch(`${API_BASE}/api/pto/balance?user_id=${uid}`).then(r => r.json()).then(setPtoBalance).catch(() => {})
    fetch(`${API_BASE}/api/pto/requests?user_id=${uid}`).then(r => r.json()).then(r => setPtoRequests(Array.isArray(r) ? r : [])).catch(() => {})
    fetch(`${API_BASE}/api/pto/requests`).then(r => r.json()).then(r => setAllPtoRequests(Array.isArray(r) ? r : [])).catch(() => {})
  }, [activeView, user?.id])

  // Load schedules data
  useEffect(() => {
    if (activeView !== 'schedules' || !user?.id) return
    const uid = user.id
    fetch(`${API_BASE}/api/shift-swaps?user_id=${uid}`).then(r => r.json()).then(r => setShiftSwaps(Array.isArray(r) ? r : [])).catch(() => {})
    fetch(`${API_BASE}/api/shift-swaps`).then(r => r.json()).then(r => setAllShiftSwaps(Array.isArray(r) ? r : [])).catch(() => {})
    fetch(`${API_BASE}/api/timesheet-submissions?user_id=${uid}`).then(r => r.json()).then(r => setTimesheetSubs(Array.isArray(r) ? r : [])).catch(() => {})
  }, [activeView, user?.id])

  // Clock state
  const [clockInAt, setClockInAt] = useState<Date | null>(() => {
    // Quick-load clock-in time from localStorage so clocked-in state is visible immediately on refresh
    const saved = localStorage.getItem('swiftshift-clock-in-at')
    if (saved) {
      const d = new Date(saved)
      if (!isNaN(d.getTime())) return d
    }
    return null
  })
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [breakStartedAt, setBreakStartedAt] = useState<Date | null>(null)
  const [breakType, setBreakType] = useState<'paid' | 'unpaid' | null>(null)
  const [breakMsAccum, setBreakMsAccum] = useState(0)
  const [paidBreakMsAccum, setPaidBreakMsAccum] = useState(0)
  const [periodTotalMs, setPeriodTotalMs] = useState(0)
  const [todayWorkedMs, setTodayWorkedMs] = useState(() => {
    // Quick-load from localStorage so earnings don't flash at $0 on refresh
    const saved = localStorage.getItem('swiftshift-today-ms')
    if (saved) {
      const { ms, date } = JSON.parse(saved)
      // Only use if it's still the same day
      if (date === new Date().toISOString().slice(0, 10)) return Number(ms)
    }
    return 0
  })
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

  // Daily streak counter (gamified punctuality) — prefer DB values, fall back to localStorage
  const [streak, setStreak] = useState<number>(() => {
    if (user?.streak_count != null) return Number(user.streak_count)
    const saved = localStorage.getItem('streak')
    return saved ? parseInt(saved, 10) : 0
  })
  const [lastStreakDate, setLastStreakDate] = useState<string>(() => {
    if (user?.streak_last_date) return user.streak_last_date
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
        const currentPeriod = payPeriodFor(new Date())
        const periodStartStr = currentPeriod.start.toISOString().slice(0, 10)
        const periodEndStr = currentPeriod.end.toISOString().slice(0, 10)

        // Sum duration_minutes for today's completed sessions, and for the full pay period
        let todayMs = 0
        let periodMs = 0
        for (const row of allRows) {
          if (!row.clock_in) continue
          const d = row.clock_in.slice(0, 10)
          if (d === todayStr) {
            const mins = Number(row.duration_minutes) || 0
            todayMs += mins * 60 * 1000
          }
          if (d >= periodStartStr && d <= periodEndStr) {
            const mins = Number(row.duration_minutes) || 0
            periodMs += mins * 60 * 1000
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
          localStorage.setItem('swiftshift-clock-in-at', clockInDate.toISOString())
          setActiveSessionId(active.id)
          setBreakStartedAt(null)
          setBreakType(null)
          setBreakMsAccum(0)
          setPaidBreakMsAccum(0)
        } else {
          setClockInAt(null)
          localStorage.removeItem('swiftshift-clock-in-at')
          setActiveSessionId(null)
        }

        setTodayWorkedMs(todayMs)
        setPeriodTotalMs(periodMs)
      })
      .catch(() => {})
  }, [user?.id])

  // Live clock tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Persist todayWorkedMs to localStorage (for quick refresh load)
  useEffect(() => {
    if (todayWorkedMs > 0) {
      localStorage.setItem('swiftshift-today-ms', JSON.stringify({
        ms: todayWorkedMs,
        date: new Date().toISOString().slice(0, 10),
      }))
    }
  }, [todayWorkedMs])

  // Derived clock values
  const isClockedIn = clockInAt !== null
  const isOnBreak = breakStartedAt !== null
  const activeBreakMs = isOnBreak ? Math.max(0, now.getTime() - breakStartedAt.getTime()) : 0
  // Only unpaid breaks deduct from worked time; paid breaks count as work time
  const unpaidActiveBreakMs = (isOnBreak && breakType === 'unpaid') ? activeBreakMs : 0
  const sessionWorkedMs = isClockedIn
    ? Math.max(0, now.getTime() - clockInAt.getTime() - breakMsAccum - unpaidActiveBreakMs)
    : 0
  const todayTotalMs = todayWorkedMs + sessionWorkedMs
  const isOvertimeOverdrive = todayTotalMs >= 8 * 3600000

  const statusText = !isClockedIn
    ? 'Not clocked in'
    : isOnBreak
      ? (breakType === 'paid' ? 'On paid break (15 min)' : 'On lunch break')
      : `Clocked in since ${clockInAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  // One-time login welcome toast
  useEffect(() => {
    if (!loginWelcomeShownRef.current) {
      loginWelcomeShownRef.current = true
      const hour = new Date().getHours()
      const g = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
      setTimeout(() => {
        toast(`Good ${g}, ${user.first_name}!`, {
          description: streak > 0 ? `${streak}-day streak - keep it going!` : 'Ready to clock in?',
          duration: 8000,
          icon: '👋',
          style: {
            background: '#111111',
            color: '#ffffff',
            border: 'none',
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
        1: '1 hour in - nice start!',
        2: '2 hours down!',
        3: '3 hours - you\'re in the zone!',
        4: 'Halfway there - 4 hours! 💪',
        5: '5 hours - almost done!',
        6: '6 hours - strong work!',
        7: '7 hours - one more to go!',
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
          75: '75% complete - almost there! 🚀',
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

  // Overtime warning at 7.5 hours
  const overtimeWarnFiredRef = useRef(false)
  useEffect(() => {
    if (!isClockedIn) { overtimeWarnFiredRef.current = false; return }
    const hoursWorked = todayTotalMs / 3600000
    if (hoursWorked >= 7.5 && !overtimeWarnFiredRef.current) {
      overtimeWarnFiredRef.current = true
      toast.warning('⚠️ Approaching overtime', {
        description: 'You\'ve worked 7.5 hours. Any time beyond 8h is overtime (1.5×).',
        duration: 6000,
      })
    }
  }, [Math.floor(todayTotalMs / (0.5 * 3600000))])

  // Payday notification (fire once on period end day)
  const paydayFiredRef = useRef(false)
  useEffect(() => {
    const period = payPeriodFor(now)
    const todayStr = now.toISOString().slice(0, 10)
    const endStr = period.end.toISOString().slice(0, 10)
    if (todayStr === endStr && !paydayFiredRef.current) {
      paydayFiredRef.current = true
      setTimeout(() => {
        toast.success('💸 Payday!', {
          description: 'Today is the last day of your pay period. Payday is coming!',
          duration: 8000,
        })
      }, 3000)
    }
  }, [now.toISOString().slice(0, 10)])

  // Clock-in reminder if not clocked in by 9:30 AM
  const clockInReminderFiredRef = useRef(false)
  useEffect(() => {
    const todayStr = now.toISOString().slice(0, 10)
    const key = `swiftshift-clockin-remind-${todayStr}`
    if (isClockedIn || localStorage.getItem(key)) return
    const hour = now.getHours()
    const min = now.getMinutes()
    if ((hour > 9 || (hour === 9 && min >= 30)) && !clockInReminderFiredRef.current) {
      clockInReminderFiredRef.current = true
      localStorage.setItem(key, '1')
      toast.info("⏰ Don't forget to clock in!", {
        description: 'You haven\'t clocked in yet today.',
        duration: 8000,
      })
    }
  }, [Math.floor(now.getTime() / 60000)])

  // Pay period
  const period = useMemo(() => payPeriodFor(now), [now])
  const periodLabel = `${period.start.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })} – ${period.end.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' })}`

  // Overtime 1.5× earnings calculation for pay period sidebar
  const periodEarnings = useMemo(() => {
    const totalMs = periodTotalMs + sessionWorkedMs
    const totalHours = totalMs / 3600000
    // Approximate: treat hours > 8h/day as overtime (per-day breakdown not tracked in periodTotalMs)
    // Use today's breakdown: regularToday = min(todayTotal, 8h), overtimeToday = max(0, todayTotal - 8h)
    const todayHours = (todayWorkedMs + sessionWorkedMs) / 3600000
    const regularToday = Math.min(todayHours, 8)
    const overtimeToday = Math.max(0, todayHours - 8)
    // Prior period hours assumed all regular (no per-day breakdown stored)
    const priorHours = periodTotalMs / 3600000 - (todayWorkedMs / 3600000)
    const priorRegular = Math.max(0, priorHours)
    const regular = priorRegular + regularToday
    const overtime = overtimeToday
    return {
      totalHours,
      regular,
      overtime,
      pay: regular * clockHourlyRate + overtime * clockHourlyRate * 1.5,
    }
  }, [periodTotalMs, sessionWorkedMs, todayWorkedMs, clockHourlyRate])

  // Actions
  const handleClockIn = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!isClockedIn) {
      setClockInAt(now)
      localStorage.setItem('swiftshift-clock-in-at', now.toISOString())
      setActiveSessionId(null)
      setBreakStartedAt(null)
      setBreakType(null)
      setBreakMsAccum(0)
      setPaidBreakMsAccum(0)

      // Persist clock-in to DB
      if (user?.id) {
        fetch(`${API_BASE}/api/clock-sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: user.id }),
        })
          .then(r => r.json())
          .then(row => { if (row?.id) setActiveSessionId(row.id) })
          .catch(() => {})
      }

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
        // Persist streak to DB
        if (user?.id) {
          fetch(`${API_BASE}/api/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streak_count: newStreak, streak_last_date: todayStr }),
          }).catch(() => {})
        }

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

  const handleStartBreak = (type: 'paid' | 'unpaid') => {
    if (isClockedIn && !isOnBreak) {
      setBreakStartedAt(now)
      setBreakType(type)
    }
  }

  const handleEndBreak = () => {
    if (isOnBreak && breakStartedAt) {
      const delta = Math.max(0, now.getTime() - breakStartedAt.getTime())
      if (breakType === 'paid') {
        setPaidBreakMsAccum(v => v + delta)
      } else {
        setBreakMsAccum(v => v + delta)
      }
      setBreakStartedAt(null)
      setBreakType(null)
      const breakMins = Math.round(delta / 60000)
      const msgs = [
        "You're back - let's get it!",
        "Refreshed and ready to crush it!",
        "Break over - back to greatness!",
        "Recharged! Time to earn! ⚡",
        "Welcome back - you've got this!",
      ]
      toast.success(msgs[Math.floor(Math.random() * msgs.length)], {
        description: `${breakType === 'paid' ? 'Paid break' : 'Lunch'}: ${breakMins} min`,
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
      // If currently on an unpaid break, close it first (unpaid breaks deduct from pay)
      let unpaidAccum = breakMsAccum
      if (isOnBreak && breakStartedAt && breakType === 'unpaid') {
        unpaidAccum += Math.max(0, now.getTime() - breakStartedAt.getTime())
      }
      const session = Math.max(0, now.getTime() - clockInAt!.getTime() - unpaidAccum)
      setTodayWorkedMs(v => v + session)
      setClockInAt(null)
      localStorage.removeItem('swiftshift-clock-in-at')
      setBreakStartedAt(null)
      setBreakType(null)
      setBreakMsAccum(0)
      setPaidBreakMsAccum(0)

      // Show LootDrop modal with earnings and PTO
      const ptoAccrualRate = 0.0385
      const hoursWorked = session / 3600000
      setLootEarnings(Math.round(hoursWorked * clockHourlyRate * 100) / 100)
      setLootPtoHours(Math.round(hoursWorked * ptoAccrualRate * 100) / 100)
      setLootDurationMin(Math.round(session / 60000))
      setShowLootDrop(true)

      // Persist clock-out to DB (send unpaid break minutes so backend deducts them)
      const sid = activeSessionId
      setActiveSessionId(null)
      const unpaidBreakMin = Math.round(unpaidAccum / 60000)
      if (sid && user?.id) {
        fetch(`${API_BASE}/api/clock-sessions/${sid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ break_minutes: unpaidBreakMin }),
        }).catch(() => {})
        // Accrue PTO to DB
        fetch(`${API_BASE}/api/pto/balance/accrue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, hours_worked: hoursWorked }),
        }).catch(() => {})
      }
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
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload error', { description: 'Could not upload file. Please try again.' })
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
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload error', { description: 'Could not upload document. Please try again.' })
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
        toast.error(data.error || 'Failed to fill 1040')
      }
    } catch {
      toast.error('Error filling form', { description: 'Could not connect to tax filing service. Please try again.' })
    } finally {
      setTaxLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    window.location.href = 'login'
  }

  const navUnlockedAchievements = appGState.unlockedAchievements

  return (
    <div className="ta-app" data-theme={theme} data-overdrive={isOvertimeOverdrive ? 'true' : undefined}>
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
          {/* Achievements badge */}
          <div className="relative group">
            <button
              onClick={() => navTo('rewards')}
              title="Achievements"
              className="flex items-center gap-1.5 px-3 py-1 text-sm border border-white/10 rounded-full hover:border-white/20 hover:bg-white/5 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',flexShrink:0,stroke:'var(--accent-color)'}}>
                <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
              </svg>
              {navUnlockedAchievements.slice(0, 3).map(id => {
                const ach = ACHIEVEMENTS.find(a => a.id === id)
                return ach ? <span key={id} className="text-xs leading-none" style={{ color: 'var(--accent-color)' }}>{ach.icon}</span> : null
              })}
              <span className="ta-streak-label text-white/40">Achievements</span>
            </button>
            {/* Hover dropdown */}
            <div
              className="absolute right-0 top-full mt-1 w-72 bg-zinc-900 border border-white/10 rounded-2xl hidden group-hover:block z-50 overflow-hidden"
              style={{ boxShadow: '0 0 40px -10px rgba(var(--accent-color-rgb), 0.2), 0 8px 24px rgba(0,0,0,0.8)' }}
            >
              <div className="px-4 py-2.5 text-xs text-zinc-500 uppercase tracking-wider border-b border-white/10">
                Today's Achievements
              </div>
              {navUnlockedAchievements.length === 0 ? (
                <div className="px-4 py-3 text-xs text-zinc-500">No achievements yet. Keep going!</div>
              ) : (
                ACHIEVEMENTS.filter(a => navUnlockedAchievements.includes(a.id)).map(ach => (
                  <div key={ach.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors">
                    <span className="text-base w-6 text-center flex-shrink-0" style={{ color: 'var(--accent-color)' }}>{ach.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-white">{ach.name}</div>
                      <div className="text-xs text-zinc-500">{ach.desc}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Daily streak counter */}
          <div className="flex items-center gap-1.5 px-3 py-1 text-sm text-white/60 border border-white/10 rounded-full">
            <span style={{ color: 'var(--accent-color)' }}>
              {streak > 0
                ? (
                  <svg width="13" height="16" viewBox="0 0 26 32" fill="currentColor" style={{display:'inline',verticalAlign:'middle'}}>
                    <path d="M13 1 C13 1, 3 10, 3 18 C3 25, 7.5 31, 13 31 C18.5 31, 23 25, 23 18 C23 10, 13 1, 13 1 Z M13 10 C13 10, 7 16, 7 20 C7 23.5, 9.7 26, 13 26 C16.3 26, 19 23.5, 19 20 C19 16, 13 10, 13 10 Z" fillRule="evenodd" opacity="0.95"/>
                    <path d="M13 14 C13 14, 9.5 18, 9.5 21 C9.5 23.2, 11 25, 13 25 C15 25, 16.5 23.2, 16.5 21 C16.5 18, 13 14, 13 14 Z" opacity="0.35"/>
                  </svg>
                )
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle'}}><circle cx="12" cy="12" r="8"/></svg>}
            </span>
            <span className="font-semibold" style={{ color: 'var(--accent-color)' }}>{streak}</span>
            <span className="text-white/40 ta-streak-label">day streak</span>
          </div>
          {/* User menu dropdown */}
          <div className="relative group">
            <span className="text-sm text-zinc-400 cursor-pointer flex items-center gap-2">
              {profilePicUrl
                ? <img src={profilePicUrl} alt="Profile" className="w-6 h-6 rounded-full object-cover border border-white/20" style={{ objectPosition: `${profilePicX}% ${profilePicY}%`, transform: `scale(${profilePicZoom})`, transformOrigin: `${profilePicX}% ${profilePicY}%` }} />
                : <span className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs text-zinc-400">{user.first_name?.[0]?.toUpperCase()}</span>
              }
              Hi, {user.first_name} <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1" style={{ backgroundColor: 'var(--accent-color)', color: '#000', fontWeight: 700 }}>Lv.{appCurrentLevel.level}<span className="ta-level-badge-name"> {appCurrentLevel.name}</span></span> ▾
            </span>
            <div className="absolute right-0 top-full w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-lg hidden group-hover:block z-50 pt-1">
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
              <div className="px-3 py-2 border-t border-white/10">
                <div className="text-xs text-zinc-500 mb-2">Theme</div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'green', label: 'Green', color: '#D7FE51', unlock: 1 },
                    { id: 'white', label: 'White', color: '#E5E7EB', unlock: 2 },
                    { id: 'orange', label: 'Orange', color: '#F97316', unlock: 3 },
                    { id: 'cyan', label: 'Ice Blue', color: '#51FEFE', unlock: 4 },
                    { id: 'pink', label: 'Neon Pink', color: '#FE51D7', unlock: 5 },
                    { id: 'purple', label: 'Midnight', color: '#9B51FE', unlock: 6 },
                    { id: 'red', label: 'Red', color: '#EF4444', unlock: 7 },
                    { id: 'gold', label: 'Gold', color: '#F59E0B', unlock: 8 },
                    { id: 'teal', label: 'Teal', color: '#2DD4BF', unlock: 9 },
                    { id: 'blue', label: 'Blue', color: '#60A5FA', unlock: 10 },
                  ].map(t => {
                    const unlocked = appCurrentLevel.level >= t.unlock
                    return (
                      <button
                        key={t.id}
                        onClick={() => unlocked && setTheme(t.id as any)}
                        title={unlocked ? t.label : `Unlocks at Level ${t.unlock}`}
                        className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all ${theme === t.id ? 'ring-1 ring-white/40' : ''} ${!unlocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'}`}
                      >
                        <div className="relative">
                          <span className="w-4 h-4 rounded-full border border-white/20 block" style={{ backgroundColor: t.color }} />
                          {!unlocked && (
                            <span className="absolute -top-1 -right-1.5">
                              <svg width="8" height="9" viewBox="0 0 10 12" fill="currentColor" className="text-zinc-400">
                                <rect x="1" y="5" width="8" height="7" rx="1.5" fill="currentColor"/>
                                <path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] text-zinc-400 leading-tight">{unlocked ? t.label : `L${t.unlock}`}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              {appCurrentLevel.level >= 5 && (
                <div className="px-3 py-2 border-t border-white/10">
                  <div className="text-xs text-zinc-500 mb-1.5">Custom Color <span className="text-[9px]">(Lv.5 unlock)</span></div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customAccentColor}
                      onChange={e => {
                        setCustomAccentColor(e.target.value)
                        localStorage.setItem('swiftshift-custom-accent', e.target.value)
                        setTheme('custom' as any)
                      }}
                      className="w-8 h-8 rounded cursor-pointer border border-white/20 bg-transparent"
                    />
                    <button
                      onClick={() => setTheme('custom' as any)}
                      className={`flex-1 text-[10px] px-2 py-1 rounded-lg transition-all ${theme === 'custom' ? 'ring-1 ring-white/40' : 'hover:bg-white/10'} text-zinc-300`}
                    >
                      {theme === 'custom' ? '✓ Active' : 'Use custom'}
                    </button>
                  </div>
                </div>
              )}
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
        {(() => {
          const NAV_ITEMS: Array<{ id: string; label: string; view: View; htmlId?: string; icon: React.ReactElement }> = [
            { id: 'clock', label: 'Time Clock', view: 'clock', htmlId: 'nav-clock', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
            { id: 'timesheet', label: 'Timesheet', view: 'timesheet', htmlId: 'nav-timesheet', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
            { id: 'rewards', label: 'Rewards', view: 'rewards', htmlId: 'nav-rewards', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg> },
            { id: 'kpi', label: 'My KPIs', view: 'kpi', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
            { id: 'insurance', label: 'Insurance & Benefits', view: 'insurance', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
            { id: 'orgchart', label: 'Org Chart', view: 'orgchart', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="2" y="14" width="8" height="4" rx="1"/><rect x="14" y="14" width="8" height="4" rx="1"/><line x1="12" y1="6" x2="12" y2="11"/><line x1="6" y1="14" x2="6" y2="11"/><line x1="18" y1="14" x2="18" y2="11"/><line x1="6" y1="11" x2="18" y2="11"/></svg> },
            { id: 'taxes', label: 'Files', view: 'taxes', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> },
            { id: 'groktax', label: 'Swifty - AI Tax Filing', view: 'groktax', htmlId: 'nav-groktax', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg> },
            { id: 'applications', label: 'InstaApply', view: 'applications', htmlId: 'nav-applications', icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
          ]

          const sortedItems = [...NAV_ITEMS].sort((a, b) => {
            const ai = sidebarOrder.indexOf(a.id); const bi = sidebarOrder.indexOf(b.id)
            return (ai >= 0 ? ai : 999) - (bi >= 0 ? bi : 999)
          })
          const favoriteItems = favoriteTabs.map(fid => NAV_ITEMS.find(n => n.id === fid)).filter(Boolean) as typeof NAV_ITEMS
          const mainItems = sortedItems.filter(item => !favoriteTabs.includes(item.id))

          const renderNavBtn = (item: typeof NAV_ITEMS[0], isDraggable = false) => (
            <button
              key={isDraggable ? item.id : `fav-${item.id}`}
              id={item.htmlId}
              className={`ta-nav-btn group ${activeView === item.view ? 'active' : ''}`}
              onClick={() => navTo(item.view)}
              draggable={isDraggable}
              onDragStart={isDraggable ? () => setDraggedNavId(item.id) : undefined}
              onDragOver={isDraggable ? (e) => { e.preventDefault(); setDragOverNavId(item.id) } : undefined}
              onDrop={isDraggable ? () => handleNavDrop(item.id) : undefined}
              onDragEnd={isDraggable ? () => { setDraggedNavId(null); setDragOverNavId(null) } : undefined}
              style={{
                opacity: draggedNavId === item.id ? 0.4 : undefined,
                outline: dragOverNavId === item.id ? '2px solid var(--accent-color)' : undefined,
                outlineOffset: '-2px',
              }}
            >
              {item.icon}
              <span className="flex-1 text-left truncate">{item.label}</span>
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id) }}
                className={`shrink-0 text-[13px] transition-colors opacity-0 group-hover:opacity-100 ${favoriteTabs.includes(item.id) ? 'text-yellow-400 opacity-100' : 'text-zinc-600 hover:text-zinc-400'}`}
                title={favoriteTabs.includes(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                style={{ padding: '0 2px', lineHeight: 1 }}
              >
                {favoriteTabs.includes(item.id) ? '★' : '☆'}
              </button>
            </button>
          )

          return (
            <nav className="ta-nav">
              {favoriteItems.length > 0 && (
                <>
                  <div className="ta-nav-section" style={{ color: 'rgba(255,255,255,0.35)' }}>Favorites</div>
                  {favoriteItems.map(item => renderNavBtn(item, false))}
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 14px 4px' }} />
                </>
              )}
              {mainItems.map(item => renderNavBtn(item, true))}

              {/* ── Manager collapsible section ── */}
              <button
                className="ta-nav-section-btn w-full flex items-center justify-between px-3 py-2 mt-1 rounded-lg text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer select-none"
                onClick={() => setManagerSectionOpen(v => !v)}
              >
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                  Manager
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: managerSectionOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {managerSectionOpen && (
                <>
                  <button className={`ta-nav-btn ${activeView === 'admin' ? 'active' : ''}`} onClick={() => navTo('admin')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                    Manage Users
                  </button>
                  <button className={`ta-nav-btn ${activeView === 'schedules' ? 'active' : ''}`} onClick={() => navTo('schedules')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Schedule Management
                  </button>
                  <button id="nav-payroll" className={`ta-nav-btn ${activeView === 'payroll' ? 'active' : ''}`} onClick={() => navTo('payroll')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    Payroll
                  </button>
                  <button className={`ta-nav-btn ${activeView === 'reports' ? 'active' : ''}`} onClick={() => navTo('reports')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                    Reports &amp; Analytics
                  </button>
                  <button id="nav-kpi-manager" className={`ta-nav-btn ${activeView === 'kpi' ? 'active' : ''}`} onClick={() => navTo('kpi')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    Sales KPIs
                  </button>
                  <button className={`ta-nav-btn ${activeView === 'leaves' ? 'active' : ''}`} onClick={() => navTo('leaves')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    Leave Management
                  </button>
                  <button className={`ta-nav-btn ${activeView === 'compliance' ? 'active' : ''}`} onClick={() => navTo('compliance')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                    Compliance &amp; Audit
                  </button>
                  <button className={`ta-nav-btn ${activeView === 'hiring' ? 'active' : ''}`} onClick={() => navTo('hiring')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                    Hiring &amp; Onboarding
                  </button>
                  <button className={`ta-nav-btn ${activeView === 'teamkpi' ? 'active' : ''}`} onClick={() => navTo('teamkpi')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                    Team KPI Dashboard
                  </button>
                  <button className={`ta-nav-btn ${activeView === 'announcements' ? 'active' : ''}`} onClick={() => navTo('announcements')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M22 17H2a3 3 0 000 6h20a3 3 0 000-6z"/><path d="M17 8V2"/><path d="M12 8V5"/><path d="M7 8V1"/></svg>
                    Announcements
                  </button>
                </>
              )}
            </nav>
          )
        })()}
        <div className="mt-auto pt-4">
          <button
            id="nav-grokky"
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
              <div className="flex-1 flex flex-col">
                {/* Dashboard card */}
                <div className="glass rounded-3xl p-5 sm:p-8 flex-1 flex flex-col">
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
                        <motion.button onClick={() => handleStartBreak('paid')} className="px-4 py-2.5 rounded-xl border border-white/20 hover:bg-white/5 text-sm" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          15-min break
                          <span className="block text-[10px] text-zinc-500 mt-0.5">paid</span>
                        </motion.button>
                        <motion.button onClick={() => handleStartBreak('unpaid')} className="px-4 py-2.5 rounded-xl border border-white/20 hover:bg-white/5 text-sm" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                          Lunch break
                          <span className="block text-[10px] text-zinc-500 mt-0.5">unpaid</span>
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

                        const radius = 106
                        const circumference = 2 * Math.PI * radius
                        // Progress ring: empty at 0, full at 100%
                        const offset = circumference * (1 - Math.min(progress, 1))

                        // Spark arc: short dash (~6% of circumference) that orbits the ring in overdrive
                        const sparkDash = circumference * 0.06
                        const sparkGap = circumference - sparkDash

                        return (
                          <div className="relative w-[200px] h-[200px] sm:w-[260px] sm:h-[260px] flex items-center justify-center">
                            <svg viewBox="0 0 260 260" className="absolute w-full h-full" overflow="visible" style={isOverdrive ? { filter: 'drop-shadow(0 0 12px #FFAA00) drop-shadow(0 0 24px #FFD700)' } : undefined}>
                              {/* Background ring */}
                              <circle cx="130" cy="130" r={radius} fill="none" stroke="#222" strokeWidth="12" />
                              {/* Progress arc */}
                              <motion.circle
                                cx="130" cy="130" r={radius}
                                fill="none"
                                stroke={isOverdrive ? '#FFAA00' : 'var(--accent-color)'}
                                strokeWidth={isOverdrive ? 14 : 12}
                                strokeLinecap="round"
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: offset }}
                                transition={{ type: 'spring', stiffness: isOverdrive ? 100 : 70, damping: isOverdrive ? 15 : 20 }}
                                style={{ strokeDasharray: circumference }}
                              />
                              {/* Overdrive: orbiting speed spark (represents 1.5× earnings) */}
                              {isOverdrive && (
                                <circle
                                  cx="130" cy="130" r={radius}
                                  fill="none"
                                  stroke="#FFFFFF"
                                  strokeWidth="20"
                                  strokeLinecap="round"
                                  strokeDasharray={`${sparkDash} ${sparkGap}`}
                                  style={{
                                    transformOrigin: '130px 130px',
                                    animation: 'overdrive-orbit 1.5s linear infinite',
                                    opacity: 0.9,
                                    filter: 'blur(3px)',
                                  }}
                                />
                              )}
                              {/* Overdrive: electric bolt flashes around the ring — zigzag lightning at 4 cardinal positions */}
                              {isOverdrive && (
                                <>
                                  {/* top — zigzag pointing up */}
                                  <polyline points="127,26 131,16 126,12 130,22" fill="none" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ animation: 'overdrive-bolt 3.2s 0.0s infinite', willChange: 'opacity' }} />
                                  {/* right — zigzag pointing right */}
                                  <polyline points="234,127 244,131 240,126 248,130" fill="none" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ animation: 'overdrive-bolt 3.2s 0.8s infinite', willChange: 'opacity' }} />
                                  {/* bottom — zigzag pointing down */}
                                  <polyline points="133,234 129,244 134,248 130,238" fill="none" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ animation: 'overdrive-bolt 3.2s 1.6s infinite', willChange: 'opacity' }} />
                                  {/* left — zigzag pointing left */}
                                  <polyline points="26,133 16,129 20,134 12,130" fill="none" stroke="#FFD700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ animation: 'overdrive-bolt 3.2s 2.4s infinite', willChange: 'opacity' }} />
                                  {/* upper-right */}
                                  <polyline points="207,53 215,47 212,44 218,50" fill="none" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ animation: 'overdrive-bolt 3.2s 0.4s infinite', willChange: 'opacity' }} />
                                  {/* lower-left */}
                                  <polyline points="53,207 45,213 48,216 42,210" fill="none" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    style={{ animation: 'overdrive-bolt 3.2s 2.0s infinite', willChange: 'opacity' }} />
                                </>
                              )}
                            </svg>
                            {/* Center content */}
                            <div className="text-center z-10">
                              <div className={`text-xs uppercase tracking-[2px] mb-1.5 ${isOverdrive ? 'text-[#FFAA00]' : 'text-zinc-500'}`}>
                                {isOverdrive ? 'OVERDRIVE' : 'Time Remaining'}
                              </div>
                              <div className={`font-mono text-3xl tabular-nums tracking-[1px] ${isOverdrive ? 'text-[#FFAA00]' : 'text-white'}`}>
                                {isOverdrive ? `+${formatMs(todayTotalMs - EIGHT_HOURS_MS)}` : countdown}
                              </div>
                              <div className="text-xs text-zinc-500 mt-1.5">{isOverdrive ? 'time-and-a-half' : '8-hour day'}</div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="mt-auto pt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
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
                      <div className="font-mono text-xl neon-green">{formatMs(breakMsAccum + paidBreakMsAccum + activeBreakMs)}</div>
                      {(breakMsAccum > 0 || paidBreakMsAccum > 0) && (
                        <div className="text-[10px] text-zinc-600 mt-1">
                          {paidBreakMsAccum > 0 && <span>{formatMs(paidBreakMsAccum)} paid</span>}
                          {paidBreakMsAccum > 0 && breakMsAccum > 0 && <span> · </span>}
                          {breakMsAccum > 0 && <span>{formatMs(breakMsAccum)} unpaid</span>}
                        </div>
                      )}
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
                        <div
                          className="crystal-progress-fill"
                          style={{ width: `${Math.min(100, (todayTotalMs / (8 * 3600000)) * 100)}%` }}
                        />
                      </div>
                      {/* Work state selector + break law info below the bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs text-zinc-400">State:</span>
                        <select
                          value={workState}
                          onChange={e => setWorkState(e.target.value)}
                          className="text-xs bg-black/40 border border-white/10 rounded-lg px-1.5 py-0.5 text-zinc-300 focus:border-white/30 focus:outline-none"
                          style={{ maxWidth: '52px' }}
                        >
                          {STATE_CODES.map(code => (
                            <option key={code} value={code}>{code}</option>
                          ))}
                        </select>
                        <span className="text-xs text-zinc-500">
                          {STATE_BREAK_RULES[workState]?.triggerAfterHours > 0
                            ? `${STATE_BREAK_RULES[workState].mealBreakMinutes}-min break by hr ${STATE_BREAK_RULES[workState].triggerAfterHours + 1}`
                            : 'No state break law'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Right sidebar: Real Time Rewards (top) + This pay period */}
              <aside className="xl:w-80 shrink-0 flex flex-col sm:flex-row xl:flex-col gap-4">
                {/* Real Time Rewards module - at top */}
                <div className="glass rounded-3xl p-8 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-5">
                    <div className="text-sm uppercase tracking-[2px] text-white">Real Time Rewards</div>
                    {isClockedIn && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full animate-pulse inline-block"
                          style={{
                            background: isOvertimeOverdrive ? '#FFD700' : '#22ff7a',
                            boxShadow: isOvertimeOverdrive
                              ? '0 0 8px #FFD700, 0 0 16px #FFD70060'
                              : '0 0 8px #22ff7a, 0 0 16px #22ff7a60',
                          }}
                        />
                        <span className="text-xs uppercase tracking-widest text-zinc-300 font-medium">
                          {isOvertimeOverdrive ? 'overdrive' : 'live'}
                        </span>
                      </div>
                    )}
                  </div>
                  <motion.div
                    key={Math.floor((todayTotalMs / 3600000) * clockHourlyRate * 10)}
                    initial={isClockedIn ? { scale: 1.08, color: 'var(--accent-color)' } : false}
                    animate={{ scale: 1, color: 'var(--accent-color)' }}
                    transition={{ duration: 0.25 }}
                    className="font-mono text-5xl font-bold tabular-nums neon-green mb-5"
                  >
                    ${((todayTotalMs / 3600000) * clockHourlyRate).toFixed(2)}
                  </motion.div>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={navToRewardsWithHighlight}
                      className="text-xs text-zinc-400 hover:text-white text-left underline decoration-zinc-600 hover:decoration-white transition-colors cursor-pointer leading-snug"
                      title="Click to update your hourly rate on the Rewards tab"
                    >
                      Today's earnings so far at ${clockHourlyRate}/hr
                    </button>
                  </div>
                  <div className="mt-auto pt-10">
                    <div className="flex justify-between items-center mb-5">
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
                </div>

                {/* This pay period - below Real Time Rewards */}
                <div className="glass rounded-3xl p-8 flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm uppercase tracking-[2px] text-white">This pay period</div>
                    {isClockedIn && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full animate-pulse inline-block"
                          style={{
                            background: '#22ff7a',
                            boxShadow: '0 0 8px #22ff7a, 0 0 16px #22ff7a60',
                          }}
                        />
                        <span className="text-xs uppercase tracking-widest text-zinc-300 font-medium">live</span>
                      </div>
                    )}
                  </div>
                  <div className="text-base font-medium mb-4 neon-green">{periodLabel}</div>
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Regular hours</span>
                      <span className="font-mono neon-green">{periodEarnings.regular.toFixed(1)} hrs</span>
                    </div>
                    {periodEarnings.overtime > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-amber-400">Overtime (1.5×)</span>
                        <span className="font-mono text-amber-400">{periodEarnings.overtime.toFixed(1)} hrs</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Earned this period</span>
                      <span className="font-mono neon-green">${periodEarnings.pay.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-400">Days remaining</span>
                      <span className="font-mono neon-green">
                        {Math.max(0, Math.ceil((period.end.getTime() - now.getTime()) / 86400000))} days
                      </span>
                    </div>
                  </div>
                  <div className="crystal-progress mb-4">
                    <div
                      className="crystal-progress-fill"
                      style={{
                        width: `${Math.min(100, Math.round(
                          (1 - Math.max(0, Math.ceil((period.end.getTime() - now.getTime()) / 86400000)) / 14) * 100
                        ))}%`,
                      }}
                    />
                  </div>
                  <button
                    onClick={() => navTo('timesheet')}
                    className="text-sm underline decoration-white/30 hover:decoration-white"
                  >
                    See my time →
                  </button>
                </div>
              </aside>
            </div>
            </>
          )}

          {activeView === 'timesheet' && (
            <TimesheetView user={user} gamification={gamification} />
          )}
          {activeView === 'rewards' && (
            <div className="space-y-6">
              <Rewards
                totalHours={todayTotalMs / 3600000}
                elapsedSeconds={Math.floor(sessionWorkedMs / 1000)}
                isClockedIn={isClockedIn}
                theme={(['green','white','orange','cyan','pink','purple'] as const).includes(theme as any) ? theme as 'green'|'white'|'orange'|'cyan'|'pink'|'purple' : 'green'}
                user={user}
                highlightRate={highlightRate}
                xpTotalForPTO={appGState.totalXP}
                onRateChange={(rate) => {
                  setClockHourlyRate(rate)
                  localStorage.setItem('swiftshift-hourly-rate', String(rate))
                  if (user?.id) {
                    fetch(`${API_BASE}/api/users/${user.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ hourly_rate: rate }),
                    }).catch(() => {})
                  }
                }}
              />
              <XPCenter
                gState={appGState}
                currentLevel={appCurrentLevel}
                nextLevel={appNextLevel}
                users={users}
                accentColor={themeAccentHex}
                totalHoursThisWeek={todayTotalMs / 3600000}
              />
            </div>
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
                      <th className="text-left py-1">XP Level</th>
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
                          <div className="flex items-center gap-1">
                            {(() => {
                              const simXP = ((u.id * 137 + u.id * 31) % 3200) + 50
                              const lvl = [...XP_LEVELS].reverse().find(l => simXP >= l.xpNeeded) || XP_LEVELS[0]
                              return (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                                  Lv.{lvl.level} {lvl.name}
                                </span>
                              )
                            })()}
                          </div>
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
                  <p className="text-sm text-zinc-400">Shift swaps, timesheet submissions, and weekly view</p>
                </div>
                <button onClick={() => setShowSwapForm(v => !v)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                  {showSwapForm ? 'Cancel' : '↔ Request Swap'}
                </button>
              </div>

              {/* Shift Swap Request Form */}
              {showSwapForm && (
                <div className="glass rounded-3xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Request Shift Swap</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: 'Shift Date', key: 'shift_date', type: 'date' },
                      { label: 'Shift Start', key: 'shift_start', type: 'time' },
                      { label: 'Shift End', key: 'shift_end', type: 'time' },
                      { label: 'Reason', key: 'reason', type: 'text' },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <div className="text-xs text-zinc-400 mb-1">{label}</div>
                        <input type={type} value={(swapForm as any)[key]} onChange={e => setSwapForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    if (!user?.id || !swapForm.shift_date || !swapForm.shift_start || !swapForm.shift_end) {
                      toast.error('Please fill shift date, start, and end'); return
                    }
                    fetch(`${API_BASE}/api/shift-swaps`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ requester_id: user.id, ...swapForm }),
                    }).then(r => r.json()).then(row => {
                      if (row.error) { toast.error(row.error); return }
                      setShiftSwaps(prev => [row, ...prev])
                      setShowSwapForm(false)
                      setSwapForm({ shift_date: '', shift_start: '', shift_end: '', reason: '' })
                      toast.success('Shift swap requested!')
                    }).catch(() => toast.error('Failed to submit'))
                  }} className="px-5 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                    Submit Swap Request
                  </button>
                </div>
              )}

              {/* Shift Swaps List */}
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>My Shift Swaps</h2>
                {shiftSwaps.length === 0 ? (
                  <div className="text-sm text-zinc-500 text-center py-6">No shift swap requests yet.</div>
                ) : (
                  <div className="space-y-3">
                    {shiftSwaps.map(sw => (
                      <div key={sw.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                        <div>
                          <div className="font-medium">{sw.shift_date}</div>
                          <div className="text-xs text-zinc-400">{sw.shift_start} – {sw.shift_end}{sw.reason ? ` · ${sw.reason}` : ''}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sw.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : sw.status === 'denied' ? 'bg-red-500/20 text-red-400' : sw.status === 'cancelled' ? 'bg-zinc-500/20 text-zinc-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {sw.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timesheet Submissions */}
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Timesheet Submissions</h2>
                {timesheetSubs.length === 0 ? (
                  <div className="text-sm text-zinc-500 text-center py-6">No timesheet submissions yet.</div>
                ) : (
                  <div className="space-y-2">
                    {timesheetSubs.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 text-sm">
                        <div>
                          <div className="font-medium">{sub.period_start} – {sub.period_end}</div>
                          <div className="text-xs text-zinc-400">Submitted {sub.submitted_at?.slice(0, 10)}</div>
                        </div>
                        <span className="font-mono neon-green">{sub.total_hours}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manager: Shift Swap Approvals */}
              {allShiftSwaps.length > 0 && (
                <div className="glass rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Manager: Team Swap Requests</h2>
                      <p className="text-xs text-zinc-400 mt-0.5">Review your team's shift swap requests</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">
                      {allShiftSwaps.filter(s => s.status === 'pending').length} pending
                    </span>
                  </div>
                  <div className="space-y-3">
                    {allShiftSwaps.map(sw => (
                      <div key={sw.id} className="flex flex-wrap items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{sw.shift_date}</div>
                          <div className="text-xs text-zinc-400">{sw.shift_start} – {sw.shift_end}{sw.reason ? ` · "${sw.reason}"` : ''}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">User #{sw.requester_id}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {sw.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => {
                                  fetch(`${API_BASE}/api/shift-swaps/${sw.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'accepted' }),
                                  }).then(() => {
                                    setAllShiftSwaps(prev => prev.map(s => s.id === sw.id ? { ...s, status: 'accepted' } : s))
                                    setShiftSwaps(prev => prev.map(s => s.id === sw.id ? { ...s, status: 'accepted' } : s))
                                    toast.success('Shift swap approved')
                                  }).catch(() => toast.error('Failed to approve'))
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 transition-colors"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  fetch(`${API_BASE}/api/shift-swaps/${sw.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'denied' }),
                                  }).then(() => {
                                    setAllShiftSwaps(prev => prev.map(s => s.id === sw.id ? { ...s, status: 'denied' } : s))
                                    setShiftSwaps(prev => prev.map(s => s.id === sw.id ? { ...s, status: 'denied' } : s))
                                    toast.success('Shift swap denied')
                                  }).catch(() => toast.error('Failed to deny'))
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                              >
                                Deny
                              </button>
                            </>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sw.status === 'accepted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {sw.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly grid */}
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
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeView === 'payroll' && (() => {
            // Real paystub calculation based on current pay period
            const grossPay = periodEarnings.pay
            const regularPay = periodEarnings.regular * clockHourlyRate
            const overtimePay = periodEarnings.overtime * clockHourlyRate * 1.5
            // 2026 federal income tax brackets (single filer, annualized then per-paycheck)
            const payPeriodsPerYear = 26 // bi-weekly
            const annualGross = grossPay * payPeriodsPerYear
            const calcFederal2026 = (income: number) => {
              const brackets = [
                [11925, 0.10], [48475, 0.12], [103350, 0.22],
                [197300, 0.24], [250525, 0.32], [626350, 0.35], [Infinity, 0.37],
              ] as [number, number][]
              let tax = 0; let prev = 0
              for (const [limit, rate] of brackets) {
                if (income <= prev) break
                tax += (Math.min(income, limit) - prev) * rate
                prev = limit
              }
              return tax
            }
            const annualFederalTax = calcFederal2026(annualGross)
            const federalTax = annualFederalTax / payPeriodsPerYear
            const federalEffectiveRate = annualGross > 0 ? annualFederalTax / annualGross : 0
            const stateTaxRate = 0.0593  // CA avg
            const socialSecurityRate = 0.062
            const medicareRate = 0.0145
            const stateTax = grossPay * stateTaxRate
            const socialSecurity = grossPay * socialSecurityRate
            const medicare = grossPay * medicareRate
            const totalDeductions = federalTax + stateTax + socialSecurity + medicare
            const netPay = grossPay - totalDeductions
            return (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold neon-green">Payroll</h1>
                  <p className="text-sm text-zinc-400">Pay period: {periodLabel}</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print Paystub
                </button>
              </div>

              {/* Personal Paystub */}
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>My Paystub - {periodLabel}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Earnings */}
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Earnings</div>
                    {[
                      ['Regular Pay', `${periodEarnings.regular.toFixed(1)}h × $${clockHourlyRate}`, regularPay],
                      ...(periodEarnings.overtime > 0 ? [['Overtime Pay (1.5×)', `${periodEarnings.overtime.toFixed(1)}h × $${(clockHourlyRate * 1.5).toFixed(2)}`, overtimePay]] : []),
                    ].map(([label, sub, val]) => (
                      <div key={String(label)} className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-2.5">
                        <div>
                          <div className="text-sm font-medium">{String(label)}</div>
                          <div className="text-xs text-zinc-500">{String(sub)}</div>
                        </div>
                        <span className="font-mono neon-green">${Number(val).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-white/10 pt-3">
                      <span className="font-semibold">Gross Pay</span>
                      <span className="font-mono font-bold text-lg neon-green">${grossPay.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Deductions</div>
                    {[
                      ['Federal Income Tax', `${(federalEffectiveRate * 100).toFixed(1)}% eff. (2026 brackets)`, federalTax],
                      ['State Income Tax', `${(stateTaxRate * 100).toFixed(1)}% (CA)`, stateTax],
                      ['Social Security', '6.2%', socialSecurity],
                      ['Medicare', '1.45%', medicare],
                    ].map(([label, rate, val]) => (
                      <div key={String(label)} className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-2.5">
                        <div>
                          <div className="text-sm font-medium">{String(label)}</div>
                          <div className="text-xs text-zinc-500">{String(rate)}</div>
                        </div>
                        <span className="font-mono text-red-400">−${Number(val).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-white/10 pt-3">
                      <span className="font-semibold">Total Deductions</span>
                      <span className="font-mono text-red-400">−${totalDeductions.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Pay */}
                <div className="mt-6 bg-white/5 rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <div className="text-zinc-400 text-sm">Net Pay (Take-home)</div>
                    <div className="text-xs text-zinc-600 mt-0.5">After all deductions</div>
                  </div>
                  <div className="text-3xl font-bold neon-green font-mono">${netPay.toFixed(2)}</div>
                </div>

                <div className="mt-4 text-xs text-zinc-500">* Tax estimates are approximate. Actual withholding may differ based on filing status and elections.</div>
              </div>

              {/* Tax Withholding Calculator — 2026 brackets */}
              <div className="glass rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Tax Withholding Summary</h2>
                  <span className="text-xs text-zinc-500 bg-white/5 px-2 py-1 rounded-lg">2026 Federal Brackets</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    ['Federal', `$${federalTax.toFixed(0)}`, `${(federalEffectiveRate * 100).toFixed(1)}% eff.`],
                    ['State (CA)', `$${stateTax.toFixed(0)}`, '5.93%'],
                    ['FICA', `$${(socialSecurity + medicare).toFixed(0)}`, '7.65%'],
                    ['Total', `$${totalDeductions.toFixed(0)}`, `${grossPay > 0 ? ((totalDeductions / grossPay) * 100).toFixed(1) : '0.0'}%`],
                  ].map(([label, val, pct]) => (
                    <div key={String(label)} className="bg-white/5 rounded-2xl p-4 text-center">
                      <div className="text-xl font-bold text-red-400">{String(val)}</div>
                      <div className="text-xs text-zinc-400 mt-1">{String(label)}</div>
                      <div className="text-xs text-zinc-600">{String(pct)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-xs text-zinc-500">
                  Annual gross estimate: ${(grossPay * payPeriodsPerYear).toLocaleString()} ({payPeriodsPerYear} pay periods/yr) · Effective federal rate: {(federalEffectiveRate * 100).toFixed(2)}%
                </div>
              </div>

              {/* Employee Payroll Summary with One-Click Sign-off */}
              <div className="glass rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Employee Payroll Summary</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">
                      {Object.values(payrollSignoffs).filter(Boolean).length}/{Object.keys(payrollSignoffs).length} signed off
                    </span>
                    <button
                      onClick={() => {
                        const allSigned = Object.keys(payrollSignoffs).every(k => payrollSignoffs[k])
                        if (allSigned) { toast.success('All employees already signed off'); return }
                        setPayrollSignoffs(prev => Object.fromEntries(Object.keys(prev).map(k => [k, true])))
                        toast.success('All payroll signed off! Payroll run initiated.')
                      }}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                      style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}
                    >
                      Sign Off All
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '560px' }}>
                  <thead>
                    <tr className="text-zinc-400 border-b border-white/10 text-left">
                      <th className="py-2 pr-4">Employee</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Hours</th>
                      <th className="py-2 pr-4">Rate</th>
                      <th className="py-2 pr-4">Gross Pay</th>
                      <th className="py-2">Sign-off</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Alex Rivera', role: 'Co-Founder', hrs: '80h', rate: '$85/hr', gross: '$6,800' },
                      { name: 'Jordan Lee', role: 'Engineering Lead', hrs: '76h', rate: '$72/hr', gross: '$5,472' },
                      { name: 'Dana Morales', role: 'HR Director', hrs: '78h', rate: '$65/hr', gross: '$5,070' },
                      { name: 'Casey Morgan', role: 'Sales Lead', hrs: '82h', rate: '$60/hr', gross: '$4,920' },
                    ].map(({ name, role, hrs, rate, gross }) => {
                      const signed = payrollSignoffs[name] || false
                      return (
                        <tr key={name} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2.5 pr-4 font-medium">{name}</td>
                          <td className="py-2.5 pr-4 text-zinc-400">{role}</td>
                          <td className="py-2.5 pr-4">{hrs}</td>
                          <td className="py-2.5 pr-4">{rate}</td>
                          <td className="py-2.5 pr-4 font-semibold" style={{ color: 'var(--accent-color)' }}>{gross}</td>
                          <td className="py-2.5">
                            <button
                              onClick={() => {
                                setPayrollSignoffs(prev => ({ ...prev, [name]: !prev[name] }))
                                toast.success(signed ? `Sign-off removed for ${name}` : `${name} signed off!`)
                              }}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${signed ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/10 text-zinc-400 hover:bg-white/20'}`}
                            >
                              {signed ? '✓ Signed Off' : 'Sign Off'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
                {Object.values(payrollSignoffs).every(Boolean) && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium text-center">
                    All employees signed off — Payroll run ready to submit
                  </div>
                )}
              </div>
            </div>
            )
          })()}
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

              {/* Manager Hub */}
              <div className="pt-2">
                <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Manager Hub</h2>
                <p className="text-sm text-zinc-400 -mt-3 mb-5">Real-time insights and action items for team managers</p>
              </div>

              {/* Timesheet Approvals with Anomaly Flagging */}
              <div className="glass rounded-3xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Timesheet Approvals</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">5 pending</span>
                </div>
                <p className="text-xs text-zinc-400 mb-4">Anomalies auto-detected from clock records — review before approving</p>
                <div className="space-y-2">
                  {[
                    { type: 'Timesheet', name: 'Alex Rivera', detail: 'Week of Apr 21 · 42.5h', anomaly: 'Overtime — 2.5h above threshold', urgency: 'High' },
                    { type: 'PTO Request', name: 'Jordan Lee', detail: 'May 5–9 · 40h vacation', anomaly: null, urgency: 'Normal' },
                    { type: 'Timesheet', name: 'Casey Brooks', detail: 'Week of Apr 21 · 38h', anomaly: 'Missed clock-out on Apr 23', urgency: 'Normal' },
                    { type: 'PTO Request', name: 'Sam Carter', detail: 'Apr 30 · 8h sick leave', anomaly: null, urgency: 'Normal' },
                    { type: 'Overtime Auth', name: 'Dana Morales', detail: 'Apr 28 · 6h OT requested', anomaly: 'No prior OT this period — unusual spike', urgency: 'High' },
                  ].map(({ type, name, detail, anomaly, urgency }) => (
                    <div key={name + type} className={`flex flex-wrap items-start gap-3 rounded-xl px-4 py-3 ${anomaly ? 'bg-amber-500/5 border border-amber-500/10' : 'bg-white/5'}`}>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${urgency === 'High' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>{type}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{name}</div>
                        <div className="text-xs text-zinc-500">{detail}</div>
                        {anomaly && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            {anomaly}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button className="px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">Approve</button>
                        <button className="px-3 py-1 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Team Status + Top Performers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="glass rounded-3xl p-6">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Live Team Status</h2>
                  <div className="space-y-2">
                    {[
                      { name: 'Alex Rivera', role: 'Engineer', status: 'clocked-in', since: '8:02 AM' },
                      { name: 'Jordan Lee', role: 'Designer', status: 'clocked-in', since: '9:15 AM' },
                      { name: 'Casey Brooks', role: 'Infra Lead', status: 'on-break', since: '10:30 AM' },
                      { name: 'Dana Morales', role: 'Finance', status: 'clocked-out', since: '—' },
                      { name: 'Mia Thompson', role: 'Designer', status: 'clocked-in', since: '8:45 AM' },
                      { name: 'Sam Carter', role: 'Frontend Eng', status: 'clocked-out', since: '—' },
                    ].map(({ name, role, status, since }) => (
                      <div key={name} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === 'clocked-in' ? 'bg-emerald-400' : status === 'on-break' ? 'bg-amber-400' : 'bg-zinc-600'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <div className="text-xs text-zinc-500">{role}</div>
                        </div>
                        <span className="text-xs text-zinc-500 flex-shrink-0">{status === 'clocked-in' ? `Since ${since}` : status === 'on-break' ? 'On break' : 'Off'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-3xl p-6">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Top Performers</h2>
                  <div className="space-y-2">
                    {[
                      { rank: 1, name: 'Alex Rivera', metric: '98% on-time', hours: '164h', badge: '🥇' },
                      { rank: 2, name: 'Mia Thompson', metric: '96% on-time', hours: '158h', badge: '🥈' },
                      { rank: 3, name: 'Jordan Lee', metric: '94% on-time', hours: '152h', badge: '🥉' },
                      { rank: 4, name: 'Casey Brooks', metric: '91% on-time', hours: '148h', badge: '' },
                      { rank: 5, name: 'Dana Morales', metric: '89% on-time', hours: '141h', badge: '' },
                    ].map(({ rank, name, metric, hours, badge }) => (
                      <div key={name} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                        <span className="text-base w-5 text-center flex-shrink-0">{badge || <span className="text-xs text-zinc-500">#{rank}</span>}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{name}</div>
                          <div className="text-xs text-zinc-500">{metric}</div>
                        </div>
                        <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--accent-color)' }}>{hours}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Labor Budget Tracker */}
              <div className="glass rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Labor Budget Tracker</h2>
                  <span className="text-xs text-zinc-500">April 2026 · 27 days elapsed</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  {[
                    { label: 'Monthly Budget', value: '$98,000', sub: 'approved' },
                    { label: 'Spent to Date', value: '$94,600', sub: '96.5% of budget', warn: false },
                    { label: 'Remaining', value: '$3,400', sub: '3 days left', warn: true },
                  ].map(({ label, value, sub, warn }) => (
                    <div key={label} className="bg-white/5 rounded-2xl p-4">
                      <div className="text-xs text-zinc-400 mb-1">{label}</div>
                      <div className="text-2xl font-bold" style={{ color: warn ? '#F59E0B' : 'var(--accent-color)' }}>{value}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Budget used</span>
                    <span>96.5%</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: '96.5%', background: 'linear-gradient(90deg, var(--accent-color) 0%, #F59E0B 100%)' }} />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { dept: 'Engineering', budget: 40000, spent: 39200 },
                    { dept: 'Sales', budget: 25000, spent: 22800 },
                    { dept: 'HR', budget: 15000, spent: 14600 },
                    { dept: 'Marketing', budget: 12000, spent: 11200 },
                    { dept: 'Finance', budget: 6000, spent: 6800 },
                  ].map(({ dept, budget, spent }) => {
                    const pct = Math.min(100, Math.round(spent / budget * 100))
                    const over = spent > budget
                    return (
                      <div key={dept}>
                        <div className="flex justify-between text-xs mb-1">
                          <span>{dept}</span>
                          <span className={over ? 'text-red-400' : 'text-zinc-400'}>${spent.toLocaleString()} / ${budget.toLocaleString()}{over ? ' ⚠ Over' : ''}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: over ? '#EF4444' : 'var(--accent-color)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Schedule Gap Alerts */}
              <div className="glass rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Schedule Coverage Alerts</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">3 gaps</span>
                </div>
                <div className="space-y-2">
                  {[
                    { shift: 'Wed Apr 30 · Morning (8AM–12PM)', dept: 'Engineering', needed: 4, scheduled: 2, gap: 2 },
                    { shift: 'Thu May 1 · Afternoon (1PM–5PM)', dept: 'Sales', needed: 3, scheduled: 1, gap: 2 },
                    { shift: 'Fri May 2 · All-Day', dept: 'HR', needed: 2, scheduled: 0, gap: 2 },
                  ].map(({ shift, dept, needed, scheduled, gap }) => (
                    <div key={shift} className="flex flex-wrap items-center gap-3 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{shift}</div>
                        <div className="text-xs text-zinc-500">{dept} · {scheduled}/{needed} staff scheduled</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-red-400 font-medium">−{gap} staff</span>
                        <button className="px-3 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>Fill Gap</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Export */}
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Quick Export</h2>
                <div className="flex flex-wrap gap-3">
                  {['Timesheet CSV', 'Payroll Summary PDF', 'PTO Balance Report', 'Headcount Report', 'Compliance Summary'].map(label => (
                    <button key={label} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm border border-white/10 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeView === 'kpi' && (
            <SalesKPI
              user={user}
              users={users}
              isAdmin={isAdmin}
              accentColor={themeAccentHex}
              addXP={gamification.addXP}
            />
          )}
          {activeView === 'leaves' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold neon-green">Leave Management</h1>
                  <p className="text-sm text-zinc-400">Your PTO bank, requests, and payout calculator</p>
                </div>
                <button onClick={() => setShowPtoForm(v => !v)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                  {showPtoForm ? 'Cancel' : '+ Request PTO'}
                </button>
              </div>

              {/* PTO Balance */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  ['Available PTO', ptoBalance ? `${parseFloat(ptoBalance.hours_available || 0).toFixed(1)} hrs` : '—'],
                  ['Used PTO', ptoBalance ? `${parseFloat(ptoBalance.hours_used || 0).toFixed(1)} hrs` : '—'],
                  ['Payout Value', ptoBalance ? `$${(parseFloat(ptoBalance.hours_available || 0) * clockHourlyRate).toFixed(0)}` : '—'],
                  ['Pending Requests', String(ptoRequests.filter(r => r.status === 'pending').length)],
                ].map(([label, val]) => (
                  <div key={label} className="glass rounded-2xl p-4 text-center">
                    <div className="text-2xl font-bold" style={{ color: 'var(--accent-color)' }}>{val}</div>
                    <div className="text-xs text-zinc-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* PTO Payout Calculator */}
              {ptoBalance && (
                <div className="glass rounded-3xl p-6">
                  <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--accent-color)' }}>PTO Payout Calculator</h2>
                  <div className="flex flex-wrap gap-6 text-sm">
                    <div>
                      <div className="text-zinc-400 mb-1">Available Balance</div>
                      <div className="text-xl font-bold neon-green">{parseFloat(ptoBalance.hours_available || 0).toFixed(2)} hrs</div>
                    </div>
                    <div>
                      <div className="text-zinc-400 mb-1">At ${clockHourlyRate}/hr</div>
                      <div className="text-xl font-bold neon-green">${(parseFloat(ptoBalance.hours_available || 0) * clockHourlyRate).toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-zinc-400 mb-1">Days equivalent (8h)</div>
                      <div className="text-xl font-bold neon-green">{(parseFloat(ptoBalance.hours_available || 0) / 8).toFixed(1)} days</div>
                    </div>
                  </div>
                </div>
              )}

              {/* PTO Request Form */}
              {showPtoForm && (
                <div className="glass rounded-3xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>New PTO Request</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-zinc-400 mb-1">Type</div>
                      <select value={ptoRequestForm.request_type} onChange={e => setPtoRequestForm(f => ({ ...f, request_type: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                        {['vacation', 'sick', 'personal', 'bereavement'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400 mb-1">Hours Requested</div>
                      <input type="number" min="1" step="0.5" value={ptoRequestForm.hours_requested} onChange={e => setPtoRequestForm(f => ({ ...f, hours_requested: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" placeholder="8" />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400 mb-1">Start Date</div>
                      <input type="date" value={ptoRequestForm.start_date} onChange={e => setPtoRequestForm(f => ({ ...f, start_date: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400 mb-1">End Date</div>
                      <input type="date" value={ptoRequestForm.end_date} onChange={e => setPtoRequestForm(f => ({ ...f, end_date: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs text-zinc-400 mb-1">Reason (optional)</div>
                      <input type="text" value={ptoRequestForm.reason} onChange={e => setPtoRequestForm(f => ({ ...f, reason: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" placeholder="Optional reason..." />
                    </div>
                  </div>
                  <button onClick={() => {
                    if (!user?.id || !ptoRequestForm.start_date || !ptoRequestForm.end_date || !ptoRequestForm.hours_requested) {
                      toast.error('Please fill in all required fields'); return
                    }
                    fetch(`${API_BASE}/api/pto/requests`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ user_id: user.id, ...ptoRequestForm, hours_requested: parseFloat(ptoRequestForm.hours_requested) }),
                    }).then(r => r.json()).then(row => {
                      if (row.error) { toast.error(row.error); return }
                      setPtoRequests(prev => [row, ...prev])
                      setShowPtoForm(false)
                      setPtoRequestForm({ start_date: '', end_date: '', request_type: 'vacation', reason: '', hours_requested: '' })
                      toast.success('PTO request submitted!')
                    }).catch(() => toast.error('Failed to submit request'))
                  }} className="px-5 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                    Submit Request
                  </button>
                </div>
              )}

              {/* My PTO Requests */}
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>My PTO Requests</h2>
                {ptoRequests.length === 0 ? (
                  <div className="text-sm text-zinc-500 text-center py-6">No PTO requests yet. Click "+ Request PTO" to get started.</div>
                ) : (
                  <div className="space-y-3">
                    {ptoRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                        <div>
                          <div className="font-medium capitalize">{req.request_type}</div>
                          <div className="text-xs text-zinc-400">{req.start_date} → {req.end_date} · {req.hours_requested}h</div>
                          {req.reason && <div className="text-xs text-zinc-500 mt-0.5">{req.reason}</div>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : req.status === 'denied' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          {req.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manager: Approve / Deny Team Requests */}
              {allPtoRequests.length > 0 && (
                <div className="glass rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Manager: Team Leave Requests</h2>
                      <p className="text-xs text-zinc-400 mt-0.5">Review and approve or deny your team's PTO requests</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400">
                      {allPtoRequests.filter(r => r.status === 'pending').length} pending
                    </span>
                  </div>
                  <div className="space-y-3">
                    {allPtoRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-medium capitalize text-sm">{req.request_type}</div>
                            {req.user_id && <div className="text-xs text-zinc-500">User #{req.user_id}</div>}
                          </div>
                          <div className="text-xs text-zinc-400 mt-0.5">{req.start_date} → {req.end_date} · {req.hours_requested}h</div>
                          {req.reason && <div className="text-xs text-zinc-500 mt-0.5 italic">"{req.reason}"</div>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {req.status === 'pending' ? (
                            <>
                              <button
                                disabled={ptoApprovalLoading === req.id}
                                onClick={() => {
                                  setPtoApprovalLoading(req.id)
                                  fetch(`${API_BASE}/api/pto/requests/${req.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'approved' }),
                                  }).then(r => r.json()).then(() => {
                                    setAllPtoRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r))
                                    setPtoRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r))
                                    toast.success('Leave approved')
                                  }).catch(() => toast.error('Failed to approve')).finally(() => setPtoApprovalLoading(null))
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 transition-colors disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                disabled={ptoApprovalLoading === req.id}
                                onClick={() => {
                                  setPtoApprovalLoading(req.id)
                                  fetch(`${API_BASE}/api/pto/requests/${req.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'denied' }),
                                  }).then(r => r.json()).then(() => {
                                    setAllPtoRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'denied' } : r))
                                    setPtoRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'denied' } : r))
                                    toast.success('Leave denied')
                                  }).catch(() => toast.error('Failed to deny')).finally(() => setPtoApprovalLoading(null))
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors disabled:opacity-50"
                              >
                                Deny
                              </button>
                            </>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {req.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team Leave Calendar */}
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Team Leave Calendar — May 2026</h2>
                <p className="text-xs text-zinc-400 mb-4">Visual overview of who's out to prevent coverage conflicts</p>
                <div className="space-y-2">
                  {[
                    { name: 'Jordan Lee', type: 'Vacation', dates: 'May 5–9', days: [5,6,7,8,9], color: '#60A5FA' },
                    { name: 'Sam Carter', type: 'Sick Leave', dates: 'Apr 30', days: [30], color: '#F59E0B' },
                    { name: 'Casey Brooks', type: 'Personal', dates: 'May 12–13', days: [12,13], color: '#9B51FE' },
                    { name: 'Mia Thompson', type: 'Vacation', dates: 'May 19–23', days: [19,20,21,22,23], color: '#60A5FA' },
                    { name: 'Dana Morales', type: 'Bereavement', dates: 'May 1–2', days: [1,2], color: '#EF4444' },
                  ].map(({ name, type, dates, color }) => (
                    <div key={name} className="flex items-center gap-4 bg-white/5 rounded-xl px-4 py-2.5">
                      <div className="w-32 flex-shrink-0">
                        <div className="text-sm font-medium truncate">{name}</div>
                        <div className="text-xs text-zinc-500 capitalize">{type}</div>
                      </div>
                      <div className="flex-1 relative h-6">
                        <div className="h-full rounded-full flex items-center px-3 text-xs font-medium" style={{ backgroundColor: color + '30', border: `1px solid ${color}60`, color }}>
                          {dates}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex flex-wrap gap-3 text-xs">
                    {[['#60A5FA', 'Vacation'], ['#F59E0B', 'Sick'], ['#9B51FE', 'Personal'], ['#EF4444', 'Bereavement']].map(([c, l]) => (
                      <div key={l} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                        <span className="text-zinc-400">{l}</span>
                      </div>
                    ))}
                  </div>
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

              {/* Auto-compliance alerts */}
              <div className="glass rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Auto-Compliance Alerts</h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">5 active</span>
                </div>
                <div className="space-y-3">
                  {[
                    { type: 'Break Violation', employee: 'Casey Brooks', detail: 'Worked 11h 20m on Apr 26 — no break recorded', severity: 'high' },
                    { type: 'Break Violation', employee: 'Sam Carter', detail: 'Worked 10h 45m on Apr 24 — no break recorded', severity: 'high' },
                    { type: 'Overdue Training', employee: 'Riley Voss', detail: 'Workplace Safety Training due May 1 — not completed', severity: 'medium' },
                    { type: 'Overdue Training', employee: 'Parker Kim', detail: 'Anti-Harassment Policy due Apr 30 — not completed', severity: 'medium' },
                    { type: 'Overdue Training', employee: 'Dakota Lane', detail: 'Data Privacy & GDPR due Jun 15 — not started', severity: 'low' },
                  ].map(({ type, employee, detail, severity }) => (
                    <div key={employee + type} className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 border ${severity === 'high' ? 'bg-red-500/5 border-red-500/20' : severity === 'medium' ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/5 border-white/5'}`}>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${severity === 'high' ? 'bg-red-500/20 text-red-400' : severity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{employee}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{detail}</div>
                      </div>
                      <button className="px-3 py-1 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0">
                        Resolve
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-4">Auto-detected from clock-in/out records. Break violations are flagged when shifts exceed 10h with no break entry.</p>
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
                      { name: 'Sam Carter', role: 'Frontend Engineer', start: 'May 5, 2026' },
                      { name: 'Mia Thompson', role: 'Product Designer', start: 'May 12, 2026' },
                      { name: 'Leo Kim', role: 'Account Executive', start: 'Apr 28, 2026' },
                    ].map(({ name, role, start }) => {
                      const tasks = onboardingTasks[name] || []
                      const done = tasks.filter(Boolean).length
                      const pct = tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0
                      return (
                        <div key={name} className="bg-white/5 rounded-xl px-4 py-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-sm">{name}</div>
                              <div className="text-xs text-zinc-400">{role} · Starts {start}</div>
                            </div>
                            <span className="text-xs" style={{ color: 'var(--accent-color)' }}>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--accent-color)' }} />
                          </div>
                          <div className="text-xs text-zinc-500">{done}/{tasks.length} tasks complete</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Onboarding Checklists */}
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Onboarding Checklists</h2>
                <div className="space-y-6">
                  {[
                    { name: 'Sam Carter', role: 'Frontend Engineer' },
                    { name: 'Mia Thompson', role: 'Product Designer' },
                    { name: 'Leo Kim', role: 'Account Executive' },
                  ].map(({ name, role }) => {
                    const taskLabels = ['Equipment provisioned', 'Accounts created (email, Slack, GitHub)', 'HR paperwork signed', 'Benefits enrollment', '1:1 with manager scheduled', 'Team introduction done']
                    const tasks = onboardingTasks[name] || taskLabels.map(() => false)
                    const done = tasks.filter(Boolean).length
                    return (
                      <div key={name}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="text-sm font-semibold">{name}</div>
                          <div className="text-xs text-zinc-400">— {role}</div>
                          <span className="ml-auto text-xs text-zinc-500">{done}/{tasks.length}</span>
                        </div>
                        <div className="space-y-2">
                          {taskLabels.map((label, i) => (
                            <div key={label} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                              <button
                                onClick={() => setOnboardingTasks(prev => ({
                                  ...prev,
                                  [name]: (prev[name] || tasks).map((v, j) => j === i ? !v : v)
                                }))}
                                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${tasks[i] ? 'border-transparent' : 'border-white/30 bg-transparent hover:border-white/60'}`}
                                style={tasks[i] ? { backgroundColor: 'var(--accent-color)' } : {}}
                              >
                                {tasks[i] && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              </button>
                              <span className={`text-sm flex-1 ${tasks[i] ? 'line-through text-zinc-500' : ''}`}>{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {activeView === 'teamkpi' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div>
                <h1 className="text-2xl font-semibold neon-green">Team KPI Dashboard</h1>
                <p className="text-sm text-zinc-400">Attendance, performance, hours, and overtime at a glance</p>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Avg Attendance Rate', value: '93.4%', sub: 'This month', color: 'var(--accent-color)' },
                  { label: 'Avg Hours / Employee', value: '38.2h', sub: 'This week', color: 'var(--accent-color)' },
                  { label: 'Overtime Employees', value: '4', sub: 'Above 40h threshold', color: '#F59E0B' },
                  { label: 'On-Time Clock-in', value: '89%', sub: 'Within 5 min of shift', color: 'var(--accent-color)' },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="glass rounded-2xl p-4 text-center">
                    <div className="text-2xl font-bold" style={{ color }}>{value}</div>
                    <div className="text-xs font-medium text-white mt-1">{label}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>

              {/* Per-employee KPI table */}
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Employee Performance Overview</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: '640px' }}>
                    <thead>
                      <tr className="text-zinc-400 border-b border-white/10 text-left">
                        <th className="py-2 pr-4">Employee</th>
                        <th className="py-2 pr-4">Hours (Week)</th>
                        <th className="py-2 pr-4">Attendance</th>
                        <th className="py-2 pr-4">On-Time</th>
                        <th className="py-2 pr-4">Streak</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'Alex Rivera', hours: 44, attendance: '98%', onTime: '100%', streak: 12, flag: 'overtime' },
                        { name: 'Jordan Lee', hours: 38, attendance: '96%', onTime: '95%', streak: 8, flag: '' },
                        { name: 'Casey Brooks', hours: 42, attendance: '94%', onTime: '88%', streak: 5, flag: 'overtime' },
                        { name: 'Mia Thompson', hours: 40, attendance: '100%', onTime: '97%', streak: 15, flag: '' },
                        { name: 'Dana Morales', hours: 35, attendance: '88%', onTime: '80%', streak: 2, flag: 'low-attendance' },
                        { name: 'Sam Carter', hours: 41, attendance: '92%', onTime: '91%', streak: 6, flag: 'overtime' },
                        { name: 'Riley Voss', hours: 37, attendance: '90%', onTime: '85%', streak: 3, flag: '' },
                        { name: 'Parker Kim', hours: 43, attendance: '95%', onTime: '92%', streak: 9, flag: 'overtime' },
                      ].map(({ name, hours, attendance, onTime, streak, flag }) => (
                        <tr key={name} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-2.5 pr-4 font-medium">{name}</td>
                          <td className="py-2.5 pr-4">
                            <span className={hours > 40 ? 'text-amber-400 font-semibold' : ''}>{hours}h</span>
                          </td>
                          <td className="py-2.5 pr-4">{attendance}</td>
                          <td className="py-2.5 pr-4">{onTime}</td>
                          <td className="py-2.5 pr-4">
                            <span className="flex items-center gap-1">
                              <svg viewBox="0 0 20 20" width="12" height="12" fill={streak >= 7 ? '#F97316' : '#6B7280'}><path d="M10 1.5C7 6 4 8.5 4 12a6 6 0 0012 0c0-3.5-3-6-6-10.5z"/></svg>
                              {streak}d
                            </span>
                          </td>
                          <td className="py-2.5">
                            {flag === 'overtime' && <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">OT Flag</span>}
                            {flag === 'low-attendance' && <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">Low Attendance</span>}
                            {!flag && <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">Good Standing</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Streak leaderboard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="glass rounded-3xl p-6">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Work Streak Leaders</h2>
                  <div className="space-y-3">
                    {[
                      { rank: 1, name: 'Mia Thompson', streak: 15, badge: '🥇' },
                      { rank: 2, name: 'Alex Rivera', streak: 12, badge: '🥈' },
                      { rank: 3, name: 'Parker Kim', streak: 9, badge: '🥉' },
                      { rank: 4, name: 'Jordan Lee', streak: 8, badge: '' },
                      { rank: 5, name: 'Sam Carter', streak: 6, badge: '' },
                    ].map(({ rank, name, streak, badge }) => (
                      <div key={name} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5">
                        <span className="w-6 text-center">{badge || <span className="text-xs text-zinc-500">#{rank}</span>}</span>
                        <span className="flex-1 text-sm font-medium">{name}</span>
                        <span className="flex items-center gap-1 text-sm">
                          <svg viewBox="0 0 20 20" width="14" height="14" fill="#F97316"><path d="M10 1.5C7 6 4 8.5 4 12a6 6 0 0012 0c0-3.5-3-6-6-10.5z"/></svg>
                          <span style={{ color: 'var(--accent-color)' }}>{streak}d</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overtime flags */}
                <div className="glass rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Overtime Flags</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">4 flagged</span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: 'Alex Rivera', hours: 44, dept: 'Engineering', action: 'Auth needed' },
                      { name: 'Casey Brooks', hours: 42, dept: 'Infra', action: 'Pre-approved' },
                      { name: 'Sam Carter', hours: 41, dept: 'Frontend', action: 'Auth needed' },
                      { name: 'Parker Kim', hours: 43, dept: 'Engineering', action: 'Auth needed' },
                    ].map(({ name, hours, dept, action }) => (
                      <div key={name} className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{name}</div>
                          <div className="text-xs text-zinc-500">{dept} · {hours}h this week</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-400">{action}</span>
                          {action === 'Auth needed' && (
                            <button className="px-2 py-0.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 transition-colors">Authorize</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Attendance trend */}
              <div className="glass rounded-3xl p-6">
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Department Attendance Rate</h2>
                <div className="space-y-3">
                  {[
                    { dept: 'Engineering', rate: 95 },
                    { dept: 'Sales', rate: 91 },
                    { dept: 'HR', rate: 96 },
                    { dept: 'Marketing', rate: 88 },
                    { dept: 'Finance', rate: 93 },
                  ].map(({ dept, rate }) => (
                    <div key={dept}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{dept}</span>
                        <span className={rate < 90 ? 'text-red-400' : 'text-zinc-400'}>{rate}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, backgroundColor: rate < 90 ? '#EF4444' : 'var(--accent-color)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {activeView === 'announcements' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold neon-green">Team Announcements</h1>
                  <p className="text-sm text-zinc-400">Broadcast messages to your team with read-receipt tracking</p>
                </div>
                <button
                  onClick={() => setShowAnnouncementForm(v => !v)}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}
                >
                  {showAnnouncementForm ? 'Cancel' : '+ New Announcement'}
                </button>
              </div>

              {showAnnouncementForm && (
                <div className="glass rounded-3xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>New Announcement</h2>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-zinc-400 mb-1">Title</div>
                      <input
                        type="text"
                        value={announcementForm.title}
                        onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Announcement title..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400 mb-1">Message</div>
                      <textarea
                        value={announcementForm.body}
                        onChange={e => setAnnouncementForm(f => ({ ...f, body: e.target.value }))}
                        placeholder="Write your announcement..."
                        rows={4}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400 mb-1">Priority</div>
                      <select
                        value={announcementForm.priority}
                        onChange={e => setAnnouncementForm(f => ({ ...f, priority: e.target.value as 'normal' | 'urgent' }))}
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                      >
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!announcementForm.title.trim() || !announcementForm.body.trim()) {
                        toast.error('Please fill in title and message'); return
                      }
                      const newA = {
                        id: Date.now(),
                        title: announcementForm.title,
                        body: announcementForm.body,
                        author: user?.name || 'Manager',
                        priority: announcementForm.priority,
                        created_at: new Date().toISOString(),
                        read_by: [],
                      }
                      setAnnouncements(prev => [newA, ...prev])
                      setShowAnnouncementForm(false)
                      setAnnouncementForm({ title: '', body: '', priority: 'normal' })
                      toast.success('Announcement sent to team!')
                    }}
                    className="px-5 py-2 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}
                  >
                    Send to All
                  </button>
                </div>
              )}

              {/* Read receipt summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Announcements Sent', value: announcements.length },
                  { label: 'Avg Read Rate', value: '—' },
                  { label: 'Urgent Unread', value: announcements.filter(a => a.priority === 'urgent' && a.read_by.length === 0).length },
                ].map(({ label, value }) => (
                  <div key={label} className="glass rounded-2xl p-4 text-center">
                    <div className="text-2xl font-bold" style={{ color: 'var(--accent-color)' }}>{value}</div>
                    <div className="text-xs text-zinc-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* Announcements list */}
              <div className="space-y-4">
                {announcements.map(a => (
                  <div key={a.id} className={`glass rounded-3xl p-6 border ${a.priority === 'urgent' ? 'border-amber-500/30' : 'border-white/5'}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.priority === 'urgent' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">Urgent</span>
                        )}
                        <h3 className="font-semibold text-white">{a.title}</h3>
                      </div>
                      <span className="text-xs text-zinc-500 flex-shrink-0">{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-zinc-300 mb-4 leading-relaxed">{a.body}</p>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="text-xs text-zinc-500">
                        Sent by <span className="text-zinc-300">{a.author}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span>{a.read_by.length === 0 ? 'No reads yet' : `${a.read_by.length} read`}</span>
                        </div>
                        <button
                          onClick={() => {
                            const name = user?.name || 'You'
                            if (!a.read_by.includes(name)) {
                              setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, read_by: [...x.read_by, name] } : x))
                            }
                          }}
                          className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                        >
                          Mark as Read
                        </button>
                      </div>
                    </div>
                    {a.read_by.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/10 text-xs text-zinc-500">
                        Read by: {a.read_by.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
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
          {activeView === 'taxes' && (() => {
            // Paystub calculation (same as payroll tab)
            const _gp = periodEarnings.pay
            const _rp = periodEarnings.regular * clockHourlyRate
            const _op = periodEarnings.overtime * clockHourlyRate * 1.5
            const _ppy = 26
            const _ag = _gp * _ppy
            const _calcFed = (inc: number) => {
              const b = [[11925,0.10],[48475,0.12],[103350,0.22],[197300,0.24],[250525,0.32],[626350,0.35],[Infinity,0.37]] as [number,number][]
              let t = 0; let p = 0
              for (const [lim, rate] of b) { if (inc <= p) break; t += (Math.min(inc, lim) - p) * rate; p = lim }
              return t
            }
            const _ft = _calcFed(_ag) / _ppy
            const _fer = _ag > 0 ? _calcFed(_ag) / _ag : 0
            const _st = _gp * 0.0593
            const _ss = _gp * 0.062
            const _med = _gp * 0.0145
            const _td = _ft + _st + _ss + _med
            const _np = _gp - _td
            return (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* My Paystub module */}
              <div className="glass rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>My Paystub - {periodLabel}</h2>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors print-hide"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print Paystub
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Earnings</div>
                    {[
                      ['Regular Pay', `${periodEarnings.regular.toFixed(1)}h x $${clockHourlyRate}`, _rp],
                      ...(_op > 0 ? [['Overtime Pay (1.5x)', `${periodEarnings.overtime.toFixed(1)}h x $${(clockHourlyRate * 1.5).toFixed(2)}`, _op]] : []),
                    ].map(([label, sub, val]) => (
                      <div key={String(label)} className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-2.5">
                        <div>
                          <div className="text-sm font-medium">{String(label)}</div>
                          <div className="text-xs text-zinc-500">{String(sub)}</div>
                        </div>
                        <span className="font-mono neon-green">${Number(val).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-white/10 pt-3">
                      <span className="font-semibold">Gross Pay</span>
                      <span className="font-mono font-bold text-lg neon-green">${_gp.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Deductions</div>
                    {[
                      ['Federal Income Tax', `${(_fer * 100).toFixed(1)}% eff. (2026 brackets)`, _ft],
                      ['State Income Tax', '5.93% (CA)', _st],
                      ['Social Security', '6.2%', _ss],
                      ['Medicare', '1.45%', _med],
                    ].map(([label, rate, val]) => (
                      <div key={String(label)} className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-2.5">
                        <div>
                          <div className="text-sm font-medium">{String(label)}</div>
                          <div className="text-xs text-zinc-500">{String(rate)}</div>
                        </div>
                        <span className="font-mono text-red-400">-${Number(val).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center border-t border-white/10 pt-3">
                      <span className="font-semibold">Total Deductions</span>
                      <span className="font-mono text-red-400">-${_td.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 bg-white/5 rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <div className="text-zinc-400 text-sm">Net Pay (Take-home)</div>
                    <div className="text-xs text-zinc-600 mt-0.5">After all deductions</div>
                  </div>
                  <div className="text-3xl font-bold neon-green font-mono">${_np.toFixed(2)}</div>
                </div>
                <div className="mt-4 text-xs text-zinc-500">* Tax estimates are approximate. Actual withholding may differ based on filing status and elections.</div>
              </div>

              {/* Files module */}
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
                    style={{ boxShadow: `0 0 80px -20px ${themeAccentHex}35, 0 28px 72px -14px rgba(0,0,0,0.85)` }}
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
          )})()}
          {activeView === 'groktax' && (
            <div className="max-w-5xl mx-auto">
              <div className="glass rounded-3xl flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/10 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                    <i className="bx bx-receipt text-xl" style={{ color: 'var(--accent-color)' }} />
                  </div>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--accent-color)' }}>Swifty AI Tax Filing</div>
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
                            <div className="text-lg font-medium" style={{ color: 'var(--accent-color)' }}>Form 1040: U.S. Individual Income Tax Return</div>
                            <div className="text-xs text-zinc-500">Pre-filled from your documents via RAG</div>
                          </div>
                          <div className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--accent-color-dim, rgba(215,254,81,0.15))', color: 'var(--accent-color)' }}>AI-Completed</div>
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
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Header */}
              <div className="glass rounded-3xl p-6 flex items-center gap-6">
                <div className="relative flex-shrink-0">
                  {profilePicUrl
                    ? (
                      <div className="relative group cursor-pointer" onClick={() => setShowCropModal(true)} title="Click to adjust crop">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/20">
                          <img
                            src={profilePicUrl}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            style={{
                              objectPosition: `${profilePicX}% ${profilePicY}%`,
                              transform: `scale(${profilePicZoom})`,
                              transformOrigin: `${profilePicX}% ${profilePicY}%`,
                            }}
                          />
                        </div>
                        <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </div>
                      </div>
                    )
                    : (
                      <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                    )
                  }
                  <label className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity" style={{ background: 'var(--accent-color)' }} title="Upload photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = ev => {
                          const url = ev.target?.result as string
                          setProfilePicUrl(url)
                          localStorage.setItem('swiftshift-profile-pic', url)
                          setShowCropModal(true)
                        }
                        reader.readAsDataURL(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-2xl font-semibold neon-green">{user.first_name} {user.last_name}</div>
                  <div className="text-sm text-zinc-400 mt-1">{user.job_role || 'Employee'} · {user.email}</div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                      Lv.{appCurrentLevel.level} {appCurrentLevel.name}
                    </span>
                    <span className="text-xs text-zinc-500">{appGState.totalXP} XP total</span>
                    <span className="text-xs text-zinc-500">· {appGState.submits} timesheets submitted</span>
                  </div>
                  {profilePicUrl
                    ? <div className="text-xs text-zinc-600 mt-1.5">Click photo to adjust crop</div>
                    : <div className="text-xs text-zinc-600 mt-1">Click the upload button to add a profile photo</div>
                  }
                </div>
              </div>

              {/* Profile pic crop modal */}
              {showCropModal && profilePicUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowCropModal(false)}>
                  <div className="glass rounded-3xl p-6 w-full max-w-sm mx-4 border border-white/20" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-semibold text-white">Adjust Photo</h3>
                      <button onClick={() => setShowCropModal(false)} className="text-zinc-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <div className="flex justify-center mb-5">
                      <div className="w-28 h-28 rounded-2xl overflow-hidden border border-white/20">
                        <img src={profilePicUrl} alt="Preview" className="w-full h-full object-cover"
                          style={{ objectPosition: `${profilePicX}% ${profilePicY}%`, transform: `scale(${profilePicZoom})`, transformOrigin: `${profilePicX}% ${profilePicY}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-20 flex-shrink-0">Zoom</span>
                        <input type="range" min="1" max="3" step="0.05" value={profilePicZoom}
                          onChange={e => { const v = parseFloat(e.target.value); setProfilePicZoom(v); localStorage.setItem('swiftshift-profile-pic-zoom', String(v)) }}
                          className="flex-1 h-1 accent-[var(--accent-color)]"
                        />
                        <span className="text-xs text-zinc-400 w-10 text-right">{profilePicZoom.toFixed(1)}×</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-20 flex-shrink-0">Horizontal</span>
                        <input type="range" min="0" max="100" step="1" value={profilePicX}
                          onChange={e => { const v = parseFloat(e.target.value); setProfilePicX(v); localStorage.setItem('swiftshift-profile-pic-x', String(v)) }}
                          className="flex-1 h-1 accent-[var(--accent-color)]"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-20 flex-shrink-0">Vertical</span>
                        <input type="range" min="0" max="100" step="1" value={profilePicY}
                          onChange={e => { const v = parseFloat(e.target.value); setProfilePicY(v); localStorage.setItem('swiftshift-profile-pic-y', String(v)) }}
                          className="flex-1 h-1 accent-[var(--accent-color)]"
                        />
                      </div>
                    </div>
                    <button onClick={() => setShowCropModal(false)} className="mt-5 w-full py-2.5 rounded-xl text-sm font-semibold text-black transition-opacity hover:opacity-90" style={{ background: 'var(--accent-color)' }}>
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Tab nav */}
              <div className="flex gap-2 flex-wrap">
                {(['info', 'schedule', 'deposit', 'availability'] as const).map(tab => (
                  <button key={tab} onClick={() => setProfileTab(tab)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${profileTab === tab ? 'text-black' : 'glass hover:bg-white/10 text-zinc-300'}`}
                    style={profileTab === tab ? { backgroundColor: 'var(--accent-color)' } : undefined}>
                    {tab === 'info' ? 'Info' : tab === 'schedule' ? 'Work Schedule' : tab === 'deposit' ? 'Direct Deposit' : 'Availability'}
                  </button>
                ))}
              </div>

              {/* Tab: Info */}
              {profileTab === 'info' && (
                <div className="glass rounded-3xl p-6">
                  <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Personal Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[['Email', user.email], ['Manager', user.manager_name || '—'], ['User ID', String(user.id)], ['Role', user.job_role || '—'], ['Pay Type', user.salary ? 'Salaried' : 'Hourly'], ['Rate', user.salary ? `$${user.salary.toLocaleString()}/yr` : user.pay ? `$${user.pay}/hr` : '—']].map(([label, val]) => (
                      <div key={label} className="bg-white/5 rounded-2xl p-4">
                        <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-1">{label}</div>
                        <div className="text-base font-mono">{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-xs text-zinc-500">Contact HR to update personal information.</div>
                </div>
              )}

              {/* Tab: Work Schedule */}
              {profileTab === 'schedule' && (
                <div className="glass rounded-3xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Work Schedule</h2>
                  {scheduleEdit !== null && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { label: 'Schedule Type', key: 'schedule_type', type: 'select', options: ['full_time', 'part_time', 'flex'] },
                        { label: 'Hours / Week', key: 'hours_per_week', type: 'number' },
                        { label: 'Shift Start', key: 'shift_start', type: 'time' },
                        { label: 'Shift End', key: 'shift_end', type: 'time' },
                      ].map(({ label, key, type, options }) => (
                        <div key={key} className="bg-white/5 rounded-2xl p-4">
                          <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-2">{label}</div>
                          {type === 'select' ? (
                            <select value={scheduleEdit[key] || ''} onChange={e => setScheduleEdit((s: any) => ({ ...s, [key]: e.target.value }))}
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30">
                              {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input type={type} value={scheduleEdit[key] || ''} onChange={e => setScheduleEdit((s: any) => ({ ...s, [key]: e.target.value }))}
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="bg-white/5 rounded-2xl p-4">
                    <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-2">Work Days</div>
                    <div className="flex flex-wrap gap-2">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => {
                        const current = (scheduleEdit?.work_days || 'Mon,Tue,Wed,Thu,Fri').split(',')
                        const active = current.includes(d)
                        return (
                          <button key={d} onClick={() => {
                            const next = active ? current.filter((x: string) => x !== d) : [...current, d]
                            setScheduleEdit((s: any) => ({ ...s, work_days: next.join(',') }))
                          }} className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                            style={active ? { backgroundColor: 'var(--accent-color)', color: '#000' } : { backgroundColor: 'rgba(255,255,255,0.1)', color: '#aaa' }}>
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <button onClick={() => {
                    if (!user?.id || !scheduleEdit) return
                    fetch(`${API_BASE}/api/work-schedule`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, ...scheduleEdit }) })
                      .then(r => r.json()).then(d => { setWorkSchedule(d); toast.success('Work schedule saved!') }).catch(() => toast.error('Failed to save'))
                  }} className="px-5 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                    Save Schedule
                  </button>
                </div>
              )}

              {/* Tab: Direct Deposit */}
              {profileTab === 'deposit' && (
                <div className="glass rounded-3xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Direct Deposit</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: 'Bank Name', key: 'bank_name', type: 'text' },
                      { label: 'Account Type', key: 'account_type', type: 'select', options: ['checking', 'savings'] },
                      { label: 'Routing Number', key: 'routing_number', type: 'text', placeholder: '•••••••••' },
                      { label: 'Account Number', key: 'account_number', type: 'text', placeholder: '••••••••••••' },
                    ].map(({ label, key, type, options, placeholder }) => (
                      <div key={key} className="bg-white/5 rounded-2xl p-4">
                        <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-2">{label}</div>
                        {type === 'select' ? (
                          <select value={depositEdit?.[key] || ''} onChange={e => setDepositEdit((s: any) => ({ ...s, [key]: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30">
                            {(options || []).map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={type} value={depositEdit?.[key] || ''} placeholder={placeholder} onChange={e => setDepositEdit((s: any) => ({ ...s, [key]: e.target.value }))}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30" />
                        )}
                      </div>
                    ))}
                  </div>
                  {directDeposit?.bank_name && (
                    <div className="text-xs text-zinc-500">Currently on file: <span className="text-zinc-300">{directDeposit.bank_name}</span> ({directDeposit.account_type})</div>
                  )}
                  <button onClick={() => {
                    if (!user?.id || !depositEdit) return
                    fetch(`${API_BASE}/api/direct-deposit`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, ...depositEdit }) })
                      .then(r => r.json()).then(d => { setDirectDeposit(d); toast.success('Direct deposit saved!') }).catch(() => toast.error('Failed to save'))
                  }} className="px-5 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                    Save Banking Info
                  </button>
                </div>
              )}

              {/* Tab: Availability */}
              {profileTab === 'availability' && (
                <div className="glass rounded-3xl p-6 space-y-4">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Weekly Availability</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => (
                      <div key={day} className="bg-white/5 rounded-2xl p-3">
                        <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-2">{day}</div>
                        <select value={availabilityEdit?.[day] || 'available'} onChange={e => setAvailabilityEdit((s: any) => ({ ...s, [day]: e.target.value }))}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-white/30">
                          <option value="available">Available</option>
                          <option value="preferred">Preferred</option>
                          <option value="unavailable">Unavailable</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4">
                      <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-2">Preferred Start</div>
                      <input type="time" value={availabilityEdit?.preferred_start || '09:00'} onChange={e => setAvailabilityEdit((s: any) => ({ ...s, preferred_start: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30" />
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4">
                      <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-2">Preferred End</div>
                      <input type="time" value={availabilityEdit?.preferred_end || '17:00'} onChange={e => setAvailabilityEdit((s: any) => ({ ...s, preferred_end: e.target.value }))}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30" />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4">
                    <div className="text-xs uppercase tracking-[1px] text-zinc-500 mb-2">Notes</div>
                    <textarea value={availabilityEdit?.notes || ''} onChange={e => setAvailabilityEdit((s: any) => ({ ...s, notes: e.target.value }))} rows={2}
                      placeholder="Any scheduling notes..." className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 resize-none" />
                  </div>
                  <button onClick={() => {
                    if (!user?.id || !availabilityEdit) return
                    fetch(`${API_BASE}/api/availability`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, ...availabilityEdit }) })
                      .then(r => r.json()).then(d => { setWorkAvailability(d); toast.success('Availability saved!') }).catch(() => toast.error('Failed to save'))
                  }} className="px-5 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                    Save Availability
                  </button>
                </div>
              )}
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
            onNavigate={(viewId) => navTo(viewId as any)}
            onComplete={() => {
              toast.success('Tour complete! +50 XP', { description: 'You unlocked the Explorer badge!' })
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
            handleStartBreak(STATE_BREAK_RULES[workState]?.isPaid ? 'paid' : 'unpaid')
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
          theme={(['green','white','orange','cyan','pink','purple'] as const).includes(theme as any) ? theme as 'green'|'white'|'orange'|'cyan'|'pink'|'purple' : undefined}
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
