import { describe, it, expect } from 'vitest'
import { getSampleEntries } from './sampleData'
import { TimeEntry } from '../types'

describe('getSampleEntries', () => {
  it('returns an array of time entries', () => {
    const entries = getSampleEntries()
    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
  })

  it('each entry has required fields', () => {
    const entries = getSampleEntries()
    entries.forEach((entry: TimeEntry) => {
      expect(entry).toHaveProperty('id')
      expect(entry).toHaveProperty('date')
      expect(entry).toHaveProperty('project')
      expect(entry).toHaveProperty('task')
      expect(entry).toHaveProperty('startTime')
      expect(entry).toHaveProperty('endTime')
      expect(entry).toHaveProperty('duration')
      expect(entry).toHaveProperty('description')
    })
  })

  it('dates are in YYYY-MM-DD format', () => {
    const entries = getSampleEntries()
    entries.forEach((entry: TimeEntry) => {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  it('times are in HH:MM format', () => {
    const entries = getSampleEntries()
    entries.forEach((entry: TimeEntry) => {
      expect(entry.startTime).toMatch(/^\d{2}:\d{2}$/)
      expect(entry.endTime).toMatch(/^\d{2}:\d{2}$/)
    })
  })

  it('durations are positive numbers', () => {
    const entries = getSampleEntries()
    entries.forEach((entry: TimeEntry) => {
      expect(entry.duration).toBeGreaterThan(0)
      expect(typeof entry.duration).toBe('number')
    })
  })

  it('generates entries for multiple days', () => {
    const entries = getSampleEntries()
    const uniqueDates = new Set(entries.map(e => e.date))
    expect(uniqueDates.size).toBeGreaterThan(1)
  })
})
