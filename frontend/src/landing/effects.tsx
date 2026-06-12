import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// WordReveal — renders text split into per-word spans so GSAP can brighten
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
// LiveMoney — a dollar figure that accrues in real time at an hourly rate,
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
// GalaxyCanvas — a lightweight spiral-galaxy particle field. Rotation is
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
// HandwrittenNote — a Caveat-script annotation with a hand-drawn circled
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
// CountUp — a numeral that counts from 0 when it enters the viewport.
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
