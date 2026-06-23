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
  const plain = text.replace(/\*\*/g, '')
  const words: { text: string; em: boolean }[] = []
  text.split(/(\*\*[^*]+\*\*)/).forEach(seg => {
    if (!seg) return
    const em = seg.startsWith('**')
    seg.replace(/\*\*/g, '').split(/\s+/).filter(Boolean).forEach(w => words.push({ text: w, em }))
  })
  return (
    <Tag className={className} aria-label={plain} {...(reveal ? { 'data-word-reveal': '' } : {})}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" className={`lp-word${w.em ? ' lp-word--em' : ''}`}>
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
// GalaxyCanvas - a lightweight spiral-galaxy particle field. Rotation is
// driven from outside (scroll progress) via rotationRef, plus a slow idle
// drift so it never feels frozen.
// ---------------------------------------------------------------------------
export function GalaxyCanvas({
  rotationRef,
  className,
}: {
  rotationRef: React.MutableRefObject<number>
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 3-arm logarithmic spiral, normalized coordinates (radius 0..1)
    const N = 520
    const particles: { r: number; a: number; size: number; alpha: number; warm: boolean }[] = []
    for (let i = 0; i < N; i++) {
      const arm = i % 3
      const t = Math.pow(Math.random(), 0.75) * 2.6           // distance along the arm
      const spread = (Math.random() - 0.5) * 0.34 * (0.4 + t / 2.6)
      particles.push({
        r: 0.06 + (t / 2.6) * 0.92,
        a: arm * ((Math.PI * 2) / 3) + t * 1.9 + spread,
        size: Math.random() < 0.12 ? 1.8 : Math.random() * 1.1 + 0.4,
        alpha: 0.25 + Math.random() * 0.75,
        warm: Math.random() < 0.18,
      })
    }

    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      canvas.width = width * dpr
      canvas.height = height * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const render = (time: number) => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) * 0.46
      const rot = rotationRef.current + time * 0.000045
      // soft core glow
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.45)
      core.addColorStop(0, 'rgba(255,244,214,0.5)')
      core.addColorStop(0.4, 'rgba(255,220,170,0.12)')
      core.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = core
      ctx.fillRect(0, 0, w, h)
      // tilt the disc for a 3/4 view like the reference galaxy
      for (const p of particles) {
        const ang = p.a + rot
        const x = cx + Math.cos(ang) * p.r * R
        const y = cy + Math.sin(ang) * p.r * R * 0.42
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.warm ? 'rgba(255,214,160,1)' : 'rgba(235,240,255,1)'
        ctx.beginPath()
        ctx.arc(x, y, p.size * dpr, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [rotationRef])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}

// ---------------------------------------------------------------------------
// HandwrittenNote - a Caveat-script annotation with a hand-drawn circled
// arrow. The strokes use pathLength=1 so GSAP can write them on with a
// simple dashoffset 1→0 scrub; the text reveals via a clip-path sweep.
// Targets carry stable classes: .lp-hw-stroke (paths) and .lp-handwrite-clip.
// ---------------------------------------------------------------------------
export function HandwrittenNote({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className} data-handwrite aria-hidden="true">
      <span className="lp-handwrite lp-handwrite-clip">{text}</span>
      <svg width="74" height="58" viewBox="0 0 74 58" fill="none" className="inline-block ml-1 -mt-2">
        <path
          className="lp-hw-stroke"
          d="M10 12 C 28 2, 56 4, 60 14 C 64 24, 40 30, 24 26 C 10 23, 8 16, 14 11"
          stroke="rgba(244,244,245,0.8)"
          strokeWidth="1.6"
          strokeLinecap="round"
          pathLength={1}
        />
        <path
          className="lp-hw-stroke"
          d="M34 30 C 40 38, 46 44, 56 50 M56 50 L46 47 M56 50 L52 41"
          stroke="rgba(244,244,245,0.8)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
        />
      </svg>
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
