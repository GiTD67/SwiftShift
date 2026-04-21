import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  calculateDuration,
  formatTime,
  getWeekDates,
  getDayName,
  getDayNumber,
} from './format'

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
})

describe('getDayNumber', () => {
  it('returns day of month as string', () => {
    expect(getDayNumber('2024-01-15')).toBe('15')
  })
})
