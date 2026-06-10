import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const API_BASE = ''

const inputCls =
  'glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 outline-none transition-all'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

// Employee first-run overlay. mode 'link' = unlinked account (enter an invite
// code); mode 'wizard' = linked but onboarding incomplete (confirm details).
export default function EmployeeOnboarding({
  user,
  initialCode,
  mode,
  onComplete,
  onSkip,
  onCreateCompany,
}: {
  user: any
  initialCode?: string
  mode: 'link' | 'wizard'
  onComplete: (user: any) => void
  onSkip: () => void
  onCreateCompany: () => void
}) {
  const [phase, setPhase] = useState<'link' | 'wizard'>(mode)
  const [step, setStep] = useState(1)

  // link phase
  const [code, setCode] = useState((initialCode || '').toUpperCase())
  const [lookup, setLookup] = useState<any | null>(null)
  const [joining, setJoining] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  // wizard phase
  const [acceptInfo, setAcceptInfo] = useState<any | null>(null)
  const [companyInfo, setCompanyInfo] = useState<any | null>(null)
  const [firstName, setFirstName] = useState(user?.first_name || '')
  const [lastName, setLastName] = useState(user?.last_name || '')
  const [avail, setAvail] = useState<Record<string, boolean>>({
    monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false,
  })
  const [prefStart, setPrefStart] = useState('09:00')
  const [prefEnd, setPrefEnd] = useState('17:00')
  const [finishing, setFinishing] = useState(false)

  // Debounced invite-code lookup (public endpoint, fine pre/post auth).
  useEffect(() => {
    if (phase !== 'link') return
    const trimmed = code.trim()
    if (trimmed.length < 6) { setLookup(null); return }
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/onboarding/invites/lookup?code=${encodeURIComponent(trimmed)}`)
        .then(r => r.json())
        .then(d => setLookup(d))
        .catch(() => setLookup(null))
    }, 400)
    return () => clearTimeout(t)
  }, [code, phase])

  // Wizard entered directly (resume): fetch the company for the read-only chips.
  useEffect(() => {
    if (phase !== 'wizard' || companyInfo) return
    fetch(`${API_BASE}/api/onboarding/company`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && !d.error) setCompanyInfo(d) })
      .catch(() => {})
  }, [phase, companyInfo])

  // Prefill availability from the existing endpoint once in the wizard.
  useEffect(() => {
    if (phase !== 'wizard') return
    fetch(`${API_BASE}/api/availability`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d || d.error || !d.id) return
        setAvail(Object.fromEntries(DAYS.map(day => [day, d[day] !== 'unavailable'])))
        if (d.preferred_start) setPrefStart(String(d.preferred_start).slice(0, 5))
        if (d.preferred_end) setPrefEnd(String(d.preferred_end).slice(0, 5))
      })
      .catch(() => {})
  }, [phase])

  async function joinCompany() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) { setLinkError('Enter your invite code.'); return }
    setJoining(true)
    setLinkError(null)
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/invites/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setLinkError(data?.error || 'Could not join with that code.'); return }
      setAcceptInfo(data)
      if (data.company) setCompanyInfo(data.company)
      toast.success(`Welcome to ${data.company?.name || 'the team'}!`)
      setPhase('wizard')
      setStep(1)
    } catch {
      setLinkError('Could not reach the server. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  // saveAvailability=false is the availability step's "Skip" — finish without saving.
  async function finish(saveAvailability: boolean) {
    setFinishing(true)
    try {
      if (saveAvailability) {
        await fetch(`${API_BASE}/api/availability`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...Object.fromEntries(DAYS.map(day => [day, avail[day] ? 'available' : 'unavailable'])),
            preferred_start: prefStart,
            preferred_end: prefEnd,
          }),
        }).catch(() => {})
      }
      const body: any = {}
      if (firstName.trim()) body.first_name = firstName.trim()
      if (lastName.trim()) body.last_name = lastName.trim()
      const res = await fetch(`${API_BASE}/api/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { toast.error(data?.error || 'Could not finish setup.'); return }
      toast.success("You're all set!")
      onComplete(data.user)
    } catch {
      toast.error('Network error.')
    } finally {
      setFinishing(false)
    }
  }

  const managerName = acceptInfo?.manager
    ? `${acceptInfo.manager.first_name || ''} ${acceptInfo.manager.last_name || ''}`.trim()
    : user?.manager_name || null
  const jobRole = acceptInfo?.job_role ?? user?.job_role ?? null
  const hourlyRate = acceptInfo?.hourly_rate ?? user?.hourly_rate ?? null
  const companyName = companyInfo?.name || null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      {/* body scroll is disabled globally — the card owns its scrolling */}
      <div className="glass w-full max-w-xl rounded-3xl border border-white/10 max-h-[90vh] flex flex-col">
        <div className="overflow-y-auto p-8">
          {phase === 'link' ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs tracking-[2px] mb-1.5 uppercase" style={{ color: 'var(--accent-color)' }}>Join Your Company</div>
                <h2 className="text-2xl font-semibold tracking-tight mb-1">
                  Welcome{user?.first_name ? `, ${user.first_name}` : ''}!
                </h2>
                <p className="text-zinc-400 text-sm">Enter the invite code from your manager to link your account to your company.</p>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1 tracking-wide">INVITE CODE</label>
                <input
                  className={`${inputCls} font-mono tracking-[2px] uppercase`}
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="SW-XXXXXXXX"
                  autoFocus
                />
              </div>
              {lookup && code.trim().length >= 6 && (
                lookup.valid ? (
                  <div
                    className="text-sm rounded-xl px-4 py-2"
                    style={{
                      backgroundColor: 'rgba(var(--accent-color-rgb),0.08)',
                      border: '1px solid rgba(var(--accent-color-rgb),0.35)',
                      color: 'var(--accent-color)',
                    }}
                  >
                    ✓ Joining <span className="font-semibold">{lookup.company_name}</span> as {lookup.name}{lookup.job_role ? ` — ${lookup.job_role}` : ''}
                  </div>
                ) : (
                  <div className="text-sm text-red-400 bg-red-950/40 border border-red-900/60 rounded-xl px-4 py-2">
                    ⚠ Invalid or expired invite code — double-check it with your manager.
                  </div>
                )
              )}
              {linkError && (
                <div role="alert" className="text-sm text-red-400 flex items-center gap-2 bg-red-950/40 border border-red-900/60 rounded-xl px-4 py-2">
                  ⚠ {linkError}
                </div>
              )}
              <button
                onClick={joinCompany}
                disabled={joining || !code.trim() || lookup?.valid === false}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}
              >
                {joining ? 'Joining…' : 'Join company'}
              </button>
              <div className="flex items-center justify-between pt-1 text-sm">
                <button onClick={onSkip} className="text-zinc-500 hover:text-zinc-300 transition-colors">Skip for now</button>
                <button onClick={onCreateCompany} className="text-zinc-400 hover:text-white transition-colors">
                  Setting up for your team? <span style={{ color: 'var(--accent-color)' }}>Create a company →</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step indicator */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map(s => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${s === step ? 'w-8' : 'w-4'}`}
                    style={{ backgroundColor: s <= step ? 'var(--accent-color)' : 'rgba(255,255,255,0.12)' }}
                  />
                ))}
              </div>

              {step === 1 && (
                <>
                  <div>
                    <div className="text-xs tracking-[2px] mb-1.5 uppercase" style={{ color: 'var(--accent-color)' }}>Your Details · Step 1 of 3</div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-1">
                      {companyName ? `Welcome to ${companyName}!` : 'Welcome aboard!'}
                    </h2>
                    <p className="text-zinc-400 text-sm">Confirm how your name should appear on timesheets and payroll.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1 tracking-wide">FIRST NAME</label>
                      <input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Alex" />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1 tracking-wide">LAST NAME</label>
                      <input className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Rivera" />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-2xl px-5 py-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-zinc-400">Company</span><span className="font-medium text-right">{companyName || '—'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-zinc-400">Role</span><span className="font-medium text-right">{jobRole || '—'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-zinc-400">Hourly rate</span><span className="font-medium text-right">{hourlyRate != null ? `$${Number(hourlyRate).toFixed(2)}/hr` : '—'}</span></div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={onSkip} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Skip for now</button>
                    <button
                      onClick={() => setStep(2)}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                      style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}
                    >
                      Continue →
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <div className="text-xs tracking-[2px] mb-1.5 uppercase" style={{ color: 'var(--accent-color)' }}>Your Manager · Step 2 of 3</div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-1">Who you'll report to</h2>
                  </div>
                  <div className="bg-white/5 rounded-2xl px-5 py-5 flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                      style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}
                    >
                      {String(managerName || '?').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{managerName || 'Your manager'}</div>
                      <div className="text-xs text-zinc-400">Approves your timesheets, PTO requests, and shift swaps.</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => setStep(1)} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Back</button>
                    <button
                      onClick={() => setStep(3)}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                      style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}
                    >
                      Continue →
                    </button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <div className="text-xs tracking-[2px] mb-1.5 uppercase" style={{ color: 'var(--accent-color)' }}>Availability · Step 3 of 3</div>
                    <h2 className="text-2xl font-semibold tracking-tight mb-1">When can you work?</h2>
                    <p className="text-zinc-400 text-sm">Optional — helps your manager build schedules. You can change it any time in your profile.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map(day => (
                      <button
                        key={day}
                        onClick={() => setAvail(a => ({ ...a, [day]: !a[day] }))}
                        className="px-3 py-2 rounded-xl text-sm font-medium border transition-colors"
                        style={
                          avail[day]
                            ? { backgroundColor: 'var(--accent-color)', color: '#000', borderColor: 'transparent' }
                            : { borderColor: 'rgba(255,255,255,0.12)', color: '#a1a1aa', backgroundColor: 'transparent' }
                        }
                      >
                        {DAY_LABELS[day]}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1 tracking-wide">PREFERRED START</label>
                      <input type="time" className={inputCls} value={prefStart} onChange={e => setPrefStart(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1 tracking-wide">PREFERRED END</label>
                      <input type="time" className={inputCls} value={prefEnd} onChange={e => setPrefEnd(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => setStep(2)} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Back</button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => finish(false)}
                        disabled={finishing}
                        className="text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-60"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => finish(true)}
                        disabled={finishing}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                        style={{ backgroundColor: 'var(--accent-color)', color: '#000', opacity: finishing ? 0.6 : 1 }}
                      >
                        {finishing ? 'Finishing…' : 'Save & finish'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
