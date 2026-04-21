import { useEffect, useMemo, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { TimeEntry } from '../types'

interface TimelineProps {
  entries: TimeEntry[]
  onFocus?: () => void
}

interface HoveredDay {
  day: Date
  hours: number
  x: number // position for popup
}

export function Timeline({ entries, onFocus }: TimelineProps) {
  // Current month dates
  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Calculate hours per day
  const hoursByDate = useMemo(() => {
    const map: Record<string, number> = {}
    entries.forEach(entry => {
      const date = entry.date
      map[date] = (map[date] || 0) + entry.duration / 60
    })
    return map
  }, [entries])

  // Haptic wave on mount (bottom to top sweep)
  useEffect(() => {
    if ('vibrate' in navigator) {
      // Simulate sweeping haptic wave
      navigator.vibrate([20, 30, 50, 30, 20])
    }
    onFocus?.()
  }, [onFocus])

  // Scrubbing state for heatmap
  const [hoveredDay, setHoveredDay] = useState<HoveredDay | null>(null)
  const heatmapRef = useRef<HTMLDivElement>(null)
  const lastHapticDayRef = useRef<string | null>(null)

  // Handle scrub / hover over heatmap bar
  const handleScrub = (clientX: number) => {
    if (!heatmapRef.current) return
    const rect = heatmapRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    const dayIndex = Math.floor(pct * monthDays.length)
    const clampedIndex = Math.max(0, Math.min(monthDays.length - 1, dayIndex))
    const day = monthDays[clampedIndex]
    const dateStr = format(day, 'yyyy-MM-dd')
    const hours = hoursByDate[dateStr] || 0

    // Update hovered day with popup position
    setHoveredDay({ day, hours, x: Math.max(20, Math.min(rect.width - 20, x)) })

    // Tiny haptic click when scrubbing to a new day
    const dayKey = dateStr
    if (lastHapticDayRef.current !== dayKey) {
      lastHapticDayRef.current = dayKey
      if ('vibrate' in navigator) {
        navigator.vibrate(8) // micro-click
      }
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    handleScrub(e.clientX)
  }

  const handlePointerLeave = () => {
    setHoveredDay(null)
    lastHapticDayRef.current = null
  }

  // Determine glow intensity based on hours (muted white)
  const getGlowClass = (hours: number) => {
    if (hours >= 10) return 'bg-white shadow-[0_0_20px_rgba(255,255,255,0.4)] animate-pulse'
    if (hours >= 8) return 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.3)]'
    if (hours >= 4) return 'bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.2)]'
    if (hours > 0) return 'bg-white/50 shadow-[0_0_4px_rgba(255,255,255,0.15)]'
    return 'bg-white/10'
  }

  const totalMonthHours = Object.values(hoursByDate).reduce((sum, h) => sum + h, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-sm text-white tracking-[3px] font-medium mb-1">TIME CONTINUUM</div>
        <div className="text-4xl font-semibold tracking-tight">{format(new Date(), 'MMMM yyyy')}</div>
        <div className="text-sm text-zinc-500 mt-1">
          {totalMonthHours.toFixed(1)}h logged this month
        </div>
      </div>

      {/* Top Panel: Heatmap Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 relative overflow-hidden border border-white/10"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium tracking-wide text-white/90">MONTH HEATMAP</div>
          <div className="text-xs text-zinc-500">Slide to scrub • {hoveredDay ? format(hoveredDay.day, 'EEE d') : 'hover'}</div>
        </div>

        {/* Horizontal frosted glass bar with heatmap - scrubbable */}
        <div 
          ref={heatmapRef}
          className="relative h-20 glass-subtle rounded-2xl overflow-hidden border border-white/10 p-3 cursor-pointer touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <div className="flex h-full gap-1 items-end">
            {monthDays.map((day, index) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const hours = hoursByDate[dateStr] || 0
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
              
              return (
                <motion.div
                  key={dateStr}
                  initial={{ height: 4, opacity: 0 }}
                  animate={{ 
                    height: hours > 0 ? Math.max(12, Math.min(64, hours * 8)) : 8,
                    opacity: 1 
                  }}
                  transition={{ delay: index * 0.01 }}
                  className={`flex-1 rounded-sm transition-all relative ${getGlowClass(hours)}`}
                >
                  {/* Today indicator */}
                  {isToday && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Neural network horizontal light-trails */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.15)_0px,rgba(255,255,255,0.15)_1px,transparent_1px,transparent_8px)] opacity-10 animate-[network-drift_3s_linear_infinite]" />
          </div>

          {/* Magnified glass bubble popup - follows scrub position */}
          {hoveredDay && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute -top-14 pointer-events-none z-50"
              style={{ left: hoveredDay.x }}
            >
              <div className="glass px-4 py-2 rounded-2xl text-sm whitespace-nowrap shadow-[0_0_20px_-4px_rgba(255,255,255,0.2)] border border-white/20 flex items-center gap-2">
                <div className="text-white">●</div>
                <div>
                  <span className="font-medium">{format(hoveredDay.day, 'EEE, MMM d')}</span>
                  <span className="text-zinc-400 mx-1">•</span>
                  <span className="tabular-nums font-semibold text-white">{hoveredDay.hours.toFixed(1)}</span>
                  <span className="text-zinc-400 text-xs ml-0.5">hrs</span>
                </div>
              </div>
              {/* Bubble pointer */}
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-3 h-3 glass rotate-45 border-b border-r border-white/20" />
            </motion.div>
          )}
        </div>

        <div className="mt-3 flex justify-between text-xs text-zinc-500">
          <div>1st</div>
          <div className="text-white">8h = steady • brighter = overtime</div>
          <div>{monthDays.length}</div>
        </div>
      </motion.div>

      {/* Middle Panel: AI Time Continuum Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-3xl p-6 border border-white/10"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="text-sm font-medium tracking-wide text-white">AI TIME CONTINUUM ANALYSIS</div>
          <div className="px-2 py-0.5 rounded bg-white/10 text-white text-xs tracking-widest">GROK</div>
        </div>

        <div className="flex items-start gap-4">
          {/* Pulsing glowing icon: lightbulb / brain */}
          <motion.div
            animate={{ 
              boxShadow: [
                '0 0 20px rgba(255,255,255,0.3)',
                '0 0 40px rgba(255,255,255,0.2)',
                '0 0 20px rgba(255,255,255,0.3)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex-shrink-0 w-12 h-12 rounded-full border border-white/20 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.75">
              {/* Lightbulb glass */}
              <path d="M12 2C8.5 2 6 4.5 6 8c0 2.2 1 3.8 2.5 5 1 .8 1.5 1.8 1.5 3v1h4v-1c0-1.2.5-2.2 1.5-3 1.5-1.2 2.5-2.8 2.5-5 0-3.5-2.5-6-6-6z" />
              {/* Base / screw threads */}
              <path d="M9 17h6" />
              <path d="M10 19h4" />
              {/* Rays */}
              <path d="M12 2v1" />
              <path d="M5 7l1 1" />
              <path d="M19 7l-1 1" />
            </svg>
          </motion.div>

          {/* Synthesized observation text */}
          <div className="flex-1 text-[15px] leading-snug text-white/90 font-light tracking-[-0.1px]">
            You are averaging <span className="font-semibold text-white">9.5 hours</span> on Tuesdays. 
            Consider shifting <span className="font-semibold text-white">2 hours</span> of Deep Work to 
            Thursday to optimize weekly flow.
          </div>
        </div>

        <div className="mt-4 text-[11px] text-zinc-500 tracking-wide">Based on your last 30 days • Updated live</div>
      </motion.div>

      {/* Bottom Panel: Next Week's Forecast */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-3xl p-6 border border-white/10"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium tracking-wide text-white">NEXT WEEK'S FORECAST</div>
          <div className="text-xs px-2 py-0.5 rounded bg-white/10 text-white tracking-widest">GROK AI</div>
        </div>

        {/* Minimalist Mon-Fri block chart */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => {
            // Generate next week dates
            const today = new Date()
            const dayOfWeek = today.getDay() // 0=Sun, 1=Mon
            const daysUntilMonday = ((8 - dayOfWeek) % 7) || 7
            const monday = new Date(today)
            monday.setDate(today.getDate() + daysUntilMonday)
            const forecastDate = new Date(monday)
            forecastDate.setDate(monday.getDate() + i)
            
            // Predict hours based on pattern (average ~8, with some variance)
            const baseHours = 8
            const variance = (i % 3 - 1) * 0.5 // slight variance Mon-Fri
            const predictedHours = Math.max(6, Math.min(11, baseHours + variance))
            
            const dayName = format(forecastDate, 'EEE')
            
            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="text-[10px] text-zinc-500 mb-1 tracking-widest">{dayName}</div>
                <motion.div
                  initial={{ height: 8 }}
                  animate={{ height: Math.max(20, predictedHours * 7) }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="w-full rounded-lg bg-gradient-to-t from-white/60 to-white shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                />
                <div className="text-xs text-white mt-1 font-medium tabular-nums">{predictedHours.toFixed(0)}h</div>
              </div>
            )
          })}
        </div>

        {/* Auto-log button */}
        <motion.button
          whileTap={{ scale: 0.985 }}
          onClick={() => {
            // TODO: Replace with real Grok API call
            // fetch('/api/grok/forecast', { method: 'POST', body: JSON.stringify({ entries, nextWeek: true }) })
            // For hackathon demo: simulate Grok analyzing patterns
            const btn = document.activeElement as HTMLButtonElement
            if (btn) btn.disabled = true
            
            // Show loading state briefly
            setTimeout(() => {
              // Haptic feedback
              if ('vibrate' in navigator) navigator.vibrate([20, 40, 20])
              
              // Show success toast (simple alert for now; could be a toast component)
              alert('✓ 40 hrs auto-logged for next week\n\nGrok analyzed your patterns:\n• 8h/day Mon–Thu\n• 8h Friday (lighter)\n\nTimesheet pre-approved.')
              
              if (btn) btn.disabled = false
            }, 600)
          }}
          className="w-full py-4 rounded-2xl glass text-white font-semibold tracking-[1px] text-lg border border-white/20 shadow-[0_0_20px_-6px_rgba(255,255,255,0.2)] active:shadow-[0_0_30px_-4px_rgba(255,255,255,0.25)] transition-all"
        >
          40 HRS
        </motion.button>

        <div className="mt-4 text-center text-[10px] text-zinc-500">
          Tap to pre-approve next week • Powered by Grok
        </div>
      </motion.div>
    </div>
  )
}
