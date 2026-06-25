import { Fragment, useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// WordReveal - renders text split into per-word spans so GSAP can brighten
// them sequentially on scroll. `**bold**` segments render pre-emphasized
// (white) and the rest dim; containers tagged data-word-reveal get a scrubbed
// dim→bright stagger wired up in LandingPage. Screen readers get the plain
// sentence via aria-label; the spans are presentational.
// ---------------------------------------------------------------------------
export function WordReveal({
  text,
  className,
  as: Tag = 'p',
  reveal = true,
}: {
  text: string
  className?: string
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'div'
  reveal?: boolean
}) {
  const plain = text.replace(/\*\*|\^\^/g, '')
  const words: { text: string; em: boolean; brand: boolean }[] = []
  text.split(/(\*\*[^*]+\*\*|\^\^[^^]+\^\^)/).forEach(seg => {
    if (!seg) return
    const em = seg.startsWith('**')
    const brand = seg.startsWith('^^')
    seg.replace(/\*\*|\^\^/g, '').split(/\s+/).filter(Boolean).forEach(w => words.push({ text: w, em, brand }))
  })
  return (
    <Tag className={className} aria-label={plain} {...(reveal ? { 'data-word-reveal': '' } : {})}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className={`lp-word${w.em ? ' lp-word--em' : ''}${w.brand ? ' lp-word--brand' : ''}`}>
          {w.text}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  )
}

// ---------------------------------------------------------------------------
// HeroHeadline - like WordReveal, but supports two scroll-driven emphases:
//   ~~text~~  -> "sad" words that deflate and turn gray as you scroll
//   **text**  -> "brand" words (SwiftShift) that brighten, lift, and grow
// Each word is an inline-block span carrying stable classes (.lp-hw, plus
// .lp-sad / .lp-brand) so GSAP can transform it. Screen readers get the
// plain sentence via aria-label; the spans are presentational.
// ---------------------------------------------------------------------------
export function HeroHeadline({ text, className }: { text: string; className?: string }) {
  const plain = text.replace(/~~|\*\*/g, '')
  const words: { text: string; sad: boolean; brand: boolean }[] = []
  text.split(/(~~[^~]+~~|\*\*[^*]+\*\*)/).forEach(seg => {
    if (!seg) return
    const sad = seg.startsWith('~~')
    const brand = seg.startsWith('**')
    seg.replace(/~~|\*\*/g, '').split(/\s+/).filter(Boolean).forEach(w =>
      words.push({ text: w, sad, brand }),
    )
  })
  return (
    <h1 className={className} aria-label={plain}>
      {words.map((w, i) => (
        // The space lives BETWEEN the inline-block spans (not inside them, where
        // inline-block layout would trim it) so words are spaced and can wrap.
        <Fragment key={i}>
          <span
            aria-hidden="true"
            className={`lp-hw${w.sad ? ' lp-sad' : ''}${w.brand ? ' lp-brand' : ''}`}
          >
            {w.text}
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </h1>
  )
}

// ---------------------------------------------------------------------------
// LiveMoney - a dollar figure that accrues in real time at an hourly rate,
// with a small third-decimal digit so the motion is visible every frame.
// Mirrors the in-app live earnings odometer that the copy is selling.
// ---------------------------------------------------------------------------
export function LiveMoney({
  rate = 36.5,
  start = 1284.063,
  className,
}: {
  rate?: number
  start?: number
  className?: string
}) {
  const mainRef = useRef<HTMLSpanElement>(null)
  const milliRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = (t: number) => {
      const v = start + ((t - t0) / 3_600_000) * rate
      const fixed = v.toFixed(3)
      const dot = fixed.indexOf('.')
      const dollars = Number(fixed.slice(0, dot)).toLocaleString('en-US')
      if (mainRef.current) mainRef.current.textContent = `$${dollars}.${fixed.slice(dot + 1, dot + 3)}`
      if (milliRef.current) milliRef.current.textContent = fixed.slice(dot + 3)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [rate, start])

  return (
    <span className={`lp-money ${className ?? ''}`}>
      <span ref={mainRef}>${start.toFixed(2)}</span>
      <span ref={milliRef} className="opacity-50" style={{ fontSize: '0.45em', verticalAlign: 'baseline' }} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// DepositCanvas - a "direct deposit" money field for the friction-scale finale
// (replaces the old galaxy, which didn't fit "get paid"). Lime/gold bills drift
// down, sway and flip like cash landing in an account; intensity ramps up with
// scroll progress (progressRef, ~0..2.6) so it blooms as the section pins.
// ---------------------------------------------------------------------------
export function DepositCanvas({
  progressRef,
  className,
}: {
  progressRef: React.MutableRefObject<number>
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    type Bill = {
      x: number; y: number; vy: number
      sway: number; swayAmp: number
      rot: number; vr: number
      flip: number; vf: number
      size: number; warm: boolean
    }
    const N = 44
    const bills: Bill[] = []
    for (let i = 0; i < N; i++) {
      bills.push({
        x: Math.random(),
        y: Math.random(),
        vy: 0.05 + Math.random() * 0.07,
        sway: Math.random() * Math.PI * 2,
        swayAmp: 6 + Math.random() * 16,
        rot: (Math.random() - 0.5) * 0.6,
        vr: (Math.random() - 0.5) * 0.012,
        flip: Math.random() * Math.PI * 2,
        vf: 0.6 + Math.random() * 1.3,
        size: 13 + Math.random() * 13,
        warm: Math.random() < 0.28,
      })
    }

    let raf = 0
    let last = performance.now()
    const render = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t
      ctx.clearRect(0, 0, w, h)
      // Opacity + fall speed ramp with scroll progress through phase 3 (~1.9..2.5).
      const prog = Math.max(0, Math.min(1, (progressRef.current - 1.9) / 0.55))
      const intensity = 0.3 + prog * 0.7
      for (const b of bills) {
        b.y += b.vy * dt * (0.6 + prog)
        b.sway += dt * 1.2
        b.rot += b.vr
        b.flip += b.vf * dt
        if (b.y > 1.1) { b.y = -0.1; b.x = Math.random() }
        const px = b.x * w + Math.sin(b.sway) * b.swayAmp
        const py = b.y * h
        const fade = Math.min(1, b.y * 5 + 0.15) * Math.min(1, (1.1 - b.y) * 2.2)
        const alpha = intensity * 0.85 * Math.max(0, fade)
        if (alpha <= 0.01) continue
        const wBill = b.size * 1.7
        const hBill = b.size
        const sx = Math.cos(b.flip)               // horizontal flip = spinning bill
        const col = b.warm ? '255,210,90' : '215,254,81'
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(b.rot)
        ctx.scale(Math.max(0.12, Math.abs(sx)), 1)
        ctx.globalAlpha = alpha
        ctx.fillStyle = `rgba(${col},0.92)`
        ctx.beginPath()
        ctx.rect(-wBill / 2, -hBill / 2, wBill, hBill)
        ctx.fill()
        ctx.globalAlpha = alpha * 0.9
        ctx.fillStyle = 'rgba(8,14,8,0.85)'
        ctx.font = `${Math.round(b.size * 0.66)}px ui-sans-serif, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('$', 0, 1)
        ctx.restore()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [progressRef])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// HandwrittenNote - a Caveat-script annotation (.lp-handwrite-clip). The text
// reveals via a clip-path sweep wired up in LandingPage's pay timeline.
// ---------------------------------------------------------------------------
export function HandwrittenNote({ text, className }: { text: string; className?: string }) {
  // The hand-drawn circle-arrow doodle was removed: the circle wasn't circling
  // anything next to "your money, live". Just the handwritten label remains.
  return (
    <div className={className} data-handwrite aria-hidden="true">
      <span className="lp-handwrite lp-handwrite-clip">{text}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CountUp - a numeral that counts from 0 when it enters the viewport.
// LandingPage wires the trigger; this just renders the final value and a
// data attribute with the target so GSAP can animate textContent.
// ---------------------------------------------------------------------------
export function CountUp({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className} data-countup={value}>
      {value.toLocaleString('en-US')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// GravityDots - the hero's dot field, made interactive. A grid of dots that
// bends toward the pointer like a little gravity well (and brightens to the
// accent near the cursor), then springs back. Pure 2D canvas, pointer-events
// none so it never blocks the hero. Reduced motion renders one static grid.
// ---------------------------------------------------------------------------
export function GravityDots({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0
    type Dot = { bx: number; by: number; x: number; y: number; vx: number; vy: number }
    let dots: Dot[] = []

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Spacing scales up a touch on small screens to keep the dot count sane.
      const spacing = w < 640 ? 26 : 32
      const cols = Math.ceil(w / spacing) + 2
      const rows = Math.ceil(h / spacing) + 2
      dots = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = c * spacing, by = r * spacing
          dots.push({ bx, by, x: bx, y: by, vx: 0, vy: 0 })
        }
      }
    }
    build()

    const drawStatic = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      for (const d of dots) {
        ctx.beginPath()
        ctx.arc(d.bx, d.by, 1, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const ro = new ResizeObserver(() => { build(); if (reduce) drawStatic() })
    ro.observe(canvas)

    if (reduce) {
      drawStatic()
      return () => ro.disconnect()
    }

    // Pointer position in canvas-local coords; far-away sentinel = inactive.
    let mx = -1e5, my = -1e5
    const RADIUS = 168
    const setFromClient = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect()
      mx = cx - rect.left; my = cy - rect.top
    }
    const onMouse = (e: MouseEvent) => setFromClient(e.clientX, e.clientY)
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; if (t) setFromClient(t.clientX, t.clientY) }
    const onLeave = () => { mx = -1e5; my = -1e5 }
    window.addEventListener('mousemove', onMouse, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchend', onLeave, { passive: true })
    window.addEventListener('touchcancel', onLeave, { passive: true })
    window.addEventListener('mouseout', onLeave, { passive: true })

    let raf = 0
    const render = () => {
      ctx.clearRect(0, 0, w, h)
      const r2 = RADIUS * RADIUS
      for (const d of dots) {
        const dx = mx - d.bx, dy = my - d.by
        const dist2 = dx * dx + dy * dy
        let near = 0
        if (dist2 < r2) {
          const dist = Math.sqrt(dist2) || 0.0001
          near = 1 - dist / RADIUS                 // 0..1 falloff
          const pull = near * near * 30             // dots drawn toward the cursor
          const tx = d.bx + (dx / dist) * pull
          const ty = d.by + (dy / dist) * pull
          d.vx += (tx - d.x) * 0.16
          d.vy += (ty - d.y) * 0.16
        } else {
          d.vx += (d.bx - d.x) * 0.11               // spring back home
          d.vy += (d.by - d.y) * 0.11
        }
        d.vx *= 0.80; d.vy *= 0.80
        d.x += d.vx; d.y += d.vy

        const radius = 1 + near * 1.8
        ctx.beginPath()
        ctx.arc(d.x, d.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = near > 0
          ? `rgba(215,254,81,${0.16 + near * 0.62})`
          : 'rgba(255,255,255,0.14)'
        ctx.fill()
      }
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouse)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchend', onLeave)
      window.removeEventListener('touchcancel', onLeave)
      window.removeEventListener('mouseout', onLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// WorkdayMorph - an original enterprise-style logo mark (a glossy blue orb
// with a corporate swirl) that, as you scroll into the comparison, drains to
// gray and morphs into a sad face: the swirl fades, eyes and a frown appear,
// a tear wells up. All targets carry stable classes wired up in LandingPage.
// (Original art - it evokes heavyweight HR software, it is not a real mark.)
// ---------------------------------------------------------------------------
export function WorkdayMorph({ className }: { className?: string }) {
  return (
    <div className={className} data-workday aria-hidden="true">
      <svg viewBox="0 0 120 120" className="lp-wd-svg">
        <circle className="lp-wd-orb" cx="60" cy="60" r="46" />
        <circle className="lp-wd-sheen" cx="46" cy="44" r="15" />
        <path className="lp-wd-mark" d="M38 58 q11 -24 22 0 q11 24 22 0" />
        <circle className="lp-wd-eye" cx="47" cy="55" r="4.6" />
        <circle className="lp-wd-eye" cx="73" cy="55" r="4.6" />
        <path className="lp-wd-mouth" d="M45 86 Q60 73 75 86" />
        <path className="lp-wd-tear" d="M47 63 q-4.5 7.5 0 11 q4.5 -3.5 0 -11 z" />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EarningsTickerDemo - a landing-page replica of the in-app "Real Time Rewards"
// card (Rewards.tsx). Simulates a clocked-in worker, ticking every frame via
// rAF from a plausible mid-shift balance. No live session needed; styled to the
// landing's dark aesthetic with the lime accent and a live pulse badge.
// ---------------------------------------------------------------------------
export function EarningsTickerDemo({
  rate = 36.5,
  start = 247.38,
  className,
}: {
  rate?: number
  start?: number
  className?: string
}) {
  const amountRef = useRef<HTMLSpanElement>(null)
  const milliRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = (t: number) => {
      const v = start + ((t - t0) / 3_600_000) * rate
      const fixed = v.toFixed(3)
      const dot = fixed.indexOf('.')
      const dollars = Number(fixed.slice(0, dot)).toLocaleString('en-US')
      if (amountRef.current) amountRef.current.textContent = `$${dollars}.${fixed.slice(dot + 1, dot + 3)}`
      if (milliRef.current) milliRef.current.textContent = fixed.slice(dot + 3)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [rate, start])

  return (
    <div
      className={`relative rounded-3xl p-6 overflow-hidden ${className ?? ''}`}
      style={{
        background: 'rgba(10,12,18,0.82)',
        border: '1px solid rgba(215,254,81,0.18)',
        boxShadow: '0 0 48px -16px rgba(215,254,81,0.14), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(215,254,81,0.10) 0%, transparent 65%)' }}
      />
      <div className="text-[0.68rem] uppercase tracking-[0.22em] mb-0.5 relative" style={{ color: 'rgba(244,244,245,0.9)' }}>
        Real Time Rewards
      </div>
      <div className="text-[0.62rem] uppercase tracking-[0.18em] mb-4 relative" style={{ color: 'rgba(244,244,245,0.38)' }}>
        Today&apos;s Earnings
      </div>
      <div className="relative mb-3">
        <span
          className="lp-money block"
          style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', color: '#d7fe51', letterSpacing: '-0.03em', fontWeight: 550 }}
        >
          <span ref={amountRef}>${start.toFixed(2)}</span>
          <span ref={milliRef} style={{ fontSize: '0.44em', opacity: 0.55, verticalAlign: 'baseline' }} />
        </span>
      </div>
      <div className="flex items-center gap-1.5 relative">
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: '#22ff7a', boxShadow: '0 0 6px #22ff7a, 0 0 12px #22ff7a55' }}
        />
        <span className="text-[0.62rem] uppercase tracking-[0.22em] font-medium" style={{ color: 'rgba(244,244,245,0.6)' }}>
          live
        </span>
      </div>
      <div
        className="mt-4 pt-4 text-[0.62rem] relative"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: 'rgba(244,244,245,0.26)' }}
      >
        accruing at ${rate}/hr &middot; every second counts
      </div>
    </div>
  )
}
