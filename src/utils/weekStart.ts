/**
 * Which weeks the app can show, and how their start dates are calculated.
 *
 * A wrong date here fails silently — it just queries a row that isn't there —
 * so this is the one piece of the week navigation that is unit-tested.
 */

/**
 * How far the week navigation reaches, in weeks from the current one.
 *
 * One week back and one forward is what the beta needs; going further is a
 * product decision, not a refactor. Everything else keys off `week_start`
 * strings or compares against today, so widening this is meant to be an edit
 * of these two numbers plus a call on whether arriving at a future week still
 * generates it (see `handleWeekNav`).
 */
export const WEEK_RANGE = { min: -1, max: 1 }

/** Return the Saturday that starts the week period (Sat–Fri) containing `from`. */
export const getCurrentWeekStart = (from: Date = new Date()): Date => {
  const dayOfWeek = from.getDay() // 0=Sun … 6=Sat
  const daysBack = (dayOfWeek + 1) % 7 // Sat=0, Sun=1, Mon=2, … Fri=6
  const start = new Date(from)
  start.setDate(from.getDate() - daysBack)
  start.setHours(0, 0, 0, 0)
  return start
}

/** The week start `offset` weeks from the current one. Negative offsets are the past. */
export const weekStartFor = (offset: number, from: Date = new Date()): Date => {
  const start = getCurrentWeekStart(from)
  start.setDate(start.getDate() + offset * 7)
  return start
}

/** The last day of the week that starts on `weekStart`. */
export const weekEndFor = (weekStart: Date): Date => {
  const end = new Date(weekStart)
  end.setDate(weekStart.getDate() + 6)
  return end
}

/**
 * `YYYY-MM-DD` in local time. Not `toISOString()`, which shifts to UTC and can
 * land on the previous day for anyone east of Greenwich.
 */
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** The `week_start` key of the week `offset` weeks away, as stored in the database. */
export const weekKeyFor = (offset: number, from: Date = new Date()): string =>
  formatLocalDate(weekStartFor(offset, from))

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "18 – 24 de julio", or "30 de julio – 5 de agosto" when the week spans two months. */
export const formatWeekRange = (startISO: string, endISO: string): string => {
  const start = new Date(startISO)
  const end = new Date(endISO)
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} de ${MONTHS[end.getMonth()]}`
    : `${start.getDate()} de ${MONTHS[start.getMonth()]} – ${end.getDate()} de ${MONTHS[end.getMonth()]}`
}
