import { Ingredient } from '../types'

/**
 * The ingredient list and, just as importantly, its order — `onboarding-v2.md`
 * §4 requires the same order everywhere in the app, and §4b tints a chip "in its
 * fixed position", which only means anything if the position never moves.
 *
 * The order is the one the spec pins down (Verdura, Carne, Pescado, Pasta,
 * Arroz, Legumbre) with the two the spec omits appended: a dish cannot be
 * tagged without them.
 *
 * Decided 2026-08-05: the onboarding step-3 filters show ALL of these, plus
 * "Todos" in front. The spec's shorter list left egg and potato dishes
 * reachable only through "Todos".
 */
export const INGREDIENTS: { value: Ingredient; label: string }[] = [
  { value: 'vegetable', label: 'Verdura' },
  { value: 'meat', label: 'Carne' },
  { value: 'fish', label: 'Pescado' },
  { value: 'pasta', label: 'Pasta' },
  { value: 'rice', label: 'Arroz' },
  { value: 'legume', label: 'Legumbre' },
  { value: 'egg', label: 'Huevo' },
  { value: 'potato', label: 'Patata' },
]

const LABELS = new Map(INGREDIENTS.map(({ value, label }) => [value, label]))

/** "Pasta · Carne", in the canonical order rather than the stored one. */
export const formatIngredients = (ingredients: Ingredient[]): string =>
  INGREDIENTS.filter(({ value }) => ingredients.includes(value))
    .map(({ label }) => label)
    .join(' · ')

export const ingredientLabel = (ingredient: Ingredient): string =>
  LABELS.get(ingredient) ?? ingredient
