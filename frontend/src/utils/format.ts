import { format, parse, differenceInMinutes, addDays } from 'date-fns'

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function calculateDuration(startTime: string, endTime: string): number {
  const start = parse(startTime, 'HH:mm', new Date())
  const end = parse(endTime, 'HH:mm', new Date())
  return differenceInMinutes(end, start)
}

export function formatTime(isoString: string | null): string {
  if (!isoString) return ''
  return format(new Date(isoString), 'h:mm a')
}

export function getWeekDates(): string[] {
  const today = new Date()
  const dates: string[] = []
  // Get Monday of current week
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = addDays(today, mondayOffset)
  
  for (let i = 0; i < 7; i++) {
    dates.push(format(addDays(monday, i), 'yyyy-MM-dd'))
  }
  return dates
}

export function getDayName(dateStr: string): string {
  return format(new Date(dateStr), 'EEE')
}

export function getDayNumber(dateStr: string): string {
  return format(new Date(dateStr), 'd')
}
