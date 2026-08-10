import { describe, expect, it } from 'vitest'
import { formatLocalDate, getCurrentWeekStart, weekEndFor, weekKeyFor, weekStartFor } from './weekStart'

/**
 * The week start is the key every menu row is stored under, so getting it wrong
 * doesn't throw — it quietly reads the wrong week, or none at all. These pin it
 * down.
 *
 * Dates are built with `new Date(y, m, d)` (local midnight) on purpose: the
 * string form `new Date('2026-08-03')` parses as UTC and shifts the day.
 */

// 2026-08-03 is a Monday.
const MONDAY = new Date(2026, 7, 3, 9, 30)

describe('getCurrentWeekStart', () => {
  it('returns the same day when today is already the Monday', () => {
    expect(formatLocalDate(getCurrentWeekStart(MONDAY))).toBe('2026-08-03')
  })

  it('stays on the Monday that opened the week for every day of that week', () => {
    // Mon 3 Aug through Sun 9 Aug all belong to the week starting 3 Aug.
    for (let day = 3; day <= 9; day++) {
      const someDay = new Date(2026, 7, day, 18, 0)
      expect(formatLocalDate(getCurrentWeekStart(someDay))).toBe('2026-08-03')
    }
  })

  it('keeps Sunday in the week that is ending, not the one about to start', () => {
    // The trap of the (day + 6) % 7 shift: Sunday is 0, and the week it closes
    // began six days earlier.
    expect(formatLocalDate(getCurrentWeekStart(new Date(2026, 7, 9)))).toBe('2026-08-03')
  })

  it('rolls over to the next Monday', () => {
    expect(formatLocalDate(getCurrentWeekStart(new Date(2026, 7, 10)))).toBe('2026-08-10')
  })

  it('normalises the time to local midnight', () => {
    const start = getCurrentWeekStart(MONDAY)
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0])
  })

  it('does not mutate the date it was given', () => {
    const from = new Date(2026, 7, 5, 12, 0)
    getCurrentWeekStart(from)
    expect(formatLocalDate(from)).toBe('2026-08-05')
  })
})

describe('weekStartFor', () => {
  it('walks backwards and forwards a week at a time', () => {
    expect(formatLocalDate(weekStartFor(-1, MONDAY))).toBe('2026-07-27')
    expect(formatLocalDate(weekStartFor(0, MONDAY))).toBe('2026-08-03')
    expect(formatLocalDate(weekStartFor(1, MONDAY))).toBe('2026-08-10')
  })

  it('crosses a month boundary', () => {
    // Sunday 2 August closes a week that opened in July.
    expect(weekKeyFor(0, new Date(2026, 7, 2))).toBe('2026-07-27')
  })

  it('crosses a year boundary', () => {
    // Saturday 2027-01-02 belongs to a week that opened in December 2026.
    expect(weekKeyFor(0, new Date(2027, 0, 2))).toBe('2026-12-28')
  })

  it('survives the spring DST change without drifting a day', () => {
    // Spain moves the clock forward on Sunday 2026-03-29, the last day of the
    // week that opened on Monday the 23rd. Stepping in days rather than
    // milliseconds is what keeps this from landing on the 22nd.
    expect(weekKeyFor(0, new Date(2026, 2, 27))).toBe('2026-03-23')
    expect(weekKeyFor(-1, new Date(2026, 2, 31))).toBe('2026-03-23')
  })

  it('reaches further than the navigation range allows, if asked', () => {
    // The range is a product limit, not a limit of the arithmetic.
    expect(weekKeyFor(-4, MONDAY)).toBe('2026-07-06')
    expect(weekKeyFor(4, MONDAY)).toBe('2026-08-31')
  })
})

describe('weekEndFor', () => {
  it('is the Sunday six days after the start', () => {
    const end = weekEndFor(weekStartFor(0, MONDAY))
    expect(formatLocalDate(end)).toBe('2026-08-09')
    expect(end.getDay()).toBe(0) // Sunday
  })
})

describe('formatLocalDate', () => {
  it('pads month and day', () => {
    expect(formatLocalDate(new Date(2026, 0, 4))).toBe('2026-01-04')
  })

  it('keeps the local day for a late-evening date', () => {
    // toISOString() would report the 4th for anyone east of Greenwich.
    expect(formatLocalDate(new Date(2026, 7, 3, 23, 45))).toBe('2026-08-03')
  })
})
