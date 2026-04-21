import { motion } from 'framer-motion'
import { useClock } from '../hooks/useClock'
import { formatTime } from '../utils/format'

interface ClockWidgetProps {
  onClockChange?: () => void
  onClockOut?: (clockInTimeISO: string) => void
}

export function ClockWidget({ onClockChange, onClockOut }: ClockWidgetProps) {
  const { isClockedIn, elapsedFormatted, clock, toggleClock } = useClock()

  const handleToggle = () => {
    // If clocking out, fire callback with clockInTime before it clears
    if (isClockedIn && clock.clockInTime && onClockOut) {
      onClockOut(clock.clockInTime)
    }
    toggleClock()
    onClockChange?.()
  }

  // NOT CLOCKED IN: Ultra-simple one-tap experience
  // No status badges, no explanations, no keyboard hints — just ONE BIG BUTTON
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
          <div className="text-6xl">⏱</div>
          <div>CLOCK IN</div>
          <div className="text-sm font-normal opacity-60">Tap once. That's it.</div>
        </motion.button>

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

      <div className="mt-6 text-xs text-zinc-500">
        Your session auto-saves when you clock out
      </div>
    </div>
  )
}
