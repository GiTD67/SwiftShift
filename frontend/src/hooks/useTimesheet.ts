import { useState, useEffect, useCallback, useMemo } from 'react'
import { TimeEntry, TimesheetState } from '../types'
import { getSampleEntries } from '../utils/sampleData'
import { calculateDuration } from '../utils/format'

const TIMESHEET_STORAGE_KEY = 'swiftshift-timesheet'

export function useTimesheet() {
  const [state, setState] = useState<TimesheetState>(() => {
    const saved = localStorage.getItem(TIMESHEET_STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
    return {
      entries: getSampleEntries(),
      clock: {
        isClockedIn: false,
        clockInTime: null,
        lastActionTime: null,
      },
      submitted: false,
    }
  })

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(TIMESHEET_STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const addEntry = useCallback((entry: Omit<TimeEntry, 'id' | 'duration'>) => {
    const duration = calculateDuration(entry.startTime, entry.endTime)
    const newEntry: TimeEntry = {
      ...entry,
      id: `entry-${Date.now()}`,
      duration,
    }
    setState(prev => ({
      ...prev,
      entries: [...prev.entries, newEntry].sort((a, b) => 
        b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)
      ),
    }))
    return newEntry
  }, [])

  const updateEntry = useCallback((id: string, updates: Partial<TimeEntry>) => {
    setState(prev => ({
      ...prev,
      entries: prev.entries.map(entry => {
        if (entry.id === id) {
          const updated = { ...entry, ...updates }
          // Recalculate duration if times changed
          if (updates.startTime || updates.endTime) {
            updated.duration = calculateDuration(
              updated.startTime,
              updated.endTime
            )
          }
          return updated
        }
        return entry
      }),
    }))
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      entries: prev.entries.filter(entry => entry.id !== id),
    }))
  }, [])

  const submitTimesheet = useCallback(() => {
    setState(prev => ({ ...prev, submitted: true }))
  }, [])

  const resetTimesheet = useCallback(() => {
    localStorage.removeItem(TIMESHEET_STORAGE_KEY)
    setState({
      entries: getSampleEntries(),
      clock: {
        isClockedIn: false,
        clockInTime: null,
        lastActionTime: null,
      },
      submitted: false,
    })
  }, [])

  // Computed values
  const totalMinutes = useMemo(() => {
    return state.entries.reduce((sum, entry) => sum + entry.duration, 0)
  }, [state.entries])

  const totalHours = useMemo(() => totalMinutes / 60, [totalMinutes])

  const entriesByDate = useMemo(() => {
    const grouped: Record<string, TimeEntry[]> = {}
    state.entries.forEach(entry => {
      if (!grouped[entry.date]) grouped[entry.date] = []
      grouped[entry.date].push(entry)
    })
    return grouped
  }, [state.entries])

  const projectBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    state.entries.forEach(entry => {
      breakdown[entry.project] = (breakdown[entry.project] || 0) + entry.duration
    })
    return Object.entries(breakdown)
      .map(([project, minutes]) => ({ project, minutes, hours: minutes / 60 }))
      .sort((a, b) => b.minutes - a.minutes)
  }, [state.entries])

  return {
    entries: state.entries,
    clock: state.clock,
    submitted: state.submitted,
    totalMinutes,
    totalHours,
    entriesByDate,
    projectBreakdown,
    addEntry,
    updateEntry,
    deleteEntry,
    submitTimesheet,
    resetTimesheet,
  }
}
