import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import '@fontsource/caveat/600.css'
import './landing.css'
import { LogoSVG } from './shared'
import { WordReveal, HeroHeadline, LiveMoney, DepositCanvas, HandwrittenNote, CountUp, GravityDots, WorkdayMorph, EarningsTickerDemo } from './effects'

gsap.registerPlugin(ScrollTrigger)

// ---------------------------------------------------------------------------
// Copy - grounded in what the product actually does (see ClockWidget,
// Rewards/Odometer, Vault, PayrollRunsPanel, BreakReminderModal).
// Hero markup: ~~..~~ deflates to gray on scroll, **..** is the brand word
// that brightens and grows (see HeroHeadline + the hero timeline below).
// ---------------------------------------------------------------------------
const HERO_TEXT =
  'Workforce software became ~~heavy, slow, and joyless.~~ **SwiftShift** makes it easy and fun. 7x your company’s efficiency by gamifying pay, PTO, and payroll with **SwiftShift.**'

const STATEMENT_TEXT =
  '**Instant gratification,** built in. ^^SwiftShift^^ closes the gap between doing the work and seeing the money, so the reward lands the moment you earn it.'

const CAPABILITIES = ['Time clock', 'Live pay', 'PTO', 'Payroll', 'Documents', 'Rewards', 'AI taxes']

// The seven headline features, lit up one by one as they scroll into view.
const FEATURES = [
  'Frictionless time clock',
  'Live paycheck accrual',
  'Live PTO accrual',
  'Easy payroll',
  'Quickly locate documents',
  'Rewards for punctual employees',
  'Free AI tax filing',
]

const STEPS = [
  { tap: 'One tap', name: 'Clock in', desc: 'No login maze, no menus. Works even offline.' },
  { tap: 'Zero taps', name: 'Accrue', desc: 'Pay and PTO tick upward live while you work, to the cent. Instant gratification you can watch.' },
  { tap: 'One tap', name: 'Get paid', desc: 'Payroll runs with direct deposit. No third-party vendor, no waiting.' },
]

const PAY_BULLETS = [
  'Watch earnings tick up every second you’re clocked in',
  'PTO accrues to the third decimal, no mystery math',
  'A live payday countdown, never hidden behind a portal',
]

const CMP_ROWS: [string, string, string, string][] = [
  ['Time to first clock-in', '~7 seconds', 'Weeks of deployment', 'Days of setup'],
  ['Learning curve', 'None, it’s one button', 'Training courses', 'Admin configuration'],
  ['Clocking in', '1 tap, even offline', 'Portal login + module', 'App + menus'],
  ['Live pay & PTO ticker', '✓ To the cent, every second', '-', '-'],
  ['Finding your documents', 'Instant search, zero folders', 'Folder maze', 'Admin-gated'],
  ['Payroll', '✓ Built-in ACH via Stripe', 'Separate module', 'Separate product tier'],
  ['Rewards, XP & streaks', '✓ Native', '-', '-'],
  ['State break-law reminders', '✓ Automatic', 'HR-configured', 'HR-configured'],
  ['Price to start', 'Free account', 'Enterprise contract', 'Per-module pricing'],
]

const STATS = [
  { n: 1, label: 'tap to clock in, no login, no menus' },
  { n: 0, label: 'minutes of training required' },
  { n: 30, label: 'days one sign-in lasts' },
  { n: 86400, label: 'times a day your live pay updates' },
]

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const depositProgress = useRef(0)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // -- Smooth scrolling (Lenis drives ScrollTrigger) -------------------
        const lenis = new Lenis({ duration: 1.15 })
        lenis.on('scroll', ScrollTrigger.update)
        const tick = (time: number) => lenis.raf(time * 1000)
        gsap.ticker.add(tick)
        gsap.ticker.lagSmoothing(0)

        // Recompute every pin/trigger after a resize or orientation change so
        // narrow windows and mobile toolbar toggles never leave a stale pin.
        const onResize = () => ScrollTrigger.refresh()
        window.addEventListener('resize', onResize)

        // -- Nav: translucent once you leave the hero ------------------------
        ScrollTrigger.create({
          start: 60,
          onUpdate: self => {
            root.querySelector('.lp-nav')?.classList.toggle('is-scrolled', self.scroll() > 60)
          },
        })

        // -- Hero: staggered entrance, then parallax exit + ring spin --------
        gsap.from('.lp-hero .lp-hw', {
          opacity: 0, y: 26, duration: 0.9, ease: 'power3.out', stagger: 0.025, delay: 0.1,
        })
        gsap.from('.lp-hero-after', {
          opacity: 0, y: 18, duration: 0.8, ease: 'power3.out', stagger: 0.09, delay: 0.75,
        })
        gsap.to('.lp-hero-inner', {
          yPercent: -16, opacity: 0.5, ease: 'none',
          scrollTrigger: { trigger: '.lp-hero', start: 'top top', end: 'bottom top', scrub: true },
        })
        gsap.to('.lp-ring--a', {
          rotation: 130, ease: 'none',
          scrollTrigger: { trigger: '.lp-hero', start: 'top top', end: 'bottom top', scrub: true },
        })
        gsap.to('.lp-ring--b', {
          rotation: -95, ease: 'none',
          scrollTrigger: { trigger: '.lp-hero', start: 'top top', end: 'bottom top', scrub: true },
        })

        // -- Hero word emotion: "heavy, slow, and joyless" deflates to gray,
        //    "SwiftShift" brightens, lifts, and grows as you scroll ----------
        gsap.to('.lp-hero .lp-sad', {
          color: '#6b7280', opacity: 0.55, scaleY: 0.6, y: 11, skewX: -3,
          transformOrigin: '50% 0%', ease: 'none', stagger: 0.05, immediateRender: false,
          scrollTrigger: { trigger: '.lp-hero', start: 'top top', end: '62% top', scrub: true },
        })
        // "SwiftShift" is already brand-green from first paint (see .lp-brand in
        // landing.css); scroll only lifts and grows it, no color change.
        gsap.set('.lp-hero .lp-brand', { textShadow: '0px 0px 0px rgba(215,254,81,0)' })
        gsap.to('.lp-hero .lp-brand', {
          scale: 1.16, y: -3, textShadow: '0px 0px 28px rgba(215,254,81,0.6)',
          transformOrigin: '50% 100%', ease: 'none', immediateRender: false,
          scrollTrigger: { trigger: '.lp-hero', start: 'top top', end: '45% top', scrub: true },
        })

        // -- Scroll-linked word reveals (statement section) ------------------
        gsap.utils.toArray<HTMLElement>('[data-word-reveal]').forEach(el => {
          gsap.fromTo(
            el.querySelectorAll('.lp-word:not(.lp-word--brand)'),
            { color: 'rgba(244,244,245,0.18)' },
            {
              color: '#f4f4f5', ease: 'none', stagger: 0.5,
              scrollTrigger: { trigger: el, start: 'top 80%', end: 'top 32%', scrub: true },
            },
          )
        })

        // -- Feature list: each phrase lights up and grows as it rises -------
        gsap.set('.lp-feature-text', { textShadow: '0px 0px 0px rgba(255,255,255,0)' })
        gsap.utils.toArray<HTMLElement>('.lp-feature').forEach(el => {
          const text = el.querySelector('.lp-feature-text')
          const idx = el.querySelector('.lp-feature-idx')
          if (text) {
            gsap.fromTo(text,
              { color: 'rgba(244,244,245,0.20)', scale: 0.84 },
              {
                color: '#ffffff', scale: 1.04, textShadow: '0px 0px 30px rgba(255,255,255,0.22)',
                transformOrigin: 'left center', ease: 'none',
                scrollTrigger: { trigger: el, start: 'top 86%', end: 'top 42%', scrub: true },
              },
            )
          }
          if (idx) {
            gsap.fromTo(idx,
              { color: 'rgba(244,244,245,0.16)' },
              {
                color: '#d7fe51', ease: 'none',
                scrollTrigger: { trigger: el, start: 'top 86%', end: 'top 52%', scrub: true },
              },
            )
          }
        })

        // -- The Friction Scale: pinned orb morph (ring -> sun -> direct deposit) --
        const steps = gsap.utils.toArray<HTMLElement>('.lp-step')
        const scaleTl = gsap.timeline({
          scrollTrigger: {
            trigger: '.lp-scale', start: 'top top', end: '+=320%', pin: true, scrub: 1,
            invalidateOnRefresh: true,
            onUpdate: self => { depositProgress.current = self.progress * 2.6 },
          },
        })
        scaleTl
          // phase 1 - lime ring (clock in)
          .fromTo('.lp-orb-ring-el', { scale: 0.55, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5 })
          .to(steps[0], { opacity: 1, duration: 0.25 }, 0.1)
          .to('.lp-orb-ring-el', { rotation: 80, duration: 1.3, ease: 'none' }, 0)
          // phase 2 - molten sun (live accrual)
          .to(steps[0], { opacity: 0.3, duration: 0.25 }, 0.9)
          .to(steps[1], { opacity: 1, duration: 0.25 }, 0.95)
          .to('.lp-orb-ring-el', { opacity: 0, scale: 1.5, duration: 0.4 }, 0.9)
          .fromTo('.lp-orb-sun-el', { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'power1.out' }, 0.95)
          .fromTo('.lp-orb-money', { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.3)
          .to('.lp-orb-sun-el', { scale: 1.32, duration: 0.7, ease: 'none' }, 1.5)
          // phase 3 - direct deposit (payroll lands for the whole team)
          .to('.lp-orb-money', { opacity: 0, duration: 0.2 }, 1.95)
          .to(steps[1], { opacity: 0.3, duration: 0.25 }, 2.0)
          .to(steps[2], { opacity: 1, duration: 0.25 }, 2.05)
          .to('.lp-orb-sun-el', { scale: 0.45, opacity: 0, duration: 0.5 }, 2.0)
          .fromTo('.lp-deposit', { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.6 }, 2.25)
          .to({}, { duration: 0.45 })

        // -- Live pay: glow rises, handwriting writes, letterbox collapse ----
        const payTl = gsap.timeline({
          scrollTrigger: { trigger: '.lp-pay', start: 'top top', end: '+=180%', pin: true, scrub: 1, invalidateOnRefresh: true },
        })
        payTl
          .fromTo('.lp-glow', { yPercent: 70, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1 })
          .fromTo('.lp-pay-money', { scale: 0.85, opacity: 0.4 }, { scale: 1, opacity: 1, duration: 0.7 }, 0.2)
          .fromTo('.lp-pay-bullet', { opacity: 0.18, x: -14 }, { opacity: 1, x: 0, stagger: 0.2, duration: 0.5 }, 0.45)
          .fromTo('.lp-handwrite-clip', { clipPath: 'inset(-20% 100% -20% 0)' }, { clipPath: 'inset(-20% 0% -20% 0)', duration: 0.5 }, 0.75)
          .to({}, { duration: 0.4 })
          .to('.lp-pay-frame', { clipPath: 'inset(44% 0% 44% 0%)', ease: 'power1.in', duration: 0.9 })
          .to('.lp-pay-content', { scale: 0.93, opacity: 0.4, duration: 0.9 }, '<')

        // -- The heavyweight mark drains to gray and turns into a sad face ----
        const wdTl = gsap.timeline({
          scrollTrigger: { trigger: '.lp-cmp', start: 'top 80%', end: 'top 30%', scrub: true },
        })
        wdTl
          .to('.lp-wd-orb', { fill: '#6b7280', duration: 1 }, 0)
          .to('.lp-wd-sheen', { opacity: 0, duration: 0.5 }, 0)
          .to('.lp-wd-mark', { opacity: 0, duration: 0.5 }, 0)
          .to('.lp-workday', { rotation: -6, y: 6, transformOrigin: '50% 50%', duration: 1 }, 0)
          .to('.lp-wd-eye', { opacity: 1, duration: 0.4 }, 0.3)
          .to('.lp-wd-mouth', { opacity: 1, duration: 0.6 }, 0.4)
          .to('.lp-wd-tear', { opacity: 1, y: 6, duration: 0.5 }, 0.65)

        // -- Comparison rows slide in on viewport entry -----------------------
        gsap.utils.toArray<HTMLElement>('.lp-cmp-row').forEach(row => {
          gsap.from(row, {
            opacity: 0, y: 24, duration: 0.7, ease: 'power3.out',
            scrollTrigger: { trigger: row, start: 'top 90%' },
          })
        })

        // -- Stats: entrance + count-up + scale bars + spinning dial ----------
        gsap.utils.toArray<HTMLElement>('.lp-stat').forEach(stat => {
          gsap.from(stat, {
            opacity: 0, y: 30, duration: 0.7, ease: 'power3.out',
            scrollTrigger: { trigger: stat, start: 'top 88%' },
          })
          const num = stat.querySelector<HTMLElement>('[data-countup]')
          if (!num) return
          const target = Number(num.dataset.countup)
          const counter = { v: 0 }
          gsap.to(counter, {
            v: target, duration: 1.6, ease: 'power2.out',
            scrollTrigger: { trigger: stat, start: 'top 88%' },
            onUpdate: () => { num.textContent = Math.round(counter.v).toLocaleString('en-US') },
          })
        })
        gsap.fromTo('.lp-bar--swift', { scaleY: 0 }, {
          scaleY: 1, ease: 'none',
          scrollTrigger: { trigger: '.lp-bars', start: 'top 85%', end: 'top 35%', scrub: true },
        })
        gsap.fromTo('.lp-bar--hris', { scaleY: 0 }, {
          scaleY: 1, ease: 'none',
          scrollTrigger: { trigger: '.lp-bars', start: 'top 85%', end: 'top 25%', scrub: true },
        })
        gsap.to('.lp-stat-dial', {
          rotation: 360, ease: 'none',
          scrollTrigger: { trigger: '.lp-stats', start: 'top bottom', end: 'bottom top', scrub: true },
        })

        // -- Finale: letterboxed app slab zooms with scroll -------------------
        const finTl = gsap.timeline({
          scrollTrigger: { trigger: '.lp-fin', start: 'top top', end: '+=160%', pin: true, scrub: 1, invalidateOnRefresh: true },
        })
        finTl
          .fromTo('.lp-slab', { scale: 0.62, rotateX: 10, yPercent: 6 }, { scale: 1.04, rotateX: 0, yPercent: 0, ease: 'none', duration: 1 })
          .fromTo('.lp-fin-head', { opacity: 1 }, { opacity: 0.25, duration: 0.35 }, 0.55)

        // -- Generic viewport entrances ---------------------------------------
        gsap.utils.toArray<HTMLElement>('[data-rise]').forEach(el => {
          gsap.from(el, {
            opacity: 0, y: 28, duration: 0.8, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          })
        })

        return () => {
          gsap.ticker.remove(tick)
          window.removeEventListener('resize', onResize)
          lenis.destroy()
        }
      })

      // Reduced motion: everything legible and static, no pins, no smoothing.
      // We still show the *final* emotion (sad words gray, brand lit, the
      // heavyweight mark already a sad face) so the story reads without motion.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('.lp-word:not(.lp-word--brand)', { color: '#f4f4f5' })
        gsap.set('.lp-hw', { color: '#f4f4f5' })
        gsap.set('.lp-sad', { color: '#6b7280' })
        gsap.set('.lp-brand', { color: '#d7fe51' })
        gsap.set('.lp-feature-text', { color: '#f4f4f5' })
        gsap.set('.lp-feature-idx', { color: '#d7fe51' })
        gsap.set('.lp-step, .lp-pay-bullet', { opacity: 1 })
        gsap.set('.lp-orb-ring-el', { opacity: 1 })
        gsap.set('.lp-handwrite-clip', { clipPath: 'none' })
        gsap.set('.lp-wd-orb', { fill: '#6b7280' })
        gsap.set('.lp-wd-mark, .lp-wd-sheen', { opacity: 0 })
        gsap.set('.lp-wd-eye, .lp-wd-mouth, .lp-wd-tear', { opacity: 1 })
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={rootRef} className="lp-root relative min-h-screen">
      {/* ===================== nav ===================== */}
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

      {/* ===================== hero ===================== */}
      <header className="lp-hero relative min-h-[100svh] flex items-center overflow-hidden">
        <GravityDots className="lp-gravity-dots" />
        {/* clock-motif rings, spun by scroll */}
        <div aria-hidden="true" className="absolute -right-[4vw] sm:-right-[12vw] top-1/2 -translate-y-1/2 w-[58vw] h-[58vw] sm:w-[46vw] sm:h-[46vw] max-w-[640px] max-h-[640px] opacity-40 sm:opacity-100">
          <div className="lp-ring lp-ring--a inset-0" />
          <div className="lp-ring lp-ring--inner lp-ring--b inset-[12%]" />
          <div className="lp-ring lp-ring--inner inset-[26%]" />
        </div>
        <div className="lp-hero-inner relative z-10 min-w-0 px-[clamp(20px,6vw,84px)] max-w-[1100px]">
          <HeroHeadline text={HERO_TEXT} className="lp-h1 max-w-[860px]" />
          <div className="flex flex-wrap items-center gap-3 mt-9">
            <a href="signup" className="lp-btn lp-hero-after">Create free account <span aria-hidden="true">→</span></a>
            <a href="login" className="lp-btn lp-btn--ghost lp-hero-after">Sign in <span aria-hidden="true">→</span></a>
          </div>
          <div className="lp-hero-after flex flex-wrap gap-x-5 gap-y-1 mt-8 sm:mt-20 pt-6 border-t border-white/10 max-w-[820px]">
            {CAPABILITIES.map(c => (
              <span key={c} className="text-[11px] tracking-[0.22em] uppercase" style={{ color: 'var(--lp-faint)' }}>{c}</span>
            ))}
          </div>
        </div>
      </header>

      {/* ===================== statement ===================== */}
      <section className="relative py-[12vh] sm:py-[22vh] px-[clamp(20px,6vw,84px)]">
        <div className="max-w-[1100px] mx-auto grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-center">
          <WordReveal as="h2" text={STATEMENT_TEXT} className="lp-h2 max-w-[640px]" />
          {/* A live replica of the in-app real-time earnings module (Rewards). */}
          <EarningsTickerDemo rate={36.5} start={247.38} className="w-full lg:w-[300px] shrink-0" />
        </div>
      </section>

      {/* ===================== features (light up on scroll) ===================== */}
      <section className="lp-features relative py-[14vh] sm:py-[18vh] px-[clamp(20px,6vw,84px)]">
        <div className="max-w-[1100px] mx-auto">
          <div className="lp-eyebrow mb-7" data-rise>Everything, one tap away</div>
          <ul className="lp-feature-list">
            {FEATURES.map((f, i) => (
              <li key={f} className="lp-feature">
                <span className="lp-feature-idx" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className="lp-feature-text">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ===================== the friction scale (pinned) ===================== */}
      <section className="lp-scale relative h-[100svh] overflow-hidden">
        <DepositCanvas progressRef={depositProgress} className="lp-deposit absolute inset-0 w-full h-full opacity-0" />
        <div aria-hidden="true" className="absolute right-[50%] translate-x-1/2 top-[6%] w-[56vw] max-w-[300px] aspect-square lg:translate-x-0 lg:right-[4vw] lg:top-1/2 lg:-translate-y-1/2 lg:w-[min(44vw,520px)] lg:max-w-none">
          <div className="lp-orb-ring-el absolute inset-0 opacity-0"><div className="lp-orb-ring" /></div>
          <div className="lp-orb-sun-el absolute inset-0 opacity-0">
            <div className="lp-orb-sun" />
          </div>
          <div className="lp-orb-money absolute inset-0 flex flex-col items-center justify-center opacity-0">
            <LiveMoney className="text-[clamp(1.4rem,3vw,2.6rem)] text-black/85" rate={36.5} start={147.062} />
            <span className="text-[10px] tracking-[0.3em] uppercase text-black/60 mt-1">earned · live</span>
          </div>
        </div>
        <div className="relative z-10 h-full flex flex-col justify-end pb-[8vh] lg:justify-center lg:pb-0 px-[clamp(20px,6vw,84px)] max-w-[760px]">
          <div className="lp-eyebrow mb-3 sm:mb-5">The Friction Scale</div>
          <h2 className="lp-h2 mb-6 sm:mb-10">We measure everything<br />in taps.</h2>
          <div>
            {STEPS.map(s => (
              <div key={s.name} className="lp-step">
                <div className="lp-step-tap">{s.tap}</div>
                <div>
                  <div className="lp-step-name">{s.name}</div>
                  <div className="lp-step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== live pay (pinned, letterbox exit) ===================== */}
      <section className="lp-pay relative h-[100svh]">
        <div className="lp-pay-frame absolute inset-0 overflow-hidden">
          <div className="lp-glow" />
          <div className="lp-pay-content relative z-10 h-full grid lg:grid-cols-2 items-start pt-[13vh] lg:items-center lg:pt-0 gap-8 lg:gap-10 px-[clamp(20px,6vw,84px)]">
            <div>
              <div className="lp-eyebrow mb-3 sm:mb-5">Instant gratification, in real time</div>
              <h2 className="lp-h2 mb-5 sm:mb-9">Harnessing the power<br />of every hour.</h2>
              <div className="max-w-[440px]">
                {PAY_BULLETS.map(b => (
                  <div key={b} className="lp-pay-bullet py-3 border-t border-white/10 text-[0.95rem]" style={{ color: 'var(--lp-dim)' }}>
                    {b}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative justify-self-center lg:justify-self-end text-center">
              <HandwrittenNote text="your money, live" className="relative lg:absolute lg:-top-16 lg:-left-20 whitespace-nowrap block mb-2 lg:mb-0" />
              <LiveMoney className="lp-pay-money block text-[clamp(2.1rem,7.5vw,6rem)]" rate={36.5} start={1284.063} />
              <div className="text-xs tracking-[0.28em] uppercase mt-3 flex items-center justify-center gap-2" style={{ color: 'var(--lp-dim)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--lp-accent)' }} />
                accruing while you read this
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== comparison ===================== */}
      <section className="lp-cmp relative py-[14vh] sm:py-[18vh] px-[clamp(20px,6vw,84px)]">
        <div className="max-w-[1060px] mx-auto">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="lp-eyebrow mb-5" data-rise>vs. the heavyweights</div>
              <h2 className="lp-h2 mb-10 sm:mb-14" data-rise>
                Heavyweights made HR heavy.<br className="hidden sm:block" />{' '}
                <span style={{ color: 'var(--lp-dim)' }}>We made it disappear.</span>
              </h2>
            </div>
            <WorkdayMorph className="lp-workday shrink-0" />
          </div>
          <div role="table" aria-label="SwiftShift compared to Workday and Rippling">
            <div role="row" className="lp-cmp-row lp-cmp-head text-[0.72rem] uppercase tracking-[0.18em]">
              <span role="columnheader" />
              <span role="columnheader" className="lp-cmp-swift" style={{ color: 'var(--lp-accent)' }}>SwiftShift</span>
              <span role="columnheader" className="lp-cmp-other">Workday</span>
              <span role="columnheader" className="lp-cmp-other">Rippling</span>
            </div>
            {CMP_ROWS.map(([label, swift, workday, rippling]) => (
              <div role="row" key={label} className="lp-cmp-row">
                <span role="rowheader">{label}</span>
                <span role="cell" className="lp-cmp-swift">
                  {swift.startsWith('✓') ? (<><span className="lp-check" aria-hidden="true">✓</span>{swift.slice(2)}</>) : swift}
                </span>
                <span role="cell" className="lp-cmp-other">{workday}</span>
                <span role="cell" className="lp-cmp-other">{rippling}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== stats ===================== */}
      <section className="lp-stats relative py-[16vh] px-[clamp(20px,6vw,84px)] overflow-hidden">
        <div aria-hidden="true" className="lp-stat-dial lp-ring absolute -left-[14vw] bottom-[-10vw] w-[40vw] h-[40vw] max-w-[520px] max-h-[520px]" />
        <div className="max-w-[1060px] mx-auto grid lg:grid-cols-[1fr_auto] gap-16 items-end">
          <div>
            <h2 className="lp-h2 mb-14" data-rise>Zero friction,<br /><span style={{ color: 'var(--lp-dim)' }}>by the numbers.</span></h2>
            <div className="space-y-12">
              {STATS.map(s => (
                <div key={s.label} className="lp-stat">
                  <CountUp value={s.n} className="lp-stat-num block" />
                  <div className="mt-2 text-sm" style={{ color: 'var(--lp-dim)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-bars hidden lg:flex items-end gap-10 pb-2" aria-label="Setup time comparison: SwiftShift about three minutes, enterprise HR suites measured in weeks">
            <div className="text-center">
              <div className="lp-bar lp-bar--swift h-[14px] mx-auto" style={{ background: 'var(--lp-accent)' }} />
              <div className="mt-3 text-xs" style={{ color: 'var(--lp-dim)' }}><span style={{ color: 'var(--lp-accent)' }}>SwiftShift</span><br />≈ 3 min setup</div>
            </div>
            <div className="text-center">
              <div className="lp-bar lp-bar--hris h-[380px] mx-auto" style={{ background: 'rgba(255,255,255,0.16)' }} />
              <div className="mt-3 text-xs" style={{ color: 'var(--lp-dim)' }}>Enterprise HRIS<br />weeks of rollout</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== finale: app slab zoom ===================== */}
      <section className="lp-fin relative h-[100svh] overflow-hidden flex flex-col">
        <div className="lp-fin-head pt-[12vh] px-[clamp(20px,6vw,84px)]">
          <h2 className="lp-h2" data-rise>Built to disappear<br /><span style={{ color: 'var(--lp-dim)' }}>into your workday.</span></h2>
        </div>
        <div className="lp-letterbox flex-1 flex items-center justify-center mt-8" style={{ perspective: '1200px' }}>
          <div className="lp-slab w-[min(620px,86vw)] p-4 sm:p-7" aria-hidden="true">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <LogoSVG className="h-5 w-auto" />
                <span className="text-[10px] tracking-[0.25em] uppercase" style={{ color: 'var(--lp-dim)' }}>Good afternoon, Alex</span>
              </div>
              <span className="text-[10px] tracking-[0.2em] uppercase flex items-center gap-1.5" style={{ color: 'var(--lp-dim)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--lp-accent)' }} />live
              </span>
            </div>
            <div className="rounded-xl py-7 text-center font-semibold text-lg tracking-wide mb-5" style={{ background: 'var(--lp-accent)', color: '#000' }}>
              CLOCK IN
            </div>
            <div className="text-center text-[11px] mb-6" style={{ color: 'var(--lp-dim)' }}>Tap once. That’s it.</div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
              {[['Today', '$0.00'], ['PTO', '41.205h'], ['Streak', '12 days']].map(([k, v]) => (
                <div key={k} className="border border-white/10 rounded-lg py-3">
                  <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--lp-dim)' }}>{k}</div>
                  <div className="text-sm font-medium mt-1">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CTA + footer ===================== */}
      <section className="relative py-[14vh] sm:py-[18vh] px-[clamp(20px,6vw,84px)] text-center">
        <div className="lp-dots" />
        <h2 className="lp-h2 mb-4" data-rise>Run your team at <span style={{ color: 'var(--lp-accent)' }}>SwiftShift</span> speed.</h2>
        <p className="text-sm mb-10" style={{ color: 'var(--lp-dim)' }} data-rise>
          Set up in minutes. Free to start. Nothing to install.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3" data-rise>
          <a href="signup" className="lp-btn">Create free account <span aria-hidden="true">→</span></a>
          <a href="login" className="lp-btn lp-btn--ghost">Sign in <span aria-hidden="true">→</span></a>
        </div>
        <footer className="mt-[14vh] pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-[11px]" style={{ color: 'var(--lp-faint)' }}>
          <span>© 2026 <span style={{ color: 'var(--lp-accent)' }}>SwiftShift</span>. All rights reserved.</span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--lp-accent)' }} />
            System status: online
          </span>
        </footer>
      </section>
    </div>
  )
}
