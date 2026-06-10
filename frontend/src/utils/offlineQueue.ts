// Offline punch queue — clock in/out punches made while offline are stored in
// localStorage and replayed in order (with their original timestamps as
// client_ts) once connectivity returns.

const QUEUE_KEY = 'swiftshift-offline-punches'
// Fired whenever the queue changes so any mounted clock UI can refresh its
// "Saved offline" state.
export const PUNCH_QUEUE_EVENT = 'swiftshift-punch-queue'

export interface QueuedPunch {
  action: 'clock_in' | 'clock_out'
  timestamp: string // ISO time of the original punch, sent to the API as client_ts
  sessionId?: number | null // known session id for a clock_out (null if the clock_in is itself queued)
  breakMinutes?: number // unpaid break minutes for a clock_out
}

export function getQueuedPunches(): QueuedPunch[] {
  const raw = localStorage.getItem(QUEUE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // Corrupted queue — discard it rather than crashing.
    localStorage.removeItem(QUEUE_KEY)
    return []
  }
}

export function hasQueuedPunches(): boolean {
  return getQueuedPunches().length > 0
}

function saveQueue(queue: QueuedPunch[]) {
  if (queue.length) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } else {
    localStorage.removeItem(QUEUE_KEY)
  }
  window.dispatchEvent(new Event(PUNCH_QUEUE_EVENT))
}

export function queuePunch(punch: QueuedPunch) {
  saveQueue([...getQueuedPunches(), punch])
}

// Prevents two flushes (e.g. app load + 'online' event) replaying the same punch.
let flushing = false

/**
 * Replay queued punches in order. Stops at the first network/server failure so
 * the remaining punches stay queued for the next attempt; punches the server
 * rejects outright (4xx) are dropped. Returns how many punches synced and the
 * session id left active by the replay (null if the last punch clocked out).
 */
export async function flushQueuedPunches(apiBase: string): Promise<{ synced: number; activeSessionId: number | null }> {
  if (flushing) return { synced: 0, activeSessionId: null }
  flushing = true
  let synced = 0
  let activeSessionId: number | null = null
  try {
    let queue = getQueuedPunches()
    while (queue.length > 0) {
      const punch = queue[0]
      if (punch.action === 'clock_in') {
        const res = await fetch(`${apiBase}/api/clock-sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_ts: punch.timestamp }),
        })
        if (res.status >= 500) break // server hiccup — retry later
        if (res.ok) {
          const row = await res.json()
          if (row?.id) activeSessionId = row.id
          synced++
        }
        // other 4xx: punch was rejected — drop it
      } else {
        // Resolve the session to close: the id captured at punch time, the one
        // a just-replayed clock_in created, or whatever session is still open.
        let sid = punch.sessionId ?? activeSessionId
        if (!sid) {
          const res = await fetch(`${apiBase}/api/clock-sessions?active=1`)
          if (!res.ok) break
          const rows = await res.json()
          sid = Array.isArray(rows) && rows.length ? rows[0].id : null
        }
        if (sid) {
          const res = await fetch(`${apiBase}/api/clock-sessions/${sid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ break_minutes: punch.breakMinutes || 0, client_ts: punch.timestamp }),
          })
          if (res.status >= 500) break
          if (res.ok) {
            synced++
            activeSessionId = null
          }
        }
        // No open session to close — drop the punch
      }
      queue = queue.slice(1)
      saveQueue(queue)
    }
  } catch {
    // Network error — still offline; whatever wasn't synced stays queued.
  } finally {
    flushing = false
  }
  return { synced, activeSessionId }
}
