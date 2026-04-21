import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TimeEntry } from '../types'
import { EntryRow } from './EntryRow'
import { getWeekDates, getDayName, getDayNumber, formatDuration } from '../utils/format'

interface WeeklyGridProps {
  entriesByDate: Record<string, TimeEntry[]>
  onUpdate: (id: string, updates: Partial<TimeEntry>) => void
  onDelete: (id: string) => void
  disabled?: boolean
}

export function WeeklyGrid({ entriesByDate, onUpdate, onDelete, disabled }: WeeklyGridProps) {
  const weekDates = getWeekDates()
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})

  const toggleDay = (date: string) => {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }))
  }

  const getDayEntries = (date: string) => entriesByDate[date] || []
  const getDayTotal = (date: string) => {
    const dayEntries = getDayEntries(date)
    return dayEntries.reduce((sum, e) => sum + e.duration, 0)
  }

  return (
    <div className="glass rounded-3xl overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
        <div className="text-lg font-semibold">This Week</div>
        <div className="text-xs text-zinc-500">Click any field to edit</div>
      </div>

      <div className="divide-y divide-white/10">
        {weekDates.map(date => {
          const dayEntries = getDayEntries(date)
          const dayTotal = getDayTotal(date)
          const isExpanded = expandedDays[date] !== false // default expanded
          const hasEntries = dayEntries.length > 0

          return (
            <div key={date} className="px-6 py-4">
              <button
                onClick={() => toggleDay(date)}
                className="w-full flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium text-lg leading-none">{getDayName(date)}</div>
                    <div className="text-sm text-zinc-500">{getDayNumber(date)}</div>
                  </div>
                  
                  {hasEntries && (
                    <div className="px-3 py-1 rounded-full bg-white/10 text-white text-sm font-mono neon-green">
                      {formatDuration(dayTotal)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  {hasEntries ? (
                    <span>{dayEntries.length} entr{dayEntries.length === 1 ? 'y' : 'ies'}</span>
                  ) : (
                    <span className="text-zinc-600">No entries</span>
                  )}
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    className="text-xs"
                  >
                    ▼
                  </motion.span>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && hasEntries && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 pl-4 pr-2 border-l-2 border-white/10 ml-1 mt-2 space-y-1">
                      {dayEntries.map(entry => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          onUpdate={onUpdate}
                          onDelete={onDelete}
                          disabled={disabled}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!hasEntries && (
                <div className="text-xs text-zinc-500 pl-1 mt-1 flex items-center gap-2">
                  <span>No time logged yet.</span>
                  <span className="text-emerald-400">Tap +15m above or clock in.</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
