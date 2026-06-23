import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

const API_BASE = ''

// ---- Types matching the /api/payments contract -------------------------------

export interface PaymentsStatus {
  configured: boolean
  company?: { funding_status: string; bank_name: string | null; last4: string | null }
  me?: { onboarding_status: string; payouts_enabled: boolean; disabled_reason: string | null }
}

interface CompanyFunding {
  funding_status: string
  bank_name: string | null
  last4: string | null
}

interface PreviewItem {
  user_id: number
  name: string
  hours: number
  overtime_hours: number
  hourly_rate: number
  gross_cents: number
  payout_ready: boolean
  skip_reason: string | null
}

interface RunPreview {
  period_start: string
  period_end: string
  total_payable_cents: number
  items: PreviewItem[]
}

interface RunItem {
  id: number
  run_id: number
  user_id: number
  name?: string
  hours: number
  overtime_hours: number
  hourly_rate: number
  gross_cents: number
  status: string
  failure_message: string | null
}

interface PayrollRun {
  id: number
  period_start: string
  period_end: string
  status: string
  total_gross_cents: number
  failure_message: string | null
  created_at: string | null
  item_count?: number
  sent_count?: number
  skipped_count?: number
  items?: RunItem[]
}

// ---- Helpers ------------------------------------------------------------------

export const fmtUsd = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const RUN_CHIPS: Record<string, { label: string; cls: string }> = {
  funding: { label: 'ACH processing', cls: 'bg-amber-500/20 text-amber-400' },
  funded: { label: 'Funded - sending transfers', cls: 'bg-amber-500/20 text-amber-400' },
  paid: { label: 'Paid', cls: 'bg-emerald-500/20 text-emerald-400' },
  partially_paid: { label: 'Partially paid', cls: 'bg-red-500/20 text-red-400' },
  failed: { label: 'Failed', cls: 'bg-red-500/20 text-red-400' },
  canceled: { label: 'Canceled', cls: 'bg-zinc-500/20 text-zinc-400' },
}

function RunStatusChip({ status }: { status: string }) {
  const chip = RUN_CHIPS[status] || { label: status, cls: 'bg-zinc-500/20 text-zinc-400' }
  return <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold whitespace-nowrap ${chip.cls}`}>{chip.label}</span>
}

const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: 'Sent - typically arrives in 1–2 business days', cls: 'text-emerald-400' },
  pending: { label: 'Processing', cls: 'text-amber-400' },
  skipped_no_payout_account: { label: 'Skipped - no payout account', cls: 'text-zinc-400' },
  failed: { label: 'Failed', cls: 'text-red-400' },
}

// Shared honesty card: shown by both payments components when Stripe isn't
// configured. No action buttons - nothing pretends to work.
export function PaymentsNotConfiguredCard() {
  return (
    <div className="glass rounded-3xl p-6 flex items-start gap-4">
      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 text-zinc-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      </div>
      <div>
        <div className="text-sm font-semibold text-white">Payments not configured</div>
        <div className="text-xs text-zinc-500 mt-1">Ask your administrator to connect Stripe to enable real payments.</div>
      </div>
    </div>
  )
}

// ---- Manager panel --------------------------------------------------------------

interface PayrollRunsPanelProps {
  status: PaymentsStatus | null // from GET /api/payments/status (null = still loading)
  defaultPeriodStart: string // YYYY-MM-DD, current 14-day pay period
  defaultPeriodEnd: string
}

export default function PayrollRunsPanel({ status, defaultPeriodStart, defaultPeriodEnd }: PayrollRunsPanelProps) {
  const configured = status ? status.configured : null

  // Company funding (GET self-heals a 'pending' status against Stripe)
  const [funding, setFunding] = useState<CompanyFunding | null>(status?.company ?? null)
  const [connectLoading, setConnectLoading] = useState(false)

  // Run preview
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart)
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd)
  const [preview, setPreview] = useState<RunPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [runLoading, setRunLoading] = useState(false)

  // Runs history
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)

  const fetchFunding = useCallback(() => {
    fetch(`${API_BASE}/api/payments/company/funding`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && !d.error) setFunding(d) })
      .catch(() => {})
  }, [])

  const fetchRuns = useCallback(() => {
    setRunsLoading(true)
    fetch(`${API_BASE}/api/payments/runs`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && Array.isArray(d.runs)) setRuns(d.runs) })
      .catch(() => {})
      .finally(() => setRunsLoading(false))
  }, [])

  useEffect(() => {
    if (configured !== true) return
    fetchFunding()
    fetchRuns()
  }, [configured, fetchFunding, fetchRuns])

  if (configured === null) {
    return <div className="glass rounded-3xl p-6 text-sm text-zinc-400">Checking payment status…</div>
  }
  if (!configured) {
    return <PaymentsNotConfiguredCard />
  }

  const fundingStatus = funding?.funding_status || status?.company?.funding_status || 'none'

  const connectBank = () => {
    setConnectLoading(true)
    fetch(`${API_BASE}/api/payments/company/funding-session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d?.url) { window.location.href = d.url; return }
        toast.error(d?.error || 'Could not start bank connection')
        setConnectLoading(false)
      })
      .catch(() => { toast.error('Could not start bank connection'); setConnectLoading(false) })
  }

  const loadPreview = () => {
    if (!periodStart || !periodEnd) { toast.error('Pick a period start and end date'); return }
    setPreviewLoading(true)
    fetch(`${API_BASE}/api/payments/runs/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }) })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { toast.error(d?.error || 'Could not build payroll preview'); setPreview(null); return }
        setPreview(d)
      })
      .catch(() => { toast.error('Could not build payroll preview'); setPreview(null) })
      .finally(() => setPreviewLoading(false))
  }

  const openRunDetail = (runId: number) => {
    fetch(`${API_BASE}/api/payments/runs/${runId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && d.run) setSelectedRun({ ...d.run, items: d.items }) })
      .catch(() => toast.error('Could not load run details'))
  }

  const runPayroll = () => {
    if (!preview) return
    setRunLoading(true)
    fetch(`${API_BASE}/api/payments/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period_start: preview.period_start, period_end: preview.period_end }) })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || !d?.run) { toast.error(d?.error || 'Could not start payroll run'); return }
        toast.success(`Payroll run #${d.run.id} started`, { description: 'ACH debit of the company bank is processing.' })
        setPreview(null)
        setSelectedRun(d.run)
        fetchRuns()
      })
      .catch(() => toast.error('Could not start payroll run'))
      .finally(() => setRunLoading(false))
  }

  const syncRun = (runId: number) => {
    setSyncLoading(true)
    fetch(`${API_BASE}/api/payments/runs/${runId}/sync`, { method: 'POST' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || !d?.run) { toast.error(d?.error || 'Sync failed'); return }
        setSelectedRun(d.run)
        fetchRuns()
        toast.success('Run status synced with Stripe')
      })
      .catch(() => toast.error('Sync failed'))
      .finally(() => setSyncLoading(false))
  }

  const cancelRun = (runId: number) => {
    setCancelLoading(true)
    fetch(`${API_BASE}/api/payments/runs/${runId}/cancel`, { method: 'POST' })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || !d?.run) { toast.error(d?.error || 'Could not cancel run'); return }
        setSelectedRun(d.run)
        fetchRuns()
        toast.success(`Payroll run #${runId} canceled`)
      })
      .catch(() => toast.error('Could not cancel run'))
      .finally(() => setCancelLoading(false))
  }

  const totalPayable = preview?.total_payable_cents || 0
  const canRun = fundingStatus === 'verified' && totalPayable > 0 && !runLoading

  return (
    <div className="space-y-6">
      {/* 1. Company bank (funding source) */}
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-white">Company Bank</h2>
          {fundingStatus === 'verified' ? (
            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400">Connected</span>
          ) : fundingStatus === 'pending' ? (
            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-400">Verification pending</span>
          ) : fundingStatus === 'failed' ? (
            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400">Verification failed</span>
          ) : (
            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-zinc-500/20 text-zinc-400">Not connected</span>
          )}
        </div>
        {fundingStatus === 'verified' ? (
          <div className="text-sm text-zinc-300">
            {funding?.bank_name || 'Bank account'} <span className="font-mono text-zinc-400">••••{funding?.last4 || '????'}</span>
            <div className="text-xs text-zinc-500 mt-1">Payroll runs debit this account via ACH.</div>
          </div>
        ) : fundingStatus === 'pending' ? (
          <div className="text-sm text-zinc-400">
            Verification in progress (micro-deposits can take 1–2 days).
            <div className="mt-3">
              <button onClick={connectBank} disabled={connectLoading}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors disabled:opacity-50">
                {connectLoading ? 'Opening Stripe…' : 'Restart bank connection'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-400">
            Connect the bank account payroll is funded from. You'll verify it on a secure Stripe-hosted page - SwiftShift never sees or stores the account number.
            <div className="mt-3">
              <button onClick={connectBank} disabled={connectLoading}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                {connectLoading ? 'Opening Stripe…' : 'Connect company bank'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Run payroll (preview → run) */}
      <div className="glass rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Run Payroll</h2>
        <p className="text-xs text-zinc-500 mb-4">Pays employees their gross wages for the period via Stripe. No taxes are withheld.</p>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <div className="text-xs text-zinc-400 mb-1">Period start</div>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 mb-1">Period end</div>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
          </div>
          <button onClick={loadPreview} disabled={previewLoading}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors disabled:opacity-50">
            {previewLoading ? 'Loading…' : 'Preview'}
          </button>
        </div>

        {preview && (
          preview.items.length === 0 ? (
            <div className="text-sm text-zinc-500 py-4 text-center">No hours logged in this period.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '640px' }}>
                  <thead>
                    <tr className="text-zinc-400 border-b border-white/10 text-left">
                      <th className="py-2 pr-4">Employee</th>
                      <th className="py-2 pr-4">Hours</th>
                      <th className="py-2 pr-4">OT</th>
                      <th className="py-2 pr-4">Rate</th>
                      <th className="py-2 pr-4">Gross</th>
                      <th className="py-2">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map(item => (
                      <tr key={item.user_id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2.5 pr-4 font-medium">{item.name}</td>
                        <td className="py-2.5 pr-4">{item.hours.toFixed(1)}h</td>
                        <td className="py-2.5 pr-4">{item.overtime_hours > 0 ? `${item.overtime_hours.toFixed(1)}h` : '-'}</td>
                        <td className="py-2.5 pr-4">${item.hourly_rate}/hr</td>
                        <td className="py-2.5 pr-4 font-semibold" style={{ color: 'var(--accent-color)' }}>{fmtUsd(item.gross_cents)}</td>
                        <td className="py-2.5">
                          {item.payout_ready ? (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400">Ready</span>
                          ) : item.skip_reason === 'zero_amount' ? (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-zinc-500/20 text-zinc-400">Nothing to pay</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-400"
                              title="No payout account - ask them to set up payouts in Profile">
                              No payout account - ask them to set up payouts in Profile
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">
                  Total payable: <span style={{ color: 'var(--accent-color)' }}>{fmtUsd(totalPayable)}</span>
                  <span className="text-xs font-normal text-zinc-500 ml-2">({preview.items.filter(i => i.payout_ready).length} of {preview.items.length} employees ready)</span>
                </div>
                <button onClick={runPayroll} disabled={!canRun}
                  className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#000' }}>
                  {runLoading ? 'Starting…' : 'Run payroll'}
                </button>
              </div>
              {fundingStatus !== 'verified' && (
                <div className="mt-2 text-xs text-amber-400">Connect and verify the company bank above before running payroll.</div>
              )}
              <div className="mt-3 text-xs text-zinc-500">
                This debits the company bank for the gross total. Employees are paid after the debit settles (typically 4 business days). No taxes are withheld.
              </div>
            </>
          )
        )}
      </div>

      {/* 3. Runs history */}
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-white">Payroll Runs</h2>
          <button onClick={fetchRuns} disabled={runsLoading}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50">
            {runsLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {runs.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-6">{runsLoading ? 'Loading…' : 'No payroll runs yet.'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '560px' }}>
              <thead>
                <tr className="text-zinc-400 border-b border-white/10 text-left">
                  <th className="py-2 pr-4">Run</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Gross total</th>
                  <th className="py-2 pr-4">Employees</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id} onClick={() => (selectedRun?.id === run.id ? setSelectedRun(null) : openRunDetail(run.id))}
                    className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${selectedRun?.id === run.id ? 'bg-white/5' : ''}`}>
                    <td className="py-2.5 pr-4 font-medium">#{run.id}</td>
                    <td className="py-2.5 pr-4 text-zinc-400">{run.period_start} → {run.period_end}</td>
                    <td className="py-2.5 pr-4 font-semibold" style={{ color: 'var(--accent-color)' }}>{fmtUsd(run.total_gross_cents)}</td>
                    <td className="py-2.5 pr-4 text-zinc-400">{run.sent_count ?? 0}/{run.item_count ?? 0} paid{(run.skipped_count ?? 0) > 0 ? ` · ${run.skipped_count} skipped` : ''}</td>
                    <td className="py-2.5">
                      <RunStatusChip status={run.status} />
                      {run.failure_message && (run.status === 'failed' || run.status === 'partially_paid') && (
                        <div className="text-xs text-red-400 mt-0.5 max-w-[240px] truncate" title={run.failure_message}>{run.failure_message}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedRun && (
          <div className="mt-4 bg-white/5 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white">Run #{selectedRun.id} · {selectedRun.period_start} → {selectedRun.period_end}</span>
                <RunStatusChip status={selectedRun.status} />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => syncRun(selectedRun.id)} disabled={syncLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50">
                  {syncLoading ? 'Syncing…' : 'Sync status'}
                </button>
                {selectedRun.status === 'funding' && (
                  <button onClick={() => cancelRun(selectedRun.id)} disabled={cancelLoading}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                    {cancelLoading ? 'Canceling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
            {selectedRun.failure_message && (
              <div className="mb-3 text-xs text-red-400">{selectedRun.failure_message}</div>
            )}
            {selectedRun.status === 'funding' && (
              <div className="mb-3 text-xs text-zinc-500">ACH debit of the company bank is processing - employees are paid once it settles (typically 4 business days).</div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: '560px' }}>
                <thead>
                  <tr className="text-zinc-400 border-b border-white/10 text-left">
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Hours</th>
                    <th className="py-2 pr-4">Gross</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedRun.items || []).map(item => {
                    const st = ITEM_STATUS[item.status] || { label: item.status, cls: 'text-zinc-400' }
                    return (
                      <tr key={item.id} className="border-b border-white/5">
                        <td className="py-2.5 pr-4 font-medium">{item.name || `User ${item.user_id}`}</td>
                        <td className="py-2.5 pr-4 text-zinc-400">{item.hours.toFixed(1)}h{item.overtime_hours > 0 ? ` (+${item.overtime_hours.toFixed(1)}h OT)` : ''}</td>
                        <td className="py-2.5 pr-4 font-semibold" style={{ color: 'var(--accent-color)' }}>{fmtUsd(item.gross_cents)}</td>
                        <td className="py-2.5">
                          <span className={`text-xs font-medium ${st.cls}`}>{st.label}</span>
                          {item.failure_message && item.failure_message !== 'zero_amount' && (
                            <div className="text-xs text-red-400 mt-0.5">{item.failure_message}</div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
