import { Ingredient } from '../types'

/**
 * The closed set of rules a household can configure. Deliberately not a generic
 * rule engine: every entry here maps to one control in the UI, and the set only
 * grows if the beta shows it needs to.
 */
export interface HouseholdRules {
  // --- Block A: the shape of each meal ---
  /** Lunch is one dish, a starter plus a main, or the generator's choice. */
  lunchStructure: 'single' | 'courses' | 'either'
  /** Dinner is one dish or two. Two is Cristina's blocking requirement. */
  dinnerCourses: 1 | 2

  // --- Block B: not twice in the same day ---
  /** Don't repeat pasta / rice / potato between lunch and dinner. */
  noRepeatCarb: boolean
  /** Don't repeat meat / fish / egg / legume between lunch and dinner. */
  noRepeatProtein: boolean

  // --- Block C: how the week adds up ---
  /** Fish on at least this many days. */
  fishMinDays: number
  /** Legume at at least this many lunches. */
  legumeMinLunches: number
  /** Pasta at most this many times in the week. */
  pastaMaxPerWeek: number
  /** One of the two dinner courses must be vegetable. Only meaningful when dinnerCourses is 2. */
  vegetableEveryDinner: boolean

  // --- Block D: not in the evening ---
  dinnerExclusions: Ingredient[]
}

/**
 * The two axes of block B. An axis is the SET of ingredients compared, not a
 * label the ingredients collapse into: "don't repeat the protein group" means
 * meat-then-meat or fish-then-fish, NOT protein-then-protein. Collapsing them
 * would make the rule fire on almost every day of almost every household, since
 * nearly every dinner brings some protein.
 */
export const CARB_AXIS: Ingredient[] = ['pasta', 'rice', 'potato']
export const PROTEIN_AXIS: Ingredient[] = ['meat', 'fish', 'egg', 'legume']

/**
 * What a household gets when it never touches a setting.
 *
 * These reproduce today's hardcoded behaviour with two deliberate exceptions,
 * both from `docs/beta-plan.md`:
 *
 * - `legumeMinLunches` is a minimum. Today the generator demands EXACTLY one
 *   legume lunch and rejects a week with two, which excludes households that eat
 *   legumes several times a week.
 * - `noRepeatProtein` is on, where today only fish and egg are cross-checked.
 *   This is a superset of current behaviour and both interviewees asked for it,
 *   so existing households will see their weeks change.
 */
export const DEFAULT_RULES: HouseholdRules = {
  lunchStructure: 'either',
  dinnerCourses: 1,
  noRepeatCarb: true,
  noRepeatProtein: true,
  fishMinDays: 2,
  legumeMinLunches: 1,
  pastaMaxPerWeek: 2,
  vegetableEveryDinner: false,
  dinnerExclusions: ['pasta'],
}

const STEPPER_MIN = 0
const STEPPER_MAX = 7

const clampStepper = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(STEPPER_MAX, Math.max(STEPPER_MIN, Math.round(value)))
}

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

const INGREDIENTS: Ingredient[] = [...CARB_AXIS, ...PROTEIN_AXIS, 'vegetable']

/**
 * Reads whatever is stored on the household into a complete set of rules.
 *
 * Every field falls back to its default independently, so a rule added later
 * lands on existing households as its default instead of leaving them with a
 * half-built object. Stored values are also range-checked: the column is JSONB
 * and nothing stops a bad write from putting a 99 in a stepper.
 */
export function parseRules(stored: unknown): HouseholdRules {
  const raw = (stored ?? {}) as Partial<Record<keyof HouseholdRules, unknown>>

  const lunchStructure =
    raw.lunchStructure === 'single' || raw.lunchStructure === 'courses' || raw.lunchStructure === 'either'
      ? raw.lunchStructure
      : DEFAULT_RULES.lunchStructure

  return {
    lunchStructure,
    dinnerCourses: raw.dinnerCourses === 2 ? 2 : 1,
    noRepeatCarb: asBoolean(raw.noRepeatCarb, DEFAULT_RULES.noRepeatCarb),
    noRepeatProtein: asBoolean(raw.noRepeatProtein, DEFAULT_RULES.noRepeatProtein),
    fishMinDays: clampStepper(raw.fishMinDays, DEFAULT_RULES.fishMinDays),
    legumeMinLunches: clampStepper(raw.legumeMinLunches, DEFAULT_RULES.legumeMinLunches),
    pastaMaxPerWeek: clampStepper(raw.pastaMaxPerWeek, DEFAULT_RULES.pastaMaxPerWeek),
    vegetableEveryDinner: asBoolean(raw.vegetableEveryDinner, DEFAULT_RULES.vegetableEveryDinner),
    dinnerExclusions: Array.isArray(raw.dinnerExclusions)
      ? (raw.dinnerExclusions.filter((i): i is Ingredient =>
          INGREDIENTS.includes(i as Ingredient)
        ))
      : DEFAULT_RULES.dinnerExclusions,
  }
}

/**
 * The vegetable rule is only offered when dinner has two courses: with a single
 * dish, requiring vegetables forces that one dish to contain them, which is both
 * restrictive and hard to explain. Stored state can still hold it as true from a
 * household that later switched back to one course, so reading it goes through
 * here rather than through the field.
 */
export const requiresVegetableAtDinner = (rules: HouseholdRules): boolean =>
  rules.dinnerCourses === 2 && rules.vegetableEveryDinner
