import { MenuItem } from '../types'

/**
 * Swaps two whole days of a week: lunch and dinner travel together.
 *
 * Only the whole day moves, never one meal on its own, and that is what makes
 * this safe without a single warning: every day-level house rule (no repeating
 * a carb or a protein, vegetables at dinner, dinner exclusions) compares the
 * two meals of the same day, and both keep their partner. The weekly counts do
 * not change either, because the same dishes are still in the week.
 *
 * A day missing a meal (the degraded menu can leave one out) swaps what it has,
 * and the gap moves with it.
 *
 * The result stays in calendar order, lunch before dinner within a day, because
 * that is how the generator writes the week and the WhatsApp message reads it
 * in stored order. The sort is stable, so the meals of a day keep their order.
 *
 * Swapping the same two days again is the undo.
 */
export const swapDays = (items: MenuItem[], dayA: string, dayB: string): MenuItem[] => {
  if (dayA === dayB) return items
  return items
    .map(item => {
      if (item.day === dayA) return { ...item, day: dayB }
      if (item.day === dayB) return { ...item, day: dayA }
      return item
    })
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}
