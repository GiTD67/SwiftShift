import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PaymentsNotConfiguredCard, fmtUsd } from './PayrollRunsPanel'
import type { PaymentsStatus } from './PayrollRunsPanel'

const API_BASE = ''

interface PayoutAccount {
  onboarding_status: string // not_started | pending | complete
  payouts_enabled: boolean
  disabled_reason: string | null
  has_account: boolean
}

interface PayoutItem {
  run_id: number
  period_start: string
  period_end: string
  hours: number
  overtime_hours: number
  hourly_rate: number
  gross_cents: number
  status: string
  run_status: string
  updated_at: string | null
}

const PAYOUT_STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: 'Sent - typically arrives in 1–2 business days', cls: 'text-emerald-400' },
  pending: { label: 'Processing', cls: 'text-amber-400' },
  skipped_no_payout_account: { label: 'Skipped - no payout account', cls: 'text-red-400' },
  failed: { label: 'Failed', cls: 'text-red-400' },
}

interface PayoutSetupCardProps {
  status: PaymentsStatus | null // from GET /api/payments/status (null = still loading)
}

export default function PayoutSetupCard({ status }: PayoutSetupCardProps) {
  const configured = status ? status.configured : null

  const [account, setAccount] = useState<PayoutAccount | null>(null)
  const [payouts, setPayouts] = useState<PayoutItem[]>([])
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (configured !== true) return
    // GET self-heals 'pending' accounts against Stripe (missed webhooks).
    fetch(`${API_BASE}/api/payments/me/payout-account`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && !d.error) setAccount(d) })
      .catch(() => {})
    fetch(`${API_BASE}/api/payments/me/payouts`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && Array.isArray(d.items)) setPayouts(d.items) })
      .catch(() => {})
  }, [configured])

  if (configured === null) {
    return <div className="glass rounded-3xl p-6 text-sm text-zinc-400">Checking payment status…</div>
  }
  if (!configured) {
    return <PaymentsNotConfiguredCard />
  }

  const startOnboarding = () => {
    setActionLoading(true)
    fetch(`${API_BASE}/api/payments/me/payout-account/onboard`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d?.url) { window.location.href = d.url; return }
        toast.error(d?.error || 'Could not start payout setup')
        setActionLoading(false)
      })
      .catch(() => { toast.error('Could not start payout setup'); setActionLoading(false) })
  }

  const openStripeDashboard = () => {
    setActionLoading(true)
    fetch(`${API_BASE}/api/payments/me/payout-account/login-link`, { method: 'POST' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d?.url) { window.open(d.url, '_blank', 'noopener'); return }
        toast.error(d?.error || 'Could not open Stripe dashboard')
      })
      .catch(() => toast.error('Could not open Stripe dashboard'))
      .finally(() => setActionLoading(false))
  }

  const onboardingStatus = account?.onboarding_status ?? status?.me?.onboarding_status ?? 'not_started'
  const payoutsEnabled = account ? account.payouts_enabled : !!status?.me?.payouts_enabled
  const disabledReason = account?.disabled_reason ?? status?.me?.disabled_reason ?? null

  return (
    <div className="glass rounded-3xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Payouts</h2>
        {onboardingStatus === 'complete' && payoutsEnabled ? (
          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400">Active</span>
        ) : onboardingStatus === 'complete' ? (
          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-400">Paused by Stripe</span>
        ) : onboardingStatus === 'pending' ? (
          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-400">Setup incomplete</span>
        ) : (
          <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-zinc-500/20 text-zinc-400">Not set up</span>
        )}
      </div>

      {onboardingStatus === 'not_started' && (
        <div>
          <p className="text-sm text-zinc-400">
            Get paid directly to your bank when your manager runs payroll. You'll verify your identity and bank with Stripe; SwiftShift never sees or stores your account number.
          </p>
          <button onClick={startOnboarding} disabled={actionLoading}
            className="mt-3 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
            {actionLoading ? 'Opening Stripe…' : 'Set up payouts'}
          </button>
        </div>
      )}

      {onboardingStatus === 'pending' && (
        <div>
          <p className="text-sm text-zinc-400">Your payout setup with Stripe isn't finished yet - pick up where you left off.</p>
          {disabledReason && <p className="text-xs text-amber-400 mt-1">Stripe needs more info: {disabledReason}</p>}
          <button onClick={startOnboarding} disabled={actionLoading}
            className="mt-3 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
            {actionLoading ? 'Opening Stripe…' : 'Finish setting up'}
          </button>
        </div>
      )}

      {onboardingStatus === 'complete' && (
        <div>
          {payoutsEnabled ? (
            <p className="text-sm text-zinc-400">Your payout account is ready. Payroll payments are sent to your bank automatically.</p>
          ) : (
            <p className="text-sm text-amber-400">Stripe has paused payouts on your account{disabledReason ? `: ${disabledReason}` : '.'} Update your details to resume.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={openStripeDashboard} disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors disabled:opacity-50">
              View payouts in Stripe
            </button>
            {!payoutsEnabled && (
              <button onClick={startOnboarding} disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                Update details with Stripe
              </button>
            )}
          </div>
        </div>
      )}

      {payouts.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2 mt-2">Payout history</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '520px' }}>
              <thead>
                <tr className="text-zinc-400 border-b border-white/10 text-left">
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Hours</th>
                  <th className="py-2 pr-4">Gross</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map(p => {
                  // An item still 'pending' on a failed/canceled run will never pay out -
                  // show the honest terminal state instead of 'Processing' forever.
                  const runDead = p.status === 'pending' && (p.run_status === 'failed' || p.run_status === 'canceled')
                  const st = runDead
                    ? (p.run_status === 'failed'
                        ? { label: 'Not paid - payroll run failed', cls: 'text-red-400' }
                        : { label: 'Not paid - payroll run canceled', cls: 'text-zinc-400' })
                    : PAYOUT_STATUS[p.status] || { label: p.status, cls: 'text-zinc-400' }
                  return (
                    <tr key={`${p.run_id}-${p.period_start}`} className="border-b border-white/5">
                      <td className="py-2.5 pr-4 text-zinc-400 whitespace-nowrap">{p.period_start} → {p.period_end}</td>
                      <td className="py-2.5 pr-4">{p.hours.toFixed(1)}h{p.overtime_hours > 0 ? ` (+${p.overtime_hours.toFixed(1)}h OT)` : ''}</td>
                      <td className="py-2.5 pr-4 font-semibold" style={{ color: 'var(--accent-color)' }}>{fmtUsd(p.gross_cents)}</td>
                      <td className="py-2.5"><span className={`text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500 mt-2">Gross wages only - no taxes are withheld by SwiftShift.</p>
        </div>
      )}
    </div>
  )
}
