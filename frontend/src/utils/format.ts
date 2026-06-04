import { format, parse, differenceInMinutes, addDays } from 'date-fns'

export function formatDuration(minutes: number): string {
  // Guard against NaN/Infinity/negative durations from corrupt data, which
  // would otherwise render as "NaNm" / "Infinityh" / "-1h -30m".
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m'
  minutes = Math.round(minutes)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function calculateDuration(startTime: string, endTime: string): number {
  const start = parse(startTime, 'HH:mm', new Date())
  const end = parse(endTime, 'HH:mm', new Date())
  // Unparseable input (empty/garbage strings) yields Invalid Date → NaN diff.
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0
  const mins = differenceInMinutes(end, start)
  // End before start means the shift crossed midnight; roll into the next day.
  return mins < 0 ? mins + 1440 : mins
}

export function formatTime(isoString: string | null): string {
  if (!isoString) return ''
  const d = new Date(isoString)
  // date-fns format() throws RangeError on an invalid Date; guard the render.
  if (isNaN(d.getTime())) return ''
  return format(d, 'h:mm a')
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
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return format(d, 'EEE')
}

export function getDayNumber(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return format(d, 'd')
}
