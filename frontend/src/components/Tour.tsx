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

const PaletteIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
)

interface TourStep {
  icon: React.ReactNode
  title: string
  desc: string
  why: string
  targetId: string | null
  viewId: string | null
  highlightId?: string | null
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: <SparkleIcon />,
    title: 'Welcome to SwiftShift!',
    desc: "You're in. Let's take a 60-second tour of the key features so you can hit the ground running.",
    why: 'Knowing where everything lives saves you time on day one and helps you get paid faster.',
    targetId: null,
    viewId: null,
    highlightId: null,
  },
  {
    icon: <ClockIcon />,
    title: 'Time Clock',
    desc: 'Clock in and out with one click. Your earnings update in real time - every second counts. Track breaks too.',
    why: 'One tap replaces the whole punch-card ritual. The less friction between you and getting paid, the better.',
    targetId: 'nav-clock',
    viewId: 'clock',
    highlightId: 'nav-clock',
  },
  {
    icon: <DocumentIcon />,
    title: 'Timesheet',
    desc: 'All your time entries in one place. Add, edit, and submit your weekly timesheet with ease. You can even use natural language: just type "I worked 8 hours Monday" or "add 7.5 hours today" and it figures out the rest.',
    why: 'A clean, accurate timesheet means no surprises on payday and a permanent record you can always reference.',
    targetId: 'nav-timesheet',
    viewId: 'timesheet',
    highlightId: 'nav-timesheet',
  },
  {
    icon: <TrophyIcon />,
    title: 'Rewards',
    desc: "Stay consistent and earn streak rewards. Watch your real-time earnings climb on the Odometer, a live earnings counter that ticks up every second while you're clocked in, so you can literally see money being made.",
    why: 'This gives you instant gratification and helps connect the work to the reward - motivation you can actually see.',
    targetId: 'nav-rewards',
    viewId: 'rewards',
    highlightId: 'nav-rewards',
  },
  {
    icon: <CreditCardIcon />,
    title: 'Payroll & Reports',
    desc: 'View pay details, export reports, and track your analytics - all in one dashboard. It also gives you live updates on taxes withheld so you always know exactly how much of your check goes where - no surprises.',
    why: 'Visibility into your pay breakdown and history means you always know where your money is and where it came from.',
    targetId: 'nav-payroll',
    viewId: 'payroll',
    highlightId: 'nav-payroll',
  },
  {
    icon: <DollarIcon />,
    title: 'AI Tax Filing - Swifty',
    desc: "Upload your W-2 or 1099 and Swifty fills out your Form 1040 instantly. No accountant needed. It's completely free, and frankly it'll do a better job than a human accountant, with zero errors and zero waiting.",
    why: 'Tax prep can cost hundreds of dollars and hours of stress. Swifty handles it in seconds so you can file with confidence.',
    targetId: 'nav-groktax',
    viewId: 'groktax',
    highlightId: 'nav-groktax',
  },
  {
    icon: <BotIcon />,
    title: 'AI Assistant - Swifty',
    desc: 'Ask Swifty anything - leave policies, HR questions, company info. Instant, intelligent answers.',
    why: 'Having an always-available HR expert in your pocket means fewer blockers and faster answers when you need them most.',
    targetId: 'nav-grokky',
    viewId: 'grokky',
    highlightId: 'nav-grokky',
  },
  {
    icon: <LightningIcon />,
    title: 'InstaApply',
    desc: "Upload your resume once. SwiftShift matches you to the perfect jobs for your skills and experience, then applies for you automatically so you don't have to retype your info 1000x. No more making a new account for every job app. No more filling out your employment history over and over. Just one upload and you're done.",
    why: 'The best opportunities move fast. InstaApply makes sure you never miss a role that fits - with zero extra effort.',
    targetId: 'nav-applications',
    viewId: 'applications',
    highlightId: 'nav-applications',
  },
  {
    icon: <PaletteIcon />,
    title: 'Personalize Your Theme',
    desc: "SwiftShift has 6 color themes you can switch any time. Click your name in the top-right corner and select 'Theme' to cycle through Green, White, Orange, Cyan, Pink, and Purple.",
    why: "Your workspace should feel like yours. Pick the vibe that keeps you focused.",
    targetId: null,
    viewId: null,
    highlightId: null,
  },
  {
    icon: <CheckCircleIcon />,
    title: "You're all set!",
    desc: "That covers the highlights. Start by clocking in - your first session is just one click away.",
    why: "You've unlocked +50 XP just for completing the tour. Every feature you use from here builds your streak and earnings.",
    targetId: null,
    viewId: 'clock',
    highlightId: null,
  },
]

const BOX_WIDTH = 560

interface TourProps {
  onClose: () => void
  onNavigate?: (viewId: string) => void
  onComplete?: () => void
  accentHex?: string
}

export function Tour({ onClose, onNavigate, onComplete, accentHex = '#D7FE51' }: TourProps) {
  const [step, setStep] = useState(0)
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)

  const current = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1
  const isDark = ['#D7FE51', '#E5E7EB', '#51FEFE', '#FE51D7'].includes(accentHex)

  useEffect(() => {
    // Navigate to the view for this step
    if (current.viewId && onNavigate) {
      onNavigate(current.viewId)
    }

    // Update highlight circle target
    const highlightTarget = current.highlightId ? document.getElementById(current.highlightId) : null
    if (highlightTarget) {
      setHighlightRect(highlightTarget.getBoundingClientRect())
    } else {
      setHighlightRect(null)
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
  }, [step, current.targetId, current.viewId, current.highlightId, accentHex, onNavigate])

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
    // Navigate back to clock tab at end
    if (onNavigate) onNavigate('clock')
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: [accentHex, '#39FF14', '#00CC00'] })
    setTimeout(() => confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, colors: [accentHex] }), 250)
    if (onComplete) onComplete()
    onClose()
  }

  const next = () => { if (isLast) finish(); else setStep(s => s + 1) }
  const prev = () => { if (step > 0) setStep(s => s - 1) }

  return (
    <div
      className="fixed inset-0 z-[300]"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Highlight circle around referenced element */}
      <AnimatePresence>
        {highlightRect && (
          <motion.div
            key={`circle-${step}`}
            initial={{ opacity: 0, scale: 1.3 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              left: highlightRect.left - 8,
              top: highlightRect.top - 8,
              width: highlightRect.width + 16,
              height: highlightRect.height + 16,
              borderRadius: '16px',
              border: `2px solid ${accentHex}`,
              boxShadow: `0 0 0 4px ${accentHex}30, 0 0 24px ${accentHex}50`,
              pointerEvents: 'none',
              zIndex: 301,
            }}
          />
        )}
      </AnimatePresence>

      {/* Tour box: fixed at center-bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 16px',
          zIndex: 302,
          pointerEvents: 'none',
        }}
      >
      <motion.div
        key={`box-${step}`}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 38 }}
        className="glass rounded-3xl border border-white/10"
        style={{
          width: BOX_WIDTH,
          maxWidth: '100%',
          boxShadow: `0 0 80px -20px ${accentHex}35, 0 28px 72px -14px rgba(0,0,0,0.85)`,
          pointerEvents: 'all',
        }}
      >
        <div className="px-7 py-5">
          {/* Progress bar */}
          <div className="h-0.5 rounded-full bg-white/10 mb-4 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: accentHex }}
              animate={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          {/* Step counter */}
          <div className="text-xs tracking-[2px] text-zinc-500 mb-3 uppercase">
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
              className="flex gap-5 items-start"
            >
              {/* Icon */}
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${accentHex}15`,
                  color: accentHex,
                  border: `1px solid ${accentHex}28`,
                }}
              >
                {current.icon}
              </div>

              <div className="flex-1 min-w-0">
                {/* Title */}
                <h2
                  className="text-lg font-semibold tracking-tight mb-1.5"
                  style={{ color: step === 0 || isLast ? accentHex : 'white' }}
                >
                  {current.title}
                </h2>

                {/* Description */}
                <p className="text-zinc-400 text-sm leading-relaxed mb-2">
                  {current.desc}
                </p>

                {/* Why it matters */}
                <p className="text-sm leading-relaxed" style={{ color: `${accentHex}bb` }}>
                  {current.why}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Actions row */}
          <div className="flex items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip tour
              </button>
              {/* Progress dots */}
              <div className="flex gap-1.5 items-center">
                {TOUR_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    aria-label={`Go to step ${i + 1}`}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: i === step ? '14px' : '5px',
                      height: '5px',
                      backgroundColor: i === step ? accentHex : i < step ? `${accentHex}55` : 'rgba(255,255,255,0.12)',
                    }}
                  />
                ))}
              </div>
            </div>
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
        </div>
      </motion.div>
      </div>
    </div>
  )
}
