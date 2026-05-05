import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface LeaderboardProps {
  gState: {
    totalXP: number
    streak: number
    submits: number
    perfectPeriods: number
    weekSubmitStreak: number
  }
  currentLevel: { level: number; name: string; xpNeeded: number }
  users: any[]
  accentColor: string
  user: any
  totalHoursThisWeek: number
  isAdmin?: boolean
}

type Category = 'xp' | 'hours' | 'submissions' | 'custom'
type Period = 'week' | 'month' | 'alltime'

interface CustomMetric {
  id: string
  name: string
  description: string
  unit: string
  icon: string
  target: number
}

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

const LEVEL_RING_COLORS: Record<number, string> = {
  1: '#6B7280', 2: '#22C55E', 3: '#3B82F6', 4: '#EAB308',
  5: '#F97316', 6: '#A855F7', 7: '#F59E0B', 8: '#EF4444',
  9: '#EC4899', 10: '#FFD700',
}

function getTier(xp: number) {
  if (xp >= 3200) return { name: 'Legend', color: '#FFD700' }
  if (xp >= 2000) return { name: 'Platinum', color: '#E5E4E2' }
  if (xp >= 1000) return { name: 'Gold', color: '#F59E0B' }
  if (xp >= 500) return { name: 'Silver', color: '#94A3B8' }
  return { name: 'Bronze', color: '#CD7F32' }
}

function simXP(uid: number) {
  return ((uid * 137 + uid * 31) % 3000) + 200
}

function simHoursWeek(uid: number) {
  return Math.round(((uid * 73 + uid * 17) % 30 + 20) * 10) / 10
}

function simHoursMonth(uid: number) {
  return Math.round(((uid * 91 + uid * 29) % 80 + 60) * 10) / 10
}

function simSubmissionsWeek(uid: number) {
  return (uid * 43 + 3) % 4 + 1
}

function simSubmissionsMonth(uid: number) {
  return (uid * 37 + 7) % 12 + 4
}

function simCustomMetric(uid: number, metricIdx: number, target: number) {
  return Math.round(((uid * (37 + metricIdx * 13) + uid * (19 + metricIdx * 7)) % target) + target * 0.1)
}

const DEFAULT_METRICS: CustomMetric[] = [
  { id: 'quality', name: 'Quality Score', description: 'Average task quality rating from peer reviews', unit: '%', icon: '', target: 100 },
  { id: 'punctuality', name: 'Punctuality', description: 'On-time clock-in rate', unit: '%', icon: '', target: 100 },
]

function loadCustomMetrics(): CustomMetric[] {
  try {
    const s = localStorage.getItem('swiftshift-leaderboard-metrics')
    return s ? JSON.parse(s) : DEFAULT_METRICS
  } catch {
    return DEFAULT_METRICS
  }
}

function saveCustomMetrics(metrics: CustomMetric[]) {
  localStorage.setItem('swiftshift-leaderboard-metrics', JSON.stringify(metrics))
}

const BLANK_METRIC: Omit<CustomMetric, 'id'> = { name: '', description: '', unit: '', icon: '', target: 100 }

export function Leaderboard({ gState, users, accentColor, user, totalHoursThisWeek, isAdmin }: LeaderboardProps) {
  const [category, setCategory] = useState<Category>('xp')
  const [period, setPeriod] = useState<Period>('alltime')
  const [selectedCustomMetric, setSelectedCustomMetric] = useState(0)
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>(loadCustomMetrics)
  const [showMetricForm, setShowMetricForm] = useState(false)
  const [editingMetric, setEditingMetric] = useState<CustomMetric | null>(null)
  const [metricDraft, setMetricDraft] = useState<Omit<CustomMetric, 'id'>>(BLANK_METRIC)

  const myId = user?.id ?? -1

  const entries = useMemo(() => {
    if (users.length === 0) return []

    return users.map(u => {
      const isMe = u.id === myId
      const xp = isMe ? gState.totalXP : simXP(u.id)
      const lvl = [...XP_LEVELS].reverse().find(l => xp >= l.xpNeeded) || XP_LEVELS[0]
      const tier = getTier(xp)

      let score = 0
      let displayValue = ''

      if (category === 'xp') {
        score = xp
        displayValue = `${xp.toLocaleString()} XP`
      } else if (category === 'hours') {
        const hrs = isMe
          ? (period === 'week' ? totalHoursThisWeek : totalHoursThisWeek * 4)
          : (period === 'week' ? simHoursWeek(u.id) : simHoursMonth(u.id))
        score = hrs
        displayValue = `${hrs.toFixed(1)} hrs`
      } else if (category === 'submissions') {
        const subs = isMe
          ? (period === 'week' ? gState.submits % 5 : gState.submits)
          : (period === 'week' ? simSubmissionsWeek(u.id) : simSubmissionsMonth(u.id))
        score = subs
        displayValue = `${subs} submitted`
      } else if (category === 'custom') {
        const metric = customMetrics[selectedCustomMetric]
        if (metric) {
          const val = simCustomMetric(u.id, selectedCustomMetric, metric.target)
          score = val
          displayValue = `${val}${metric.unit}`
        }
      }

      return {
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        jobRole: u.job_role || '',
        xp,
        lvl,
        tier,
        score,
        displayValue,
        isMe,
      }
    }).sort((a, b) => b.score - a.score)
  }, [users, category, period, gState, myId, totalHoursThisWeek, customMetrics, selectedCustomMetric])

  const myRank = entries.findIndex(e => e.isMe) + 1
  const myEntry = entries.find(e => e.isMe)

  const maxScore = entries[0]?.score || 1

  const catLabels: { id: Category; label: string }[] = [
    { id: 'xp', label: 'XP Ranking' },
    { id: 'hours', label: 'Hours Worked' },
    { id: 'submissions', label: 'Timesheets' },
    { id: 'custom', label: 'Custom Metrics' },
  ]

  const periodLabels: { id: Period; label: string }[] = [
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'alltime', label: 'All Time' },
  ]

  function handleSaveMetric() {
    if (!metricDraft.name.trim()) { toast.error('Metric name is required'); return }
    const updated = editingMetric
      ? customMetrics.map(m => m.id === editingMetric.id ? { ...metricDraft, id: editingMetric.id } : m)
      : [...customMetrics, { ...metricDraft, id: Date.now().toString() }]
    setCustomMetrics(updated)
    saveCustomMetrics(updated)
    setShowMetricForm(false)
    setEditingMetric(null)
    setMetricDraft(BLANK_METRIC)
    toast.success(editingMetric ? 'Metric updated' : 'Custom metric added!')
  }

  function handleDeleteMetric(id: string) {
    const updated = customMetrics.filter(m => m.id !== id)
    setCustomMetrics(updated)
    saveCustomMetrics(updated)
    setSelectedCustomMetric(0)
    toast.success('Metric removed')
  }

  return (
    <div className="max-w-[1100px] mx-auto space-y-4">

      {/* ── Header ── */}
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-bold" style={{ color: accentColor }}>Leaderboard</div>
            <div className="text-sm text-zinc-400 mt-0.5">Compete, improve, and earn rewards</div>
          </div>
          {myEntry && (
            <div className="flex items-center gap-3 glass rounded-2xl px-4 py-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: accentColor, color: '#000', boxShadow: `0 0 0 2px ${LEVEL_RING_COLORS[Math.min(myEntry.lvl.level, 10)]}` }}
              >
                {myEntry.name[0]}
              </div>
              <div>
                <div className="text-xs text-zinc-400">Your rank</div>
                <div className="text-lg font-bold tabular-nums" style={{ color: accentColor }}>
                  #{myRank}
                </div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <div className="text-xs text-zinc-400">{myEntry.tier.name}</div>
                <div className="text-sm font-semibold">{myEntry.displayValue}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Category + Period ── */}
      <div className="glass rounded-3xl p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {catLabels.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={category === cat.id
                ? { backgroundColor: accentColor, color: '#000' }
                : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {category !== 'xp' && (
          <div className="flex gap-2">
            {periodLabels.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={period === p.id
                  ? { backgroundColor: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }
                  : { backgroundColor: 'transparent', color: '#71717a', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Custom Metric Selector ── */}
      {category === 'custom' && (
        <div className="glass rounded-3xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="text-sm font-semibold" style={{ color: accentColor }}>Company Metrics</div>
            {isAdmin && (
              <button
                onClick={() => { setEditingMetric(null); setMetricDraft(BLANK_METRIC); setShowMetricForm(v => !v) }}
                className="text-xs px-3 py-1 rounded-lg font-medium"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}30` }}
              >
                {showMetricForm ? 'Cancel' : '+ Add Metric'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {customMetrics.map((m, i) => (
              <div key={m.id} className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedCustomMetric(i)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={selectedCustomMetric === i
                    ? { backgroundColor: accentColor, color: '#000' }
                    : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }}
                >
                  {m.name}
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => { setEditingMetric(m); setMetricDraft({ name: m.name, description: m.description, unit: m.unit, icon: m.icon, target: m.target }); setShowMetricForm(true) }}
                      className="text-zinc-500 hover:text-zinc-300 text-xs px-1"
                      title="Edit"
                    >✎</button>
                    <button
                      onClick={() => handleDeleteMetric(m.id)}
                      className="text-zinc-600 hover:text-red-400 text-xs px-1"
                      title="Delete"
                    >✕</button>
                  </>
                )}
              </div>
            ))}
            {customMetrics.length === 0 && (
              <div className="text-sm text-zinc-500">No custom metrics yet. {isAdmin ? 'Add one above.' : 'Ask your manager to add metrics.'}</div>
            )}
          </div>

          {customMetrics[selectedCustomMetric] && (
            <div className="text-xs text-zinc-500">{customMetrics[selectedCustomMetric].description} · Target: {customMetrics[selectedCustomMetric].target}{customMetrics[selectedCustomMetric].unit}</div>
          )}

          <AnimatePresence>
            {showMetricForm && isAdmin && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4 glass rounded-2xl p-4 space-y-3"
              >
                <div className="text-sm font-semibold mb-2" style={{ color: accentColor }}>{editingMetric ? 'Edit Metric' : 'New Metric'}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Name</label>
                    <input
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
                      value={metricDraft.name}
                      onChange={e => setMetricDraft(d => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. Sales Calls"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Icon (emoji)</label>
                    <input
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
                      value={metricDraft.icon}
                      onChange={e => setMetricDraft(d => ({ ...d, icon: e.target.value }))}
                      placeholder="📊"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Unit</label>
                    <input
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
                      value={metricDraft.unit}
                      onChange={e => setMetricDraft(d => ({ ...d, unit: e.target.value }))}
                      placeholder="%, calls, pts…"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Target Value</label>
                    <input
                      type="number"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
                      value={metricDraft.target}
                      onChange={e => setMetricDraft(d => ({ ...d, target: Number(e.target.value) || 100 }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Description</label>
                  <input
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm"
                    value={metricDraft.description}
                    onChange={e => setMetricDraft(d => ({ ...d, description: e.target.value }))}
                    placeholder="How is this metric calculated?"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowMetricForm(false); setEditingMetric(null) }} className="text-xs px-4 py-1.5 rounded-lg bg-white/5 text-zinc-400">Cancel</button>
                  <button onClick={handleSaveMetric} className="text-xs px-4 py-1.5 rounded-lg font-medium" style={{ backgroundColor: accentColor, color: '#000' }}>Save Metric</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Podium top 3 ── */}
      {entries.length >= 3 && (
        <div className="glass rounded-3xl p-6">
          <div className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-widest text-center">Top Performers</div>
          <div className="flex items-end justify-center gap-3">
            {/* 2nd place */}
            {(() => {
              const e = entries[1]
              return (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col items-center gap-2 flex-1 max-w-[140px]">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: e.isMe ? accentColor : 'rgba(255,255,255,0.1)', color: e.isMe ? '#000' : 'white', boxShadow: `0 0 0 2px ${LEVEL_RING_COLORS[Math.min(e.lvl.level, 10)]}` }}
                  >
                    {e.name[0]}
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold truncate max-w-[120px]">{e.name}{e.isMe ? ' (You)' : ''}</div>
                    <div className="text-[10px] text-zinc-500">{e.tier.name}</div>
                    <div className="text-xs font-bold mt-0.5" style={e.isMe ? { color: accentColor } : {}}>{e.displayValue}</div>
                  </div>
                  <div className="w-full h-16 rounded-t-xl flex items-end justify-center pb-2" style={{ backgroundColor: 'rgba(148,163,184,0.15)' }}>
                    <span className="text-zinc-400 font-bold text-lg">#2</span>
                  </div>
                </motion.div>
              )
            })()}

            {/* 1st place */}
            {(() => {
              const e = entries[0]
              return (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="flex flex-col items-center gap-2 flex-1 max-w-[160px]">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ backgroundColor: e.isMe ? accentColor : '#FFD700', color: '#000', boxShadow: `0 0 12px ${LEVEL_RING_COLORS[Math.min(e.lvl.level, 10)]}, 0 0 0 2px ${LEVEL_RING_COLORS[Math.min(e.lvl.level, 10)]}` }}
                  >
                    {e.name[0]}
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold truncate max-w-[140px]">{e.name}{e.isMe ? ' (You)' : ''}</div>
                    <div className="text-[10px] text-zinc-400">{e.tier.name}</div>
                    <div className="text-sm font-bold mt-0.5" style={{ color: accentColor }}>{e.displayValue}</div>
                  </div>
                  <div className="w-full h-24 rounded-t-xl flex items-end justify-center pb-2" style={{ backgroundColor: `${accentColor}18` }}>
                    <span className="font-bold text-2xl" style={{ color: accentColor }}>#1</span>
                  </div>
                </motion.div>
              )
            })()}

            {/* 3rd place */}
            {(() => {
              const e = entries[2]
              return (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col items-center gap-2 flex-1 max-w-[140px]">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: e.isMe ? accentColor : 'rgba(255,255,255,0.1)', color: e.isMe ? '#000' : 'white', boxShadow: `0 0 0 2px ${LEVEL_RING_COLORS[Math.min(e.lvl.level, 10)]}` }}
                  >
                    {e.name[0]}
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-semibold truncate max-w-[120px]">{e.name}{e.isMe ? ' (You)' : ''}</div>
                    <div className="text-[10px] text-zinc-500">{e.tier.name}</div>
                    <div className="text-xs font-bold mt-0.5" style={e.isMe ? { color: accentColor } : {}}>{e.displayValue}</div>
                  </div>
                  <div className="w-full h-10 rounded-t-xl flex items-end justify-center pb-2" style={{ backgroundColor: 'rgba(205,127,50,0.12)' }}>
                    <span className="text-amber-700 font-bold text-lg">#3</span>
                  </div>
                </motion.div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Full Rankings ── */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold" style={{ color: accentColor }}>
            Full Rankings
          </div>
          <div className="text-xs text-zinc-500">
            {entries.length} employees
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-8">No team data yet. Employees appear here as they join.</div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const pct = maxScore > 0 ? (entry.score / maxScore) * 100 : 0
              const medal = i < 3 ? `#${i + 1}` : null

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="rounded-2xl overflow-hidden"
                  style={entry.isMe
                    ? { background: `${accentColor}0e`, border: `1px solid ${accentColor}30` }
                    : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-7 text-center text-sm font-bold text-zinc-500 shrink-0">
                      {medal ?? `#${i + 1}`}
                    </div>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        backgroundColor: entry.isMe ? accentColor : undefined,
                        color: entry.isMe ? '#000' : undefined,
                        boxShadow: `0 0 0 2px ${LEVEL_RING_COLORS[Math.min(entry.lvl.level, 10)]}`,
                        background: entry.isMe ? accentColor : `rgba(255,255,255,0.08)`,
                      }}
                    >
                      {entry.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{entry.name}{entry.isMe ? ' (You)' : ''}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: `${LEVEL_RING_COLORS[Math.min(entry.lvl.level, 10)]}20`, color: LEVEL_RING_COLORS[Math.min(entry.lvl.level, 10)] }}>
                          Lv.{entry.lvl.level} {entry.lvl.name}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">{entry.jobRole || 'Employee'} · {entry.tier.name}</div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1.5">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: entry.isMe ? accentColor : LEVEL_RING_COLORS[Math.min(entry.lvl.level, 10)] + '80' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: Math.min(i * 0.03, 0.3) }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums" style={entry.isMe ? { color: accentColor } : { color: 'white' }}>
                        {entry.displayValue}
                      </div>
                      <div className="text-[10px] text-zinc-500">{Math.round(pct)}% of leader</div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Tier Distribution ── */}
      {entries.length > 0 && (
        <div className="glass rounded-3xl p-6">
          <div className="text-lg font-semibold mb-4" style={{ color: accentColor }}>League Tiers</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(['Legend', 'Platinum', 'Gold', 'Silver', 'Bronze'] as const).map(tierName => {
              const tierEntries = entries.filter(e => e.tier.name === tierName)
              const tierInfo = {
                Legend: { color: '#FFD700', min: '3200+ XP' },
                Platinum: { color: '#E5E4E2', min: '2000+ XP' },
                Gold: { color: '#F59E0B', min: '1000+ XP' },
                Silver: { color: '#94A3B8', min: '500+ XP' },
                Bronze: { color: '#CD7F32', min: '0+ XP' },
              }[tierName]
              return (
                <div key={tierName} className="glass rounded-2xl p-4 text-center">
                  <div className="text-sm font-semibold" style={{ color: tierInfo.color }}>{tierName}</div>
                  <div className="text-xs text-zinc-500 mb-2">{tierInfo.min}</div>
                  <div className="text-2xl font-bold tabular-nums" style={{ color: tierInfo.color }}>{tierEntries.length}</div>
                  <div className="text-[10px] text-zinc-600">{tierEntries.length === 1 ? 'employee' : 'employees'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="text-center text-xs text-zinc-600 pb-2">
        Leaderboard data refreshes in real time · XP is earned by clocking in, submitting timesheets, and completing challenges
      </div>
    </div>
  )
}
