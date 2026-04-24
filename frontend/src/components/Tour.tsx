import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

// Fintech-style SVG icon components
const ClockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)

const DocumentIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)

const TrophyIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
  </svg>
)

const CreditCardIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
    <line x1="6" y1="15" x2="10" y2="15"/>
  </svg>
)

const DollarIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
)

const BotIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1a7 7 0 01-7 7H9a7 7 0 01-7-7H1a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z"/>
    <circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>
  </svg>
)

const LightningIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)

const CheckCircleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)

const SparkleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.1-6.2-4.5-6.2 4.5 2.4-7.1L2 9.4h7.6L12 2z"/>
  </svg>
)

interface TourStep {
  icon: React.ReactNode
  title: string
  desc: string
  why: string
  targetId: string | null
  viewId: string | null
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: <SparkleIcon />,
    title: 'Welcome to SwiftShift!',
    desc: "You're in. Let's take a 60-second tour of the key features so you can hit the ground running.",
    why: 'Knowing where everything lives saves you time on day one and helps you get paid faster.',
    targetId: null,
    viewId: null,
  },
  {
    icon: <ClockIcon />,
    title: 'Time Clock',
    desc: 'Clock in and out with one click. Your earnings update in real time - every second counts. Track breaks too.',
    why: 'One tap replaces the whole punch-card ritual. The less friction between you and getting paid, the better.',
    targetId: 'nav-clock',
    viewId: 'clock',
  },
  {
    icon: <DocumentIcon />,
    title: 'Timesheet',
    desc: 'All your time entries in one place. Add, edit, and submit your weekly timesheet with ease.',
    why: 'A clean, accurate timesheet means no surprises on payday and a permanent record you can always reference.',
    targetId: 'nav-timesheet',
    viewId: 'timesheet',
  },
  {
    icon: <TrophyIcon />,
    title: 'Rewards',
    desc: 'Stay consistent and earn streak rewards. Watch your real-time earnings climb on the Odometer.',
    why: 'This gives you instant gratification and helps connect the work to the reward - motivation you can actually see.',
    targetId: 'nav-rewards',
    viewId: 'rewards',
  },
  {
    icon: <CreditCardIcon />,
    title: 'Payroll & Reports',
    desc: 'View pay details, export reports, and track your analytics - all in one dashboard.',
    why: 'Visibility into your pay breakdown and history means you always know where your money is and where it came from.',
    targetId: 'nav-payroll',
    viewId: 'payroll',
  },
  {
    icon: <DollarIcon />,
    title: 'AI Tax Filing - Swifty',
    desc: 'Upload your W-2 or 1099 and Swifty fills out your Form 1040 instantly. No accountant needed.',
    why: 'Tax prep can cost hundreds of dollars and hours of stress. Swifty handles it in seconds so you can file with confidence.',
    targetId: 'nav-groktax',
    viewId: 'groktax',
  },
  {
    icon: <BotIcon />,
    title: 'AI Assistant - Swifty',
    desc: 'Ask Swifty anything - leave policies, HR questions, company info. Instant, intelligent answers.',
    why: 'Having an always-available HR expert in your pocket means fewer blockers and faster answers when you need them most.',
    targetId: 'nav-grokky',
    viewId: 'grokky',
  },
  {
    icon: <LightningIcon />,
    title: 'InstaApply',
    desc: 'Upload your resume once. SwiftShift matches you to jobs and applies in seconds.',
    why: 'The best opportunities move fast. InstaApply makes sure you never miss a role that fits - with zero extra effort.',
    targetId: 'nav-applications',
    viewId: 'applications',
  },
  {
    icon: <CheckCircleIcon />,
    title: "You're all set!",
    desc: "That covers the highlights. Start by clocking in - your first session is just one click away.",
    why: "You've unlocked +50 XP just for completing the tour. Every feature you use from here builds your streak and earnings.",
    targetId: null,
    viewId: null,
  },
]

const BOX_WIDTH = 400
const BOX_HEIGHT_EST = 420

interface BoxPosition {
  top: number
  left: number
  hasArrow: boolean
  arrowTop: number
}

function computePosition(stepIndex: number): BoxPosition {
  const step = TOUR_STEPS[stepIndex]
  const centered: BoxPosition = {
    top: Math.max(64, (window.innerHeight - BOX_HEIGHT_EST) / 2),
    left: Math.max(0, (window.innerWidth - BOX_WIDTH) / 2),
    hasArrow: false,
    arrowTop: 0,
  }
  if (!step.targetId) return centered
  const target = document.getElementById(step.targetId)
  if (!target) return centered
  const rect = target.getBoundingClientRect()
  const left = 240 + 28
  const targetMidY = rect.top + rect.height / 2
  const top = Math.max(80, Math.min(window.innerHeight - BOX_HEIGHT_EST - 24, targetMidY - BOX_HEIGHT_EST / 2))
  return { top, left, hasArrow: true, arrowTop: targetMidY - top }
}

interface TourProps {
  onClose: () => void
  onNavigate?: (viewId: string) => void
  onComplete?: () => void
  accentHex?: string
}

export function Tour({ onClose, onNavigate, onComplete, accentHex = '#D7FE51' }: TourProps) {
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<BoxPosition>(() => computePosition(0))

  const current = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1
  const isDark = ['#D7FE51', '#E5E7EB', '#51FEFE', '#FE51D7'].includes(accentHex)

  useEffect(() => {
    const newPos = computePosition(step)
    setPos(newPos)

    // Navigate to the view for this step
    if (current.viewId && onNavigate) {
      onNavigate(current.viewId)
    }

    // Apply highlight to target nav button
    const target = current.targetId ? document.getElementById(current.targetId) : null
    if (target) {
      target.style.boxShadow = `0 0 0 2px ${accentHex}80, inset 3px 0 0 ${accentHex}`
      target.style.background = `${accentHex}18`
      target.style.color = '#fff'
    }
    return () => {
      if (target) {
        target.style.boxShadow = ''
        target.style.background = ''
        target.style.color = ''
      }
    }
  }, [step, current.targetId, current.viewId, accentHex, onNavigate])

  useEffect(() => {
    return () => {
      TOUR_STEPS.forEach(s => {
        if (s.targetId) {
          const el = document.getElementById(s.targetId)
          if (el) { el.style.boxShadow = ''; el.style.background = ''; el.style.color = '' }
        }
      })
    }
  }, [])

  const finish = () => {
    // Fire confetti on tour complete
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: [accentHex, '#39FF14', '#00CC00'] })
    setTimeout(() => confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, colors: [accentHex] }), 250)
    if (onComplete) onComplete()
    onClose()
  }

  const next = () => { if (isLast) finish(); else setStep(s => s + 1) }
  const prev = () => { if (step > 0) setStep(s => s - 1) }

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ top: pos.top, left: pos.left, opacity: 0, scale: 0.96 }}
        animate={{ top: pos.top, left: pos.left, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 38 }}
        className="absolute glass rounded-3xl border border-white/10"
        style={{
          width: BOX_WIDTH,
          boxShadow: `0 0 80px -20px ${accentHex}35, 0 28px 72px -14px rgba(0,0,0,0.85)`,
        }}
      >
        {/* Arrow pointing left toward sidebar */}
        <AnimatePresence>
          {pos.hasArrow && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, top: pos.arrowTop }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 38 }}
              style={{
                position: 'absolute',
                left: -11,
                width: 0,
                height: 0,
                borderTop: '11px solid transparent',
                borderBottom: '11px solid transparent',
                borderRight: `11px solid ${accentHex}`,
                transform: 'translateY(-50%)',
                filter: `drop-shadow(-2px 0 6px ${accentHex}50)`,
              }}
            />
          )}
        </AnimatePresence>

        <div className="p-8">
          {/* Progress bar */}
          <div className="h-0.5 rounded-full bg-white/10 mb-6 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: accentHex }}
              animate={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          {/* Step counter */}
          <div className="text-xs tracking-[2px] text-zinc-500 mb-5 uppercase">
            Step {step + 1} <span className="text-zinc-700">/ {TOUR_STEPS.length}</span>
          </div>

          {/* Animated content */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background: `${accentHex}15`,
                  color: accentHex,
                  border: `1px solid ${accentHex}28`,
                }}
              >
                {current.icon}
              </div>

              {/* Title */}
              <h2
                className="text-2xl font-semibold tracking-tight mb-3"
                style={{ color: step === 0 || isLast ? accentHex : 'white' }}
              >
                {current.title}
              </h2>

              {/* Description */}
              <p className="text-zinc-400 text-sm leading-relaxed mb-3">
                {current.desc}
              </p>

              {/* Why it matters */}
              <p className="text-sm leading-relaxed mb-6" style={{ color: `${accentHex}bb` }}>
                {current.why}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="px-4 py-2 rounded-xl border border-white/10 text-sm text-zinc-400 hover:bg-white/5 transition-all"
                >
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] hover:opacity-90"
                style={{ background: accentHex, color: isDark ? '#000' : '#fff' }}
              >
                {isLast ? 'Get started (+50 XP)' : 'Next'}
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-6 justify-center">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === step ? '16px' : '6px',
                  height: '6px',
                  backgroundColor: i === step ? accentHex : i < step ? `${accentHex}55` : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
