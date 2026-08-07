import { describe, expect, it } from 'vitest'
import { formatLocalDate, getCurrentWeekStart, weekEndFor, weekKeyFor, weekStartFor } from './weekStart'

/**
 * The week start is the key every menu row is stored under, so getting it wrong
 * doesn't throw — it quietly reads the wrong week, or none at all. These pin it
 * down. When M10 moves the week to Monday, the expectations below are what
 * should change, deliberately and all at once.
 *
 * Dates are built with `new Date(y, m, d)` (local midnight) on purpose: the
 * string form `new Date('2026-08-01')` parses as UTC and shifts the day.
 */

// 2026-08-01 is a Saturday.
const SATURDAY = new Date(2026, 7, 1, 9, 30)

describe('getCurrentWeekStart', () => {
  it('returns the same day when today is already the Saturday', () => {
    expect(formatLocalDate(getCurrentWeekStart(SATURDAY))).toBe('2026-08-01')
  })

  it('stays on the Saturday that opened the week for every day of that week', () => {
    // Sat 1 Aug through Fri 7 Aug all belong to the week starting 1 Aug.
    for (let day = 1; day <= 7; day++) {
      const someDay = new Date(2026, 7, day, 18, 0)
      expect(formatLocalDate(getCurrentWeekStart(someDay))).toBe('2026-08-01')
    }
  })

  it('rolls over to the next Saturday', () => {
    expect(formatLocalDate(getCurrentWeekStart(new Date(2026, 7, 8)))).toBe('2026-08-08')
  })

  it('normalises the time to local midnight', () => {
    const start = getCurrentWeekStart(SATURDAY)
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
    expect(formatLocalDate(weekStartFor(-1, SATURDAY))).toBe('2026-07-25')
    expect(formatLocalDate(weekStartFor(0, SATURDAY))).toBe('2026-08-01')
    expect(formatLocalDate(weekStartFor(1, SATURDAY))).toBe('2026-08-08')
  })

  it('crosses a month boundary', () => {
    // The week containing 2026-08-01 is preceded by one starting in July.
    expect(weekKeyFor(-1, new Date(2026, 7, 3))).toBe('2026-07-25')
  })

  it('crosses a year boundary', () => {
    // 2027-01-02 is a Saturday; the week before it starts in December.
    expect(weekKeyFor(-1, new Date(2027, 0, 2))).toBe('2026-12-26')
  })

  it('survives the spring DST change without drifting a day', () => {
    // Spain moves the clock forward on Sunday 2026-03-29, mid-week under a
    // Saturday start. Adding days (not milliseconds) is what keeps this right.
    expect(weekKeyFor(0, new Date(2026, 2, 31))).toBe('2026-03-28')
    expect(weekKeyFor(-1, new Date(2026, 2, 31))).toBe('2026-03-21')
  })

  it('reaches further than the navigation range allows, if asked', () => {
    // The range is a product limit, not a limit of the arithmetic.
    expect(weekKeyFor(-4, SATURDAY)).toBe('2026-07-04')
    expect(weekKeyFor(4, SATURDAY)).toBe('2026-08-29')
  })
})

describe('weekEndFor', () => {
  it('is six days after the start', () => {
    expect(formatLocalDate(weekEndFor(weekStartFor(0, SATURDAY)))).toBe('2026-08-07')
  })
})

describe('formatLocalDate', () => {
  it('pads month and day', () => {
    expect(formatLocalDate(new Date(2026, 0, 4))).toBe('2026-01-04')
  })

  it('keeps the local day for a late-evening date', () => {
    // toISOString() would report the 2nd for anyone east of Greenwich.
    expect(formatLocalDate(new Date(2026, 7, 1, 23, 45))).toBe('2026-08-01')
  })
})
