import { motion, AnimatePresence } from 'framer-motion'
import { StateBreakRule } from '../data/stateBreakRules'

interface BreakReminderModalProps {
  isOpen: boolean
  rule: StateBreakRule
  hoursWorked: number
  isSecondBreak?: boolean
  onStartBreak: () => void
  onDismiss: () => void
}

export function BreakReminderModal({
  isOpen,
  rule,
  hoursWorked,
  isSecondBreak = false,
  onStartBreak,
  onDismiss,
}: BreakReminderModalProps) {
  const hh = Math.floor(hoursWorked)
  const mm = Math.round((hoursWorked - hh) * 60)
  const workedLabel = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`

  const breakOrdinal = isSecondBreak ? 'second' : 'first'
  const title = isSecondBreak
    ? `Second Meal Break Required`
    : `Meal Break Required`

  const urgencyColor = hoursWorked >= rule.triggerAfterHours + 0.5 ? '#ef4444' : 'var(--accent-color)'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={e => e.stopPropagation()}
            className="glass rounded-3xl p-8 max-w-md w-full shadow-2xl"
            style={{ border: `1px solid ${urgencyColor}44` }}
          >
            {/* Icon + state badge */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${urgencyColor}22`, border: `1px solid ${urgencyColor}44`, color: urgencyColor }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
                  <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[2px] text-zinc-500">
                  {rule.name} Labor Law
                </div>
                <div className="font-semibold text-lg" style={{ color: urgencyColor }}>
                  {title}
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="glass rounded-2xl p-4 mb-5">
              <p className="text-sm text-zinc-300 leading-relaxed">
                You've worked <span className="font-semibold text-white">{workedLabel}</span> - {rule.name} requires a{' '}
                <span className="font-semibold text-white">
                  {rule.mealBreakMinutes}-minute {rule.isPaid ? 'paid' : 'unpaid'}
                </span>{' '}
                meal break before the {isSecondBreak ? '10th' : `${rule.triggerAfterHours + 1}th`} hour of work.
              </p>
            </div>

            {/* Law cite */}
            <div className="text-xs text-zinc-500 mb-6 px-1">
              {rule.note}
            </div>

            {/* Progress indicator */}
            <div className="mb-6">
              <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
                <span>Hours worked this session</span>
                <span className="font-mono" style={{ color: urgencyColor }}>{workedLabel}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (hoursWorked / (rule.triggerAfterHours + 1)) * 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: urgencyColor }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <motion.button
                onClick={onStartBreak}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm text-black"
                style={{ background: urgencyColor }}
              >
                Start {breakOrdinal} break now
              </motion.button>
              <motion.button
                onClick={onDismiss}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                className="px-5 py-3 rounded-2xl text-sm border border-white/20 hover:bg-white/5 text-zinc-400"
              >
                Remind later
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
