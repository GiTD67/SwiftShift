import { format, parse, differenceInMinutes, addDays } from 'date-fns'

// Parse a timestamp string that came from the backend.
//
// The Flask API serializes datetimes as NAIVE UTC with no timezone designator
// (e.g. "2026-06-24T15:30:00.123456"), and Postgres NOW()::text yields a bare
// "+00" offset. JavaScript's `new Date()` interprets a date-time string WITHOUT
// a zone as LOCAL time, which shifts every server timestamp by the viewer's UTC
// offset. For users behind UTC that pushes an open clock session into the future
// and makes `now - clockInAt` clamp to 0, silently wiping all worked time on a
// refresh. Always read server timestamps as UTC.
//
// Returns a Date (Invalid Date for empty/garbage input, like `new Date`) so it
// is a drop-in replacement for `new Date(serverString)`. Date-only values
// ("YYYY-MM-DD") are left untouched (parsed as UTC midnight, exactly as a bare
// `new Date` would do); values that already carry a zone are passed through as-is.
export function parseServerDate(value: string | null | undefined): Date {
  if (!value) return new Date(NaN)
  let s = String(value).trim().replace(' ', 'T')
  // Postgres' bare "+00" / "+00:00" offset -> canonical 'Z'.
  s = s.replace(/\+00(?::?00)?$/, 'Z')
  const hasTimePart = s.includes('T')
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)
  if (hasTimePart && !hasZone) s = s + 'Z'
  return new Date(s)
}

// Returns a YYYY-MM-DD string in the browser's LOCAL timezone (not UTC).
// `date.toISOString().slice(0,10)` gives the UTC calendar day, which for users
// behind UTC rolls to the next day in the afternoon — so a shift worked at 8pm
// local can be bucketed/labelled on the following day. Use this for any
// user-facing calendar-day label, bucket key, "today" check, or localStorage
// day tag. To get the local day a server timestamp falls on, combine with
// parseServerDate: localDay(parseServerDate(row.clock_in)).
export function localDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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
  const d = parseServerDate(isoString)
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
