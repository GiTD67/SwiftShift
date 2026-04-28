import { useEffect, useState, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'

const AchievementIcons: Record<string, React.ReactNode> = {
  lightning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  century: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  flame: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2c0 0-6 6.5-6 11a6 6 0 0012 0C18 8.5 12 2 12 2zm0 3c0 0 3.5 4.5 3.5 8a3.5 3.5 0 01-7 0C8.5 9.5 12 5 12 5zm0 3.5c0 0-2 2.5-2 4.5a2 2 0 004 0C14 11 12 8.5 12 8.5z"/>
    </svg>
  ),
  target: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  diamond: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
      <line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="8.5" x2="22" y2="8.5"/>
    </svg>
  ),
  umbrella: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 12a11.05 11.05 0 00-22 0zm-5 7a3 3 0 01-6 0v-7"/>
    </svg>
  ),
}

interface RewardsProps {
  totalHours: number
  elapsedSeconds: number
  isClockedIn: boolean
  theme?: 'green' | 'white' | 'orange' | 'cyan' | 'pink' | 'purple'
  user?: any
  onFocus?: () => void
  highlightRate?: boolean
  onRateChange?: (rate: number) => void
  xpTotalForPTO?: number
}

const HOURLY_RATE_KEY = 'swiftshift-hourly-rate'

function computeHourlyRate(user: any): number {
  const saved = localStorage.getItem(HOURLY_RATE_KEY)
  if (saved) return parseFloat(saved)
  const salary = Number(user?.salary) || 0
  if (salary > 0) return salary / 2080
  const pay = Number(user?.pay)
  return pay > 0 ? pay : 65
}

const LEVEL_NAMES = ['Rookie', 'Associate', 'Pro', 'Senior', 'Expert', 'Elite', 'Master', 'Legend']

export function Rewards({ totalHours, elapsedSeconds, isClockedIn, theme = 'green', user, onFocus, highlightRate, onRateChange, xpTotalForPTO }: RewardsProps) {
  const [hourlyRate, setHourlyRate] = useState(() => computeHourlyRate(user))
  const [ptoAccrualRate, setPtoAccrualRate] = useState(1 / 30)
  const [dailyGoalHours, setDailyGoalHours] = useState(() => {
    const saved = localStorage.getItem('swiftshift-daily-goal-hours')
    return saved ? parseFloat(saved) : 8
  })
  const [hasFiredConfetti, setHasFiredConfetti] = useState(false)
  const [streak, setStreak] = useState(0)
  const prevCentsRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const rateInputRef = useRef<HTMLInputElement>(null)
  const rateCardRef = useRef<HTMLDivElement>(null)

  const liveTodayEarnings = isClockedIn ? (elapsedSeconds / 3600) * hourlyRate : 0
  const earnedToday = liveTodayEarnings
  const totalEarnings = totalHours * hourlyRate
  const accruedPTO = totalHours * ptoAccrualRate
  const isOvertime = totalHours > 8

  const themeColors: Record<'green' | 'white' | 'orange' | 'cyan' | 'pink' | 'purple', string> = {
    green: '#D7FE51',
    white: '#E5E7EB',
    orange: '#F97316',
    cyan: '#51FEFE',
    pink: '#FE51D7',
    purple: '#9B51FE',
  }
  const accentColor = themeColors[theme]
  const confettiColor = isOvertime ? '#FFAA00' : accentColor

  // Gamification calculations
  const dailyGoalDollars = hourlyRate * dailyGoalHours
  const dailyGoalProgress = Math.min(100, earnedToday > 0 ? (earnedToday / dailyGoalDollars) * 100 : 0)

  const totalXP = Math.floor(totalHours * 100)
  const level = Math.floor(totalXP / 500) + 1
  const levelName = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)]
  const xpForCurrentLevel = (level - 1) * 500
  const xpProgress = Math.min(100, ((totalXP - xpForCurrentLevel) / 500) * 100)

  const achievements = [
    { id: 'first_shift', label: 'First Shift', iconKey: 'lightning', desc: 'Clock in for the first time', unlocked: totalHours > 0 || isClockedIn },
    { id: 'century', label: 'Century Club', iconKey: 'century', desc: 'Earn $100 in a day', unlocked: earnedToday >= 100 },
    { id: 'overtime', label: 'Overtime Warrior', iconKey: 'flame', desc: 'Work over 9 hours', unlocked: totalHours > 9 },
    { id: 'streak_3', label: 'On a Roll', iconKey: 'target', desc: 'Work 3 days in a row', unlocked: streak >= 3 },
    { id: 'high_earner', label: 'High Earner', iconKey: 'diamond', desc: 'Earn $500 in a week', unlocked: totalEarnings >= 500 },
    { id: 'pto_master', label: 'PTO Hoarder', iconKey: 'umbrella', desc: 'Accrue 1 hour of PTO', unlocked: accruedPTO >= 1 },
  ]

  // Paycheck helpers
  const getPaycheckDates = (year: number, month: number) => {
    let day = 1
    while (new Date(year, month, day).getDay() !== 5) day++
    const secondFriday = new Date(year, month, day + 7)
    const lastDay = new Date(year, month + 1, 0).getDate()
    let lastFridayDate = lastDay
    while (new Date(year, month, lastFridayDate).getDay() !== 5) lastFridayDate--
    return { secondFriday, lastFriday: new Date(year, month, lastFridayDate) }
  }

  const getNextPaycheck = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { secondFriday, lastFriday } = getPaycheckDates(today.getFullYear(), today.getMonth())
    if (today <= secondFriday) return secondFriday
    if (today <= lastFriday) return lastFriday
    return getPaycheckDates(today.getFullYear(), today.getMonth() + 1).secondFriday
  }

  const daysUntilNextPaycheck = () => {
    const next = getNextPaycheck()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.max(0, Math.ceil((next.getTime() - today.getTime()) / 86400000))
  }

  const daysUntil = daysUntilNextPaycheck()
  const paycheckProgress = Math.min(100, ((14 - daysUntil) / 14) * 100)

  // Streak tracking via localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('swiftshift-streak')
      if (stored) {
        const { count, lastDate } = JSON.parse(stored)
        const today = new Date().toDateString()
        const yesterday = new Date(Date.now() - 86400000).toDateString()
        if (lastDate === today || lastDate === yesterday) setStreak(count)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!isClockedIn) return
    try {
      const today = new Date().toDateString()
      const stored = localStorage.getItem('swiftshift-streak')
      if (!stored) {
        localStorage.setItem('swiftshift-streak', JSON.stringify({ count: 1, lastDate: today }))
        setStreak(1)
        return
      }
      const { count, lastDate } = JSON.parse(stored)
      if (lastDate === today) return
      const yesterday = new Date(Date.now() - 86400000).toDateString()
      const newCount = lastDate === yesterday ? count + 1 : 1
      localStorage.setItem('swiftshift-streak', JSON.stringify({ count: newCount, lastDate: today }))
      setStreak(newCount)
    } catch {}
  }, [isClockedIn])

  // Haptic on cent increment
  const triggerHaptic = useCallback((currentCents: number) => {
    if (currentCents !== prevCentsRef.current && 'vibrate' in navigator) {
      try { navigator.vibrate(10) } catch {}
    }
    prevCentsRef.current = currentCents
  }, [])

  useEffect(() => {
    if (!isClockedIn) return
    triggerHaptic(Math.floor(earnedToday * 100) % 100)
  }, [earnedToday, isClockedIn, triggerHaptic])

  // Persist hourly rate changes and notify parent
  useEffect(() => {
    localStorage.setItem(HOURLY_RATE_KEY, String(hourlyRate))
    onRateChange?.(hourlyRate)
  }, [hourlyRate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist daily goal hours
  useEffect(() => {
    localStorage.setItem('swiftshift-daily-goal-hours', String(dailyGoalHours))
  }, [dailyGoalHours])

  // Scroll to and highlight rate input when triggered from clock view
  useEffect(() => {
    if (!highlightRate) return
    const timer = setTimeout(() => {
      rateCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      rateInputRef.current?.focus()
      rateInputRef.current?.select()
    }, 150)
    return () => clearTimeout(timer)
  }, [highlightRate])

  // Confetti on tab focus
  useEffect(() => {
    if (onFocus && !hasFiredConfetti) {
      const timer = setTimeout(() => {
        confetti({ particleCount: 180, spread: 90, origin: { x: 0.5, y: 0.95 }, colors: [confettiColor, '#39FF14', '#00CC00'] })
        setTimeout(() => confetti({ particleCount: 120, spread: 70, angle: 75, origin: { x: 0.3, y: 0.9 }, colors: [confettiColor, '#39FF14'] }), 120)
        setTimeout(() => confetti({ particleCount: 120, spread: 70, angle: 105, origin: { x: 0.7, y: 0.9 }, colors: [confettiColor, '#00CC00'] }), 240)
        setHasFiredConfetti(true)
      }, 80)
      return () => clearTimeout(timer)
    }
  }, [onFocus, hasFiredConfetti, confettiColor])

  useEffect(() => { return () => setHasFiredConfetti(false) }, [])

  return (
    <div ref={containerRef} className="max-w-[1200px] mx-auto space-y-4">

      {/* ═══════════════════════════════════════════
          TOP MODULE — Live Earnings Machine
          ═══════════════════════════════════════════ */}
      <div className="glass rounded-3xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-semibold neon-green">Rewards</div>
          <div className="text-right">
            <div className="text-[10px] text-zinc-500">Weekly earnings</div>
            <div className="font-semibold tabular-nums neon-green">${totalEarnings.toFixed(0)}</div>
          </div>
        </div>

        {/* Three modules side-by-side */}
        <div className="grid grid-cols-3 gap-4 mb-4">

          {/* ── REAL TIME REWARDS ── */}
          <div className="glass rounded-3xl p-6 relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${accentColor}1A 0%, transparent 65%)` }}
            />
            <div className="text-sm uppercase tracking-[2px] text-white mb-1 relative">Real Time Rewards</div>
            <div className="text-xs uppercase tracking-[2px] text-zinc-400 mb-3 relative">Today's Earnings</div>

            {isClockedIn ? (
              <div className="relative">
                <motion.div
                  key={Math.floor(earnedToday * 10)}
                  initial={{ scale: 1.06 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="font-mono text-4xl font-semibold tabular-nums mb-2"
                  style={{ color: isOvertime ? '#FFAA00' : accentColor }}
                >
                  ${earnedToday.toFixed(2)}
                </motion.div>

                {/* Live / Overtime badge */}
                <div className="flex items-center gap-1.5">
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: isOvertime ? '#FFAA00' : '#22ff7a',
                      boxShadow: isOvertime
                        ? '0 0 8px #FFAA00, 0 0 16px #FFAA0060'
                        : '0 0 8px #22ff7a, 0 0 16px #22ff7a60',
                    }}
                    animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                    transition={{ repeat: Infinity, duration: 1.0 }}
                  />
                  <span className="text-xs uppercase tracking-widest text-zinc-300 font-medium">
                    {isOvertime ? 'Overtime ×1.5' : 'live'}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-3xl font-light text-zinc-700 tracking-widest mb-1 font-mono">— — —</div>
                <div className="text-xs text-zinc-600">Clock in to start earning</div>
              </div>
            )}

            <div className="text-xs text-zinc-500 mt-2">Real time earnings</div>
          </div>

          {/* ── PTO MODULE ── */}
          <div className="glass rounded-3xl p-6 relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(81,254,254,0.1) 0%, transparent 65%)' }}
            />
            <div className="text-sm uppercase tracking-[2px] text-white mb-1 relative">Today's Accrued PTO</div>
            <div className="text-xs uppercase tracking-[2px] text-zinc-400 mb-3 relative">Real time PTO accrual</div>

            {isClockedIn ? (
              <div className="relative">
                <motion.div
                  key={Math.floor(accruedPTO * 1000)}
                  initial={{ scale: 1.06 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="font-mono text-4xl font-semibold tabular-nums mb-2"
                  style={{ color: '#51FEFE' }}
                >
                  {accruedPTO.toFixed(3)} hrs
                </motion.div>

                {/* Live badge */}
                <div className="flex items-center gap-1.5">
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: '#51FEFE',
                      boxShadow: '0 0 8px #51FEFE, 0 0 16px #51FEFE60',
                    }}
                    animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                    transition={{ repeat: Infinity, duration: 1.0 }}
                  />
                  <span className="text-xs uppercase tracking-widest text-zinc-300 font-medium">live</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-3xl font-light text-zinc-700 tracking-widest mb-1 font-mono">— — —</div>
                <div className="text-xs text-zinc-600">Clock in to start accruing</div>
              </div>
            )}

            <div className="text-xs text-zinc-500 mt-2">Real time PTO accrual</div>
          </div>

          {/* ── PAYCHECK MODULE ── */}
          <div className="glass rounded-3xl p-6 relative overflow-hidden">
            <div className="text-xs uppercase tracking-[3px] text-zinc-400 mb-3">Estimated Next Paycheck</div>
            <div className="text-4xl font-medium mb-2 neon-green">${Math.round(totalEarnings).toLocaleString()}</div>
            <div className="text-xs text-zinc-500 mb-3">{daysUntil} days away</div>
            <div className="crystal-progress">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${paycheckProgress}%`,
                  background: `linear-gradient(90deg, ${accentColor}70, ${accentColor})`,
                }}
              />
            </div>
            <div className="text-[10px] text-zinc-600 mt-1.5 text-right">{Math.round(paycheckProgress)}% of pay cycle</div>
          </div>
        </div>

        {/* ── HOURLY RATE + PTO VAULT — side by side below the 3 modules ── */}
        <div className="grid grid-cols-2 gap-4 mt-4">

          {/* HOURLY RATE */}
          <div
            ref={rateCardRef}
            className="rounded-2xl px-5 py-4 flex flex-col gap-3 transition-all duration-300"
            style={{
              background: highlightRate
                ? `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}0A 100%)`
                : 'rgba(255,255,255,0.04)',
              border: highlightRate
                ? `1.5px solid ${accentColor}`
                : '1.5px solid rgba(255,255,255,0.08)',
              boxShadow: highlightRate
                ? `0 0 20px ${accentColor}40, 0 0 40px ${accentColor}20`
                : 'none',
            }}
          >
            <div>
              <div className="text-xs uppercase tracking-[2px] text-zinc-400 mb-0.5">Your Hourly Rate</div>
              <div className="text-xs text-zinc-600">Click the amount to edit your rate</div>
            </div>
            <div
              className="flex items-center rounded-xl px-4 py-2.5 gap-1 transition-all duration-300"
              style={{
                background: highlightRate ? `${accentColor}18` : 'rgba(0,0,0,0.4)',
                border: highlightRate ? `1.5px solid ${accentColor}80` : '1.5px solid rgba(255,255,255,0.1)',
              }}
            >
              <span className="text-zinc-300 text-xl font-light">$</span>
              <input
                ref={rateInputRef}
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full bg-transparent text-right font-mono text-3xl font-bold focus:outline-none"
                style={{ color: accentColor }}
                min="1"
              />
              <span className="text-zinc-400 text-base">/hr</span>
            </div>
          </div>

          {/* PTO VAULT */}
          <div className="rounded-2xl px-5 py-4 flex flex-col gap-3 transition-all duration-300"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)' }}
          >
            <div>
              <div className="text-xs uppercase tracking-[2px] text-zinc-400 mb-0.5">PTO Vault</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold neon-green tabular-nums">{accruedPTO.toFixed(3)}</span>
                <span className="text-sm text-zinc-400">hrs</span>
              </div>
              <div className="text-xs text-zinc-600 mt-0.5">{(2080 * ptoAccrualRate).toFixed(1)} hrs projected / yr</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1.5">Accrual rate</div>
              <div className="flex items-center bg-zinc-900 rounded-xl px-3 py-1.5 gap-1">
                <span className="text-zinc-400 text-xs">1 hr per</span>
                <input
                  type="number"
                  value={(1 / ptoAccrualRate).toFixed(0)}
                  onChange={(e) => setPtoAccrualRate(Math.max(0.001, 1 / Math.max(1, parseFloat(e.target.value) || 30)))}
                  className="w-12 bg-transparent text-right font-mono text-sm focus:outline-none text-white"
                  min="1"
                />
                <span className="text-zinc-400 text-xs">hrs worked</span>
              </div>
            </div>
            {xpTotalForPTO !== undefined && xpTotalForPTO > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="text-xs text-zinc-500">XP bonus PTO</div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-sm font-bold" style={{ color: accentColor }}>{(Math.floor(xpTotalForPTO / 1000) * 0.25).toFixed(2)}</span>
                  <span className="text-xs text-zinc-500">hrs ({Math.floor(xpTotalForPTO / 1000)} milestones × 15 min)</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════
          ACHIEVEMENTS
          ═══════════════════════════════════════════ */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold neon-green uppercase tracking-[2px]">Achievements</div>
          <div className="text-xs text-zinc-500">
            {achievements.filter(a => a.unlocked).length} / {achievements.length} unlocked
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {achievements.map((ach, i) => (
            <motion.div
              key={ach.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: ach.unlocked ? 1 : 0.35, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className={`glass rounded-2xl p-4 transition-all duration-500 ${!ach.unlocked ? 'grayscale' : ''}`}
              style={
                ach.unlocked
                  ? {
                      boxShadow: `0 0 18px ${accentColor}18, inset 0 1px 0 rgba(255,255,255,0.08)`,
                      borderColor: `${accentColor}22`,
                    }
                  : {}
              }
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2 select-none" style={{ background: `${accentColor}18`, color: ach.unlocked ? accentColor : 'rgba(255,255,255,0.3)', border: `1px solid ${accentColor}25` }}>
                {AchievementIcons[ach.iconKey]}
              </div>
              <div className="text-sm font-semibold neon-green leading-tight">{ach.label}</div>
              <div className="text-xs text-zinc-500 mt-1 leading-snug">{ach.desc}</div>
              {ach.unlocked && (
                <div
                  className="text-[10px] mt-2 font-semibold tracking-[2px] uppercase"
                  style={{ color: accentColor }}
                >
                  Unlocked
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          DAILY MISSION
          ═══════════════════════════════════════════ */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-lg font-semibold neon-green uppercase tracking-[2px]">Daily Mission</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Earn ${dailyGoalDollars.toFixed(0)} today
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">Goal:</span>
              <input
                type="number"
                value={dailyGoalHours}
                min="1"
                max="24"
                step="0.5"
                onChange={e => setDailyGoalHours(Math.max(0.5, Math.min(24, parseFloat(e.target.value) || 8)))}
                className="w-14 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-white/30 text-right font-mono"
              />
              <span className="text-xs text-zinc-500">hrs</span>
            </div>
            <div className="text-right">
              <div
                className="text-3xl font-bold tabular-nums"
                style={{ color: dailyGoalProgress >= 100 ? accentColor : 'white' }}
              >
                {Math.round(dailyGoalProgress)}%
              </div>
              <div className="text-xs text-zinc-500">complete</div>
            </div>
          </div>
        </div>

        <div className="crystal-progress" style={{ height: '10px' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${accentColor}70, ${accentColor})` }}
            initial={{ width: 0 }}
            animate={{ width: `${dailyGoalProgress}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </div>

        <div className="flex justify-between text-xs mt-2">
          <span className="text-zinc-600">$0</span>
          <span className="font-semibold" style={{ color: accentColor }}>${earnedToday.toFixed(2)}</span>
          <span className="text-zinc-600">${dailyGoalDollars.toFixed(0)}</span>
        </div>

        {dailyGoalProgress >= 100 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-center text-xs font-semibold tracking-[3px] uppercase"
            style={{ color: accentColor }}
          >
            Daily goal complete - great work
          </motion.div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          STATS ROW: Streak + Level/XP + Hours
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-3 gap-4">

        {/* Work Streak */}
        <div className="glass rounded-3xl p-6 text-center flex flex-col items-center justify-center">
          <div className="text-lg font-semibold neon-green uppercase tracking-[2px] mb-2">Work Streak</div>
          <div className="mb-1 select-none flex items-center justify-center" style={{ color: 'var(--accent-color)' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 2C12 2 5 9 5 14a7 7 0 0014 0C19 9 12 2 12 2zm0 2.5c0 0 4 5 4 9.5a4 4 0 01-8 0C8 9.5 12 4.5 12 4.5zm0 4c0 0-2.5 3-2.5 5.5a2.5 2.5 0 005 0C14.5 11.5 12 8.5 12 8.5z"/>
            </svg>
          </div>
          <div className="text-4xl font-bold neon-green tabular-nums">{streak}</div>
          <div className="text-xs text-zinc-500 mt-1.5">
            {streak === 0
              ? 'Clock in to start'
              : streak === 1
              ? 'Day one - keep going!'
              : `${streak} days in a row`}
          </div>
        </div>

        {/* Level & XP */}
        <div className="glass rounded-3xl p-6 text-center">
          <div className="text-xs uppercase tracking-[2px] text-zinc-400 mb-1">Level {level}</div>
          <div className="text-2xl font-bold neon-green">{levelName}</div>
          <div className="mt-4 crystal-progress">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${xpProgress}%`,
                background: `linear-gradient(90deg, ${accentColor}70, ${accentColor})`,
              }}
            />
          </div>
          <div className="text-xs text-zinc-500 mt-2">{totalXP} / {level * 500} XP</div>
          <div className="text-[10px] text-zinc-600 mt-0.5">100 XP per hour worked</div>
        </div>

        {/* Hours Today */}
        <div className="glass rounded-3xl p-6 text-center">
          <div className="text-xs uppercase tracking-[2px] text-zinc-400 mb-2">Hours Today</div>
          <div className="text-4xl font-bold neon-green tabular-nums">{totalHours.toFixed(1)}</div>
          <div className="text-xs text-zinc-500 mt-1">
            {isOvertime ? 'Overtime active' : isClockedIn ? 'Currently clocked in' : 'Clocked out'}
          </div>
          <div className="mt-3 crystal-progress">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (totalHours / 8) * 100)}%`,
                background: isOvertime
                  ? 'linear-gradient(90deg, #FFAA0070, #FFAA00)'
                  : `linear-gradient(90deg, ${accentColor}70, ${accentColor})`,
              }}
            />
          </div>
          <div className="text-xs text-zinc-500 mt-1.5">
            {Math.round(Math.min(100, (totalHours / 8) * 100))}% of 8-hour day
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-zinc-500 pt-2 pb-4">
        SwiftShift - Instant gratification for your hard work.
      </div>
    </div>
  )
}
