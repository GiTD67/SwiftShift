import { LogoSVG } from './shared'
import './landing.css'

// Public "Contact us" page, served at /contact (logged-out friendly). Matches the
// landing aesthetic (lp-root). Phone and email are the owner's real contact info.
const PHONE_DISPLAY = '(209) 247-6694'
const PHONE_TEL = '+12092476694'

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--lp-accent)', flexShrink: 0 }} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--lp-accent)', flexShrink: 0 }} aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  )
}

function ContactCard({ label, email }: { label: string; email: string }) {
  return (
    <div className="rounded-2xl p-6 border" style={{ borderColor: 'var(--lp-hairline)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="lpa-label mb-4" style={{ color: 'var(--lp-faint)' }}>{label}</div>
      <a href={`tel:${PHONE_TEL}`} className="flex items-center gap-3 mb-4 transition-opacity hover:opacity-80">
        <PhoneIcon />
        <span className="text-lg font-semibold">{PHONE_DISPLAY}</span>
      </a>
      <a href={`mailto:${email}`} className="flex items-center gap-3 transition-opacity hover:opacity-80">
        <MailIcon />
        <span className="text-base font-medium break-all">{email}</span>
      </a>
    </div>
  )
}

export function ContactPage() {
  return (
    <div className="lp-root min-h-[100dvh] relative text-white">
      <div className="lp-dots" />
      <nav className="lp-nav">
        <a href="." className="flex items-center gap-2.5">
          <LogoSVG className="h-7 w-auto" />
          <span className="font-semibold tracking-[0.18em] text-sm">SWIFTSHIFT</span>
        </a>
        <div className="flex items-center gap-2">
          <a href="login" className="lp-btn lp-btn--ghost">Sign in</a>
          <a href="signup" className="lp-btn">Create account</a>
        </div>
      </nav>

      <main className="relative z-10 max-w-3xl mx-auto px-6 pt-28 pb-24">
        <h1 className="lp-h2 mb-3">Contact us</h1>
        <p className="text-sm mb-10" style={{ color: 'var(--lp-dim)' }}>
          Questions about SwiftShift? We're here to help. Reach us by phone or email and we'll get back to you quickly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ContactCard label="General" email="info@swiftshift.work" />
          <ContactCard label="Sales" email="sales@swiftshift.work" />
        </div>

        <div className="mt-6 text-xs" style={{ color: 'var(--lp-faint)' }}>
          Phone and email are monitored during U.S. business hours, Monday to Friday.
        </div>

        <div className="mt-10">
          <a href="." className="lp-btn lp-btn--ghost">Back to home</a>
        </div>
      </main>
    </div>
  )
}

export default ContactPage
