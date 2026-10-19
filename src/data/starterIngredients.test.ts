import { describe, expect, it } from 'vitest'
import { STARTER_INGREDIENTS, guessIngredient } from './starterIngredients'
import { toKey } from '../lib/nameKey'

describe('STARTER_INGREDIENTS', () => {
  it('has no two entries with the same key', () => {
    const keys = STARTER_INGREDIENTS.map(({ name }) => toKey(name))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('fits the database limit on names', () => {
    for (const { name } of STARTER_INGREDIENTS) expect(name.length).toBeLessThanOrEqual(40)
  })

  it('marks garlic and onion as staples, and keeps eggs, milk and bread bought', () => {
    const staple = (name: string) => STARTER_INGREDIENTS.find((i) => i.name === name)?.is_staple ?? false
    expect(staple('Ajo')).toBe(true)
    expect(staple('Cebolla')).toBe(true)
    expect(staple('Sal')).toBe(true)
    expect(staple('Huevos')).toBe(false)
    expect(staple('Leche')).toBe(false)
    expect(staple('Pan')).toBe(false)
  })
})

describe('guessIngredient', () => {
  it('takes the section and staple flag of a known ingredient, whatever the case or accents', () => {
    expect(guessIngredient('merluza')).toEqual({ section: 'fish', is_staple: false })
    expect(guessIngredient('CEBOLLA')).toEqual({ section: 'produce', is_staple: true })
    expect(guessIngredient('calabacin')).toEqual({ section: 'produce', is_staple: false })
  })

  it('files an unknown ingredient under Otros, bought', () => {
    expect(guessIngredient('Papel de cocina')).toEqual({ section: 'other', is_staple: false })
  })
})
