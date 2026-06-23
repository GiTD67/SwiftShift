import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useClock } from '../hooks/useClock'
import { formatTime } from '../utils/format'
import { queuePunch, hasQueuedPunches, PUNCH_QUEUE_EVENT } from '../utils/offlineQueue'

interface ClockWidgetProps {
  onClockChange?: () => void
  onClockOut?: (clockInTimeISO: string) => void
}

export function ClockWidget({ onClockChange, onClockOut }: ClockWidgetProps) {
  const { isClockedIn, elapsedFormatted, clock, toggleClock } = useClock()
  // True while punches made offline are queued in localStorage awaiting sync
  const [offlinePending, setOfflinePending] = useState(() => hasQueuedPunches())

  // Clear the offline notice once queued punches are replayed (queue drains)
  useEffect(() => {
    const refresh = () => setOfflinePending(hasQueuedPunches())
    window.addEventListener(PUNCH_QUEUE_EVENT, refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.removeEventListener(PUNCH_QUEUE_EVENT, refresh)
      window.removeEventListener('online', refresh)
    }
  }, [])

  const handleToggle = () => {
    // If clocking out, fire callback with clockInTime before it clears
    if (isClockedIn && clock.clockInTime && onClockOut) {
      onClockOut(clock.clockInTime)
    }
    // No network? Queue the punch with its original time; it syncs on reconnect
    if (!navigator.onLine) {
      queuePunch({ action: isClockedIn ? 'clock_out' : 'clock_in', timestamp: new Date().toISOString() })
      setOfflinePending(true)
    }
    toggleClock()
    onClockChange?.()
  }

  const offlineNotice = offlinePending && (
    <div className="mt-4 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 inline-flex items-center gap-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
      Saved offline - will sync when you reconnect
    </div>
  )

  // NOT CLOCKED IN: Ultra-simple one-tap experience
  // No status badges, no explanations, no keyboard hints - just ONE BIG BUTTON
  if (!isClockedIn) {
    return (
      <div className="glass rounded-3xl p-8 text-center">
        <div className="text-sm uppercase tracking-[3px] text-zinc-400 mb-4">WELCOME</div>

        <motion.button
          onClick={handleToggle}
          className="w-full py-16 rounded-3xl glass-btn-green text-black font-semibold text-3xl transition-all flex flex-col items-center justify-center gap-4"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.985 }}
        >
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div>CLOCK IN</div>
          <div className="text-sm font-normal opacity-60">Tap once. That's it.</div>
        </motion.button>

        {offlineNotice}

        <div className="mt-4 text-xs text-zinc-500">
          No login. No menus. No hassle.
        </div>
      </div>
    )
  }

  // CLOCKED IN: Full view with timer, status, clock out
  return (
    <div className="glass rounded-3xl p-8 text-center">
      <div className="flex items-center justify-center gap-6">
        <motion.button
          onClick={handleToggle}
          className="py-4 px-10 rounded-2xl font-bold text-lg bg-red-500 hover:bg-red-600 text-white transition-all flex items-center justify-center gap-3"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          CLOCK OUT
        </motion.button>

        <div>
          <div className="font-mono text-7xl font-semibold tabular-nums tracking-[-2px] text-white">
            {elapsedFormatted}
          </div>
          <div className="text-xl text-zinc-400">
            {clock.clockInTime && `Since ${formatTime(clock.clockInTime)}`}
          </div>
        </div>
      </div>

      {offlineNotice}

      <div className="mt-6 text-xs text-zinc-500">
        Your session auto-saves when you clock out
      </div>
    </div>
  )
}
