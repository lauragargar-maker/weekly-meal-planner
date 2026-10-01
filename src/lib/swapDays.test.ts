import { describe, expect, it } from 'vitest'
import { MenuItem } from '../types'
import { swapDays } from './swapDays'

const week: MenuItem[] = [
  { day: '2026-09-28', meal_type: 'lunch', single: 'Paella' },
  { day: '2026-09-28', meal_type: 'dinner', main: 'Tortilla' },
  { day: '2026-09-29', meal_type: 'lunch', starter: 'Gazpacho', main: 'Merluza' },
  { day: '2026-09-29', meal_type: 'dinner', main: 'Crema de calabacín' },
  { day: '2026-09-30', meal_type: 'lunch', single: 'Lentejas' },
  { day: '2026-09-30', meal_type: 'dinner', main: 'Revuelto' },
]

/** The meals of a day without their date, to compare across days. */
const mealsOf = (items: MenuItem[], day: string) =>
  items.filter(item => item.day === day).map(item => ({ ...item, day: undefined }))

describe('swapDays', () => {
  it('moves both meals of each day to the other day', () => {
    const swapped = swapDays(week, '2026-09-28', '2026-09-30')
    expect(mealsOf(swapped, '2026-09-28')).toEqual(mealsOf(week, '2026-09-30'))
    expect(mealsOf(swapped, '2026-09-30')).toEqual(mealsOf(week, '2026-09-28'))
  })

  it('leaves every other day untouched', () => {
    const swapped = swapDays(week, '2026-09-28', '2026-09-30')
    expect(mealsOf(swapped, '2026-09-29')).toEqual(mealsOf(week, '2026-09-29'))
  })

  it('keeps the course structure of each meal as it was', () => {
    const swapped = swapDays(week, '2026-09-28', '2026-09-29')
    expect(swapped.find(i => i.day === '2026-09-28' && i.meal_type === 'lunch')).toEqual({
      day: '2026-09-28',
      meal_type: 'lunch',
      starter: 'Gazpacho',
      main: 'Merluza',
    })
  })

  it('keeps the week in calendar order, lunch before dinner', () => {
    const swapped = swapDays(week, '2026-09-28', '2026-09-30')
    expect(swapped.map(i => `${i.day} ${i.meal_type}`)).toEqual(
      week.map(i => `${i.day} ${i.meal_type}`)
    )
  })

  it('is undone by swapping the same two days again', () => {
    const swapped = swapDays(week, '2026-09-28', '2026-09-30')
    expect(swapDays(swapped, '2026-09-30', '2026-09-28')).toEqual(week)
  })

  it('carries a missing meal across with its day', () => {
    const gappy = week.filter(i => !(i.day === '2026-09-29' && i.meal_type === 'dinner'))
    const swapped = swapDays(gappy, '2026-09-29', '2026-09-30')
    expect(mealsOf(swapped, '2026-09-30')).toEqual([
      { meal_type: 'lunch', starter: 'Gazpacho', main: 'Merluza' },
    ])
    expect(mealsOf(swapped, '2026-09-29')).toHaveLength(2)
  })

  it('does nothing when both days are the same', () => {
    expect(swapDays(week, '2026-09-29', '2026-09-29')).toBe(week)
  })

  it('does not mutate the stored week', () => {
    const copy = structuredClone(week)
    swapDays(week, '2026-09-28', '2026-09-30')
    expect(week).toEqual(copy)
  })
})
