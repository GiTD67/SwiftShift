import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface XPCenterProps {
  gState: {
    totalXP: number
    streak: number
    submits: number
    weekSubmitStreak: number
    perfectPeriods: number
    weeklyChallenge: { weekId: string; targetHours: number; bonusXP: number; completed: boolean } | null
    bossChallenge: { fromLevel: number; toLevel: number; req: string; progress: number; target: number; completed: boolean } | null
  }
  currentLevel: { level: number; name: string; xpNeeded: number }
  nextLevel: { level: number; name: string; xpNeeded: number }
  users: any[]
  accentColor: string
  totalHoursThisWeek: number
}

function getWeekMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  return monday.toISOString().slice(0, 10)
}

const XP_LEVELS_LOCAL = [
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

const BOSS_CHALLENGES = [
  { fromLevel: 3, toLevel: 4, req: 'Complete 2 perfect periods', shortReq: 'perfectPeriods', target: 2 },
  { fromLevel: 6, toLevel: 7, req: 'Submit 3 periods in a row', shortReq: 'streak', target: 3 },
  { fromLevel: 8, toLevel: 9, req: 'Earn 1500 XP', shortReq: 'totalXP', target: 1500 },
]

const DEPT_CHALLENGES = [
  { dept: 'Engineering', targetHours: 400, icon: '⚙️' },
  { dept: 'Sales', targetHours: 320, icon: '📊' },
  { dept: 'Design', targetHours: 240, icon: '🎨' },
  { dept: 'Operations', targetHours: 280, icon: '🔧' },
]

const SHOP_ITEMS = [
  { id: 'coffee', name: 'Coffee Gift Card', xpCost: 1000, icon: '☕', desc: '$10 coffee shop gift card' },
  { id: 'extra_pto', name: '2hr PTO Bonus', xpCost: 2000, icon: '🌴', desc: '2 extra hours of PTO' },
  { id: 'swag_shirt', name: 'Company T-Shirt', xpCost: 1500, icon: '👕', desc: 'SwiftShift branded tee' },
  { id: 'amazon', name: 'Amazon Gift Card', xpCost: 3000, icon: '📦', desc: '$25 Amazon gift card' },
  { id: 'charity', name: 'Charity Donation', xpCost: 500, icon: '💝', desc: '$5 donated to your chosen charity' },
  { id: 'remote_day', name: 'Extra Remote Day', xpCost: 2500, icon: '🏠', desc: 'One additional WFH day this month' },
]

export function XPCenter({ gState, currentLevel, nextLevel, users, accentColor, totalHoursThisWeek }: XPCenterProps) {
  const weekId = getWeekMonday()
  const weeklyTargetHours = 40
  const weeklyBonusXP = 100
  const weeklyCompleted = gState.weeklyChallenge?.weekId === weekId && gState.weeklyChallenge.completed
  const weeklyProgress = Math.min(100, (totalHoursThisWeek / weeklyTargetHours) * 100)

  const streakMultiplier = currentLevel.level >= 5 && gState.weekSubmitStreak >= 2 ? 1.5 : 1

  const bossChallenge = BOSS_CHALLENGES.find(b => b.fromLevel === currentLevel.level)
  const bossProgress = bossChallenge
    ? bossChallenge.shortReq === 'perfectPeriods' ? gState.perfectPeriods
    : bossChallenge.shortReq === 'streak' ? gState.streak
    : gState.totalXP - currentLevel.xpNeeded
    : 0

  const leaderboard = users.length > 0
    ? [...users].map(u => ({
        id: u.id,
        name: `${u.first_name} ${u.last_name}`,
        xp: u.id === (users[0]?.id || -1) ? gState.totalXP : ((u.id * 137 + u.id * 31) % 3000) + 200,
      })).sort((a, b) => b.xp - a.xp).slice(0, 8)
    : []

  const deptProgress = DEPT_CHALLENGES.map(d => ({
    ...d,
    currentHours: Math.floor((d.targetHours * 0.3) + (d.targetHours * 0.4)),
  }))

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">

      {/* ─── GAMEPLAY LOOPS ─── */}
      <div className="glass rounded-3xl p-6">
        <div className="text-lg font-semibold mb-4" style={{ color: accentColor }}>Gameplay Loops</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Weekly Challenge */}
          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-[2px] text-zinc-400 mb-2">Weekly Challenge</div>
            <div className="text-sm font-semibold text-white mb-1">Log {weeklyTargetHours}h this week</div>
            <div className="text-xs text-zinc-500 mb-3">+{weeklyBonusXP} XP bonus · Resets Monday</div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
              <motion.div
                className="h-full rounded-full"
                style={{ background: accentColor }}
                initial={{ width: 0 }}
                animate={{ width: `${weeklyProgress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">{totalHoursThisWeek.toFixed(1)}h logged</span>
              <span style={{ color: weeklyCompleted ? accentColor : 'inherit' }}>{weeklyCompleted ? '✓ Claimed' : `${weeklyTargetHours}h goal`}</span>
            </div>
          </div>

          {/* Streak Multiplier */}
          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-[2px] text-zinc-400 mb-2">XP Multiplier</div>
            <div className="text-3xl font-bold tabular-nums mb-1" style={{ color: streakMultiplier > 1 ? accentColor : 'white' }}>
              {streakMultiplier}×
            </div>
            <div className="text-xs text-zinc-500 mb-2">
              {currentLevel.level < 5
                ? `Unlock at Level 5 (${nextLevel.xpNeeded - gState.totalXP} XP to go)`
                : gState.weekSubmitStreak < 2
                ? `Submit 2 weeks in a row to activate (${gState.weekSubmitStreak}/2)`
                : '🔥 Active: submit weekly to keep it!'}
            </div>
            <div className="text-[10px] text-zinc-600">Level 5+ · 2 consecutive weekly submits</div>
          </div>

          {/* Boss Challenge */}
          <div className="glass rounded-2xl p-5">
            <div className="text-xs uppercase tracking-[2px] text-zinc-400 mb-2">Level-Up Challenge</div>
            {bossChallenge ? (
              <>
                <div className="text-xs font-semibold text-white mb-1">{bossChallenge.req}</div>
                <div className="text-xs text-zinc-500 mb-3">Required to reach Level {bossChallenge.toLevel}</div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: accentColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (bossProgress / bossChallenge.target) * 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <div className="text-xs text-zinc-500">{bossProgress} / {bossChallenge.target}</div>
              </>
            ) : (
              <div>
                <div className="text-xs font-semibold text-white mb-1">No challenge active</div>
                <div className="text-xs text-zinc-500">Challenges unlock at key level milestones</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── TEAM LEADERBOARD ─── */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold" style={{ color: accentColor }}>Team Leaderboard</div>
          <div className="text-xs text-zinc-500">All-time XP ranking</div>
        </div>
        {leaderboard.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-6">No team data yet. Team members appear here as they join.</div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const lvl = [...XP_LEVELS_LOCAL].reverse().find(l => entry.xp >= l.xpNeeded) || XP_LEVELS_LOCAL[0]
              const isMe = entry.xp === gState.totalXP
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-2xl`}
                  style={isMe ? { background: `${accentColor}10`, border: `1px solid ${accentColor}30` } : { background: 'rgba(255,255,255,0.04)' }}
                >
                  <div className="w-6 text-center text-sm font-bold text-zinc-500">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                  </div>
                  <div
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold"
                    style={{
                      backgroundColor: isMe ? accentColor : undefined,
                      color: isMe ? '#000' : undefined,
                      boxShadow: `0 0 0 2px ${LEVEL_RING_COLORS[Math.min(lvl.level, 10)] || '#6B7280'}${isMe ? `, 0 0 6px ${LEVEL_RING_COLORS[Math.min(lvl.level, 10)] || '#6B7280'}` : ''}`,
                    }}
                  >
                    {entry.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{entry.name} {isMe ? '(You)' : ''}</div>
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: LEVEL_RING_COLORS[Math.min(lvl.level, 10)] || '#6B7280' }}
                      />
                      Lv.{lvl.level} {lvl.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums" style={isMe ? { color: accentColor } : { color: 'white' }}>{entry.xp.toLocaleString()} XP</div>
                    <div className="text-[10px] text-zinc-500">
                      <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (entry.xp / 3200) * 100)}%`, backgroundColor: isMe ? accentColor : 'rgba(255,255,255,0.3)' }} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── DEPARTMENT CHALLENGES ─── */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold" style={{ color: accentColor }}>Department Challenges</div>
          <div className="text-xs text-zinc-500">Weekly collective goals, resets Monday</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {deptProgress.map(dept => {
            const pct = Math.min(100, (dept.currentHours / dept.targetHours) * 100)
            return (
              <div key={dept.dept} className="glass rounded-2xl p-4">
                <div className="text-2xl mb-2">{dept.icon}</div>
                <div className="text-sm font-semibold mb-0.5">{dept.dept}</div>
                <div className="text-xs text-zinc-500 mb-2">{dept.currentHours}h / {dept.targetHours}h goal</div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: pct >= 100 ? accentColor : `linear-gradient(90deg, ${accentColor}80, ${accentColor})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500 mt-1 text-right">{Math.round(pct)}%</div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 text-xs text-zinc-600 text-center">Team XP bonus awarded when department reaches 100% of weekly goal</div>
      </div>

      {/* ─── REWARDS SHOP ─── */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold" style={{ color: accentColor }}>Rewards Shop</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Your balance:</span>
            <span className="text-sm font-bold" style={{ color: accentColor }}>{gState.totalXP.toLocaleString()} XP</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SHOP_ITEMS.map(item => {
            const canAfford = gState.totalXP >= item.xpCost
            return (
              <div key={item.id} className={`glass rounded-2xl p-4 flex flex-col gap-2 transition-all ${canAfford ? '' : 'opacity-60'}`}
                style={canAfford ? { border: `1px solid ${accentColor}20` } : {}}>
                <div className="text-3xl">{item.icon}</div>
                <div className="text-sm font-semibold">{item.name}</div>
                <div className="text-xs text-zinc-500 flex-1">{item.desc}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs font-bold" style={{ color: accentColor }}>{item.xpCost.toLocaleString()} XP</span>
                  <button
                    disabled={!canAfford}
                    className="text-xs px-3 py-1 rounded-xl font-medium transition-all disabled:cursor-not-allowed"
                    style={canAfford ? { backgroundColor: accentColor, color: '#000' } : { backgroundColor: 'rgba(255,255,255,0.1)', color: '#666' }}
                    onClick={() => {
                      if (canAfford) {
                        toast.success(`${item.icon} Redemption submitted!`, { description: `${item.name}. HR will process within 2 business days.` })
                      }
                    }}
                  >
                    {canAfford ? 'Redeem' : 'Need more XP'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 text-xs text-zinc-600 text-center">Redemptions require employer configuration · Contact HR to enable</div>
      </div>

    </div>
  )
}
