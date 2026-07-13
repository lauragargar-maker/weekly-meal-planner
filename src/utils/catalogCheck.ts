import { DishIdea } from '../types'

export interface CatalogRequirement {
  label: string
  have: number
  need: number
  met: boolean
}

const requirement = (label: string, have: number, need: number): CatalogRequirement => ({
  label,
  have,
  need,
  met: have >= need,
})

/**
 * Minimums the menu generator needs to reliably fill a week
 * (7 dinners without pasta, fish twice, one legume lunch, varied lunches).
 */
export function getCatalogRequirements(dishIdeas: DishIdea[]): CatalogRequirement[] {
  const dinnerMains = dishIdeas.filter(
    (d) =>
      d.category === 'main' &&
      (d.meal_type === 'dinner' || d.meal_type === 'both') &&
      d.main_ingredient !== 'pasta'
  )
  const fish = dishIdeas.filter((d) => d.main_ingredient === 'fish' && d.category !== 'starter')
  const legumeLunches = dishIdeas.filter(
    (d) =>
      d.main_ingredient === 'legume' &&
      d.category !== 'starter' &&
      (d.meal_type === 'lunch' || d.meal_type === 'both')
  )
  const starters = dishIdeas.filter((d) => d.category === 'starter')
  const singles = dishIdeas.filter((d) => d.category === 'single')
  const lunchMains = dishIdeas.filter(
    (d) => d.category === 'main' && (d.meal_type === 'lunch' || d.meal_type === 'both')
  )

  return [
    requirement('Segundos para cenas (sin pasta)', dinnerMains.length, 7),
    requirement('Platos de pescado', fish.length, 2),
    requirement('Platos de legumbre para comidas', legumeLunches.length, 1),
    requirement('Primeros', starters.length, 3),
    requirement('Platos únicos', singles.length, 3),
    requirement('Segundos para comidas', lunchMains.length, 4),
  ]
}

export function isCatalogReady(dishIdeas: DishIdea[]): boolean {
  return getCatalogRequirements(dishIdeas).every((r) => r.met)
}
