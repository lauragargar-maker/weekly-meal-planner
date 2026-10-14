import { describe, expect, it } from 'vitest'
import { STARTER_CATALOG } from '../data/starterCatalog'
import { STARTER_DISH_DETAILS } from '../data/starterDishDetails'
import { STARTER_INGREDIENTS } from '../data/starterIngredients'
import { DishIngredient } from '../types'
import { isValidRecipeUrl } from './recipeLinks'
import { toKey } from './nameKey'
import { planStarterSeed } from './seedIngredients'

describe('STARTER_DISH_DETAILS', () => {
  const ingredientKeys = new Set(STARTER_INGREDIENTS.map(({ name }) => toKey(name)))

  it('covers every dish in the starter catalogue, and nothing else', () => {
    expect(Object.keys(STARTER_DISH_DETAILS).sort()).toEqual(STARTER_CATALOG.map(({ name }) => name).sort())
  })

  it('only uses ingredients from STARTER_INGREDIENTS', () => {
    for (const [dish, { ingredients }] of Object.entries(STARTER_DISH_DETAILS)) {
      for (const name of ingredients) expect(ingredientKeys.has(toKey(name)), `${dish}: ${name}`).toBe(true)
    }
  })

  it('gives every dish at least one ingredient that gets bought, and no repeats', () => {
    const staples = new Set(STARTER_INGREDIENTS.filter((i) => i.is_staple).map(({ name }) => toKey(name)))
    for (const [dish, { ingredients }] of Object.entries(STARTER_DISH_DETAILS)) {
      expect(ingredients.some((name) => !staples.has(toKey(name))), dish).toBe(true)
      expect(new Set(ingredients.map(toKey)).size, dish).toBe(ingredients.length)
    }
  })

  it('only links recipes the database will accept', () => {
    for (const [dish, { recipe_url }] of Object.entries(STARTER_DISH_DETAILS)) {
      if (recipe_url) expect(isValidRecipeUrl(recipe_url), dish).toBe(true)
    }
  })
})

describe('planStarterSeed', () => {
  const dish = (id: string, name: string, recipe_url: string | null = null) => ({ id, name, recipe_url })
  const link = (dish_id: string): DishIngredient => ({ dish_id, ingredient_id: 'x', household_id: 'h', position: 0 })

  it('fills a starter dish that has no ingredients, with its recipe', () => {
    const plan = planStarterSeed([dish('d1', 'Gazpacho')], [], [])
    expect(plan.dishes).toEqual([
      {
        dishId: 'd1',
        ingredientKeys: STARTER_DISH_DETAILS.Gazpacho.ingredients.map(toKey),
        recipeUrl: STARTER_DISH_DETAILS.Gazpacho.recipe_url,
      },
    ])
  })

  it('matches the dish name ignoring case and accents', () => {
    expect(planStarterSeed([dish('d1', 'crema de calabacin')], [], []).dishes).toHaveLength(1)
  })

  it('leaves alone a dish that already has ingredients', () => {
    expect(planStarterSeed([dish('d1', 'Gazpacho')], [], [link('d1')]).dishes).toEqual([])
  })

  it('leaves alone a renamed dish and the household’s own dishes', () => {
    const plan = planStarterSeed([dish('d1', 'Gazpacho de la abuela'), dish('d2', 'Pisto de mamá')], [], [])
    expect(plan.dishes).toEqual([])
  })

  it('keeps a recipe the household already set', () => {
    const plan = planStarterSeed([dish('d1', 'Gazpacho', 'https://example.org/mi-gazpacho')], [], [])
    expect(plan.dishes[0].recipeUrl).toBeUndefined()
  })

  it('only adds the starter ingredients the catalogue is missing', () => {
    const plan = planStarterSeed([], [{ name_key: 'sal' }, { name_key: 'tomate' }], [])
    expect(plan.ingredients).toHaveLength(STARTER_INGREDIENTS.length - 2)
    expect(plan.ingredients.find((i) => i.name_key === 'sal')).toBeUndefined()
    expect(plan.ingredients.find((i) => i.name_key === 'cebolla')).toMatchObject({ section: 'produce', is_staple: true })
  })
})
