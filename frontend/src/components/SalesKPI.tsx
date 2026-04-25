import { useState } from 'react'
import { motion } from 'framer-motion'

interface SalesRep {
  id: number
  name: string
  closes: number
  comps: number
  revenue: number
  streak: number
  xp: number
  avatar?: string
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
}


const DEMO_REPS: SalesRep[] = [
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

function formatCurrency(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`
  return `$${n}`
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

export function SalesKPI({ isAdmin = true, accentColor = '#22c55e' }: SalesKPIProps) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('monthly')
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'prizes' | 'goals'>('overview')
  const [prizes, setPrizes] = useState<Prize[]>(DEFAULT_PRIZES)
  const [goals, setGoals] = useState<KPIGoal[]>(DEFAULT_GOALS)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [showAddPrize, setShowAddPrize] = useState(false)
  const [newGoal, setNewGoal] = useState({ title: '', target: '', unit: 'closes', period: 'monthly' as KPIGoal['period'] })
  const [newPrize, setNewPrize] = useState({ title: '', description: '', milestone: '', milestoneType: 'closes' as Prize['milestoneType'], icon: '🎁' })

  const myRep = DEMO_REPS[0]
  const totalCloses = DEMO_REPS.reduce((s, r) => s + r.closes, 0)
  const totalRevenue = DEMO_REPS.reduce((s, r) => s + r.revenue, 0)
  const totalComps = DEMO_REPS.reduce((s, r) => s + r.comps, 0)
  const conversionRate = totalComps > 0 ? Math.round((totalCloses / totalComps) * 100) : 0

  const tabClass = (t: string) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === t ? 'text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`

  const addGoal = () => {
    if (!newGoal.title || !newGoal.target) return
    setGoals(g => [...g, {
      id: `g${Date.now()}`,
      title: newGoal.title,
      target: Number(newGoal.target),
      current: 0,
      unit: newGoal.unit,
      period: newGoal.period,
    }])
    setNewGoal({ title: '', target: '', unit: 'closes', period: 'monthly' })
    setShowAddGoal(false)
  }

  const addPrize = () => {
    if (!newPrize.title || !newPrize.milestone) return
    setPrizes(p => [...p, {
      id: `p${Date.now()}`,
      title: newPrize.title,
      description: newPrize.description,
      milestone: Number(newPrize.milestone),
      milestoneType: newPrize.milestoneType,
      icon: newPrize.icon,
      claimed: false,
    }])
    setNewPrize({ title: '', description: '', milestone: '', milestoneType: 'closes', icon: '🎁' })
    setShowAddPrize(false)
  }

  const sparkData = [4, 7, 5, 9, 11, 8, 14]

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

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white/5 rounded-2xl p-1 w-fit">
        {(['overview', 'leaderboard', 'prizes', 'goals'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={tabClass(t)}
            style={activeTab === t ? { backgroundColor: 'var(--accent-color)' } : {}}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div className="space-y-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Closes', value: String(totalCloses), sub: `${PERIOD_LABELS[period]}`, trend: '+12%' },
              { label: 'Total Comps', value: String(totalComps), sub: `${PERIOD_LABELS[period]}`, trend: '+8%' },
              { label: 'Revenue', value: formatCurrency(totalRevenue), sub: `${PERIOD_LABELS[period]}`, trend: '+15%' },
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

          {/* My Performance */}
          <div className="glass rounded-3xl p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>My Performance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{myRep.closes}</div>
                <div className="text-xs text-zinc-400 mt-1">Closes</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{myRep.comps}</div>
                <div className="text-xs text-zinc-400 mt-1">Comps</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{formatCurrency(myRep.revenue)}</div>
                <div className="text-xs text-zinc-400 mt-1">Revenue</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <StreakFire count={myRep.streak} />
                <div className="text-xs text-zinc-400 mt-1">Close Streak</div>
              </div>
            </div>

            {/* Trend sparkline */}
            <div className="mt-4 flex items-center gap-4">
              <div className="text-xs text-zinc-400">Closes trend (7d)</div>
              <MiniSparkline values={sparkData} color={accentColor} />
            </div>
          </div>

          {/* Top 3 Performers */}
          <div className="glass rounded-3xl p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--accent-color)' }}>Top Performers</h2>
            <div className="space-y-3">
              {DEMO_REPS.slice(0, 3).map((rep, i) => {
                const medals = ['🥇', '🥈', '🥉']
                const pct = Math.round((rep.closes / DEMO_REPS[0].closes) * 100)
                return (
                  <div key={rep.id} className="flex items-center gap-3">
                    <div className="text-xl w-6">{medals[i]}</div>
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

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Team Leaderboard — {PERIOD_LABELS[period]}</h2>
              <span className="text-xs text-zinc-500">{DEMO_REPS.length} reps</span>
            </div>
            <div className="space-y-2">
              {DEMO_REPS.map((rep, i) => (
                <motion.div
                  key={rep.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
                  style={i === 0 ? { borderLeft: `3px solid ${accentColor}` } : {}}
                >
                  <div className="text-zinc-400 font-mono text-sm w-5 text-center">{i + 1}</div>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold shrink-0" style={i === 0 ? { backgroundColor: accentColor, color: '#000' } : {}}>
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

      {/* Prizes Tab */}
      {activeTab === 'prizes' && (
        <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>Prizes &amp; Rewards</h2>
            {isAdmin && (
              <button
                onClick={() => setShowAddPrize(v => !v)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium text-black"
                style={{ backgroundColor: 'var(--accent-color)' }}
              >
                {showAddPrize ? 'Cancel' : '+ Add Prize'}
              </button>
            )}
          </div>

          {showAddPrize && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">New Prize</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 col-span-2"
                  placeholder="Prize title (e.g. AirPods Pro)"
                  value={newPrize.title}
                  onChange={e => setNewPrize(p => ({ ...p, title: e.target.value }))}
                />
                <input
                  className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 col-span-2"
                  placeholder="Description"
                  value={newPrize.description}
                  onChange={e => setNewPrize(p => ({ ...p, description: e.target.value }))}
                />
                <input
                  className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="Icon (emoji)"
                  value={newPrize.icon}
                  onChange={e => setNewPrize(p => ({ ...p, icon: e.target.value }))}
                />
                <input
                  type="number"
                  className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="Milestone value"
                  value={newPrize.milestone}
                  onChange={e => setNewPrize(p => ({ ...p, milestone: e.target.value }))}
                />
                <select
                  className="bg-zinc-900 rounded-xl px-3 py-2 text-sm text-white border border-white/10 col-span-2"
                  value={newPrize.milestoneType}
                  onChange={e => setNewPrize(p => ({ ...p, milestoneType: e.target.value as Prize['milestoneType'] }))}
                >
                  <option value="closes">Milestone type: Closes</option>
                  <option value="revenue">Milestone type: Revenue ($)</option>
                  <option value="xp">Milestone type: XP</option>
                </select>
              </div>
              <button onClick={addPrize} className="px-4 py-2 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>
                Add Prize
              </button>
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
                <div key={prize.id} className={`glass rounded-2xl p-5 transition-all`} style={unlocked ? { outline: `1px solid ${accentColor}` } : {}}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-2xl mb-1">{prize.icon}</div>
                      <div className="font-semibold">{prize.title}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">{prize.description}</div>
                    </div>
                    {unlocked && (
                      <span className="text-xs font-bold px-2 py-1 rounded-lg text-black" style={{ backgroundColor: 'var(--accent-color)' }}>
                        Unlocked!
                      </span>
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Progress</span>
                      <span>
                        {prize.milestoneType === 'revenue' ? formatCurrency(myVal) : myVal} / {prize.milestoneType === 'revenue' ? formatCurrency(prize.milestone) : prize.milestone} {prize.milestoneType}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: 'var(--accent-color)' }}
                      />
                    </div>
                    <div className="text-right text-xs mt-1" style={{ color: 'var(--accent-color)' }}>{pct}%</div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <motion.div className="space-y-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-color)' }}>KPI Goals &amp; Targets</h2>
            <button
              onClick={() => setShowAddGoal(v => !v)}
              className="px-3 py-1.5 rounded-xl text-sm font-medium text-black"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              {showAddGoal ? 'Cancel' : '+ Set Goal'}
            </button>
          </div>

          {showAddGoal && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-zinc-300">New Goal</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30 col-span-2"
                  placeholder="Goal title (e.g. Monthly Closes)"
                  value={newGoal.title}
                  onChange={e => setNewGoal(g => ({ ...g, title: e.target.value }))}
                />
                <input
                  type="number"
                  className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="Target value"
                  value={newGoal.target}
                  onChange={e => setNewGoal(g => ({ ...g, target: e.target.value }))}
                />
                <input
                  className="bg-white/5 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-white/30"
                  placeholder="Unit (closes, $, comps...)"
                  value={newGoal.unit}
                  onChange={e => setNewGoal(g => ({ ...g, unit: e.target.value }))}
                />
                <select
                  className="bg-zinc-900 rounded-xl px-3 py-2 text-sm text-white border border-white/10 col-span-2"
                  value={newGoal.period}
                  onChange={e => setNewGoal(g => ({ ...g, period: e.target.value as KPIGoal['period'] }))}
                >
                  <option value="daily">Period: Daily</option>
                  <option value="weekly">Period: Weekly</option>
                  <option value="monthly">Period: Monthly</option>
                  <option value="quarterly">Period: Quarterly</option>
                </select>
              </div>
              <button onClick={addGoal} className="px-4 py-2 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: 'var(--accent-color)' }}>
                Add Goal
              </button>
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
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      style={{ backgroundColor: color }}
                    />
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
    </div>
  )
}
