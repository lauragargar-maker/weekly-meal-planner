/**
 * Pins "today" to Monday 9 November 2026 at 10:00 while letting time run, so
 * the day picker, the list's ranges and "hoy" always show the same week.
 * Imported before anything else in main.tsx.
 */
const RealDate = Date
const offset = new RealDate(2026, 10, 9, 10, 0, 0).getTime() - RealDate.now()

class PinnedDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(RealDate.now() + offset)
    else super(...(args as [number]))
  }
  static now() {
    return RealDate.now() + offset
  }
}

globalThis.Date = PinnedDate as DateConstructor
