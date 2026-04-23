import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { TimeEntry } from '../types'
import { format } from 'date-fns'

interface QuickAddProps {
  onAdd: (entry: Omit<TimeEntry, 'id' | 'duration'>) => void
  disabled?: boolean
}

const PROJECTS = ['Engineering', 'Design', 'Sales', 'Marketing']
const TASKS = ['Development', 'Review', 'Meeting', 'Admin', 'Planning']

export function QuickAdd({ onAdd, disabled }: QuickAddProps) {
  const [isOpen, setIsOpen] = useState(false)
  const getDefaultTimes = () => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60000)
    return {
      date: format(now, 'yyyy-MM-dd'),
      project: PROJECTS[0],
      task: TASKS[0],
      startTime: oneHourAgo.toTimeString().slice(0, 5),
      endTime: now.toTimeString().slice(0, 5),
      description: '',
    }
  }

  const [form, setForm] = useState(getDefaultTimes())

  const descRef = useRef<HTMLTextAreaElement>(null)
  const startRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut: Cmd/Ctrl + K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!disabled) {
          setForm(getDefaultTimes())
          setIsOpen(true)
          setTimeout(() => startRef.current?.focus(), 100)
        }
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, disabled])

  // Reset defaults when opening
  const openForm = () => {
    if (!disabled) {
      setForm(getDefaultTimes())
      setIsOpen(true)
      setTimeout(() => startRef.current?.focus(), 100)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.startTime || !form.endTime) {
      toast.error('Please set start and end times')
      return
    }

    onAdd(form)
    toast.success('Time entry added! ✅', {
      description: `${form.project} • ${form.task}`
    })
    confetti({ particleCount: 60, spread: 55, origin: { y: 0.65 }, ticks: 50 })

    // Reset form but keep date/project/task
    setForm(prev => ({
      ...prev,
      startTime: '09:00',
      endTime: '10:00',
      description: '',
    }))
    
    // Keep open for rapid entry
    setTimeout(() => startRef.current?.focus(), 50)
  }

  return (
    <div className="mb-6">
      <AnimatePresence>
        {!isOpen ? (
          <motion.button
            onClick={openForm}
            disabled={disabled}
            className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-3 text-zinc-400 hover:text-white hover:shadow-[0_0_20px_-6px_rgba(255,255,255,0.15)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Add a custom time entry (project, task, times)"
            whileHover={{ scale: disabled ? 1 : 1.01 }}
          >
            <span className="text-2xl">+</span>
            <span className="font-medium">Add time entry</span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 font-mono" title="Keyboard shortcut">⌘K</span>
          </motion.button>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="glass rounded-3xl p-6 space-y-4"
          >
            <div className="flex justify-between items-center mb-2">
              <div className="text-lg font-semibold">New Time Entry</div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full glass-input rounded-xl px-4 py-3 font-medium"
                  disabled={disabled}
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Project</label>
                <select
                  value={form.project}
                  onChange={e => setForm({ ...form, project: e.target.value })}
                  className="w-full glass-input rounded-xl px-4 py-3 font-medium"
                  disabled={disabled}
                >
                  {PROJECTS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Task</label>
                <select
                  value={form.task}
                  onChange={e => setForm({ ...form, task: e.target.value })}
                  className="w-full glass-input rounded-xl px-4 py-3 font-medium"
                  disabled={disabled}
                >
                  {TASKS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Start</label>
                  <input
                    ref={startRef}
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm({ ...form, startTime: e.target.value })}
                    className="w-full glass-input rounded-xl px-4 py-3 font-mono"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">End</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm({ ...form, endTime: e.target.value })}
                    className="w-full glass-input rounded-xl px-4 py-3 font-mono"
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Notes (optional)</label>
              <textarea
                ref={descRef}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What did you work on?"
                className="w-full glass-input rounded-xl px-4 py-3 resize-y min-h-[60px]"
                disabled={disabled}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={disabled}
                className="flex-1 py-3 bg-white text-black font-semibold rounded-2xl hover:bg-white/90 disabled:opacity-50 transition shadow-[0_0_20px_-4px_rgba(255,255,255,0.2)]"
              >
                Add Entry
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="glass-btn px-6 py-3 rounded-2xl text-white transition"
              >
                Cancel
              </button>
            </div>

            <div className="text-center text-xs text-zinc-500 pt-1">
              Press <span className="font-mono">Enter</span> to save, <span className="font-mono">Esc</span> to cancel
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
