import { useState, useEffect, useCallback } from 'react'
import { ClockState } from '../types'

const CLOCK_STORAGE_KEY = 'swiftshift-clock'

export function useClock() {
  const [clock, setClock] = useState<ClockState>(() => {
    const fallback: ClockState = {
      isClockedIn: false,
      clockInTime: null,
      lastActionTime: null,
    }
    const saved = localStorage.getItem(CLOCK_STORAGE_KEY)
    if (!saved) return fallback
    try {
      return JSON.parse(saved)
    } catch {
      // Corrupted persisted state — discard it rather than crashing on mount.
      localStorage.removeItem(CLOCK_STORAGE_KEY)
      return fallback
    }
  })

  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify(clock))
  }, [clock])

  // Live timer when clocked in
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    if (clock.isClockedIn && clock.clockInTime) {
      interval = setInterval(() => {
        const start = new Date(clock.clockInTime!).getTime()
        const now = Date.now()
        setElapsedSeconds(Math.floor((now - start) / 1000))
      }, 1000)
    } else {
      setElapsedSeconds(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [clock.isClockedIn, clock.clockInTime])

  const clockIn = useCallback(() => {
    const now = new Date().toISOString()
    setClock({
      isClockedIn: true,
      clockInTime: now,
      lastActionTime: now,
    })
  }, [])

  const clockOut = useCallback(() => {
    const now = new Date().toISOString()
    setClock({
      isClockedIn: false,
      clockInTime: null,
      lastActionTime: now,
    })
    setElapsedSeconds(0)
  }, [])

  const toggleClock = useCallback(() => {
    if (clock.isClockedIn) {
      clockOut()
    } else {
      clockIn()
    }
  }, [clock.isClockedIn, clockIn, clockOut])

  const formatElapsed = useCallback((seconds: number): string => {
    // Corrupted/skewed clock state can yield NaN or negative values; show zero.
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }, [])

  return {
    clock,
    elapsedSeconds,
    elapsedFormatted: formatElapsed(elapsedSeconds),
    clockIn,
    clockOut,
    toggleClock,
    isClockedIn: clock.isClockedIn,
  }
}
