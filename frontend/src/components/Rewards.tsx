import { useEffect, useState, useRef, useCallback } from 'react'
import confetti from 'canvas-confetti'

interface RewardsProps {
  totalHours: number
  elapsedSeconds: number
  isClockedIn: boolean
  theme?: 'green' | 'white' | 'orange' | 'cyan' | 'pink' | 'purple'
  user?: any
  onFocus?: () => void
}

interface KalshiMarket {
  ticker: string
  title: string
  yes_ask: number
  no_ask: number
  volume: number
  open_interest: number
}

interface Position {
  ticker: string
  title: string
  side: 'yes' | 'no'
  stake: number
  price: number // price paid (cents)
}

// Compute hourly rate from user: if salary set (salaried), hourly = salary/2080, else use pay (default $65)
function computeHourlyRate(user: any): number {
  const salary = Number(user?.salary) || 0
  if (salary > 0) {
    return salary / 2080
  }
  const pay = Number(user?.pay)
  return pay > 0 ? pay : 65
}

export function Rewards({ totalHours, elapsedSeconds, isClockedIn, theme = 'green', user, onFocus }: RewardsProps) {
  const [hourlyRate, setHourlyRate] = useState(() => computeHourlyRate(user))
  const [ptoAccrualRate, setPtoAccrualRate] = useState(1 / 30) // 1 hour per 30 hours worked
  const [hasFiredConfetti, setHasFiredConfetti] = useState(false)
  const prevCentsRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Prediction Markets — mock data for UI design (Kalshi API disabled)
  interface KalshiEvent { event_ticker: string; title: string; subtitle?: string }
  const [events] = useState<KalshiEvent[]>([
    { event_ticker: 'MOCK-MAN-UTD-LIV', title: 'Who wins: Manchester United vs Liverpool', subtitle: 'Premier League • 2:00 PM' },
    { event_ticker: 'MOCK-BTC-100K', title: 'Will Bitcoin hit $100,000 by Dec 31, 2025?', subtitle: 'Crypto Markets' },
    { event_ticker: 'MOCK-US-PRES', title: 'Who wins the 2028 US Presidential Election?', subtitle: 'Politics' },
    { event_ticker: 'MOCK-AI-DOCTORS', title: 'Will AI surpass human doctors in diagnosis accuracy by 2027?', subtitle: 'AI & Healthcare' },
    { event_ticker: 'MOCK-SUPERBOWL', title: 'Who wins Super Bowl LX?', subtitle: 'NFL • Feb 2026' },
  ])
  const [marketsByEvent] = useState<Record<string, KalshiMarket[]>>({
    'MOCK-MAN-UTD-LIV': [
      { ticker: 'MOCK-MAN-UTD', title: 'Manchester United', yes_ask: 42, no_ask: 58, volume: 1250000, open_interest: 890000 },
      { ticker: 'MOCK-LIV', title: 'Liverpool', yes_ask: 51, no_ask: 49, volume: 1380000, open_interest: 950000 },
      { ticker: 'MOCK-DRAW', title: 'Draw', yes_ask: 7, no_ask: 93, volume: 320000, open_interest: 210000 },
    ],
    'MOCK-BTC-100K': [
      { ticker: 'MOCK-BTC-YES', title: 'Yes — $100k+', yes_ask: 67, no_ask: 33, volume: 890000, open_interest: 540000 },
    ],
    'MOCK-US-PRES': [
      { ticker: 'MOCK-PRES-DEM', title: 'Democratic candidate', yes_ask: 38, no_ask: 62, volume: 2100000, open_interest: 1500000 },
      { ticker: 'MOCK-PRES-REP', title: 'Republican candidate', yes_ask: 54, no_ask: 46, volume: 1950000, open_interest: 1370000 },
    ],
    'MOCK-AI-DOCTORS': [
      { ticker: 'MOCK-AI-SURPASS', title: 'AI surpasses human doctors', yes_ask: 29, no_ask: 71, volume: 640000, open_interest: 410000 },
    ],
    'MOCK-SUPERBOWL': [
      { ticker: 'MOCK-SB-KC', title: 'Kansas City Chiefs', yes_ask: 22, no_ask: 78, volume: 780000, open_interest: 520000 },
      { ticker: 'MOCK-SB-SF', title: 'San Francisco 49ers', yes_ask: 18, no_ask: 82, volume: 610000, open_interest: 390000 },
    ],
  })
  const [positions, setPositions] = useState<Position[]>([])
  const [stakeInputs, setStakeInputs] = useState<Record<string, number>>({})
  const [spinCount, setSpinCount] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [spinResult, setSpinResult] = useState<'win' | 'loss' | null>(null)
  const SLOT_COST = 10
  // Current visible symbols (for animation during spin)
  const [displaySymbols, setDisplaySymbols] = useState([0, 1, 2])

  const lockStake = (m: KalshiMarket, side: 'yes' | 'no') => {
    const amt = Math.max(1, Math.min(availableStake, stakeInputs[m.ticker] || 10))
    if (amt <= 0) return
    const price = side === 'yes' ? m.yes_ask : m.no_ask
    setPositions(prev => [...prev, { ticker: m.ticker, title: m.title, side, stake: amt, price }])
    setStakeInputs(prev => ({ ...prev, [m.ticker]: 0 }))
  }

  const closePosition = (idx: number) => {
    setPositions(prev => prev.filter((_, i) => i !== idx))
  }

  // Slot machine spin
  const handleSpin = () => {
    if (isSpinning || availableStake < SLOT_COST) return
    setSpinResult(null)
    setSlotAllocated(prev => prev + SLOT_COST)
    setIsSpinning(true)
    const iconsLen = 6
    let ticks = 0
    const interval = setInterval(() => {
      setDisplaySymbols([Math.floor(Math.random()*iconsLen), Math.floor(Math.random()*iconsLen), Math.floor(Math.random()*iconsLen)])
      ticks++
      if (ticks >= 25) { // ~5s at 200ms per tick
        clearInterval(interval)
        // Final symbols based on spinCount
        const base = spinCount * 17
        const final = [0,1,2].map(i => (base + i * 7) % iconsLen)
        setDisplaySymbols(final)
        // Determine win
        const [a,b,c] = final
        let payout = 0
        if (a === b && b === c) payout = SLOT_COST * 10
        else if (a === b || b === c || a === c) payout = SLOT_COST * 2

        // Always remove the bet cost from allotted once spin ends
        setSlotAllocated(prev => {
          // availableStake = MOCK - allocated - slotAllocated
          // On loss: free the bet (slotAllocated -= SLOT_COST), availableStake returns to original
          // On win: availableStake should increase by payout (net = payout - bet)
          // So slotAllocated -= payout (since bet was already added to slotAllocated at spin start)
          return payout > 0 ? prev - payout : prev - SLOT_COST
        })

        if (payout > 0) {
          setSpinResult('win')
          setTimeout(() => {
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: [confettiColor, '#39FF14', '#00CC00'] })
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 }, colors: [confettiColor, '#39FF14'] })
          }, 100)
        } else {
          setSpinResult('loss')
        }
        setSpinCount(c => c + 1)
        setIsSpinning(false)
      }
    }, 200)
  }

  // Calculate today's earnings (from logged entries today + live if clocked in)
  // For simplicity, we'll use totalHours as weekly; for "Earned Today" we approximate 
  // based on elapsedSeconds if clocked in. In real app, you'd track per-day.
  const liveTodayEarnings = isClockedIn 
    ? (elapsedSeconds / 3600) * hourlyRate 
    : 0

  // For demo: "Earned Today" = live running total (if clocked in, it grows; else shows last value)
  // In production you'd calculate from today's entries + live
  const earnedToday = liveTodayEarnings

  // Total weekly earnings
  const totalEarnings = totalHours * hourlyRate

  // Mock bankroll shared by prediction markets + slot machine
  const MOCK_BANKROLL = 1000
  const allocated = positions.reduce((s, p) => s + p.stake, 0)
  const [slotAllocated, setSlotAllocated] = useState(0)
  const availableStake = Math.max(0, MOCK_BANKROLL - allocated - slotAllocated)

  // PTO accrual: based on total hours worked (adjustable rate)
  const accruedPTO = totalHours * ptoAccrualRate

  // Overdrive detection: >8h daily or >40h weekly (totalHours here is daily)
  const isOvertime = totalHours > 8
  const themeColors: Record<'green' | 'white' | 'orange' | 'cyan' | 'pink' | 'purple', string> = {
    green: '#D7FE51',
    white: '#E5E7EB',
    orange: '#F97316',
    cyan: '#51FEFE',
    pink: '#FE51D7',
    purple: '#9B51FE',
  }
  const confettiColor = isOvertime ? '#FFAA00' : themeColors[theme]

  // Paycheck date helpers: 2nd Friday and last Friday of each month
  const getPaycheckDates = (year: number, month: number) => {
    // Find 2nd Friday: start from day 1, find first Friday, then add 7
    let day = 1
    while (new Date(year, month, day).getDay() !== 5) day++
    const secondFriday = new Date(year, month, day + 7)
    // Find last Friday: start from last day of month, go backwards
    const lastDay = new Date(year, month + 1, 0).getDate()
    let lastFridayDate = lastDay
    while (new Date(year, month, lastFridayDate).getDay() !== 5) lastFridayDate--
    const lastFriday = new Date(year, month, lastFridayDate)
    return { secondFriday, lastFriday }
  }

  const getNextPaycheck = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const year = today.getFullYear()
    const month = today.getMonth()
    const { secondFriday, lastFriday } = getPaycheckDates(year, month)

    if (today <= secondFriday) return secondFriday
    if (today <= lastFriday) return lastFriday
    // After last Friday: next is 2nd Friday of next month
    const { secondFriday: nextSecond } = getPaycheckDates(year, month + 1)
    return nextSecond
  }

  const daysUntilNextPaycheck = () => {
    const next = getNextPaycheck()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }

  const estimatedPaycheck = totalEarnings // running total for this pay period (simplified)

  // Haptic ticker: fire vibration on each cent increment
  const triggerHaptic = useCallback((currentCents: number) => {
    if (currentCents !== prevCentsRef.current && 'vibrate' in navigator) {
      try {
        // Subtle 10ms buzz — iOS Taptic isn't directly available in web
        // but vibration API gives a satisfying micro-click on supported devices
        navigator.vibrate(10)
      } catch {
        // Ignore if not supported
      }
    }
    prevCentsRef.current = currentCents
  }, [])

  // Track cent changes for haptic
  useEffect(() => {
    if (!isClockedIn) return
    const cents = Math.floor(earnedToday * 100) % 100
    triggerHaptic(cents)
  }, [earnedToday, isClockedIn, triggerHaptic])

  // Neon green confetti from bottom when rewards tab focuses
  useEffect(() => {
    if (onFocus && !hasFiredConfetti) {
      const timer = setTimeout(() => {
        // Burst from bottom center
        confetti({
          particleCount: 180,
          spread: 90,
          origin: { x: 0.5, y: 0.95 },
          colors: [confettiColor, '#39FF14', '#00CC00'],
        })
        // Secondary burst slightly left
        setTimeout(() => {
          confetti({
            particleCount: 120,
            spread: 70,
            angle: 75,
            origin: { x: 0.3, y: 0.9 },
            colors: [confettiColor, '#39FF14'],
          })
        }, 120)
        // Secondary burst slightly right
        setTimeout(() => {
          confetti({
            particleCount: 120,
            spread: 70,
            angle: 105,
            origin: { x: 0.7, y: 0.9 },
            colors: [confettiColor, '#00CC00'],
          })
        }, 240)
        setHasFiredConfetti(true)
      }, 80)
      return () => clearTimeout(timer)
    }
  }, [onFocus, hasFiredConfetti])

  useEffect(() => {
    return () => setHasFiredConfetti(false)
  }, [])

  return (
    <div ref={containerRef} className="max-w-[1200px] mx-auto">
      <div className="glass rounded-3xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-2xl font-semibold neon-green">Rewards</div>
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Rate:</span>
              <div className="flex items-center bg-zinc-900 rounded-xl px-3 py-1.5">
                <span className="text-zinc-400">$</span>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-16 bg-transparent text-right font-mono focus:outline-none"
                  min="1"
                />
                <span className="text-zinc-400">/hr</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">PTO:</span>
              <div className="flex items-center bg-zinc-900 rounded-xl px-3 py-1.5">
                <span className="text-zinc-400">1 hr /</span>
                <input
                  type="number"
                  value={(1 / ptoAccrualRate).toFixed(0)}
                  onChange={(e) => setPtoAccrualRate(Math.max(0.001, 1 / Math.max(1, parseFloat(e.target.value) || 30)))}
                  className="w-12 bg-transparent text-right font-mono focus:outline-none"
                  min="1"
                />
                <span className="text-zinc-400">hrs</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-zinc-500">Weekly earnings</div>
              <div className="font-semibold tabular-nums neon-green">${totalEarnings.toFixed(0)}</div>
            </div>
          </div>
        </div>

        {/* Three modules side-by-side, clock tab style */}
        <div className="grid grid-cols-3 gap-4">
          <div className="glass rounded-3xl p-6 flex-1">
            <div className="text-sm uppercase tracking-[2px] text-white mb-2">Today's Earnings</div>
            <div className="text-4xl font-medium mb-1.5 neon-green">{isClockedIn ? `$${earnedToday.toFixed(2)}` : 'CLOCK IN'}</div>
            <div className="text-sm text-zinc-400 mb-3">Real time earnings</div>
          </div>
          <div className="glass rounded-3xl p-6 flex-1">
            <div className="text-sm uppercase tracking-[2px] text-white mb-2">Today's Accrued PTO</div>
            <div className="text-4xl font-medium mb-1.5 neon-green">{isClockedIn ? `${accruedPTO.toFixed(2)} hrs` : 'CLOCK IN'}</div>
            <div className="text-sm text-zinc-400 mb-3">Real Time PTO Earned</div>
          </div>
          <div className="glass rounded-3xl p-6 flex-1">
            <div className="text-sm uppercase tracking-[2px] text-white mb-2">Estimated Next Paycheck</div>
            <div className="text-4xl font-medium mb-1.5 neon-green">${estimatedPaycheck.toFixed(0)}</div>
            <div className="text-sm text-zinc-400 mb-3">{daysUntilNextPaycheck()} days until next paycheck</div>
          </div>
        </div>

        {/* Slot Machine */}
        <div className="mt-4 flex justify-start">
          <div className="inline-flex flex-col items-center bg-zinc-950 border border-white/20 rounded-2xl p-3 shadow-inner min-w-[200px]">
            <div className="flex gap-1 bg-black rounded-xl p-1.5 border border-white/10">
              {(() => {
                const icons = ['bx-star','bx-bell','bx-diamond','bx-gift','bx-trophy','bx-coin']
                return displaySymbols.map((idx, i) => (
                  <div key={i} className="w-9 h-9 flex items-center justify-center bg-zinc-900 rounded-lg text-xl shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]">
                    <i className={`bx ${icons[idx]} text-white`}></i>
                  </div>
                ))
              })()}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleSpin}
                disabled={isSpinning || availableStake < SLOT_COST}
                className="px-4 py-1 text-xs rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition disabled:opacity-40"
              >
                {isSpinning ? 'SPINNING…' : 'SPIN'}
              </button>
              {spinResult && (
                <span className={`text-xs font-semibold ${spinResult === 'win' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {spinResult === 'win' ? 'WIN!' : 'better luck next time!!!'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Prediction Markets — Kalshi */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-lg font-semibold neon-green">Gork's Prediction Markets -</div>
              <span className="text-sm text-zinc-400">Put your paycheck into the prediction markets. Powered by Kalshi API.</span>
            </div>
            <div className="text-sm text-zinc-400 flex items-center gap-4">
              <span>Allocated: <span className="font-mono text-rose-400">${(allocated + slotAllocated).toFixed(0)}</span></span>
              <span>Available: <span className="font-mono neon-green">${availableStake.toFixed(0)}</span></span>
            </div>
          </div>

          {events.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map(ev => {
                const mkts = marketsByEvent[ev.event_ticker] || []
                if (mkts.length === 0) return null
                // Pick the market with highest probability (max yes_ask or no_ask)
                const best = mkts.reduce((a, b) => {
                  const aMax = Math.max(a.yes_ask || 0, a.no_ask || 0)
                  const bMax = Math.max(b.yes_ask || 0, b.no_ask || 0)
                  return bMax > aMax ? b : a
                }, mkts[0])
                const yesPct = Math.round(best.yes_ask || 0)
                const noPct = Math.round(best.no_ask || 0)
                return (
                  <div key={ev.event_ticker} className="glass rounded-2xl p-4 flex flex-col gap-3">
                    <div className="font-semibold text-white text-sm leading-snug">{ev.title}</div>
                    {ev.subtitle && <div className="text-[10px] text-zinc-500 -mt-1">{ev.subtitle}</div>}
                    <div className="bg-white/5 rounded-xl p-3">
                      <div className="text-sm text-white mb-2">{best.title}</div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-2">
                        <span>Vol {Math.round((best.volume || 0) / 1000)}k</span>
                        <span>OI {Math.round((best.open_interest || 0) / 1000)}k</span>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 flex items-center gap-1.5">
                          <span className="text-[10px] text-emerald-400 w-7">YES</span>
                          <div className="flex-1 h-1.5 bg-emerald-950 rounded">
                            <div className="h-1.5 bg-emerald-400 rounded" style={{ width: `${yesPct}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-emerald-400 w-7 text-right">{yesPct}¢</span>
                        </div>
                        <div className="flex-1 flex items-center gap-1.5">
                          <span className="text-[10px] text-rose-400 w-7">NO</span>
                          <div className="flex-1 h-1.5 bg-rose-950 rounded">
                            <div className="h-1.5 bg-rose-400 rounded" style={{ width: `${noPct}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-rose-400 w-7 text-right">{noPct}¢</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => lockStake(best, 'yes')}
                          disabled={availableStake < 1}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-40"
                        >
                          YES
                        </button>
                        <button
                          onClick={() => lockStake(best, 'no')}
                          disabled={availableStake < 1}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-rose-600/80 hover:bg-rose-500 disabled:opacity-40"
                        >
                          NO
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {positions.length > 0 && (
            <div className="mt-6">
              <div className="text-sm uppercase tracking-[1px] text-zinc-500 mb-2">Your Locked Positions</div>
              <div className="space-y-2">
                {positions.map((p, i) => {
                  const payout = Math.round(p.stake * (100 / p.price))
                  return (
                    <div key={i} className="flex items-center justify-between bg-zinc-900/70 rounded-xl px-4 py-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${p.side === 'yes' ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'}`}>{p.side.toUpperCase()}</span>
                        <span className="text-white">{p.title.length > 60 ? p.title.slice(0, 57) + '…' : p.title}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <span className="font-mono">${p.stake}</span>
                        <span>@{p.price}¢</span>
                        <span className="text-emerald-400">→ ${payout}</span>
                        <button onClick={() => closePosition(i)} className="text-zinc-500 hover:text-white">×</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="text-[10px] text-zinc-500 mt-2">Demo only — not real trading. Payout = stake × (100 / price).</div>
            </div>
          )}
        </div>

        <div className="text-center text-xs text-zinc-500 pt-6">
          GrokClock - Instant gratification for your hard work.
        </div>
      </div>
    </div>
  )
}
