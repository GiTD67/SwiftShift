import { useEffect, useState } from 'react'
import './landing.css'
import { API_BASE, LogoSVG, getThemeAccentHex } from './shared'
import { FeaturePreview } from '../components/FeaturePreview'
import { Tour } from '../components/Tour'

// Sign-in and create-account pages in the scrollytelling landing aesthetic:
// pure black, hairline borders, white CTA. All auth behavior (endpoints,
// localStorage persistence, invite lookup/accept, forgot-password) is
// unchanged from the previous pages — only the presentation moved.

const AUTH_TESTIMONIALS = [
  { quote: 'SwiftShift cut our payroll processing time in half. The real-time earnings view alone boosted team morale.', name: 'Jamie M.', role: 'HR Director', location: 'Austin TX', initials: 'JM' },
  { quote: 'Clock-ins went from a daily chore to a non-event. My crew actually keeps their hours up to date now.', name: 'Dana P.', role: 'Operations Manager', location: 'Columbus OH', initials: 'DP' },
  { quote: 'Swifty pulled my W-2 numbers and filled out my 1040 in minutes. Tax season was painless this year.', name: 'Marcus R.', role: 'Shift Supervisor', location: 'Phoenix AZ', initials: 'MR' },
  { quote: 'Schedules, swaps, and PTO finally live in one place. My managers get hours of their week back.', name: 'Aisha L.', role: 'Store Manager', location: 'Chicago IL', initials: 'AL' },
]

const SIDE_FEATURES = [
  ['One-tap clock in', 'Punch in instantly. Stay signed in for 30 days.'],
  ['Real-time earnings', 'Watch your pay grow live as you work.'],
  ['Live PTO accrual', 'Balance ticks up to the third decimal.'],
  ['AI tax filing', 'Swifty fills your 1040 from your W-2, free.'],
  ['Rewards & XP', 'Level up and unlock perks for showing up.'],
]

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
      aria-label={shown ? 'Hide password' : 'Show password'}
    >
      {shown ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  )
}

// Shared chrome: nav back to the landing page + left narrative rail.
function AuthShell({ children, formTitle }: { children: React.ReactNode; formTitle: string }) {
  const [quoteIndex, setQuoteIndex] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setQuoteIndex(i => (i + 1) % AUTH_TESTIMONIALS.length), 7000)
    return () => clearInterval(t)
  }, [])
  const testimonial = AUTH_TESTIMONIALS[quoteIndex]
  return (
    <div className="lp-root min-h-[100dvh] relative text-white">
      <div className="lp-dots" />
      <nav className="lp-nav">
        <a href="." className="flex items-center gap-2.5">
          <LogoSVG className="h-7 w-auto" />
          <span className="font-semibold tracking-[0.18em] text-sm">SWIFTSHIFT</span>
        </a>
        <span className="text-[11px] tracking-[0.22em] uppercase" style={{ color: 'var(--lp-dim)' }}>{formTitle}</span>
      </nav>
      <div className="relative z-10 min-h-[100dvh] flex">
        {/* Left rail: condensed narrative (desktop only) */}
        <div className="hidden lg:flex w-5/12 flex-col justify-between p-12 pt-28 border-r" style={{ borderColor: 'var(--lp-hairline)' }}>
          <div className="max-w-[400px]">
            <h1 className="lp-h2 mb-10 lpa-rise">
              Time is money.<br />
              <span style={{ color: 'var(--lp-dim)' }}>Watch both, live.</span>
            </h1>
            <div>
              {SIDE_FEATURES.map(([title, desc], i) => (
                <div key={title} className="lpa-rise py-3.5 border-t" style={{ borderColor: 'var(--lp-hairline)', animationDelay: `${0.15 + i * 0.09}s` }}>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-[0.82rem] mt-0.5" style={{ color: 'var(--lp-dim)' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="max-w-[400px] lpa-rise" style={{ animationDelay: '0.6s' }}>
            <div key={quoteIndex} className="border-t pt-5" style={{ borderColor: 'var(--lp-hairline)', animation: 'lpa-rise 0.7s ease both' }}>
              <p className="text-sm italic leading-relaxed mb-3" style={{ color: 'var(--lp-dim)' }}>“{testimonial.quote}”</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold">{testimonial.initials}</div>
                <span className="text-xs" style={{ color: 'var(--lp-faint)' }}>{testimonial.name} · {testimonial.role} · {testimonial.location}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-xs mt-6" style={{ color: 'var(--lp-dim)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--lp-accent)' }} />
              System status: online
            </div>
          </div>
        </div>
        {/* Right: the form */}
        <div className="flex-1 flex items-center justify-center p-5 pt-24 lg:pt-5">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
      <div className="absolute bottom-5 right-6 text-[10px] z-10" style={{ color: 'var(--lp-faint)' }}>
        © 2026 SwiftShift. All rights reserved.
      </div>
    </div>
  )
}

// ===== Forgot Password Modal (behavior unchanged) =====
function ForgotPasswordModal({ onClose, accentHex }: { onClose: () => void; accentHex: string }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [resetUrl, setResetUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Request failed. Please try again.')
      } else {
        setSent(true)
        if (data.reset_url) setResetUrl(data.reset_url)
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reset password"
        className="w-full max-w-[360px] max-h-[85dvh] overflow-y-auto rounded-xl p-8 mx-4 border bg-[#0a0a0c]"
        style={{ borderColor: 'rgba(255,255,255,0.12)', boxShadow: `0 0 80px -20px ${accentHex}25, 0 28px 72px -14px rgba(0,0,0,0.85)` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold">Reset Password</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {sent ? (
          <div className="text-center py-4 space-y-3">
            <div className="text-4xl">📬</div>
            <p className="text-sm text-zinc-400">
              If that email is registered, a reset link has been generated.
            </p>
            {resetUrl && (
              <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-left">
                <p className="text-[11px] text-zinc-500 mb-1.5 uppercase tracking-wider">Your reset link (demo mode)</p>
                <a href={resetUrl} className="text-xs break-all underline underline-offset-4 transition-colors" style={{ color: accentHex }}>
                  {window.location.origin}{resetUrl.startsWith('/') ? '' : '/'}{resetUrl}
                </a>
              </div>
            )}
            <button onClick={onClose} className="mt-2 text-sm underline underline-offset-4 text-zinc-400 hover:text-white transition-colors">
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-zinc-400">Enter your email and we'll generate a password reset link.</p>
            <div>
              <label htmlFor="forgot-email" className="lpa-label">Email</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="lpa-input"
                placeholder="you@company.com"
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            {error && (
              <div role="alert" className="text-sm text-red-400 flex items-center gap-2 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-2">
                ⚠ {error}
              </div>
            )}
            <button type="submit" disabled={loading} className="lpa-submit">
              {loading ? 'Generating link…' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ===== Sign in =====
export function LoginPage() {
  const [email, setEmail] = useState(() => localStorage.getItem('lastEmail') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showFeaturePreview, setShowFeaturePreview] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [showLoginTour, setShowLoginTour] = useState(false)

  const isReturningUser = !!localStorage.getItem('lastEmail')
  const accentHex = getThemeAccentHex(localStorage.getItem('theme') || 'green')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Access denied. Check credentials.')
      } else {
        localStorage.setItem('user', JSON.stringify(data))
        localStorage.setItem('lastEmail', email)
        window.location.href = '.'
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell formTitle="Sign in">
      <div className="mb-8 lpa-rise">
        <h2 className="lp-h2">Welcome back.</h2>
        <p className="text-sm mt-2" style={{ color: 'var(--lp-dim)' }}>
          {isReturningUser ? 'Good to see you. Ready to clock in?' : 'One sign-in lasts 30 days.'}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5 lpa-rise" style={{ animationDelay: '0.12s' }}>
        <div>
          <label htmlFor="signin-email" className="lpa-label">Email</label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="lpa-input"
            placeholder="you@company.com"
            autoComplete="email"
            required
            autoFocus={!isReturningUser}
          />
        </div>
        <div>
          <label htmlFor="signin-password" className="lpa-label">Password</label>
          <div className="relative">
            <input
              id="signin-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="lpa-input pr-12"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />
          </div>
        </div>
        {error && (
          <div role="alert" className="text-sm text-red-400 flex items-center gap-2 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-2">
            ⚠ {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="lpa-submit">
          {loading ? 'Signing in…' : 'Sign in →'}
        </button>
        <div className="flex justify-between text-sm pt-1">
          <button type="button" onClick={() => setShowForgotPassword(true)} className="text-zinc-500 hover:text-white transition-colors">Forgot password?</button>
          <a href="signup" className="text-zinc-400 hover:text-white underline underline-offset-4">Create account, it's free</a>
        </div>
        <div className="flex justify-center gap-6 pt-4 mt-2 border-t" style={{ borderColor: 'var(--lp-hairline)' }}>
          <button type="button" onClick={() => setShowLoginTour(true)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Explore features →
          </button>
          <button type="button" onClick={() => setShowFeaturePreview(true)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Preview the app →
          </button>
        </div>
        <div className="text-center text-[10px] tracking-[0.18em] uppercase pt-2" style={{ color: 'var(--lp-faint)' }}>
          Secure · Encrypted · Audited
        </div>
      </form>
      {showFeaturePreview && (
        <FeaturePreview onClose={() => setShowFeaturePreview(false)} accentHex={accentHex} />
      )}
      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} accentHex={accentHex} />
      )}
      {showLoginTour && (
        <Tour onClose={() => setShowLoginTour(false)} onComplete={() => setShowLoginTour(false)} accentHex={accentHex} />
      )}
    </AuthShell>
  )
}

// ===== Create account =====
export function SignupPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showFeaturePreview, setShowFeaturePreview] = useState(false)
  const [showSignupTour, setShowSignupTour] = useState(false)
  // Optional invite code (prefilled from invite links like /signup?invite=SW-XXXXXXXX)
  const [inviteCode, setInviteCode] = useState(() => (new URLSearchParams(window.location.search).get('invite') ?? '').toUpperCase())
  const [inviteInfo, setInviteInfo] = useState<any | null>(null)
  const accentHex = getThemeAccentHex(localStorage.getItem('theme') || 'green')

  // Debounced invite lookup (public endpoint) — previews the company before signup.
  useEffect(() => {
    const code = inviteCode.trim()
    if (code.length < 6) { setInviteInfo(null); return }
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/onboarding/invites/lookup?code=${encodeURIComponent(code)}`)
        .then(r => r.json())
        .then(d => setInviteInfo(d))
        .catch(() => setInviteInfo(null))
    }, 400)
    return () => clearTimeout(t)
  }, [inviteCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.')
      } else {
        localStorage.setItem('user', JSON.stringify(data))
        localStorage.setItem('lastEmail', email)
        localStorage.setItem('swiftshift-tour-pending', '1')
        const code = inviteCode.trim().toUpperCase()
        if (code) {
          // Link the new account to its company right away (the signup response
          // already set the session cookie). If this fails, stash the code so
          // the in-app invite prompt prefills it.
          try {
            const acceptRes = await fetch(`${API_BASE}/api/onboarding/invites/accept`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code }),
            })
            if (!acceptRes.ok) {
              localStorage.setItem('swiftshift-pending-invite', code)
            } else {
              // Merge the accept response (manager, role, rate) into the cached
              // user so the welcome wizard greets with the real manager instead
              // of a placeholder.
              try {
                const acc = await acceptRes.json()
                const managerName = acc?.manager ? `${acc.manager.first_name ?? ''} ${acc.manager.last_name ?? ''}`.trim() : ''
                localStorage.setItem('user', JSON.stringify({
                  ...data,
                  manager_name: managerName || data.manager_name,
                  job_role: acc?.job_role ?? data.job_role,
                  hourly_rate: acc?.hourly_rate ?? data.hourly_rate,
                }))
              } catch { /* keep the plain signup payload */ }
            }
          } catch {
            localStorage.setItem('swiftshift-pending-invite', code)
          }
        }
        window.location.href = '.'
      }
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell formTitle="Create account">
      <div className="mb-8 lpa-rise">
        <h2 className="lp-h2">Get started.</h2>
        <p className="text-sm mt-2" style={{ color: 'var(--lp-dim)' }}>
          Free account. Clocked in within minutes.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5 lpa-rise" style={{ animationDelay: '0.12s' }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="signup-first-name" className="lpa-label">First name</label>
            <input
              id="signup-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="lpa-input"
              placeholder="Alex"
              autoComplete="given-name"
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="signup-last-name" className="lpa-label">Last name</label>
            <input
              id="signup-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="lpa-input"
              placeholder="Rivera"
              autoComplete="family-name"
              required
            />
          </div>
        </div>
        {/* Invite code (optional) — links the new account to its company */}
        <div>
          <label htmlFor="signup-invite-code" className="lpa-label">Invite code <span style={{ color: 'var(--lp-faint)' }}>— optional</span></label>
          <input
            id="signup-invite-code"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="lpa-input font-mono tracking-[1px]"
            placeholder="SW-XXXXXXXX from your manager"
            autoComplete="off"
          />
          {inviteInfo && inviteCode.trim().length >= 6 && (
            inviteInfo.valid ? (
              <div
                className="mt-2 text-sm rounded-lg px-4 py-2"
                style={{
                  backgroundColor: 'rgba(215,254,81,0.07)',
                  border: '1px solid rgba(215,254,81,0.3)',
                  color: 'var(--lp-accent)',
                }}
              >
                ✓ Joining <span className="font-semibold">{inviteInfo.company_name}</span> as {inviteInfo.name}{inviteInfo.job_role ? ` — ${inviteInfo.job_role}` : ''}
              </div>
            ) : (
              <div className="mt-2 text-sm text-red-400 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-2">
                ⚠ Invalid or expired invite code — double-check it or leave this blank.
              </div>
            )
          )}
        </div>
        <div>
          <label htmlFor="signup-email" className="lpa-label">Work email</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="lpa-input"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="lpa-label">Password</label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="lpa-input pr-12"
              placeholder="Min 8 characters"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />
          </div>
        </div>
        {error && (
          <div role="alert" className="text-sm text-red-400 flex items-center gap-2 bg-red-950/40 border border-red-900/60 rounded-lg px-4 py-2">
            ⚠ {error}
          </div>
        )}
        <button type="submit" disabled={loading || inviteInfo?.valid === false} className="lpa-submit">
          {loading ? 'Creating account…' : 'Create account →'}
        </button>
        <div className="text-center text-sm pt-1">
          <a href="login" className="text-zinc-400 hover:text-white underline underline-offset-4">Already have an account?</a>
        </div>
        <div className="flex justify-center gap-6 pt-4 mt-2 border-t" style={{ borderColor: 'var(--lp-hairline)' }}>
          <button type="button" onClick={() => setShowSignupTour(true)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Explore features →
          </button>
          <button type="button" onClick={() => setShowFeaturePreview(true)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Preview the app →
          </button>
        </div>
        <div className="text-center text-[10px] tracking-[0.18em] uppercase pt-2" style={{ color: 'var(--lp-faint)' }}>
          Secure · Encrypted · Audited · 100% free
        </div>
      </form>
      {showFeaturePreview && (
        <FeaturePreview onClose={() => setShowFeaturePreview(false)} accentHex={accentHex} />
      )}
      {showSignupTour && (
        <Tour onClose={() => setShowSignupTour(false)} onComplete={() => setShowSignupTour(false)} accentHex={accentHex} />
      )}
    </AuthShell>
  )
}
