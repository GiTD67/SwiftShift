import { useState } from 'react'
import { motion } from 'framer-motion'
import { TimeEntry } from '../types'
import { formatDuration } from '../utils/format'
import { toast } from 'sonner'

interface EntryRowProps {
  entry: TimeEntry
  onUpdate: (id: string, updates: Partial<TimeEntry>) => void
  onDelete: (id: string) => void
  disabled?: boolean
}

const PROJECTS = ['Engineering', 'Design', 'Sales', 'Marketing']
const TASKS = ['Development', 'Review', 'Meeting', 'Admin', 'Planning']

export function EntryRow({ entry, onUpdate, onDelete, disabled }: EntryRowProps) {
  const [editing, setEditing] = useState<keyof TimeEntry | null>(null)
  const [tempValue, setTempValue] = useState<string>('')

  const startEdit = (field: keyof TimeEntry, current: string) => {
    if (disabled) return
    setEditing(field)
    setTempValue(current)
  }

  const saveEdit = () => {
    if (editing && tempValue !== entry[editing]) {
      onUpdate(entry.id, { [editing]: tempValue } as Partial<TimeEntry>)
      toast.success('Updated')
    }
    setEditing(null)
  }

  const cancelEdit = () => {
    setEditing(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-center gap-3 py-3 px-4 rounded-2xl hover:bg-zinc-900/50 transition-all border border-transparent hover:border-white/10"
    >
      {/* Project */}
      <div className="w-28 shrink-0">
        {editing === 'project' ? (
          <select
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="bg-zinc-800 text-sm rounded-lg px-2 py-1 w-full border border-white/20 focus:outline-none"
          >
            {PROJECTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        ) : (
          <div
            onClick={() => startEdit('project', entry.project)}
            className="text-sm font-medium cursor-pointer hover:text-white/70 transition"
          >
            {entry.project}
          </div>
        )}
      </div>

      {/* Task */}
      <div className="w-24 shrink-0">
        {editing === 'task' ? (
          <select
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="bg-zinc-800 text-sm rounded-lg px-2 py-1 w-full border border-white/20 focus:outline-none"
          >
            {TASKS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        ) : (
          <div
            onClick={() => startEdit('task', entry.task)}
            className="text-sm text-zinc-400 cursor-pointer hover:text-white/70 transition"
          >
            {entry.task}
          </div>
        )}
      </div>

      {/* Time range */}
      <div className="w-32 shrink-0 font-mono text-sm flex items-center gap-1">
        {editing === 'startTime' ? (
          <input
            type="time"
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="bg-zinc-800 text-sm rounded-lg px-2 py-1 w-full border border-white/20 focus:outline-none"
          />
        ) : (
          <span
            onClick={() => startEdit('startTime', entry.startTime)}
            className="cursor-pointer hover:text-white/70 transition"
          >
            {entry.startTime}
          </span>
        )}
        <span className="text-zinc-600">—</span>
        {editing === 'endTime' ? (
          <input
            type="time"
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="bg-zinc-800 text-sm rounded-lg px-2 py-1 w-full border border-white/20 focus:outline-none"
          />
        ) : (
          <span
            onClick={() => startEdit('endTime', entry.endTime)}
            className="cursor-pointer hover:text-white/70 transition"
          >
            {entry.endTime}
          </span>
        )}
      </div>

      {/* Duration */}
      <div className="w-16 shrink-0 text-right font-mono text-sm text-white tabular-nums">
        {formatDuration(entry.duration)}
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0 text-sm text-zinc-400 truncate pr-2">
        {editing === 'description' ? (
          <input
            value={tempValue}
            onChange={e => setTempValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="bg-zinc-800 text-sm rounded-lg px-3 py-1 w-full border border-white/20 focus:outline-none"
            placeholder="Notes..."
          />
        ) : (
          <div
            onClick={() => startEdit('description', entry.description)}
            className="cursor-pointer hover:text-white/70 transition truncate"
          >
            {entry.description || <span className="italic opacity-50">—</span>}
          </div>
        )}
      </div>

      {/* Delete - always visible for zero-friction mobile */}
      {!disabled && (
        <motion.button
          onClick={() => {
            onDelete(entry.id)
            toast.error('Entry deleted')
          }}
          className="text-red-500/60 hover:text-red-400 p-1 transition text-sm"
          whileHover={{ scale: 1.2 }}
          title="Delete"
        >
          ✕
        </motion.button>
      )}
    </motion.div>
  )
}
