import { motion } from 'framer-motion'

interface SummaryProps {
  totalHours: number
  projectBreakdown: Array<{ project: string; minutes: number; hours: number }>
}

export function Summary({ totalHours, projectBreakdown }: SummaryProps) {
  const targetHours = 40
  const progress = Math.min((totalHours / targetHours) * 100, 100)
  const isOver = totalHours > targetHours

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="text-sm uppercase tracking-[2px] text-zinc-500">WEEK TOTAL</div>
          <div className="text-6xl font-semibold tabular-nums mt-1 flex items-baseline gap-1">
            {totalHours.toFixed(1)}
            <span className="text-2xl text-zinc-500 font-normal">hrs</span>
          </div>
        </div>
        
        <div className={`px-4 py-1.5 rounded-full text-sm font-medium ${
          isOver 
            ? 'bg-orange-500/20 text-orange-400' 
            : 'bg-emerald-500/20 text-emerald-400'
        }`}>
          {isOver ? 'Overtime' : 'On track'}
        </div>
      </div>

      {/* Progress bar - Crystal tube */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-zinc-500 mb-2">
          <span>Goal: {targetHours}h</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="crystal-progress">
          <motion.div
            className={`crystal-progress-fill ${isOver ? 'bg-orange-500' : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div>
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">BY PROJECT</div>
        <div className="space-y-3">
          {projectBreakdown.length > 0 ? (
            projectBreakdown.map(({ project, hours }, i) => (
              <div key={project} className="flex items-center gap-3">
                <div className="w-24 text-sm truncate">{project}</div>
                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white/70 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(hours / totalHours) * 100}%` }}
                    transition={{ delay: i * 0.05 }}
                  />
                </div>
                <div className="w-12 text-right font-mono text-sm text-zinc-400 tabular-nums">
                  {hours.toFixed(1)}h
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-zinc-500 italic">No data yet</div>
          )}
        </div>
      </div>
    </div>
  )
}
