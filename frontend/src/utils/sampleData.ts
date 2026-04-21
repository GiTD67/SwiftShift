import { TimeEntry } from '../types'
import { subDays, format } from 'date-fns'

export function getSampleEntries(): TimeEntry[] {
  const today = new Date()
  const entries: TimeEntry[] = []

  // Generate entries for the past 5 days
  for (let i = 4; i >= 0; i--) {
    const date = format(subDays(today, i), 'yyyy-MM-dd')
    
    if (i === 0) {
      // Today: 2 entries
      entries.push({
        id: `entry-${Date.now() - 100000}`,
        date,
        project: 'Engineering',
        task: 'Development',
        startTime: '09:00',
        endTime: '12:30',
        duration: 210,
        description: 'Implemented clock widget with live timer',
      })
      entries.push({
        id: `entry-${Date.now() - 50000}`,
        date,
        project: 'Engineering',
        task: 'Review',
        startTime: '14:00',
        endTime: '16:45',
        duration: 165,
        description: 'Code review for PR #42',
      })
    } else if (i === 1) {
      entries.push({
        id: `entry-${Date.now() - 200000}`,
        date,
        project: 'Design',
        task: 'Review',
        startTime: '10:15',
        endTime: '11:30',
        duration: 75,
        description: 'Figma review session',
      })
      entries.push({
        id: `entry-${Date.now() - 150000}`,
        date,
        project: 'Engineering',
        task: 'Development',
        startTime: '13:00',
        endTime: '17:30',
        duration: 270,
        description: 'Built weekly grid component',
      })
    } else {
      entries.push({
        id: `entry-${Date.now() - i * 300000}`,
        date,
        project: i % 2 === 0 ? 'Engineering' : 'Sales',
        task: i % 3 === 0 ? 'Meeting' : 'Development',
        startTime: '09:30',
        endTime: '17:00',
        duration: 450,
        description: 'Regular work day',
      })
    }
  }

  return entries
}
