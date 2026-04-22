export interface User {
  id: number
  first_name: string
  last_name: string
  email: string
  job_role: string | null
  manager_name: string | null
  is_fulltime: number
  pay: number | null
  salary: number | null
}

export interface Employee {
  id: number
  name: string
  email: string | null
}

export interface ClockSession {
  id: number
  employee_id: number
  clock_in: string
  clock_out: string | null
  duration_minutes: number | null
  notes: string | null
}

export interface Job {
  job_id: number
  description: string | null
  hiring_manager_id: number | null
  date_posted: string | null
  date_expiry: string | null
  salary: string | null
  location: string | null
}

export interface TaxFormData {
  response: string
  source_files: string[]
  ordinary_tax?: number
  cg_tax?: number
  total_tax?: number
  refund?: number
}

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
