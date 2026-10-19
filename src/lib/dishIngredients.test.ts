import { describe, expect, it } from 'vitest'
import { DishIngredient, ShoppingIngredient } from '../types'
import { dishesWithIngredients, ingredientsOfDish, searchIngredients } from './dishIngredients'
import { toKey } from './nameKey'

const ingredient = (id: string, name: string, fields: Partial<ShoppingIngredient> = {}): ShoppingIngredient => ({
  id,
  household_id: 'h1',
  name,
  name_key: toKey(name),
  section: 'other',
  is_staple: false,
  ...fields,
})

const link = (dish_id: string, ingredient_id: string, position: number): DishIngredient => ({
  dish_id,
  ingredient_id,
  household_id: 'h1',
  position,
})

const catalog = [
  ingredient('i1', 'Cebolla', { is_staple: true }),
  ingredient('i2', 'Lentejas'),
  ingredient('i3', 'Zanahoria'),
  ingredient('i4', 'Lechuga'),
  ingredient('i5', 'Calabacín'),
]

describe('ingredientsOfDish', () => {
  it('returns the dish’s ingredients in the order they were added', () => {
    const links = [link('d1', 'i3', 1), link('d1', 'i2', 0), link('d2', 'i4', 0)]
    expect(ingredientsOfDish('d1', links, catalog).map((i) => i.name)).toEqual(['Lentejas', 'Zanahoria'])
  })

  it('skips a link whose ingredient is not loaded', () => {
    expect(ingredientsOfDish('d1', [link('d1', 'gone', 0)], catalog)).toEqual([])
  })
})

describe('dishesWithIngredients', () => {
  it('counts a dish whose only ingredients are staples', () => {
    expect(dishesWithIngredients([link('d1', 'i1', 0)]).has('d1')).toBe(true)
  })
})

describe('searchIngredients', () => {
  it('matches anywhere in the name, ignoring accents', () => {
    expect(searchIngredients('calabacin', catalog, new Set()).map((i) => i.name)).toEqual(['Calabacín'])
  })

  it('puts names that start with the query first', () => {
    expect(searchIngredients('l', catalog, new Set()).map((i) => i.name)).toEqual([
      'Lechuga',
      'Lentejas',
      'Calabacín',
      'Cebolla',
    ])
  })

  it('leaves out what the dish already has', () => {
    expect(searchIngredients('le', catalog, new Set(['lentejas'])).map((i) => i.name)).toEqual(['Lechuga'])
  })

  it('returns nothing for an empty query', () => {
    expect(searchIngredients('  ', catalog, new Set())).toEqual([])
  })
})
