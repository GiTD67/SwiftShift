import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────

interface SalesRep {
  id: number
  name: string
  closes: number
  comps: number
  revenue: number
  streak: number
  xp: number
}

interface Deal {
  id: string
  repId: number
  repName: string
  title: string
  company: string
  value: number
  stage: 'prospect' | 'proposal' | 'closed'
  note: string
  createdAt: string
}

interface MonthlySnapshot {
  id: string
  monthKey: string
  label: string
  reps: SalesRep[]
  totalCloses: number
  totalRevenue: number
  totalComps: number
  lockedAt: string
}

interface RepQuota {
  repId: number
  target: number
  metric: 'closes' | 'revenue' | 'comps'
  period: 'weekly' | 'monthly' | 'quarterly'
}

interface Prize {
  id: string
  title: string
  description: string
  milestone: number
  milestoneType: 'closes' | 'revenue' | 'xp'
  icon: string
  claimed: boolean
}

interface KPIGoal {
  id: string
  title: string
  target: number
  current: number
  unit: string
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
}

interface SalesKPIProps {
  user: any
  users: any[]
  isAdmin?: boolean
  accentColor?: string
  addXP?: (amount: number) => void
}

// ── Seed data ────────────────────────────────────────────

const INITIAL_REPS: SalesRep[] = [
  { id: 1, name: 'Alex Rivera', closes: 24, comps: 31, revenue: 142500, streak: 7, xp: 2400 },
  { id: 2, name: 'Jordan Lee', closes: 19, comps: 27, revenue: 118200, streak: 4, xp: 1900 },
  { id: 3, name: 'Morgan Chen', closes: 17, comps: 22, revenue: 98750, streak: 2, xp: 1700 },
  { id: 4, name: 'Taylor Brooks', closes: 14, comps: 19, revenue: 87300, streak: 0, xp: 1400 },
  { id: 5, name: 'Casey Kim', closes: 11, comps: 16, revenue: 62100, streak: 3, xp: 1100 },
]

const DEFAULT_PRIZES: Prize[] = [
  { id: 'p1', title: 'AirPods Pro', description: 'Hit 10 closes in a month', milestone: 10, milestoneType: 'closes', icon: '🎧', claimed: false },
  { id: 'p2', title: '$500 Gift Card', description: 'Reach $50k in monthly revenue', milestone: 50000, milestoneType: 'revenue', icon: '💳', claimed: false },
  { id: 'p3', title: 'VIP Day Off', description: 'Earn 2,000 XP from sales', milestone: 2000, milestoneType: 'xp', icon: '🏖️', claimed: false },
  { id: 'p4', title: 'Team Dinner', description: 'Hit 25 closes in a month', milestone: 25, milestoneType: 'closes', icon: '🍽️', claimed: false },
  { id: 'p5', title: 'Custom Trophy', description: 'Reach $100k in monthly revenue', milestone: 100000, milestoneType: 'revenue', icon: '🏆', claimed: false },
]

const DEFAULT_GOALS: KPIGoal[] = [
  { id: 'g1', title: 'Monthly Closes', target: 20, current: 14, unit: 'closes', period: 'monthly' },
  { id: 'g2', title: 'Monthly Revenue', target: 100000, current: 62100, unit: '$', period: 'monthly' },
  { id: 'g3', title: 'Weekly Comps', target: 8, current: 5, unit: 'comps', period: 'weekly' },
  { id: 'g4', title: 'Q2 Revenue Goal', target: 400000, current: 248750, unit: '$', period: 'quarterly' },
]

const PERIOD_LABELS = { daily: 'Today', weekly: 'This Week', monthly: 'This Month', quarterly: 'This Quarter' }
const XP_PER_CLOSE = 50
const XP_PER_COMP = 25

// ── Helpers ──────────────────────────────────────────────

function formatCurrency(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`
  return `$${n}`
}

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function loadSalesState(): any {
  try {
    const raw = localStorage.getItem('swiftshift-sales')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function StreakFire({ count }: { count: number }) {
  if (count === 0) return <span className="text-zinc-500 text-xs">No streak</span>
  return (
    <span className="flex items-center gap-1 text-sm font-semibold text-amber-400">
      🔥 {count}d
    </span>
  )
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const w = 60
  const h = 24
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Component ────────────────────────────────────────────

type ActiveTab = 'overview' | 'leaderboard' | 'prizes' | 'goals' | 'pipeline' | 'history' | 'quotas'

const STAGES: Deal['stage'][] = ['prospect', 'proposal', 'closed']
const STAGE_LABELS = { prospect: 'Prospect', proposal: 'Proposal', closed: 'Closed' }
const STAGE_ICONS = { prospect: '🔍', proposal: '📋', closed: '✅' }

export function SalesKPI({ isAdmin = true, accentColor = '#22c55e', addXP }: SalesKPIProps) {
  const saved = loadSalesState()

  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('monthly')
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')

  const [reps, setReps] = useState<SalesRep[]>(saved?.reps || INITIAL_REPS)
  const [deals, setDeals] = useState<Deal[]>(saved?.deals || [])
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>(saved?.snapshots || [])
  const [quotas, setQuotas] = useState<RepQuota[]>(saved?.quotas || [])
  const [prizes, setPrizes] = useState<Prize[]>(saved?.prizes || DEFAULT_PRIZES)
  const [goals, setGoals] = useState<KPIGoal[]>(saved?.goals || DEFAULT_GOALS)

  const [showAddGoal, setShowAddGoal] = useState(false)
  const [showAddPrize, setShowAddPrize] = useState(false)
  const [showAddDeal, setShowAddDeal] = useState(false)
  const [showAddQuota, setShowAddQuota] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const [newGoal, setNewGoal] = useState({ title: '', target: '', unit: 'closes', period: 'monthly' as KPIGoal['period'] })
  const [newPrize, setNewPrize] = useState({ title: '', description: '', milestone: '', milestoneType: 'closes' as Prize['milestoneType'], icon: '🎁' })
  const [newDeal, setNewDeal] = useState({ repId: INITIAL_REPS[0].id, title: '', company: '', value: '', note: '' })
  const [newQuota, setNewQuota] = useState({ repId: INITIAL_REPS[0].id, target: '', metric: 'closes' as RepQuota['metric'], period: 'monthly' as RepQuota['period'] })

  function persistAll(nextReps: SalesRep[], nextDeals: Deal[], nextSnaps: MonthlySnapshot[], nextQuotas: RepQuota[], nextPrizes: Prize[], nextGoals: KPIGoal[]) {
    localStorage.setItem('swiftshift-sales', JSON.stringify({
      reps: nextReps, deals: nextDeals, snapshots: nextSnaps,
      quotas: nextQuotas, prizes: nextPrizes, goals: nextGoals,
    }))
  }

  function milestoneHit(rep: SalesRep, prize: Prize): boolean {
    const val = prize.milestoneType === 'closes' ? rep.closes
      : prize.milestoneType === 'revenue' ? rep.revenue
      : rep.xp
    return val >= prize.milestone
  }

  function checkAndFireAlerts(repBefore: SalesRep, repAfter: SalesRep) {
    prizes.forEach(prize => {
      if (!milestoneHit(repBefore, prize) && milestoneHit(repAfter, prize)) {
        toast.success(`🔔 ${repAfter.name} just hit ${prize.milestone} ${prize.milestoneType}!`, {
          description: `${prize.icon} ${prize.title} — prize unlocked!`,
          duration: 6000,
        })
      }
    })
  }

  function addDeal() {
    if (!newDeal.title || !newDeal.company || !newDeal.value) return
    const rep = reps.find(r => r.id === Number(newDeal.repId))
    if (!rep) return

    const deal: Deal = {
      id: `d${Date.now()}`,
      repId: rep.id,
      repName: rep.name,
      title: newDeal.title,
      company: newDeal.company,
      value: Number(newDeal.value),
      stage: 'prospect',
      note: newDeal.note,
      createdAt: new Date().toISOString(),
    }

    const repAfter = { ...rep, comps: rep.comps + 1, xp: rep.xp + XP_PER_COMP }
    const nextReps = reps.map(r => r.id === rep.id ? repAfter : r)
    const nextDeals = [...deals, deal]

    checkAndFireAlerts(rep, repAfter)
    if (addXP) addXP(XP_PER_COMP)

    setReps(nextReps)
    setDeals(nextDeals)
    persistAll(nextReps, nextDeals, snapshots, quotas, prizes, goals)
    setNewDeal({ repId: INITIAL_REPS[0].id, title: '', company: '', value: '', note: '' })
    setShowAddDeal(false)
    toast.success('Deal added to pipeline! +25 XP to team pool')
  }

  function moveDealStage(dealId: string, newStage: Deal['stage']) {
    const deal = deals.find(d => d.id === dealId)
    if (!deal) return
    const rep = reps.find(r => r.id === deal.repId)
    if (!rep) return

    const nextDeals = deals.map(d => d.id === dealId ? { ...d, stage: newStage } : d)
    let nextReps = reps

    if (newStage === 'closed' && deal.stage !== 'closed') {
      const repAfter = {
        ...rep,
        closes: rep.closes + 1,
        revenue: rep.revenue + deal.value,
        xp: rep.xp + XP_PER_CLOSE,
        streak: rep.streak + 1,
      }
      checkAndFireAlerts(rep, repAfter)
      if (addXP) addXP(XP_PER_CLOSE)
      nextReps = reps.map(r => r.id === rep.id ? repAfter : r)
      toast.success(`🎉 Deal closed! ${formatCurrency(deal.value)}`, {
        description: `${rep.name} · +${XP_PER_CLOSE} XP to team XP pool`,
      })
    } else if (deal.stage === 'closed' && newStage !== 'closed') {
      const repAfter = {
        ...rep,
        closes: Math.max(0, rep.closes - 1),
        revenue: Math.max(0, rep.revenue - deal.value),
        xp: Math.max(0, rep.xp - XP_PER_CLOSE),
        streak: Math.max(0, rep.streak - 1),
      }
      nextReps = reps.map(r => r.id === rep.id ? repAfter : r)
    }

    setReps(nextReps)
    setDeals(nextDeals)
    persistAll(nextReps, nextDeals, snapshots, quotas, prizes, goals)
  }

  function saveDealNote(dealId: string, note: string) {
    const nextDeals = deals.map(d => d.id === dealId ? { ...d, note } : d)
    setDeals(nextDeals)
    persistAll(reps, nextDeals, snapshots, quotas, prizes, goals)
    setEditingNoteId(null)
  }

  function lockSnapshot() {
    const key = currentMonthKey()
    if (snapshots.some(s => s.monthKey === key)) {
      toast.error('Snapshot for this month already exists')
      return
    }
    const snap: MonthlySnapshot = {
      id: `snap-${key}`,
      monthKey: key,
      label: monthLabel(key),
      reps: [...reps],
      totalCloses: reps.reduce((s, r) => s + r.closes, 0),
      totalRevenue: reps.reduce((s, r) => s + r.revenue, 0),
      totalComps: reps.reduce((s, r) => s + r.comps, 0),
      lockedAt: new Date().toISOString(),
    }
    const nextSnaps = [...snapshots, snap].sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    setSnapshots(nextSnaps)
    persistAll(reps, deals, nextSnaps, quotas, prizes, goals)
    toast.success(`📅 Snapshot locked for ${snap.label}`)
  }

  function addQuota() {
    if (!newQuota.target) return
    const idx = quotas.findIndex(q => q.repId === Number(newQuota.repId) && q.metric === newQuota.metric && q.period === newQuota.period)
    const updated: RepQuota = { repId: Number(newQuota.repId), target: Number(newQuota.target), metric: newQuota.metric, period: newQuota.period }
    const nextQuotas = idx >= 0 ? quotas.map((q, i) => i === idx ? updated : q) : [...quotas, updated]
    setQuotas(nextQuotas)
    persistAll(reps, deals, snapshots, nextQuotas, prizes, goals)
    setNewQuota({ repId: INITIAL_REPS[0].id, target: '', metric: 'closes', period: 'monthly' })
    setShowAddQuota(false)
    toast.success('Quota assigned!')
  }

  function addGoal() {
    if (!newGoal.title || !newGoal.target) return
    const nextGoals = [...goals, { id: `g${Date.now()}`, title: newGoal.title, target: Number(newGoal.target), current: 0, unit: newGoal.unit, period: newGoal.period }]
    setGoals(nextGoals)
    persistAll(reps, deals, snapshots, quotas, prizes, nextGoals)
    setNewGoal({ title: '', target: '', unit: 'closes', period: 'monthly' })
    setShowAddGoal(false)
  }

  function addPrize() {
    if (!newPrize.title || !newPrize.milestone) return
    const nextPrizes = [...prizes, { id: `p${Date.now()}`, title: newPrize.title, description: newPrize.description, milestone: Number(newPrize.milestone), milestoneType: newPrize.milestoneType, icon: newPrize.icon, claimed: false }]
    setPrizes(nextPrizes)
    persistAll(reps, deals, snapshots, quotas, nextPrizes, goals)
    setNewPrize({ title: '', description: '', milestone: '', milestoneType: 'closes', icon: '🎁' })
    setShowAddPrize(false)
  }

  const myRep = reps[0]
  const sortedReps = [...reps].sort((a, b) => b.closes - a.closes)
  const totalCloses = reps.reduce((s, r) => s + r.closes, 0)
  const totalRevenue = reps.reduce((s, r) => s + r.revenue, 0)
  const totalComps = reps.reduce((s, r) => s + r.comps, 0)
  const conversionRate = totalComps > 0 ? Math.round((totalCloses / totalComps) * 100) : 0
  const sparkData = [4, 7, 5, 9, 11, 8, 14]

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'leaderboard', label: 'Leaderboard' },
    { key: 'prizes', label: 'Prizes' },
    { key: 'goals', label: 'Goals' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'history', label: 'History' },
    { key: 'quotas', label: 'Quotas' },
  ]

  const tabClass = (t: string) =>
    `px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeTab === t ? 'text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--accent-color)' }}>Sales KPIs &amp; Metrics</h1>
          <p className="text-sm text-zinc-400">Track performance, comps, closes, and rewards for your sales team</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['daily', 'weekly', 'monthly', 'quarterly'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p ? 'text-black' : 'text-zinc-400 bg-white/5 hover:bg-white/10'}`}
              style={period === p ? { backgroundColor: 'var(--accent-color)' } : {}}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-2xl p-1 flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={tabClass(key)}
            style={activeTab === key ? { backgroundColor: 'var(--accent-color)' } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <motion.div className="space-y-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Closes', value: String(totalCloses), sub: PERIOD_LABELS[period], trend: '+12%' },
              { label: 'Total Comps', value: String(totalComps), sub: PERIOD_LABELS[period], trend: '+8%' },
              { label: 'Revenue', value: formatCurrency(totalRevenue), sub: PERIOD_LABELS[period], trend: '+15%' },
              { label: 'Conv. Rate', value: `${conversionRate}%`, sub: 'closes ÷ comps', trend: '+3%' },
            ].map(({ label, value, sub, trend }) => (
              <div key={label} className="glass rounded-2xl p-4">
                <div className="text-xs text-zinc-400 mb-1">{label}</div>
                <div className="text-2xl font-bold mb-1" style={{ color: 'var(--accent-color)' }}>{value}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{sub}</span>
                  <span className="text-xs text-emerald-400 font-medium">{trend}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="glass rounded-3xl p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>My Performance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { val: myRep.closes, label: 'Closes' },
                { val: myRep.comps, label: 'Comps' },
                { val: formatCurrency(myRep.revenue), label: 'Revenue' },
              ].map(({ val, label }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold">{val}</div>
                  <div className="text-xs text-zinc-400 mt-1">{label}</div>
                </div>
              ))}
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <StreakFire count={myRep.streak} />
                <div className="text-xs text-zinc-400 mt-1">Close Streak</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <div className="text-xs text-zinc-400">Closes trend (7d)</div>
              <MiniSparkline values={sparkData} color={accentColor} />
            </div>
          </div>

          <div className="glass rounded-3xl p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Top Performers</h2>
            <div className="space-y-3">
              {sortedReps.slice(0, 3).map((rep, i) => {
                const pct = Math.round((rep.closes / (sortedReps[0]?.closes || 1)) * 100)
                return (
                  <div key={rep.id} className="flex items-center gap-3">
                    <div className="text-xl w-6">{['🥇', '🥈', '🥉'][i]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate">{rep.name}</span>
                        <span className="text-zinc-400 shrink-0">{rep.closes} closes · {formatCurrency(rep.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--accent-color)' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Leaderboard ── */}
      {activeTab === 'leaderboard' && (
        <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Team Leaderboard — {PERIOD_LABELS[period]}</h2>
              <span className="text-xs text-zinc-500">{reps.length} reps</span>
            </div>
            <div className="space-y-2">
              {sortedReps.map((rep, i) => (
                <motion.div
                  key={rep.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
                  style={i === 0 ? { borderLeft: `3px solid ${accentColor}` } : {}}
                >
                  <div className="text-zinc-400 font-mono text-sm w-5 text-center">{i + 1}</div>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold shrink-0"
                    style={i === 0 ? { backgroundColor: accentColor, color: '#000' } : {}}>
                    {rep.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{rep.name}</div>
                    <div className="text-xs text-zinc-500">{rep.xp} XP · <StreakFire count={rep.streak} /></div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{rep.closes} closes</div>
                    <div className="text-xs text-zinc-400">{rep.comps} comps · {formatCurrency(rep.revenue)}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Prizes ── */}
      {activeTab === 'prizes' && (
        <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Prizes &amp; Rewards</h2>
            {isAdmin && (
              <button onClick={() => setShowAddPrize(v => !v)} className="px-3 py-1.5 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>
                {showAddPrize ? 'Cancel' : '+ Add Prize'}
              </button>
            )}
          </div>

          {showAddPrize && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">New Prize</h3>
              <div className="grid grid-cols-2 gap-3">
                <input className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 col-span-2" placeholder="Prize title (e.g. AirPods Pro)" value={newPrize.title} onChange={e => setNewPrize(p => ({ ...p, title: e.target.value }))} />
                <input className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 col-span-2" placeholder="Description" value={newPrize.description} onChange={e => setNewPrize(p => ({ ...p, description: e.target.value }))} />
                <input className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30" placeholder="Icon (emoji)" value={newPrize.icon} onChange={e => setNewPrize(p => ({ ...p, icon: e.target.value }))} />
                <input type="number" className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30" placeholder="Milestone value" value={newPrize.milestone} onChange={e => setNewPrize(p => ({ ...p, milestone: e.target.value }))} />
                <select className="bg-zinc-900 rounded-xl px-3 py-2 text-sm text-white border border-white/10 col-span-2" value={newPrize.milestoneType} onChange={e => setNewPrize(p => ({ ...p, milestoneType: e.target.value as Prize['milestoneType'] }))}>
                  <option value="closes">Closes</option>
                  <option value="revenue">Revenue ($)</option>
                  <option value="xp">XP</option>
                </select>
              </div>
              <button onClick={addPrize} className="px-4 py-2 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>Add Prize</button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prizes.map(prize => {
              const myVal = prize.milestoneType === 'closes' ? myRep.closes
                : prize.milestoneType === 'revenue' ? myRep.revenue
                : myRep.xp
              const pct = Math.min(Math.round((myVal / prize.milestone) * 100), 100)
              const unlocked = pct >= 100
              return (
                <div key={prize.id} className="glass rounded-2xl p-5 transition-all" style={unlocked ? { outline: `1px solid ${accentColor}` } : {}}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-2xl mb-1">{prize.icon}</div>
                      <div className="font-semibold">{prize.title}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{prize.description}</div>
                    </div>
                    {unlocked && <span className="text-xs font-bold px-2 py-1 rounded-lg text-black" style={{ backgroundColor: 'var(--accent-color)' }}>Unlocked!</span>}
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Progress</span>
                      <span>
                        {prize.milestoneType === 'revenue' ? formatCurrency(myVal) : myVal} / {prize.milestoneType === 'revenue' ? formatCurrency(prize.milestone) : prize.milestone} {prize.milestoneType}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: 'var(--accent-color)' }} />
                    </div>
                    <div className="text-right text-xs mt-1" style={{ color: 'var(--accent-color)' }}>{pct}%</div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Goals ── */}
      {activeTab === 'goals' && (
        <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>KPI Goals &amp; Targets</h2>
            <button onClick={() => setShowAddGoal(v => !v)} className="px-3 py-1.5 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>
              {showAddGoal ? 'Cancel' : '+ Set Goal'}
            </button>
          </div>

          {showAddGoal && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">New Goal</h3>
              <div className="grid grid-cols-2 gap-3">
                <input className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 col-span-2" placeholder="Goal title (e.g. Monthly Closes)" value={newGoal.title} onChange={e => setNewGoal(g => ({ ...g, title: e.target.value }))} />
                <input type="number" className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30" placeholder="Target value" value={newGoal.target} onChange={e => setNewGoal(g => ({ ...g, target: e.target.value }))} />
                <input className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30" placeholder="Unit (closes, $, comps...)" value={newGoal.unit} onChange={e => setNewGoal(g => ({ ...g, unit: e.target.value }))} />
                <select className="bg-zinc-900 rounded-xl px-3 py-2 text-sm text-white border border-white/10 col-span-2" value={newGoal.period} onChange={e => setNewGoal(g => ({ ...g, period: e.target.value as KPIGoal['period'] }))}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <button onClick={addGoal} className="px-4 py-2 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>Add Goal</button>
            </div>
          )}

          <div className="glass rounded-3xl p-6 space-y-5">
            {goals.map(goal => {
              const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100)
              const isRevenue = goal.unit === '$'
              const displayCurrent = isRevenue ? formatCurrency(goal.current) : `${goal.current} ${goal.unit}`
              const displayTarget = isRevenue ? formatCurrency(goal.target) : `${goal.target} ${goal.unit}`
              const color = pct >= 100 ? '#22c55e' : pct >= 70 ? 'var(--accent-color)' : pct >= 40 ? '#f59e0b' : '#ef4444'
              return (
                <div key={goal.id}>
                  <div className="flex justify-between items-baseline mb-1">
                    <div>
                      <span className="text-sm font-medium">{goal.title}</span>
                      <span className="ml-2 text-xs text-zinc-500 capitalize">{goal.period}</span>
                    </div>
                    <span className="text-sm font-semibold" style={{ color }}>{displayCurrent} / {displayTarget}</span>
                  </div>
                  <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} style={{ backgroundColor: color }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-zinc-500">{pct >= 100 ? '🎉 Goal reached!' : `${100 - pct}% to go`}</span>
                    <span className="text-xs font-medium" style={{ color }}>{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* ── Pipeline ── */}
      {activeTab === 'pipeline' && (
        <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Revenue Pipeline</h2>
            <button onClick={() => setShowAddDeal(v => !v)} className="px-3 py-1.5 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>
              {showAddDeal ? 'Cancel' : '+ Add Deal'}
            </button>
          </div>

          {showAddDeal && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">New Deal</h3>
              <div className="grid grid-cols-2 gap-3">
                <select className="bg-zinc-900 rounded-xl px-3 py-2 text-sm text-white border border-white/10 col-span-2" value={newDeal.repId} onChange={e => setNewDeal(d => ({ ...d, repId: Number(e.target.value) }))}>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30" placeholder="Deal title" value={newDeal.title} onChange={e => setNewDeal(d => ({ ...d, title: e.target.value }))} />
                <input className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30" placeholder="Company" value={newDeal.company} onChange={e => setNewDeal(d => ({ ...d, company: e.target.value }))} />
                <input type="number" className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 col-span-2" placeholder="Deal value ($)" value={newDeal.value} onChange={e => setNewDeal(d => ({ ...d, value: e.target.value }))} />
                <textarea className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 col-span-2 resize-none" rows={2} placeholder='Deal note (e.g. "cold call → referral chain")' value={newDeal.note} onChange={e => setNewDeal(d => ({ ...d, note: e.target.value }))} />
              </div>
              <button onClick={addDeal} className="px-4 py-2 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>Add Deal</button>
            </div>
          )}

          {/* Stage summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {STAGES.map(stage => {
              const stageDeals = deals.filter(d => d.stage === stage)
              return (
                <div key={stage} className="glass rounded-2xl p-4 text-center">
                  <div className="text-xl mb-1">{STAGE_ICONS[stage]}</div>
                  <div className="text-sm font-semibold">{STAGE_LABELS[stage]}</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: 'var(--accent-color)' }}>{stageDeals.length}</div>
                  <div className="text-xs text-zinc-500">{formatCurrency(stageDeals.reduce((s, d) => s + d.value, 0))}</div>
                </div>
              )
            })}
          </div>

          {/* Kanban */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STAGES.map(stage => (
              <div key={stage} className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span>{STAGE_ICONS[stage]}</span>
                  <span className="font-semibold text-sm">{STAGE_LABELS[stage]}</span>
                  <span className="text-xs text-zinc-500 ml-auto">{deals.filter(d => d.stage === stage).length}</span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {deals.filter(d => d.stage === stage).length === 0 && (
                    <div className="text-xs text-zinc-600 text-center py-6">No deals</div>
                  )}
                  {deals.filter(d => d.stage === stage).map(deal => (
                    <motion.div key={deal.id} layout className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{deal.title}</div>
                          <div className="text-xs text-zinc-400">{deal.company}</div>
                          <div className="text-xs text-zinc-500">{deal.repName}</div>
                        </div>
                        <div className="text-xs font-semibold shrink-0" style={{ color: 'var(--accent-color)' }}>{formatCurrency(deal.value)}</div>
                      </div>

                      {/* Deal note */}
                      {editingNoteId === deal.id ? (
                        <div className="mt-2 space-y-1">
                          <textarea
                            className="w-full bg-white/5 rounded-lg px-2 py-1 text-xs text-white border border-white/20 focus:outline-none resize-none"
                            rows={2}
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <button onClick={() => saveDealNote(deal.id, noteText)} className="text-xs px-2 py-0.5 rounded-lg text-black font-medium" style={{ backgroundColor: 'var(--accent-color)' }}>Save</button>
                            <button onClick={() => setEditingNoteId(null)} className="text-xs px-2 py-0.5 rounded-lg bg-white/10 text-zinc-300">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingNoteId(deal.id); setNoteText(deal.note) }} className="mt-1.5 w-full text-left">
                          {deal.note
                            ? <div className="text-xs text-zinc-400 italic truncate">💬 {deal.note}</div>
                            : <div className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">+ Add note</div>
                          }
                        </button>
                      )}

                      {/* Move stage */}
                      <div className="mt-2 flex gap-1 flex-wrap">
                        {STAGES.filter(s => s !== stage).map(s => (
                          <button key={s} onClick={() => moveDealStage(deal.id, s)} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 transition-all">
                            → {STAGE_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── History ── */}
      {activeTab === 'history' && (
        <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Historical Snapshots</h2>
            <button onClick={lockSnapshot} className="px-3 py-1.5 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>
              📅 Lock This Month
            </button>
          </div>
          <p className="text-xs text-zinc-500">Lock in each month's results to compare quarter over quarter.</p>

          {snapshots.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center">
              <div className="text-4xl mb-3">📅</div>
              <div className="text-zinc-400 text-sm">No snapshots yet.</div>
              <div className="text-zinc-600 text-xs mt-1">Click "Lock This Month" to save the current results.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {snapshots.map((snap, i) => {
                const prev = snapshots[i + 1]
                const closesDelta = prev ? snap.totalCloses - prev.totalCloses : null
                const revDelta = prev ? snap.totalRevenue - prev.totalRevenue : null
                return (
                  <div key={snap.id} className="glass rounded-3xl p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="font-semibold text-base">{snap.label}</div>
                        <div className="text-xs text-zinc-500">Locked {new Date(snap.lockedAt).toLocaleDateString()}</div>
                      </div>
                      <div className="flex gap-5 flex-wrap">
                        {[
                          { label: 'Closes', val: snap.totalCloses, delta: closesDelta, fmt: String },
                          { label: 'Revenue', val: snap.totalRevenue, delta: revDelta, fmt: formatCurrency },
                          { label: 'Comps', val: snap.totalComps, delta: null, fmt: String },
                        ].map(({ label, val, delta, fmt }) => (
                          <div key={label} className="text-right">
                            <div className="text-xs text-zinc-500">{label}</div>
                            <div className="text-lg font-bold" style={{ color: 'var(--accent-color)' }}>{fmt(val)}</div>
                            {delta !== null && (
                              <div className={`text-xs font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {delta >= 0 ? '+' : ''}{label === 'Revenue' ? formatCurrency(Math.abs(delta)) : delta} vs prev
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {snap.reps.map(rep => (
                        <div key={rep.id} className="flex items-center gap-3 text-xs bg-white/5 rounded-lg px-3 py-2">
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">{rep.name[0]}</div>
                          <div className="flex-1 font-medium">{rep.name}</div>
                          <div className="text-zinc-400">{rep.closes} closes</div>
                          <div className="text-zinc-400">{formatCurrency(rep.revenue)}</div>
                          <div className="text-zinc-500">{rep.xp} XP</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Quotas ── */}
      {activeTab === 'quotas' && (
        <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Manager-Set Quotas</h2>
            {isAdmin && (
              <button onClick={() => setShowAddQuota(v => !v)} className="px-3 py-1.5 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>
                {showAddQuota ? 'Cancel' : '+ Assign Quota'}
              </button>
            )}
          </div>

          {!isAdmin && <p className="text-xs text-zinc-500">Quotas are set by managers. Contact your admin to update your targets.</p>}

          {isAdmin && showAddQuota && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">Assign Quota</h3>
              <div className="grid grid-cols-2 gap-3">
                <select className="bg-zinc-900 rounded-xl px-3 py-2 text-sm text-white border border-white/10 col-span-2" value={newQuota.repId} onChange={e => setNewQuota(q => ({ ...q, repId: Number(e.target.value) }))}>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select className="bg-zinc-900 rounded-xl px-3 py-2 text-sm text-white border border-white/10" value={newQuota.metric} onChange={e => setNewQuota(q => ({ ...q, metric: e.target.value as RepQuota['metric'] }))}>
                  <option value="closes">Closes</option>
                  <option value="comps">Comps</option>
                  <option value="revenue">Revenue ($)</option>
                </select>
                <select className="bg-zinc-900 rounded-xl px-3 py-2 text-sm text-white border border-white/10" value={newQuota.period} onChange={e => setNewQuota(q => ({ ...q, period: e.target.value as RepQuota['period'] }))}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
                <input type="number" className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 col-span-2" placeholder="Target value" value={newQuota.target} onChange={e => setNewQuota(q => ({ ...q, target: e.target.value }))} />
              </div>
              <button onClick={addQuota} className="px-4 py-2 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>Assign Quota</button>
            </div>
          )}

          {quotas.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <div className="text-zinc-400 text-sm">No quotas set yet.</div>
              {isAdmin && <div className="text-zinc-600 text-xs mt-1">Assign individual targets per rep using the button above.</div>}
            </div>
          ) : (
            <div className="glass rounded-3xl p-6 space-y-6">
              {reps.map(rep => {
                const repQuotas = quotas.filter(q => q.repId === rep.id)
                if (repQuotas.length === 0) return null
                return (
                  <div key={rep.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">{rep.name[0]}</div>
                      <div className="font-semibold text-sm">{rep.name}</div>
                    </div>
                    {repQuotas.map(q => {
                      const actual = q.metric === 'closes' ? rep.closes : q.metric === 'comps' ? rep.comps : rep.revenue
                      const pct = Math.min(Math.round((actual / q.target) * 100), 100)
                      const color = pct >= 100 ? '#22c55e' : pct >= 70 ? 'var(--accent-color)' : pct >= 40 ? '#f59e0b' : '#ef4444'
                      const displayActual = q.metric === 'revenue' ? formatCurrency(actual) : String(actual)
                      const displayTarget = q.metric === 'revenue' ? formatCurrency(q.target) : String(q.target)
                      return (
                        <div key={`${q.repId}-${q.metric}-${q.period}`} className="ml-9">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-400 capitalize">{q.period} {q.metric} quota</span>
                            <span className="font-medium" style={{ color }}>{displayActual} / {displayTarget}</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} style={{ backgroundColor: color }} />
                          </div>
                          <div className="flex justify-between mt-0.5">
                            <span className="text-[10px] text-zinc-600">{pct >= 100 ? '✅ Quota met!' : `${100 - pct}% remaining`}</span>
                            <span className="text-[10px] font-medium" style={{ color }}>{pct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
