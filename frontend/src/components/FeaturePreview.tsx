import { motion } from 'framer-motion'

const FeatureIcons: Record<string, React.ReactNode> = {
  clock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  document: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  trophy: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ),
  card: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  dollar: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  ),
  bot: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1a7 7 0 01-7 7H9a7 7 0 01-7-7H1a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z"/>
      <circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>
    </svg>
  ),
  lightning: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  shield: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  orgchart: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <rect x="2" y="14" width="8" height="4" rx="1"/>
      <rect x="14" y="14" width="8" height="4" rx="1"/>
      <line x1="12" y1="6" x2="12" y2="11"/>
      <line x1="6" y1="14" x2="6" y2="11"/>
      <line x1="18" y1="14" x2="18" y2="11"/>
      <line x1="6" y1="11" x2="18" y2="11"/>
    </svg>
  ),
}

const FEATURES = [
  { iconKey: 'clock', title: 'Time Clock', desc: 'Clock in/out with one click. Real-time earnings display and break tracking.' },
  { iconKey: 'document', title: 'Timesheet', desc: 'View, edit, and submit all your time entries. Track hours by project and task.' },
  { iconKey: 'trophy', title: 'Rewards', desc: 'Gamified daily streaks and real-time earnings Odometer for every second worked.' },
  { iconKey: 'card', title: 'Payroll & Reports', desc: 'Full pay details, analytics dashboards, and exportable reports.' },
  { iconKey: 'dollar', title: 'AI Tax Filing', desc: 'Upload your W-2 or 1099 and Swifty AI fills out your 1040 instantly.' },
  { iconKey: 'bot', title: 'AI Assistant', desc: 'Chat with Swifty for instant HR answers, leave policy info, and more.' },
  { iconKey: 'lightning', title: 'InstaApply', desc: 'Upload your resume once - get matched to jobs and apply in seconds.' },
  { iconKey: 'shield', title: 'Insurance & Benefits', desc: 'Browse and manage your health, dental, and vision benefits.' },
  { iconKey: 'orgchart', title: 'Org Chart', desc: 'Visualize your entire company structure at a glance.' },
]

interface FeaturePreviewProps {
  onClose: () => void
  accentHex?: string
}

export function FeaturePreview({ onClose, accentHex = '#D7FE51' }: FeaturePreviewProps) {
  const isDark = ['#D7FE51', '#E5E7EB', '#51FEFE', '#FE51D7'].includes(accentHex)
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25 }}
        className="glass w-full max-w-[560px] rounded-3xl border border-white/10 overflow-hidden"
        style={{ boxShadow: `0 0 60px -20px ${accentHex}25, 0 28px 72px -14px rgba(0,0,0,0.85)` }}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs tracking-[3px] uppercase" style={{ color: accentHex }}>
              Product Tour
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors text-2xl leading-none w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5"
              aria-label="Close feature preview"
            >
              ×
            </button>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mb-1">Everything you need.</h2>
          <p className="text-zinc-500 text-sm">SwiftShift is your all-in-one AI-powered HR platform.</p>
        </div>

        {/* Feature grid */}
        <div className="px-8 pb-6 max-h-[50vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/8 p-4 hover:border-white/15 transition-colors"
                style={{ background: 'rgba(255,255,255,0.025)' }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `${accentHex}15`, color: accentHex, border: `1px solid ${accentHex}25` }}
                >
                  {FeatureIcons[f.iconKey]}
                </div>
                <div className="font-semibold text-sm mb-1 text-white">{f.title}</div>
                <div className="text-xs text-zinc-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 pt-2 border-t border-white/8">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: accentHex, color: isDark ? '#000' : '#fff' }}
          >
            Got it - let's go
          </button>
        </div>
      </motion.div>
    </div>
  )
}
