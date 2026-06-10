import { useEffect, useRef, useState } from 'react'

// Draft auto-save for entry forms — while a form is open, in-progress values
// are persisted to localStorage (debounced, keyed by user id + form name),
// restored the next time the form opens, and forgotten on successful submit
// or via the "Discard draft" control.

const DEBOUNCE_MS = 500

function draftKey(name: string): string {
  let uid = 'anon'
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null')
    if (u && u.id != null) uid = String(u.id)
  } catch {}
  return `swiftshift-draft-${uid}-${name}`
}

export function useFormDraft<T extends object>(
  name: string,
  form: T,
  setForm: (form: T) => void,
  active: boolean,
) {
  const [draftRestored, setDraftRestored] = useState(false)
  // Skip the next debounced save — set whenever we change the form ourselves
  // (restore, discard, post-submit reset) so only real user edits make drafts.
  const skipNextSave = useRef(false)
  // Form value of a scheduled-but-not-yet-written save, flushed if the form
  // closes (or resets) before the debounce fires so keystrokes aren't lost.
  const pendingSave = useRef<T | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const write = (value: T) => {
    try { localStorage.setItem(draftKey(name), JSON.stringify(value)) } catch {}
  }

  // Restore a saved draft whenever the form (re)opens
  useEffect(() => {
    if (!active) { setDraftRestored(false); return }
    skipNextSave.current = true
    try {
      const raw = localStorage.getItem(draftKey(name))
      const saved = raw ? JSON.parse(raw) : null
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        setForm({ ...form, ...saved })
        setDraftRestored(true)
      }
    } catch {
      // Corrupted draft — discard it rather than crashing.
      try { localStorage.removeItem(draftKey(name)) } catch {}
    }
  }, [active])

  // Debounced save while the form is open
  useEffect(() => {
    if (!active) return
    if (skipNextSave.current) { skipNextSave.current = false; return }
    pendingSave.current = form
    timer.current = window.setTimeout(() => { pendingSave.current = null; write(form) }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer.current)
  }, [form, active])

  // Flush any still-pending save when the form closes or unmounts, so typing
  // right before an accidental close still survives.
  useEffect(() => () => {
    if (pendingSave.current !== null) { write(pendingSave.current); pendingSave.current = null }
  }, [active])

  // Forget the draft — call on successful submit. The form change that usually
  // follows (the post-submit reset) is not re-saved as a new draft.
  const clearDraft = () => {
    window.clearTimeout(timer.current)
    pendingSave.current = null
    skipNextSave.current = true
    setDraftRestored(false)
    try { localStorage.removeItem(draftKey(name)) } catch {}
  }

  // Discard control — drop the draft and reset the form to its defaults.
  const discardDraft = (reset: T) => {
    clearDraft()
    setForm(reset)
  }

  return { draftRestored, clearDraft, discardDraft }
}

// Subtle "Draft restored" note with a discard control, shown inside a form
// after useFormDraft restores saved values.
export function DraftRestoredNote({ show, onDiscard }: { show: boolean; onDiscard: () => void }) {
  if (!show) return null
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span>Draft restored</span>
      <span aria-hidden>·</span>
      <button type="button" onClick={onDiscard} className="underline hover:text-white transition-colors">
        Discard draft
      </button>
    </div>
  )
}
