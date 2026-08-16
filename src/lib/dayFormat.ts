import { DishIdea, Ingredient, MenuItem } from '../types'
import {
  CARB_AXIS,
  HouseholdRules,
  PROTEIN_AXIS,
  requiresVegetableAtDinner,
} from './householdRules'
import { ingredientLabel } from './ingredients'

/**
 * The per-day format of a meal: how many courses it has, and what changing that
 * number does to the stored item.
 *
 * `specs/edit-day.md` §3 puts this decision on the day rather than on the
 * household: "＋ Primer plato" and "− Quitar el primero" affect that day and that
 * meal only, never the rules and never the following weeks. Nothing here reads
 * or writes `households.rules`.
 *
 * It lives apart from the components because it is the part that can be wrong
 * without anything looking wrong: a slot written to the wrong field still
 * renders, and only shows up later as a rule the generator seems to ignore.
 */

export type CourseSlot = 'starter' | 'main' | 'single'
export type MealType = 'lunch' | 'dinner'

/** The role label the day sheet prints under each dish name (§2). */
export type CourseRole = 'Plato principal' | 'Primero' | 'Segundo'

export interface DayCourse {
  slot: CourseSlot
  dish: string
  role: CourseRole
}

/**
 * The courses of one meal, in the order they are eaten.
 *
 * Two shapes reach this from the generator — `single` for a one-dish lunch and
 * `starter` + `main` for two courses — plus a lone `main`, which is every dinner
 * of a one-course household and also what a lunch becomes after removing its
 * first course. All three are read the same way here.
 */
export const coursesOf = (item: MenuItem | null | undefined): DayCourse[] => {
  if (!item) return []
  if (item.single) return [{ slot: 'single', dish: item.single, role: 'Plato principal' }]
  if (item.starter && item.main) {
    return [
      { slot: 'starter', dish: item.starter, role: 'Primero' },
      { slot: 'main', dish: item.main, role: 'Segundo' },
    ]
  }
  // A lone course is "the" dish of that meal, whichever field holds it.
  if (item.main) return [{ slot: 'main', dish: item.main, role: 'Plato principal' }]
  if (item.starter) return [{ slot: 'starter', dish: item.starter, role: 'Plato principal' }]
  return []
}

/**
 * Which of the two format controls that meal gets, if any (§3: only ever one).
 *
 * A meal with no dish at all gets neither: the basic fallback menu can leave one
 * behind when the catalogue is threadbare, and the way out of that is to pick a
 * dish, not to change the format.
 */
export const formatControlFor = (item: MenuItem | null | undefined): 'add' | 'remove' | null => {
  const count = coursesOf(item).length
  if (count === 1) return 'add'
  if (count === 2) return 'remove'
  return null
}

/**
 * Adds a first course, putting the dish that was already there second.
 *
 * The dish moves from `single` to `main` rather than staying put: `main` is the
 * field the generator's rules read as the main course of the meal
 * (`getLunchIngredients`), so leaving it in `single` alongside a starter would
 * hide the second course from every ingredient rule.
 *
 * Callers commit this only once a dish has been chosen (§3): the format change
 * and the choice are a single write, so cancelling the picker leaves no empty
 * slot behind.
 */
export const addFirstCourse = (item: MenuItem, dishName: string): MenuItem => {
  // Already two courses, or nothing to push down: leave it exactly as it is.
  if (coursesOf(item).length !== 1) return item
  const existing = item.single ?? item.main ?? item.starter
  return { ...item, starter: dishName, main: existing, single: undefined }
}

/**
 * Removes the first course, keeping the second where it already lives.
 *
 * The survivor stays in `main` instead of collapsing back into `single`, which
 * is why this is not the exact inverse of `addFirstCourse`: both fields mean
 * "the main course of this meal" to the rules and to the day sheet, and
 * rewriting the field would only add a way to get it wrong.
 */
export const removeFirstCourse = (item: MenuItem): MenuItem => {
  if (coursesOf(item).length !== 2) return item
  return { ...item, starter: undefined, main: item.main, single: undefined }
}

/**
 * Swaps the dish in one slot and nothing else.
 *
 * Picking a dish never changes the format (§2 vs §3 are separate controls). The
 * old editor did: choosing a `main`-category dish where a `single` was invented
 * a random starter to go with it, which is precisely the "something regenerated
 * itself" that this round removes.
 */
export const replaceCourse = (item: MenuItem, slot: CourseSlot, dishName: string): MenuItem => ({
  ...item,
  [slot]: dishName,
})

/**
 * Weekend from the ISO string's own parts.
 *
 * `new Date('2026-08-22')` is parsed as UTC midnight, so west of Greenwich its
 * `getDay()` is the day before. Building the date from the parts keeps it local,
 * the way `weekStart.ts` does for the same reason.
 */
const isWeekendDay = (dayISO: string): boolean => {
  const [year, month, day] = dayISO.split('-').map(Number)
  const weekday = new Date(year, month - 1, day).getDay()
  return weekday === 0 || weekday === 6
}

/**
 * The dishes the picker offers for one meal (§4).
 *
 * Only the dish's own tags narrow the list — the meal it is for, and whether it
 * is a weekday or weekend dish. Its course (`category`) does not: the spec drops
 * the "Primeros / Segundos / Únicos" filter, and a household that files a soup
 * as a starter should still be able to make it the whole dinner.
 *
 * Nothing here reads the house rules. The old editor hid every pasta main at
 * dinner outright; that is now a note on the dish (`ruleWarningFor`), because a
 * rule the user chose is a rule the user can knowingly break for one day.
 */
export const eligibleDishesFor = (
  dishIdeas: DishIdea[],
  mealType: MealType,
  dayISO: string,
): DishIdea[] => {
  const weekend = isWeekendDay(dayISO)
  return dishIdeas.filter(dish => {
    if (dish.day_type === 'weekendday' && !weekend) return false
    if (dish.day_type === 'weekday' && weekend) return false
    return dish.meal_type === 'both' || dish.meal_type === mealType
  })
}

const has = (dish: DishIdea, ingredient: Ingredient): boolean =>
  dish.main_ingredients.includes(ingredient)

const shared = (a: Ingredient[], b: Ingredient[], axis: Ingredient[]): Ingredient | undefined =>
  axis.find(ingredient => a.includes(ingredient) && b.includes(ingredient))

/** What the picker knows about the meal the dish would land in. */
export interface CourseContext {
  mealType: MealType
  /**
   * Ingredients of the OTHER meal that day — its main course only, which is what
   * `repeatsWithinDay` compares in the generator. Passing the starter's too
   * would warn about pairings the generator itself allows.
   */
  otherMealIngredients: Ingredient[]
  /** Ingredients of the other course of this same meal, when there is one. */
  siblingCourseIngredients: Ingredient[]
}

/**
 * The one-line note a dish carries when it contradicts a house rule (§4).
 *
 * It never blocks and never asks for confirmation: the note is the whole of the
 * enforcement. Returns `null` when the dish breaks nothing.
 *
 * Only the rules that can be judged from a single day are here. The weekly
 * counts (`fishMinDays`, `legumeMinLunches`, `pastaMaxPerWeek`) would need the
 * rest of the week to say anything true, and a note that fires on every pasta
 * dish regardless of how much pasta the week already has is worse than no note.
 */
export const ruleWarningFor = (
  dish: DishIdea,
  rules: HouseholdRules,
  ctx: CourseContext,
): string | null => {
  if (ctx.mealType === 'dinner') {
    const excluded = rules.dinnerExclusions.find(ingredient => has(dish, ingredient))
    if (excluded) {
      return `tu regla: nada de ${ingredientLabel(excluded).toLowerCase()} por la noche`
    }
  }

  const repeated =
    (rules.noRepeatCarb
      ? shared(dish.main_ingredients, ctx.otherMealIngredients, CARB_AXIS)
      : undefined) ??
    (rules.noRepeatProtein
      ? shared(dish.main_ingredients, ctx.otherMealIngredients, PROTEIN_AXIS)
      : undefined)
  if (repeated) {
    return `tu regla: no repetir ${ingredientLabel(repeated).toLowerCase()} el mismo día`
  }

  // The vegetable can come from either course, so this only fires when neither
  // this dish nor the one beside it brings any.
  if (
    ctx.mealType === 'dinner' &&
    requiresVegetableAtDinner(rules) &&
    !has(dish, 'vegetable') &&
    !ctx.siblingCourseIngredients.includes('vegetable')
  ) {
    return 'tu regla: verdura en todas las cenas'
  }

  return null
}
