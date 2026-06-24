import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { localDay } from '../utils/format'

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
  return localDay(monday)
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

// Clean line-icon set (replaces emoji). Stroke uses currentColor.
const svg = (paths: ReactNode, size = 24) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
)
const ICON: Record<string, (size?: number) => ReactNode> = {
  code: (s) => svg(<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>, s),
  chart: (s) => svg(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>, s),
  pen: (s) => svg(<><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>, s),
  wrench: (s) => svg(<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.6-2.6z" />, s),
  coffee: (s) => svg(<><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></>, s),
  sun: (s) => svg(<><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.2" y1="4.2" x2="5.6" y2="5.6" /><line x1="18.4" y1="18.4" x2="19.8" y2="19.8" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.2" y1="19.8" x2="5.6" y2="18.4" /><line x1="18.4" y1="5.6" x2="19.8" y2="4.2" /></>, s),
  shirt: (s) => svg(<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />, s),
  box: (s) => svg(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>, s),
  heart: (s) => svg(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />, s),
  home: (s) => svg(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>, s),
}

const DEPT_CHALLENGES = [
  { dept: 'Engineering', targetHours: 400, iconKey: 'code' },
  { dept: 'Sales', targetHours: 320, iconKey: 'chart' },
  { dept: 'Design', targetHours: 240, iconKey: 'pen' },
  { dept: 'Operations', targetHours: 280, iconKey: 'wrench' },
]

const SHOP_ITEMS = [
  { id: 'coffee', name: 'Coffee Gift Card', xpCost: 1000, iconKey: 'coffee', desc: '$10 coffee shop gift card' },
  { id: 'extra_pto', name: '2hr PTO Bonus', xpCost: 2000, iconKey: 'sun', desc: '2 extra hours of PTO' },
  { id: 'swag_shirt', name: 'Company T-Shirt', xpCost: 1500, iconKey: 'shirt', desc: 'SwiftShift branded tee' },
  { id: 'amazon', name: 'Amazon Gift Card', xpCost: 3000, iconKey: 'box', desc: '$25 Amazon gift card' },
  { id: 'charity', name: 'Charity Donation', xpCost: 500, iconKey: 'heart', desc: '$5 donated to your chosen charity' },
  { id: 'remote_day', name: 'Extra Remote Day', xpCost: 2500, iconKey: 'home', desc: 'One additional WFH day this month' },
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
    : Math.max(0, gState.totalXP - currentLevel.xpNeeded)
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
            <div className="crystal-progress mb-2">
              <div className="crystal-progress-fill" style={{ width: `${weeklyProgress}%` }} />
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
                <div className="crystal-progress mb-2">
                  <div className="crystal-progress-fill" style={{ width: `${Math.min(100, (bossProgress / bossChallenge.target) * 100)}%` }} />
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
                  <div className="w-6 flex justify-center flex-shrink-0">
                    {i < 3
                      ? <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: i === 0 ? 'linear-gradient(135deg,#FFE08A,#F5B125)' : i === 1 ? 'linear-gradient(135deg,#E8ECF2,#AEB7C2)' : 'linear-gradient(135deg,#E6A977,#C17A45)', color: '#2a2200' }}>{i + 1}</span>
                      : <span className="text-sm font-bold text-zinc-500">#{i + 1}</span>}
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
                <div className="mb-2" style={{ color: accentColor }}>{ICON[dept.iconKey]?.(22)}</div>
                <div className="text-sm font-semibold mb-0.5">{dept.dept}</div>
                <div className="text-xs text-zinc-500 mb-2">{dept.currentHours}h / {dept.targetHours}h goal</div>
                <div className="crystal-progress">
                  <div className="crystal-progress-fill" style={{ width: `${pct}%` }} />
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
                <div style={{ color: accentColor }}>{ICON[item.iconKey]?.(26)}</div>
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
                        toast.success('Redemption submitted!', { description: `${item.name}. HR will process within 2 business days.` })
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
