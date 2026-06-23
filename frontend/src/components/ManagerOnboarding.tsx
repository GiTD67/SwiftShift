import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const API_BASE = ''

// Build the absolute /signup?invite=CODE link client-side so it works on
// subpath deploys (cf. the relative href="login"/"signup" links in App.tsx).
export const inviteUrl = (code: string) => {
  const u = new URL(window.location.href)
  u.pathname = u.pathname.replace(/[^/]*$/, '') + 'signup'
  u.search = `?invite=${code}`
  u.hash = ''
  return u.toString()
}

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied to clipboard`),
    () => toast.error('Could not copy - select and copy it manually.'),
  )
}

// Curated common zones - the backend accepts any string ≤64 chars.
const TIMEZONES: Array<[string, string]> = [
  ['America/New_York', 'Eastern (New York)'],
  ['America/Chicago', 'Central (Chicago)'],
  ['America/Denver', 'Mountain (Denver)'],
  ['America/Phoenix', 'Arizona (Phoenix)'],
  ['America/Los_Angeles', 'Pacific (Los Angeles)'],
  ['America/Anchorage', 'Alaska (Anchorage)'],
  ['Pacific/Honolulu', 'Hawaii (Honolulu)'],
  ['America/Toronto', 'Eastern (Toronto)'],
  ['Europe/London', 'UK (London)'],
  ['Europe/Berlin', 'Central Europe (Berlin)'],
  ['Asia/Tokyo', 'Japan (Tokyo)'],
  ['Australia/Sydney', 'Australia (Sydney)'],
]

const PAY_PERIODS: Array<[string, string]> = [
  ['weekly', 'Weekly'],
  ['biweekly', 'Every 2 weeks'],
  ['semimonthly', 'Twice a month'],
  ['monthly', 'Monthly'],
]

const OVERTIME_POLICIES: Array<[string, string]> = [
  ['none', 'No overtime'],
  ['weekly_40', 'Over 40 hrs/week'],
  ['daily_8_weekly_40', 'Over 8 hrs/day or 40 hrs/week'],
]

const labelFor = (pairs: Array<[string, string]>, value: string) =>
  pairs.find(([v]) => v === value)?.[1] ?? value

const inputCls =
  'glass-input w-full rounded-2xl px-4 py-3 text-sm placeholder:text-zinc-600 border border-white/10 focus:border-white/40 outline-none transition-all'
const selectCls = `${inputCls} [&>option]:bg-zinc-900 [&>option]:text-white`
const smallBtnCls =
  'px-2.5 py-1 rounded-lg text-xs border border-white/10 text-zinc-300 hover:bg-white/5 transition-colors'

// ── Invite panel (step 2 of the wizard; also mounted standalone in the
//    Hiring & Onboarding manager view) ─────────────────────────────────────────
export function InviteManagerPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [invites, setInvites] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', job_role: '', hourly_rate: '' })
  const [adding, setAdding] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkErrors, setBulkErrors] = useState<string[]>([])

  useEffect(() => {
    fetch(`${API_BASE}/api/onboarding/invites`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && Array.isArray(d.invites)) setInvites(d.invites) })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [refreshKey])

  async function addInvite() {
    if (!form.name.trim()) { toast.error('Name is required.'); return }
    if (form.hourly_rate.trim() && isNaN(Number(form.hourly_rate))) { toast.error('Hourly rate must be a number.'); return }
    setAdding(true)
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          job_role: form.job_role.trim() || undefined,
          hourly_rate: form.hourly_rate.trim() ? Number(form.hourly_rate) : undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { toast.error(data?.error || 'Failed to create invite.'); return }
      setInvites(prev => [data, ...prev])
      setForm({ name: '', email: '', job_role: '', hourly_rate: '' })
      toast.success(`Invite created - code ${data.code}`)
    } catch {
      toast.error('Network error.')
    } finally {
      setAdding(false)
    }
  }

  async function addBulk() {
    // One "Name, email, rate" per line; email and rate optional, blank lines skipped.
    const parsed: Array<{ line: number; invite: any }> = []
    const malformed: string[] = []
    bulkText.split('\n').forEach((raw, i) => {
      if (!raw.trim()) return
      const [name, email, rate] = raw.split(',').map(p => p.trim())
      if (!name) { malformed.push(`Line ${i + 1}: name required`); return }
      if (rate && isNaN(parseFloat(rate))) { malformed.push(`Line ${i + 1}: rate "${rate}" is not a number`); return }
      parsed.push({
        line: i + 1,
        invite: { name, email: email || undefined, hourly_rate: rate ? parseFloat(rate) : undefined },
      })
    })
    setBulkErrors(malformed)
    if (parsed.length === 0) {
      if (malformed.length === 0) toast.error('Nothing to add - paste one "Name, email, rate" per line.')
      return
    }
    setBulkBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/invites/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invites: parsed.map(p => p.invite) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { toast.error(data?.error || 'Bulk invite failed.'); return }
      const created = Array.isArray(data.created) ? data.created : []
      if (created.length > 0) {
        setInvites(prev => [...created.slice().reverse(), ...prev])
        setBulkText('')
        toast.success(`Created ${created.length} invite${created.length !== 1 ? 's' : ''}!`)
      }
      const serverErrors = (Array.isArray(data.errors) ? data.errors : []).map(
        (e: any) => `Line ${parsed[e.index]?.line ?? e.index + 1}${e.name ? ` (${e.name})` : ''}: ${e.error}`,
      )
      setBulkErrors([...malformed, ...serverErrors])
    } catch {
      toast.error('Network error.')
    } finally {
      setBulkBusy(false)
    }
  }

  async function revoke(id: number) {
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/invites/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Could not revoke invite.'); return }
      setInvites(prev => prev.map(inv => (inv.id === id ? { ...inv, status: 'revoked' } : inv)))
      toast.success('Invite revoked.')
    } catch {
      toast.error('Network error.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Single add */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1 tracking-wide">NAME *</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1 tracking-wide">EMAIL</label>
          <input type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1 tracking-wide">ROLE</label>
          <input className={inputCls} value={form.job_role} onChange={e => setForm(f => ({ ...f, job_role: e.target.value }))} placeholder="e.g. Barista" />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1 tracking-wide">HOURLY RATE ($)</label>
          <input type="number" min="0" step="0.01" className={inputCls} value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} placeholder="18.50" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={addInvite}
          disabled={adding}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
          style={{ backgroundColor: 'var(--accent-color)', color: '#000', opacity: adding ? 0.6 : 1 }}
        >
          {adding ? 'Creating…' : '+ Create Invite'}
        </button>
        <button
          onClick={() => setShowBulk(b => !b)}
          className="px-4 py-2 rounded-xl text-sm border border-white/10 text-zinc-300 hover:bg-white/5 transition-colors"
        >
          {showBulk ? 'Hide bulk paste' : 'Bulk paste'}
        </button>
      </div>

      {/* Bulk paste */}
      {showBulk && (
        <div className="space-y-2">
          <textarea
            className="glass-input w-full rounded-2xl px-4 py-3 text-xs font-mono placeholder:text-zinc-600 border border-white/10 focus:border-white/40 outline-none resize-y"
            rows={4}
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={'One per line: Name, email, rate\nJane Doe, jane@co.com, 18.50\nSam Lee'}
          />
          {bulkErrors.length > 0 && (
            <div className="rounded-xl px-3 py-2 text-xs space-y-0.5 bg-red-950/40 border border-red-900/60">
              {bulkErrors.map((e, i) => <div key={i} className="text-red-400">{e}</div>)}
            </div>
          )}
          <button
            onClick={addBulk}
            disabled={bulkBusy || !bulkText.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--accent-color)', color: '#000', opacity: bulkBusy || !bulkText.trim() ? 0.6 : 1 }}
          >
            {bulkBusy ? 'Creating…' : 'Create all invites'}
          </button>
        </div>
      )}

      {/* Invite list */}
      <div className="space-y-2">
        {!loaded && <div className="text-sm text-zinc-500">Loading invites…</div>}
        {loaded && invites.length === 0 && (
          <div className="text-sm text-zinc-500">No invites yet - add your first employee above.</div>
        )}
        {invites.map(inv => (
          <div key={inv.id} className="bg-white/5 rounded-xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium truncate ${inv.status === 'revoked' ? 'line-through text-zinc-500' : ''}`}>{inv.name}</div>
                <div className="text-xs text-zinc-400 truncate">
                  {[inv.job_role, inv.email, inv.hourly_rate != null ? `$${Number(inv.hourly_rate).toFixed(2)}/hr` : null].filter(Boolean).join(' · ') || 'Employee'}
                </div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                style={
                  inv.status === 'pending'
                    ? { backgroundColor: 'var(--accent-color-dim)', color: 'var(--accent-color)' }
                    : inv.status === 'accepted'
                      ? { backgroundColor: 'rgba(var(--accent-color-rgb),0.18)', color: 'var(--accent-color)' }
                      : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#a1a1aa' }
                }
              >
                {inv.status === 'accepted' ? `Joined${inv.claimed_by_name ? ` · ${inv.claimed_by_name}` : ''}` : inv.status}
              </span>
            </div>
            {inv.status === 'pending' && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <code className="text-xs font-mono px-2 py-1 rounded-lg bg-black/40 border border-white/10 tracking-wider">{inv.code}</code>
                <button onClick={() => copyText(inv.code, 'Code')} className={smallBtnCls}>Copy code</button>
                <button onClick={() => copyText(inviteUrl(inv.code), 'Signup link')} className={smallBtnCls}>Copy link</button>
                <button onClick={() => revoke(inv.id)} className="px-2.5 py-1 rounded-lg text-xs border border-red-900/60 text-red-400 hover:bg-red-950/40 transition-colors">Revoke</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 3-step manager wizard (full-screen overlay) ───────────────────────────────
export default function ManagerOnboarding({
  user,
  company,
  onComplete,
  onSkip,
}: {
  user: any
  company: any | null
  onComplete: (user: any) => void
  onSkip: () => void
}) {
  const [step, setStep] = useState(1)
  const [companyState, setCompanyState] = useState<any | null>(company)
  const [form, setForm] = useState({
    name: company?.name ?? '',
    timezone: company?.timezone ?? 'America/New_York',
    pay_period: company?.pay_period ?? 'biweekly',
    overtime_policy: company?.overtime_policy ?? 'weekly_40',
  })
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveCompany() {
    if (!form.name.trim()) { setError('Company name is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const editing = companyState != null
      const res = await fetch(`${API_BASE}/api/onboarding/company`, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          timezone: form.timezone,
          pay_period: form.pay_period,
          overtime_policy: form.overtime_policy,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 409) { setStep(2); return } // already in a company - keep going
      if (!res.ok) { setError(data?.error || 'Could not save company.'); return }
      setCompanyState(editing ? data : data.company)
      setStep(2)
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function finish() {
    setFinishing(true)
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { toast.error(data?.error || 'Could not finish setup.'); return }
      toast.success('Company setup complete!')
      onComplete(data.user)
    } catch {
      toast.error('Network error.')
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      {/* body scroll is disabled globally - the card owns its scrolling */}
      <div className="glass w-full max-w-xl rounded-3xl border border-white/10 max-h-[90vh] flex flex-col">
        <div className="overflow-y-auto p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-5">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${s === step ? 'w-8' : 'w-4'}`}
                style={{ backgroundColor: s <= step ? 'var(--accent-color)' : 'rgba(255,255,255,0.12)' }}
              />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <div className="text-xs tracking-[2px] mb-1.5 uppercase" style={{ color: 'var(--accent-color)' }}>Company Setup · Step 1 of 3</div>
                <h2 className="text-2xl font-semibold tracking-tight mb-1">
                  Welcome{user?.first_name ? `, ${user.first_name}` : ''} - set up your company
                </h2>
                <p className="text-zinc-400 text-sm">A few basics so payroll and schedules work the way your team does.</p>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1 tracking-wide">COMPANY NAME</label>
                <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Coffee" autoFocus />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1 tracking-wide">TIMEZONE</label>
                <select className={selectCls} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
                  {TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1 tracking-wide">PAY PERIOD</label>
                  <select className={selectCls} value={form.pay_period} onChange={e => setForm(f => ({ ...f, pay_period: e.target.value }))}>
                    {PAY_PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1 tracking-wide">OVERTIME</label>
                  <select className={selectCls} value={form.overtime_policy} onChange={e => setForm(f => ({ ...f, overtime_policy: e.target.value }))}>
                    {OVERTIME_POLICIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              {error && (
                <div role="alert" className="text-sm text-red-400 flex items-center gap-2 bg-red-950/40 border border-red-900/60 rounded-xl px-4 py-2">
                  ⚠ {error}
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <button onClick={onSkip} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Set up later</button>
                <button
                  onClick={saveCompany}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#000', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving…' : 'Continue →'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <div className="text-xs tracking-[2px] mb-1.5 uppercase" style={{ color: 'var(--accent-color)' }}>Company Setup · Step 2 of 3</div>
                <h2 className="text-2xl font-semibold tracking-tight mb-1">Add your employees</h2>
                <p className="text-zinc-400 text-sm">Each invite gets a code - share the code or the signup link and they join your company instantly. No emails are sent.</p>
              </div>
              <InviteManagerPanel />
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="text-xs tracking-[2px] mb-1.5 uppercase" style={{ color: 'var(--accent-color)' }}>Company Setup · Step 3 of 3</div>
                <h2 className="text-2xl font-semibold tracking-tight mb-1">You're all set 🎉</h2>
                <p className="text-zinc-400 text-sm">Here's what you just set up:</p>
              </div>
              <div className="bg-white/5 rounded-2xl px-5 py-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-zinc-400">Company</span><span className="font-medium text-right">{companyState?.name || form.name}</span></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-400">Timezone</span><span className="font-medium text-right">{labelFor(TIMEZONES, companyState?.timezone || form.timezone)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-400">Pay period</span><span className="font-medium text-right">{labelFor(PAY_PERIODS, companyState?.pay_period || form.pay_period)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-400">Overtime</span><span className="font-medium text-right">{labelFor(OVERTIME_POLICIES, companyState?.overtime_policy || form.overtime_policy)}</span></div>
              </div>
              <p className="text-xs text-zinc-500">You can mint and revoke invite codes any time from Manager Hub → Hiring &amp; Onboarding.</p>
              <div className="flex items-center justify-between pt-1">
                <button onClick={() => setStep(2)} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">← Back</button>
                <button
                  onClick={finish}
                  disabled={finishing}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#000', opacity: finishing ? 0.6 : 1 }}
                >
                  {finishing ? 'Finishing…' : 'Finish setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
