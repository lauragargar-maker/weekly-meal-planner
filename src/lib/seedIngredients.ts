import type { SupabaseClient } from '@supabase/supabase-js'
import { DishIdea, DishIngredient, ShoppingIngredient, StoreSection } from '../types'
import { STARTER_INGREDIENTS } from '../data/starterIngredients'
import { STARTER_DISH_DETAILS } from '../data/starterDishDetails'
import { dishesWithIngredients } from './dishIngredients'
import { toKey } from './nameKey'

/**
 * Gives a household's starter dishes their ingredients and recipe.
 * docs/shopping-list-spec.md §6.2.
 *
 * Runs from the frontend rather than as SQL so the data lives in one place
 * (src/data/) instead of being copied into two databases that already
 * disagree on their dish names. It is idempotent: only dishes that still have
 * no ingredients are touched, so a run cut short is finished by the next one.
 */

const DETAILS_BY_KEY = new Map(Object.entries(STARTER_DISH_DETAILS).map(([name, details]) => [toKey(name), details]))

export interface StarterSeedPlan {
  /** Starter ingredients the household's catalogue does not have yet. */
  ingredients: { name: string; name_key: string; section: StoreSection; is_staple: boolean }[]
  /** Dishes to fill, with their ingredients by key in display order. */
  dishes: { dishId: string; ingredientKeys: string[]; recipeUrl?: string }[]
}

/**
 * What a seed run would write, given what the household has now. A dish
 * qualifies only if its name matches a starter dish (ignoring case and
 * accents) and it has no ingredients at all; a renamed or already-filled
 * dish is the household's own and is left alone. The recipe is only filled
 * in where the dish has none.
 */
export const planStarterSeed = (
  dishes: Pick<DishIdea, 'id' | 'name' | 'recipe_url'>[],
  catalog: Pick<ShoppingIngredient, 'name_key'>[],
  links: DishIngredient[]
): StarterSeedPlan => {
  const existingKeys = new Set(catalog.map((ingredient) => ingredient.name_key))
  const filled = dishesWithIngredients(links)

  const ingredients = STARTER_INGREDIENTS.filter(({ name }) => !existingKeys.has(toKey(name))).map(
    ({ name, section, is_staple }) => ({ name, name_key: toKey(name), section, is_staple: Boolean(is_staple) })
  )

  const toFill = dishes.flatMap((dish) => {
    const details = DETAILS_BY_KEY.get(toKey(dish.name))
    if (!details || filled.has(dish.id)) return []
    return [
      {
        dishId: dish.id,
        ingredientKeys: details.ingredients.map(toKey),
        recipeUrl: dish.recipe_url ? undefined : details.recipe_url,
      },
    ]
  })

  return { ingredients, dishes: toFill }
}

/** Applies `planStarterSeed` to the database. Returns how many dishes it filled. */
export async function applyStarterSeed(
  client: SupabaseClient,
  householdId: string,
  dishes: Pick<DishIdea, 'id' | 'name' | 'recipe_url'>[]
): Promise<number> {
  // Read fresh rather than trusting the screen's state: another member of the
  // household may have filled a dish since it loaded.
  const [catalogResult, linksResult] = await Promise.all([
    client.from('ingredients').select('id, name_key').eq('household_id', householdId),
    client.from('dish_ingredients').select('*').eq('household_id', householdId),
  ])
  if (catalogResult.error) throw catalogResult.error
  if (linksResult.error) throw linksResult.error

  const catalog = (catalogResult.data ?? []) as { id: string; name_key: string }[]
  const plan = planStarterSeed(dishes, catalog, (linksResult.data ?? []) as DishIngredient[])

  const idByKey = new Map(catalog.map((row) => [row.name_key, row.id]))
  if (plan.ingredients.length > 0) {
    const { data, error } = await client
      .from('ingredients')
      .upsert(
        plan.ingredients.map((ingredient) => ({ ...ingredient, household_id: householdId })),
        // A row created meanwhile keeps whatever the household set on it.
        { onConflict: 'household_id,name_key', ignoreDuplicates: true }
      )
      .select('id, name_key')
    if (error) throw error
    for (const row of (data ?? []) as { id: string; name_key: string }[]) idByKey.set(row.name_key, row.id)
  }

  if (plan.dishes.length === 0) return 0

  // Ignored duplicates come back without a row, so look up any key still missing.
  const missingKeys = [...new Set(plan.dishes.flatMap((dish) => dish.ingredientKeys))].filter((key) => !idByKey.has(key))
  if (missingKeys.length > 0) {
    const { data, error } = await client
      .from('ingredients')
      .select('id, name_key')
      .eq('household_id', householdId)
      .in('name_key', missingKeys)
    if (error) throw error
    for (const row of (data ?? []) as { id: string; name_key: string }[]) idByKey.set(row.name_key, row.id)
  }

  const rows = plan.dishes.flatMap(({ dishId, ingredientKeys }) =>
    ingredientKeys
      .map((key) => idByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((ingredientId, position) => ({
        dish_id: dishId,
        ingredient_id: ingredientId,
        household_id: householdId,
        position,
      }))
  )
  const { error: linkError } = await client
    .from('dish_ingredients')
    .upsert(rows, { onConflict: 'dish_id,ingredient_id', ignoreDuplicates: true })
  if (linkError) throw linkError

  // One update per dish: each sets a different value. Run together, the ~65 of
  // a new household take about as long as one.
  const recipeUpdates = plan.dishes.filter((dish) => dish.recipeUrl)
  const results = await Promise.all(
    recipeUpdates.map((dish) =>
      client
        .from('dish_ideas')
        .update({ recipe_url: dish.recipeUrl })
        .eq('id', dish.dishId)
        .eq('household_id', householdId)
        .is('recipe_url', null)
    )
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error

  return plan.dishes.length
}
