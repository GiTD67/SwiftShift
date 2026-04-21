export interface TimeEntry {
  id: string
  date: string // YYYY-MM-DD
  project: string
  task: string
  startTime: string // HH:MM
  endTime: string // HH:MM
  duration: number // minutes
  description: string
}

export interface ClockState {
  isClockedIn: boolean
  clockInTime: string | null // ISO timestamp
  lastActionTime: string | null // ISO timestamp
}

export interface TimesheetState {
  entries: TimeEntry[]
  clock: ClockState
  submitted: boolean
}
