import { DishIdea, Ingredient } from '../types'
import {
  DEFAULT_RULES,
  HouseholdRules,
  requiresVegetableAtDinner,
} from '../lib/householdRules'

/**
 * Only the fields the minimums actually read. The onboarding checks a catalogue
 * that does not exist in the database yet — dishes the user has kept, plus any
 * they added by hand — so requiring a full DishIdea would mean inventing ids.
 */
export type CountableDish = Pick<DishIdea, 'category' | 'meal_type' | 'main_ingredients'>

export interface CatalogRequirement {
  label: string
  have: number
  need: number
  met: boolean
  /** Shown when the requirement is unmet, to say what would fix it. */
  hint?: string
  /**
   * The ingredient this requirement is about, when it is about one at all.
   * Lets the onboarding tint the matching filter chip without guessing from the
   * label, and stays undefined for the requirements that are about a course
   * (starters for dinner, say) rather than an ingredient.
   */
  ingredient?: Ingredient
}

const requirement = (
  label: string,
  have: number,
  need: number,
  hint?: string,
  ingredient?: Ingredient
): CatalogRequirement => ({ label, have, need, met: have >= need, hint, ingredient })

const has = (dish: CountableDish, ingredient: Ingredient): boolean =>
  Boolean(dish.main_ingredients?.includes(ingredient))

const excludedAtDinner = (rules: HouseholdRules, dish: CountableDish): boolean =>
  rules.dinnerExclusions.some((ingredient) => has(dish, ingredient))

const atDinner = (dish: CountableDish): boolean =>
  dish.meal_type === 'dinner' || dish.meal_type === 'both'

const atLunch = (dish: CountableDish): boolean =>
  dish.meal_type === 'lunch' || dish.meal_type === 'both'

/** A week is seven days and no dish repeats, so "one per day" means seven dishes. */
const DAYS = 7

/**
 * What the household's own rules demand of its catalogue.
 *
 * These used to be fixed numbers, which was fine while the rules were fixed too.
 * Now a household that turns on two-course dinners needs seven starters it can
 * serve in the evening — dishes nobody ever asked it for — and if the checklist
 * does not say so, the generator quietly falls back to a menu that ignores the
 * settings the user just chose.
 *
 * Every count is of DISTINCT dishes because no dish repeats within a week. Day
 * types are ignored: a weekend-only dish still counts, so these are a floor, not
 * a guarantee. A catalogue can clear every line here and still be hard to solve.
 */
export function getCatalogRequirements(
  dishIdeas: CountableDish[],
  rules: HouseholdRules = DEFAULT_RULES
): CatalogRequirement[] {
  const dinnerMains = dishIdeas.filter(
    (d) => d.category === 'main' && atDinner(d) && !excludedAtDinner(rules, d)
  )
  const dinnerStarters = dishIdeas.filter(
    (d) => d.category === 'starter' && atDinner(d) && !excludedAtDinner(rules, d)
  )
  const starters = dishIdeas.filter((d) => d.category === 'starter' && atLunch(d))
  const singles = dishIdeas.filter((d) => d.category === 'single' && atLunch(d))
  const lunchMains = dishIdeas.filter((d) => d.category === 'main' && atLunch(d))
  const fish = dishIdeas.filter((d) => has(d, 'fish') && d.category !== 'starter')

  // A two-course lunch cannot be built from a `single`, so a household on
  // "primero y segundo" needs legumes filed as seconds. This is the dead end
  // that made the seed catalogue file "Lentejas con verduras" as a main.
  const legumeLunches = dishIdeas.filter(
    (d) =>
      has(d, 'legume') &&
      atLunch(d) &&
      (rules.lunchStructure === 'courses' ? d.category === 'main' : d.category !== 'starter')
  )

  const requirements: CatalogRequirement[] = [
    requirement(
      'Segundos para cenas',
      dinnerMains.length,
      DAYS,
      'Marca algún segundo como apto para cena, o quita una exclusión de la cena.'
    ),
  ]

  if (rules.dinnerCourses === 2) {
    requirements.push(
      requirement(
        'Primeros para cenas',
        dinnerStarters.length,
        DAYS,
        'La cena de dos platos necesita un primero por día. Marca primeros como aptos para cena.'
      )
    )
  }

  if (requiresVegetableAtDinner(rules)) {
    // Counted by tag, not by category, because that is exactly what the rule
    // asks: one of the two courses must BRING vegetables. "Pollo asado con
    // verduras" satisfies it as surely as "Brócoli" does, and the generator
    // makes the same reading.
    const vegetableAtDinner = dishIdeas.filter(
      (d) =>
        has(d, 'vegetable') &&
        atDinner(d) &&
        d.category !== 'single' &&
        !excludedAtDinner(rules, d)
    )
    requirements.push(
      requirement(
        'Platos con verdura para cenas',
        vegetableAtDinner.length,
        DAYS,
        'Con verdura en todas las cenas hace falta uno por día.',
        'vegetable'
      )
    )
  }

  if (rules.fishMinDays > 0) {
    requirements.push(
      requirement('Platos de pescado', fish.length, rules.fishMinDays, undefined, 'fish')
    )
  }

  if (rules.legumeMinLunches > 0) {
    requirements.push(
      requirement(
        'Platos de legumbre para comidas',
        legumeLunches.length,
        rules.legumeMinLunches,
        rules.lunchStructure === 'courses'
          ? 'Con primero y segundo, la legumbre tiene que estar guardada como segundo, no como plato único.'
          : undefined,
        'legume'
      )
    )
  }

  if (rules.lunchStructure === 'single') {
    requirements.push(requirement('Platos únicos', singles.length, DAYS))
  } else if (rules.lunchStructure === 'courses') {
    requirements.push(requirement('Primeros para comidas', starters.length, DAYS))
    requirements.push(requirement('Segundos para comidas', lunchMains.length, DAYS))
  } else {
    // "Indistinto" mixes both shapes, so neither pool has to cover the week on
    // its own. These are the numbers the app has always used.
    requirements.push(requirement('Primeros', starters.length, 3))
    requirements.push(requirement('Platos únicos', singles.length, 3))
    requirements.push(requirement('Segundos para comidas', lunchMains.length, 4))
  }

  return requirements
}

export function isCatalogReady(
  dishIdeas: CountableDish[],
  rules: HouseholdRules = DEFAULT_RULES
): boolean {
  return getCatalogRequirements(dishIdeas, rules).every((r) => r.met)
}

/** The unmet lines, which is what a failure message is built from. */
export function getUnmetRequirements(
  dishIdeas: CountableDish[],
  rules: HouseholdRules = DEFAULT_RULES
): CatalogRequirement[] {
  return getCatalogRequirements(dishIdeas, rules).filter((r) => !r.met)
}
