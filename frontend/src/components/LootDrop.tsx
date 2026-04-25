import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

interface LootDropProps {
  isOpen: boolean
  onClose: () => void
  earnings: number // dollars earned this session
  ptoHours: number // PTO hours accrued this session
  durationMin: number
  theme?: 'green' | 'white' | 'orange' | 'cyan' | 'pink' | 'purple' | 'custom'
}

// Funny clock-out messages - random each time
const FUNNY_MESSAGES = [
  "Another day, another dollar. Mostly.",
  "Congratulations! You survived today.",
  "You did it! Another day in the books.",
  "Not bad. The boss might even notice.",
  "Heroic effort. The coffee is proud of you.",
  "You made it through the chaos. Nice.",
  "Clocked out like a pro. Take a bow.",
  "You crushed it. Now go do something fun.",
  "Victory! The inbox didn't win this time.",
  "Done. You're basically unstoppable.",
  "Logged out. Time to pretend you have hobbies.",
  "Your future self says thank you for not burning out.",
  "Great work today. Your bed is proud.",
  "And that's a wrap! Oscar-worthy performance.",
  "You showed up. You worked. You won. Go rest.",
  "Outta here. The keyboard breathes a sigh of relief.",
  "Another shift done. The coffee machine is jealous.",
  "You clocked out. The universe applauds.",
  "Well done, champion. See you tomorrow.",
  "You made the company proud. Now go make yourself proud.",
  "That's a day. Not bad. Not bad at all.",
  "Shift complete. Time to be a normal human again.",
  "You're done. Go be magnificent elsewhere.",
  "Exit stage left. Perfectly executed.",
  "Money secured. Dignity intact. Go home.",
  "The spreadsheet has been fed. You may leave.",
  "Productivity: achieved. Pants: optional now.",
  "Clock stopped. You cannot be stopped.",
  "Outstanding work. The Wi-Fi will miss you.",
  "You earned it. Every cent, every minute.",
  "Pack it up. Legend detected.",
  "Shift's over. Your couch has been waiting all day.",
  "You came, you worked, you conquered. Mic drop.",
  "Day complete. Human achievement unlocked.",
  "Rest mode activated. You've earned it.",
  "Time to recharge. You were absolutely electric today.",
  "Clocked out before overtime. Respectable restraint.",
  "That meeting could have been an email, but you survived anyway.",
  "Professional. Efficient. Possibly a robot. Impressive.",
  "Your bank account is smiling. Go celebrate.",
]

function getRandomMessage(): string {
  return FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)]
}

export function LootDrop({ isOpen, onClose, earnings, ptoHours, durationMin, theme = 'green' }: LootDropProps) {
  const [stage, setStage] = useState<'dropping' | 'settled'>('dropping')
  const [dailyMessage, setDailyMessage] = useState(() => getRandomMessage())
  const hasFiredConfettiRef = useRef(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      hasFiredConfettiRef.current = false
      setDailyMessage(getRandomMessage())
    }
  }, [isOpen])

  // Theme-aware accent color
  const themeColors: Record<'green' | 'white' | 'orange' | 'cyan' | 'pink' | 'purple' | 'custom', string> = {
    green: '#D7FE51',
    white: '#E5E7EB',
    orange: '#F97316',
    cyan: '#51FEFE',
    pink: '#FE51D7',
    purple: '#9B51FE',
    custom: '#00FF88',
  }
  const accentColor = themeColors[theme ?? 'green']

  // Auto-close after animation
  useEffect(() => {
    if (!isOpen) {
      setStage('dropping')
      return
    }

    // Confetti burst — theme color only, fires exactly once per modal open
    const burst = () => {
      if (hasFiredConfettiRef.current) return
      hasFiredConfettiRef.current = true
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: [accentColor],
        ticks: 60, // ~1.0s particle lifetime
      })
    }

    // Single burst — fires only once
    burst()

    // Settle stage after coins drop
    const settleTimer = setTimeout(() => {
      setStage('settled')
    }, 1800)

    // NO auto-close — user must dismiss manually

    return () => {
      clearTimeout(settleTimer)
    }
  }, [isOpen, onClose, accentColor])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90" onClick={onClose}>
        {/* Background glow particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white/40"
              style={{
                left: `${20 + (i % 5) * 15}%`,
                top: `${30 + Math.floor(i / 5) * 20}%`,
              }}
              animate={{
                y: [0, -40, 0],
                opacity: [0.2, 0.8, 0.2],
              }}
              transition={{
                duration: 2 + (i % 3),
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-sm mx-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Vault container */}
          <div
            className="glass rounded-3xl p-6 text-center relative overflow-hidden border border-white/20"
            style={{ boxShadow: `0 0 80px -20px ${accentColor}35, 0 28px 72px -14px rgba(0,0,0,0.85)` }}
          >
            {/* Close X — absolute top-right corner */}
            <button
              onClick={onClose}
              className="absolute top-2 right-3 w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white text-2xl leading-none z-10 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
            {/* Funny message */}
            <div className="text-xl font-semibold tracking-tight text-center leading-tight mb-4" style={{ color: accentColor }}>
              {dailyMessage}
            </div>

            <div className="mb-1 text-xs uppercase tracking-[2px] text-white/60">END OF DAY</div>

            {/* The Vault */}
            <div className="relative mx-auto w-32 h-32 mb-6">
              <motion.div
                className="absolute inset-0 rounded-full border-[14px] border-white/30"
                animate={{ 
                  boxShadow: stage === 'settled' 
                    ? '0 0 80px 20px rgba(255,255,255,0.3)' 
                    : '0 0 40px 10px rgba(255,255,255,0.2)' 
                }}
                transition={{ duration: 0.6 }}
              />
              <div className="absolute inset-3 rounded-full border-4 border-white/10 flex items-center justify-center">
                <div className="text-center">
                  <div className="font-mono text-3xl font-semibold tabular-nums text-white">
                    {(durationMin / 60).toFixed(1)}
                  </div>
                  <div className="text-[10px] uppercase tracking-[1px] text-zinc-400 -mt-1">hours</div>
                </div>
              </div>

              {/* Falling coins animation (coins removed per spec) */}

              {/* PTO floating numbers */}
              <AnimatePresence>
                {stage === 'dropping' && ptoHours > 0 && (
                  <motion.div
                    className="absolute top-6 right-6 text-[#CFF64E] font-mono text-sm font-semibold px-2 py-0.5 bg-black/40 rounded"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: [0, 1, 0], y: [-10, -45] }}
                    transition={{ duration: 1.6, ease: 'easeOut' }}
                  >
                    +{ptoHours.toFixed(3)}h PTO
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Summary */}
            <div className="space-y-4">
              <div>
                <div className="text-xs text-zinc-500 mb-1">YOU EARNED</div>
                <div className="text-4xl font-semibold tabular-nums tracking-tight text-white">
                  ${earnings.toFixed(2)}
                </div>
              </div>

              {ptoHours > 0.001 && (
                <div className="text-sm text-zinc-400">
                  +{ptoHours.toFixed(3)} hours PTO accrued
                </div>
              )}

              <div className="pt-4 border-t border-white/10 text-xs text-zinc-500">
                Session: {Math.floor(durationMin / 60)}h {durationMin % 60}m
              </div>
            </div>

            {/* Settled state: "Deposited" message */}
            {stage === 'settled' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-6 text-sm font-medium"
                style={{ color: accentColor }}
              >
                ✓ Deposited to your vault
              </motion.div>
            )}
          </div>

          {/* Tap to skip hint */}
          <div 
            className="text-center text-[10px] text-zinc-500 mt-4 cursor-pointer"
            onClick={onClose}
          >
            tap anywhere to skip
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
