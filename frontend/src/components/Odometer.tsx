import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

interface OdometerProps {
  value: number
  format?: 'currency' | 'decimal' | 'integer'
  className?: string
  speed?: number // 1 = normal, 1.5 = overtime faster
  color?: string
}

export function Odometer({ 
  value, 
  format = 'currency', 
  className = '', 
  speed = 1,
  color = 'white'
}: OdometerProps) {
  const prevValueRef = useRef(value)
  const isOvertime = speed > 1

  // Format the value into a string with fixed decimal places
  const formatValue = (val: number): string => {
    if (format === 'currency') {
      return val.toFixed(2) // Always 2 decimals for money
    } else if (format === 'decimal') {
      return val.toFixed(3) // 3 decimals for PTO (hours)
    }
    return Math.floor(val).toString()
  }

  const displayString = formatValue(value)
  const digits = displayString.split('')
  const prevDigits = formatValue(prevValueRef.current).split('')

  // Keep prev value for comparison
  useEffect(() => {
    prevValueRef.current = value
  }, [value])

  return (
    <div 
      className={`inline-flex items-baseline font-mono tabular-nums font-semibold tracking-[-2px] ${className}`}
      style={{ color }}
    >
      {format === 'currency' && <span className="text-[0.6em] align-super opacity-70 mr-0.5">$</span>}
      
      {digits.map((digit, index) => {
        const isDecimal = digit === '.'
        const prevDigit = prevDigits[index] || '0'
        const isChanged = digit !== prevDigit && !isDecimal

        if (isDecimal) {
          return (
            <span key={index} className="mx-0.5 opacity-60">.</span>
          )
        }

        return (
          <DigitReel 
            key={index} 
            digit={digit} 
            prevDigit={prevDigit}
            speed={speed}
            isChanged={isChanged}
            isOvertime={isOvertime}
          />
        )
      })}
    </div>
  )
}

interface DigitReelProps {
  digit: string
  prevDigit: string
  speed: number
  isChanged: boolean
  isOvertime: boolean
}

function DigitReel({ digit, speed, isChanged, isOvertime }: DigitReelProps) {
  const reelRef = useRef<HTMLDivElement>(null)
  
  // The digit positions (0-9)
  const digitList = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  const currentIndex = digitList.indexOf(digit)
  
  // Calculate offset: each digit is 1em tall, so we offset by -currentIndex * 1em
  const offset = -currentIndex * 1.05 // slightly more than 1em for visual spacing

  // Motion value for smooth animation
  const y = useMotionValue(offset)
  
  // Spring for smooth slot-machine feel
  const springY = useSpring(y, {
    stiffness: 180 * speed,
    damping: isOvertime ? 12 : 18, // snappier when overtime
    mass: 0.8,
  })

  // Subtle blur during fast transitions
  const blur = useTransform(springY, (latest) => {
    const velocity = Math.abs((latest - offset) * 2)
    return velocity > 0.5 ? Math.min(velocity * 0.3, 1.2) : 0
  })

  // Animate when digit changes
  useEffect(() => {
    if (isChanged) {
      // Slot-machine spin: flick past then settle with spring
      const spinOffset = offset - 1.5 // spin past target
      y.set(spinOffset)
      
      // Settle to final (spring will animate smoothly)
      setTimeout(() => {
        y.set(offset)
      }, 70)
    } else {
      y.set(offset)
    }
  }, [digit, offset, y, isChanged])

  return (
    <div 
      ref={reelRef}
      className="relative inline-block w-[0.72em] h-[1.1em] overflow-hidden align-baseline rounded-[3px]"
      style={{ fontFeatureSettings: '"tnum"', background: 'rgba(10,12,18,0.9)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08)' }}
    >
      {/* Main roller with spring motion */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center"
        style={{ 
          y: springY,
          filter: blur
        }}
      >
        {digitList.map((d, i) => (
          <div 
            key={i} 
            className={`h-[1.1em] flex items-center justify-center text-[1em] leading-none ${i === currentIndex ? 'odometer-active' : 'odometer-flank'}`}
          >
            {d}
          </div>
        ))}
      </motion.div>

      {/* Slot machine glass shine (top highlight) */}
      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
      {/* Bottom vignette */}
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      {/* Center gloss line */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-white/30 pointer-events-none" />
      {/* Crystal bezel frame */}
      <div className="absolute inset-0 border border-white/15 rounded-[3px] pointer-events-none" />
    </div>
  )
}
