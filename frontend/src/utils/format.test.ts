import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  calculateDuration,
  formatTime,
  getWeekDates,
  getDayName,
  getDayNumber,
  parseServerDate,
  localDay,
} from './format'

describe('localDay', () => {
  it('returns the LOCAL calendar day as YYYY-MM-DD, zero-padded', () => {
    const d = new Date(2026, 0, 5, 14, 30) // Jan 5 2026, local
    expect(localDay(d)).toBe('2026-01-05')
  })

  it('buckets an evening server timestamp on the local day it was worked', () => {
    // A naive-UTC clock_in for 8pm in a UTC-negative zone lands on the next UTC
    // day; localDay(parseServerDate(...)) must report the local day, not the UTC one.
    const local = localDay(parseServerDate('2026-06-25T03:00:00')) // 03:00 UTC
    // Whatever the test machine's zone, localDay must agree with a plain local Date.
    expect(local).toBe(localDay(new Date(Date.parse('2026-06-25T03:00:00Z'))))
  })

  it('agrees with the local fields of a Date built from a known instant', () => {
    const inst = new Date(Date.parse('2026-12-31T23:00:00Z'))
    const expected = `${inst.getFullYear()}-${String(inst.getMonth() + 1).padStart(2, '0')}-${String(inst.getDate()).padStart(2, '0')}`
    expect(localDay(inst)).toBe(expected)
  })
})

describe('parseServerDate', () => {
  it('reads a naive backend timestamp (no zone) as UTC, not local time', () => {
    // Regression for the clock-in refresh bug: the API returns naive UTC like
    // this, and a bare new Date() would parse it as local time and shift the
    // value by the viewer's offset (zeroing the live timer for users behind UTC).
    const naive = '2026-06-24T15:30:00.123456'
    expect(parseServerDate(naive).getTime()).toBe(Date.parse(naive + 'Z'))
  })

  it('leaves a value that already has a Z designator untouched', () => {
    const z = '2026-06-24T15:30:00.000Z'
    expect(parseServerDate(z).getTime()).toBe(Date.parse(z))
  })

  it('normalizes a Postgres bare "+00" offset to UTC', () => {
    expect(parseServerDate('2026-06-24 15:30:00.123+00').getTime()).toBe(
      Date.parse('2026-06-24T15:30:00.123Z'),
    )
  })

  it('treats an explicit +00:00 offset as UTC', () => {
    expect(parseServerDate('2026-06-24T15:30:00+00:00').getTime()).toBe(
      Date.parse('2026-06-24T15:30:00Z'),
    )
  })

  it('honors a real non-UTC offset instead of forcing UTC', () => {
    expect(parseServerDate('2026-06-24T15:30:00-07:00').getTime()).toBe(
      Date.parse('2026-06-24T15:30:00-07:00'),
    )
  })

  it('leaves a date-only value as local midnight (does not append Z)', () => {
    expect(parseServerDate('2026-06-24').getTime()).toBe(new Date('2026-06-24').getTime())
  })

  it('returns an Invalid Date for empty or garbage input', () => {
    expect(isNaN(parseServerDate(null).getTime())).toBe(true)
    expect(isNaN(parseServerDate('').getTime())).toBe(true)
    expect(isNaN(parseServerDate('not-a-date').getTime())).toBe(true)
  })
})

describe('formatDuration', () => {
  it('formats minutes only', () => {
    expect(formatDuration(45)).toBe('45m')
  })

  it('formats hours only', () => {
    expect(formatDuration(120)).toBe('2h')
  })

  it('formats hours and minutes', () => {
    expect(formatDuration(95)).toBe('1h 35m')
  })

  it('handles zero minutes', () => {
    expect(formatDuration(0)).toBe('0m')
  })

  it('clamps negative durations to 0m', () => {
    expect(formatDuration(-30)).toBe('0m')
  })

  it('returns 0m for NaN and Infinity', () => {
    expect(formatDuration(NaN)).toBe('0m')
    expect(formatDuration(Infinity)).toBe('0m')
  })

  it('rounds fractional minutes', () => {
    expect(formatDuration(90.5)).toBe('1h 31m')
  })
})

describe('calculateDuration', () => {
  it('calculates duration between two times', () => {
    expect(calculateDuration('09:00', '10:30')).toBe(90)
  })

  it('handles same hour', () => {
    expect(calculateDuration('14:00', '14:45')).toBe(45)
  })

  it('handles full hours', () => {
    expect(calculateDuration('08:00', '17:00')).toBe(540)
  })

  it('handles overnight shifts crossing midnight', () => {
    expect(calculateDuration('22:00', '06:00')).toBe(480)
  })

  it('returns 0 for unparseable time strings', () => {
    expect(calculateDuration('', '17:00')).toBe(0)
    expect(calculateDuration('09:00', 'abc')).toBe(0)
  })
})

describe('formatTime', () => {
  it('formats ISO string to readable time', () => {
    const iso = '2024-01-15T09:30:00.000Z'
    const result = formatTime(iso)
    expect(result).toMatch(/\d+:\d+ (AM|PM)/)
  })

  it('returns empty string for null', () => {
    expect(formatTime(null)).toBe('')
  })

  it('returns empty string for an invalid date string', () => {
    expect(formatTime('not-a-date')).toBe('')
  })
})

describe('getWeekDates', () => {
  it('returns 7 dates', () => {
    const dates = getWeekDates()
    expect(dates).toHaveLength(7)
  })

  it('returns dates in YYYY-MM-DD format', () => {
    const dates = getWeekDates()
    dates.forEach(date => {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  it('first date is Monday', () => {
    const dates = getWeekDates()
    const firstDate = new Date(dates[0])
    expect(firstDate.getDay()).toBe(1) // Monday = 1
  })
})

describe('getDayName', () => {
  it('returns abbreviated day name', () => {
    expect(getDayName('2024-01-15')).toBe('Mon')
  })

  it('returns empty string for an invalid date string', () => {
    expect(getDayName('nope')).toBe('')
  })
})

describe('getDayNumber', () => {
  it('returns day of month as string', () => {
    expect(getDayNumber('2024-01-15')).toBe('15')
  })

  it('returns empty string for an invalid date string', () => {
    expect(getDayNumber('nope')).toBe('')
  })
})
