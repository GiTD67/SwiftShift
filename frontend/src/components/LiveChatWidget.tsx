import { useEffect, useRef, useState } from 'react'

// Floating "agents are live" chat widget for the public marketing pages (Sales /
// Contact). A flashing green dot signals availability; opening it starts a chat
// answered by Swifty AI, with a "leave your email" handoff that routes to the
// sales inbox. It never touches account data - it only answers product questions.

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const ACCENT = 'var(--lp-accent, #d7fe51)'
const GREETING =
  "Hi! 👋 I'm the SwiftShift assistant. Ask me anything about features, pricing, " +
  "or getting started, and I'll help right away."

export function LiveChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showHandoff, setShowHandoff] = useState(false)
  const [handoffDone, setHandoffDone] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, open, showHandoff, handoffDone])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const r = await fetch('/api/live-chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-8) }),
      })
      const data = await r.json().catch(() => null)
      const reply = (data && data.reply) || "Sorry, I couldn't reach our assistant. Leave your email and we'll follow up."
      setMessages(m => [...m, { role: 'assistant', content: reply }])
      if (data && data.handoff) setShowHandoff(true)
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: "Sorry, something went wrong. Leave your email below and our team will reach out." }])
      setShowHandoff(true)
    } finally {
      setSending(false)
    }
  }

  const submitHandoff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) return
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    try {
      await fetch('/api/live-chat/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message: lastUser?.content || '' }),
      })
    } catch { /* best-effort; still confirm to the visitor */ }
    setHandoffDone(true)
    setShowHandoff(false)
  }

  return (
    <div style={{ position: 'fixed', right: '1.25rem', bottom: '1.25rem', zIndex: 60 }}>
      {open && (
        <div
          role="dialog"
          aria-label="SwiftShift live chat"
          className="flex flex-col"
          style={{
            width: 'min(360px, calc(100vw - 2.5rem))',
            height: 'min(520px, calc(100dvh - 7rem))',
            marginBottom: '0.75rem',
            background: '#0b0c10',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '18px',
            boxShadow: '0 24px 70px -20px rgba(0,0,0,0.85)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <span className="animate-pulse" style={{ width: 9, height: 9, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white leading-tight">SwiftShift Help</div>
              <div className="text-[11px]" style={{ color: ACCENT }}>Agents available now</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-white/50 hover:text-white transition-colors p-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className="text-sm leading-relaxed"
                  style={{
                    maxWidth: '85%',
                    padding: '8px 12px',
                    borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.role === 'user' ? ACCENT : 'rgba(255,255,255,0.06)',
                    color: m.role === 'user' ? '#0a0b0e' : '#f4f4f5',
                    fontWeight: m.role === 'user' ? 600 : 400,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="text-sm" style={{ padding: '8px 12px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)', color: 'rgba(244,244,245,0.6)' }}>…</div>
              </div>
            )}

            {handoffDone && (
              <div className="text-xs rounded-xl px-3 py-2" style={{ background: 'rgba(215,254,81,0.08)', border: `1px solid rgba(215,254,81,0.3)`, color: '#f4f4f5' }}>
                Thanks! A team member will email you back shortly.
              </div>
            )}

            {showHandoff && !handoffDone && (
              <form onSubmit={submitHandoff} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="text-xs text-white/70">Leave your email and a human will follow up:</div>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Name (optional)"
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                />
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="you@company.com"
                  className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}
                />
                <button type="submit" className="w-full text-sm font-bold rounded-lg py-2 transition-transform active:scale-95" style={{ background: ACCENT, color: '#0a0b0e' }}>
                  Send
                </button>
              </form>
            )}
          </div>

          {/* Composer */}
          <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                rows={1}
                placeholder="Type your message…"
                className="flex-1 text-sm rounded-xl px-3 py-2 outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', maxHeight: 96 }}
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                aria-label="Send message"
                className="rounded-xl p-2.5 transition-transform active:scale-95 disabled:opacity-40"
                style={{ background: ACCENT, color: '#0a0b0e' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </div>
            <div className="mt-1.5 text-[10px] text-center" style={{ color: 'rgba(244,244,245,0.3)' }}>Powered by Swifty AI</div>
          </div>
        </div>
      )}

      {/* Launcher */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Minimize chat' : 'Chat with us, agents available'}
        className="flex items-center gap-2.5 font-semibold transition-transform hover:scale-105 active:scale-95"
        style={{
          marginLeft: 'auto',
          padding: open ? '0.6rem' : '0.7rem 1.1rem',
          borderRadius: '9999px',
          background: '#0b0c10',
          border: `1px solid rgba(215,254,81,0.5)`,
          color: '#fff',
          boxShadow: `0 10px 30px -8px rgba(0,0,0,0.7), 0 0 0 4px rgba(215,254,81,0.08)`,
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        ) : (
          <>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <span className="animate-pulse" style={{ width: 9, height: 9, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }} />
            </span>
            <span className="text-sm">Chat with us</span>
          </>
        )}
      </button>
    </div>
  )
}

export default LiveChatWidget
