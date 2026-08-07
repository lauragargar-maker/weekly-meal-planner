import { describe, expect, it } from 'vitest'
import { extractWords, generateWeeklyMenu } from './menuGenerator'
import { STARTER_CATALOG } from '../data/starterCatalog'
import { DishIdea, Ingredient, MenuItem, NewDishIdea } from '../types'
import {
  CARB_AXIS,
  DEFAULT_RULES,
  HouseholdRules,
  PROTEIN_AXIS,
} from '../lib/householdRules'
import { PRODUCTION_CATALOG } from './__fixtures__/productionCatalog'

/**
 * Characterisation tests: they pin down what the generator does TODAY, before
 * M1 and M2 rewrite its checks. They are not a specification of what it should
 * do — several of these rules are about to become configurable, and the ones
 * that change are called out in the comments.
 *
 * The generator is randomised, so every invariant runs over many weeks.
 */

const RUNS = 25

// 2026-08-01 is a Saturday, which is where the app still starts its weeks.
const WEEK_START = new Date(2026, 7, 1)

const toDish = (dish: NewDishIdea, index: number): DishIdea => ({
  ...dish,
  id: `dish-${index}`,
  household_id: 'household-test',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
})

const catalog = (): DishIdea[] => STARTER_CATALOG.map(toDish)

const byName = (dishes: DishIdea[]) => new Map(dishes.map((dish) => [dish.name, dish]))

const dishNames = (item: MenuItem): string[] =>
  [item.starter, item.main, item.single].filter((name): name is string => Boolean(name))

/** The ingredients the generator attributes to a lunch: the single's, or the main's. */
const lunchIngredients = (map: Map<string, DishIdea>, lunch: MenuItem): Ingredient[] =>
  map.get(lunch.single ?? lunch.main ?? '')?.main_ingredients ?? []

const dinnerIngredients = (map: Map<string, DishIdea>, dinner: MenuItem): Ingredient[] =>
  map.get(dinner.main ?? '')?.main_ingredients ?? []

const weeks = (dishes: DishIdea[] = catalog()) =>
  Array.from(
    { length: RUNS },
    () => generateWeeklyMenu({ dishIdeas: dishes, weekStart: WEEK_START }).items
  )

const eachWeek = (assert: (items: MenuItem[], map: Map<string, DishIdea>) => void) => {
  const dishes = catalog()
  const map = byName(dishes)
  for (const items of weeks(dishes)) assert(items, map)
}

describe('extractWords', () => {
  it('folds accents instead of splitting the word in two', () => {
    // The old version deleted the accented letter along with its accent, so
    // "calabacín" came out as ["calabac", "n"] and every dish with an accent
    // shared a meaningless "n" with every other one.
    expect(extractWords('Crema de calabacín')).toEqual(['crema', 'calabacin'])
    expect(extractWords('Croquetas de jamón')).toEqual(['croquetas', 'jamon'])
    expect(extractWords('Revuelto de champiñones')).toEqual(['revuelto', 'champinones'])
  })

  it('drops words of three letters or fewer', () => {
    expect(extractWords('Sepia con ajo y perejil')).toEqual(['sepia', 'perejil'])
    expect(extractWords('Salmón a la plancha')).toEqual(['salmon', 'plancha'])
  })

  it('still catches the repetition it exists for', () => {
    const a = extractWords('Ensalada de pasta')
    const b = extractWords('Macarrones con tomate')
    const c = extractWords('Espaguetis a la carbonara')
    expect(a.some((word) => b.includes(word))).toBe(false)
    expect(a).toContain('pasta')
    expect(c).toContain('carbonara')
  })

  it('survives punctuation', () => {
    expect(extractWords('Alitas al horno / Airfrier')).toEqual(['alitas', 'horno', 'airfrier'])
  })
})

describe('generateWeeklyMenu — shape of the week', () => {
  it('fills seven days with a lunch and a dinner each', () => {
    eachWeek((items) => {
      expect(items).toHaveLength(14)

      const days = [...new Set(items.map((item) => item.day))]
      expect(days).toHaveLength(7)

      for (const day of days) {
        const meals = items.filter((item) => item.day === day)
        expect(meals.map((meal) => meal.meal_type).sort()).toEqual(['dinner', 'lunch'])
      }
    })
  })

  it('makes every lunch either a single course or a starter plus a main, never both', () => {
    eachWeek((items) => {
      for (const lunch of items.filter((item) => item.meal_type === 'lunch')) {
        const isSingle = Boolean(lunch.single)
        const isCombo = Boolean(lunch.starter && lunch.main)
        expect(isSingle !== isCombo).toBe(true)
      }
    })
  })

  it('gives every dinner exactly one main', () => {
    eachWeek((items) => {
      for (const dinner of items.filter((item) => item.meal_type === 'dinner')) {
        expect(dinner.main).toBeTruthy()
        expect(dinner.starter).toBeUndefined()
        expect(dinner.single).toBeUndefined()
      }
    })
  })

  it('never repeats a dish within the week', () => {
    eachWeek((items) => {
      const names = items.flatMap(dishNames)
      expect(new Set(names).size).toBe(names.length)
    })
  })

  it('honours weekday and weekend-only dishes', () => {
    eachWeek((items, map) => {
      for (const item of items) {
        // Parsed as local time to match the generator's own formatting.
        const [year, month, day] = item.day.split('-').map(Number)
        const weekday = new Date(year, month - 1, day).getDay()
        const isWeekend = weekday === 0 || weekday === 6

        for (const name of dishNames(item)) {
          const dish = map.get(name)
          if (dish?.day_type === 'weekendday') expect(isWeekend).toBe(true)
          if (dish?.day_type === 'weekday') expect(isWeekend).toBe(false)
        }
      }
    })
  })
})

describe('generateWeeklyMenu — rules that M2 turns into settings', () => {
  it('serves fish on at least two days', () => {
    eachWeek((items, map) => {
      const fishDays = new Set(
        items
          .filter((item) =>
            item.meal_type === 'lunch'
              ? lunchIngredients(map, item).includes('fish')
              : dinnerIngredients(map, item).includes('fish')
          )
          .map((item) => item.day)
      )
      expect(fishDays.size).toBeGreaterThanOrEqual(2)
    })
  })

  it('serves legume at AT LEAST the required number of lunches', () => {
    // This used to assert exactly one, because the generator rejected a week
    // with two — the rule that actively excluded Cristina's household. M2 makes
    // it a minimum, so more is fine and fewer is not.
    eachWeek((items, map) => {
      const legumeLunches = items
        .filter((item) => item.meal_type === 'lunch')
        .filter((item) => lunchIngredients(map, item).includes('legume'))
      expect(legumeLunches.length).toBeGreaterThanOrEqual(DEFAULT_RULES.legumeMinLunches)
    })
  })

  it('never serves pasta at dinner', () => {
    // Hardcoded today; M2 turns it into the configurable "nada de… por la noche".
    eachWeek((items, map) => {
      for (const dinner of items.filter((item) => item.meal_type === 'dinner')) {
        expect(dinnerIngredients(map, dinner)).not.toContain('pasta')
      }
    })
  })

  it('does not repeat fish or egg between lunch and dinner of the same day', () => {
    // The cross-check still covers only these two ingredients; M1 changed the
    // comparison to an intersection, not its scope. M2 widens it per axis
    // (carb / protein group), behind a switch.
    eachWeek((items, map) => {
      for (const day of new Set(items.map((item) => item.day))) {
        const lunch = items.find((item) => item.day === day && item.meal_type === 'lunch')!
        const dinner = items.find((item) => item.day === day && item.meal_type === 'dinner')!
        const lunchIng = lunchIngredients(map, lunch)
        const dinnerIng = dinnerIngredients(map, dinner)

        for (const ingredient of ['fish', 'egg'] as const) {
          expect(lunchIng.includes(ingredient) && dinnerIng.includes(ingredient)).toBe(false)
        }
      }
    })
  })

  it('does not repeat a meaningful word between the dishes of a single day', () => {
    // Stays an internal invariant with no switch of its own.
    eachWeek((items) => {
      for (const day of new Set(items.map((item) => item.day))) {
        const words = items
          .filter((item) => item.day === day)
          .flatMap(dishNames)
          .flatMap(extractWords)
        expect(new Set(words).size).toBe(words.length)
      }
    })
  })
})

describe('generateWeeklyMenu — configurable rules', () => {
  const rules = (overrides: Partial<HouseholdRules>): HouseholdRules => ({
    ...DEFAULT_RULES,
    ...overrides,
  })

  /** The real founder household: 63 hand-built dishes, roughly half of them meat. */
  const production = (): DishIdea[] => PRODUCTION_CATALOG.map(toDish)

  const run = (dishes: DishIdea[], householdRules: HouseholdRules, runs = RUNS) =>
    Array.from(
      { length: runs },
      () =>
        generateWeeklyMenu({ dishIdeas: dishes, weekStart: WEEK_START, rules: householdRules }).items
    )

  const eachDay = (items: MenuItem[], map: Map<string, DishIdea>) =>
    [...new Set(items.map((item) => item.day))].map((day) => ({
      lunch: lunchIngredients(map, items.find((i) => i.day === day && i.meal_type === 'lunch')!),
      dinner: dinnerIngredients(map, items.find((i) => i.day === day && i.meal_type === 'dinner')!),
    }))

  describe('block A — the shape of each meal', () => {
    it('gives every lunch a single dish when that is what was asked', () => {
      // Cristina always eats one substantial dish; the app used to flip a coin.
      const dishes = catalog()
      for (const items of run(dishes, rules({ lunchStructure: 'single' }))) {
        for (const lunch of items.filter((i) => i.meal_type === 'lunch')) {
          expect(lunch.single).toBeTruthy()
          expect(lunch.starter).toBeUndefined()
          expect(lunch.main).toBeUndefined()
        }
      }
    })

    it('gives every lunch a starter and a main when that is what was asked', () => {
      // Erika, the opposite case. The legume minimum has to come off: every
      // legume dish in the catalogue is a `single`, so requiring both a legume
      // lunch and a two-course lunch is unsatisfiable. See the test below.
      const dishes = catalog()
      for (const items of run(dishes, rules({ lunchStructure: 'courses', legumeMinLunches: 0 }))) {
        for (const lunch of items.filter((i) => i.meal_type === 'lunch')) {
          expect(lunch.starter).toBeTruthy()
          expect(lunch.main).toBeTruthy()
          expect(lunch.single).toBeUndefined()
        }
      }
    })

    it('can serve a legume lunch to a household that always eats two courses', () => {
      // This used to be impossible, and it is the reason the seed catalogue now
      // files "Lentejas con verduras" as a `main`. Legumes are one-dish meals in
      // Spanish home cooking, so every other legume dish here is a `single` —
      // and Erika, who always eats a starter and a main, could never be served
      // one. The generator would burn its 200 attempts and hand back the basic
      // menu, which ignores lunchStructure as well: she would have asked for two
      // courses and received single dishes, with nothing said.
      const dishes = catalog()
      const map = byName(dishes)

      // The catalogue has to keep at least one legume that is not a `single`,
      // or the dead end comes straight back.
      const legumeSeconds = dishes.filter(
        (d) => d.main_ingredients.includes('legume') && d.category === 'main'
      )
      expect(legumeSeconds.length).toBeGreaterThan(0)

      for (const items of run(dishes, rules({ lunchStructure: 'courses', legumeMinLunches: 1 }))) {
        const lunches = items.filter((i) => i.meal_type === 'lunch')
        // Every lunch keeps the requested shape: no fallback happened.
        for (const lunch of lunches) {
          expect(lunch.starter).toBeTruthy()
          expect(lunch.main).toBeTruthy()
        }
        expect(
          lunches.filter((lunch) => lunchIngredients(map, lunch).includes('legume')).length
        ).toBeGreaterThanOrEqual(1)
      }
    })

    it('still mixes both shapes on "either"', () => {
      const shapes = new Set<string>()
      for (const items of run(catalog(), rules({ lunchStructure: 'either' }))) {
        for (const lunch of items.filter((i) => i.meal_type === 'lunch')) {
          shapes.add(lunch.single ? 'single' : 'courses')
        }
      }
      expect(shapes).toEqual(new Set(['single', 'courses']))
    })

    it('serves two dinner courses when asked, and never repeats a dish', () => {
      // Cristina's blocking requirement.
      const dishes = catalog()
      for (const items of run(dishes, rules({ dinnerCourses: 2 }))) {
        for (const dinner of items.filter((i) => i.meal_type === 'dinner')) {
          expect(dinner.starter).toBeTruthy()
          expect(dinner.main).toBeTruthy()
          expect(dinner.starter).not.toBe(dinner.main)
        }
        const names = items.flatMap(dishNames)
        expect(new Set(names).size).toBe(names.length)
      }
    })

    it('draws dinner starters from dishes the one-course generator could never reach', () => {
      // The point of composing dinner like lunch: `starter` dishes flagged for
      // dinner were unreachable in the evening, and that is where the vegetables
      // are. If this set were empty the rule below could not be satisfiable.
      const dishes = catalog()
      const used = new Set<string>()
      for (const items of run(dishes, rules({ dinnerCourses: 2 }))) {
        for (const dinner of items.filter((i) => i.meal_type === 'dinner')) {
          if (dinner.starter) used.add(dinner.starter)
        }
      }
      const map = byName(dishes)
      expect(used.size).toBeGreaterThan(0)
      for (const name of used) expect(map.get(name)?.category).toBe('starter')
    })

    it('puts a vegetable in one of the two dinner courses when asked', () => {
      const dishes = catalog()
      const map = byName(dishes)
      for (const items of run(dishes, rules({ dinnerCourses: 2, vegetableEveryDinner: true }))) {
        for (const dinner of items.filter((i) => i.meal_type === 'dinner')) {
          const both = [
            ...(map.get(dinner.starter ?? '')?.main_ingredients ?? []),
            ...(map.get(dinner.main ?? '')?.main_ingredients ?? []),
          ]
          expect(both).toContain('vegetable')
        }
      }
    })

    it('ignores the vegetable rule when dinner has a single course', () => {
      // The UI never offers the combination, but stored state can hold it from a
      // household that switched back, and it must not silently constrain them.
      const dishes = catalog()
      const map = byName(dishes)
      const withoutVegetable = run(dishes, rules({ dinnerCourses: 1, vegetableEveryDinner: true }))
        .flatMap((items) => items.filter((i) => i.meal_type === 'dinner'))
        .filter((dinner) => !(map.get(dinner.main ?? '')?.main_ingredients ?? []).includes('vegetable'))

      expect(withoutVegetable.length).toBeGreaterThan(0)
    })
  })

  describe('block B — not twice in the same day', () => {
    it('never repeats a carb between lunch and dinner when asked', () => {
      const dishes = production()
      const map = byName(dishes)
      for (const items of run(dishes, rules({ noRepeatCarb: true }))) {
        for (const { lunch, dinner } of eachDay(items, map)) {
          for (const carb of CARB_AXIS) {
            expect(lunch.includes(carb) && dinner.includes(carb)).toBe(false)
          }
        }
      }
    })

    it('never repeats a protein between lunch and dinner when asked', () => {
      // The hard case: this catalogue is about half meat, so the rule bites on
      // roughly a third of the days the generator would otherwise produce.
      const dishes = production()
      const map = byName(dishes)
      for (const items of run(dishes, rules({ noRepeatProtein: true }))) {
        for (const { lunch, dinner } of eachDay(items, map)) {
          for (const protein of PROTEIN_AXIS) {
            expect(lunch.includes(protein) && dinner.includes(protein)).toBe(false)
          }
        }
      }
    })

    it('allows the repetition once the rule is off', () => {
      // Not a formality: if turning the rule off changed nothing, the rule would
      // not be doing anything when it is on.
      const dishes = production()
      const map = byName(dishes)
      const repeats = run(dishes, rules({ noRepeatProtein: false, noRepeatCarb: false }))
        .flatMap((items) => eachDay(items, map))
        .filter(({ lunch, dinner }) => PROTEIN_AXIS.some((p) => lunch.includes(p) && dinner.includes(p)))

      expect(repeats.length).toBeGreaterThan(0)
    })
  })

  describe('block C — how the week adds up', () => {
    it('honours a raised legume minimum', () => {
      // The starter catalogue is used here because the founder household only
      // owns two legume dishes and no week can hold three.
      const dishes = catalog()
      const map = byName(dishes)
      for (const items of run(dishes, rules({ legumeMinLunches: 3 }))) {
        const legumes = items
          .filter((item) => item.meal_type === 'lunch')
          .filter((item) => lunchIngredients(map, item).includes('legume'))
        expect(legumes.length).toBeGreaterThanOrEqual(3)
      }
    })

    it('honours a raised fish minimum', () => {
      const dishes = production()
      const map = byName(dishes)
      for (const items of run(dishes, rules({ fishMinDays: 4 }))) {
        const fishDays = new Set(
          items
            .filter((item) =>
              item.meal_type === 'lunch'
                ? lunchIngredients(map, item).includes('fish')
                : dinnerIngredients(map, item).includes('fish')
            )
            .map((item) => item.day)
        )
        expect(fishDays.size).toBeGreaterThanOrEqual(4)
      }
    })

    it('keeps pasta under the weekly ceiling', () => {
      const dishes = catalog()
      const map = byName(dishes)
      for (const items of run(dishes, rules({ pastaMaxPerWeek: 1 }))) {
        const pasta = items
          .flatMap(dishNames)
          .filter((name) => map.get(name)?.main_ingredients.includes('pasta'))
        expect(pasta.length).toBeLessThanOrEqual(1)
      }
    })

    it('can ban pasta from the week entirely', () => {
      const dishes = catalog()
      const map = byName(dishes)
      for (const items of run(dishes, rules({ pastaMaxPerWeek: 0 }))) {
        const pasta = items
          .flatMap(dishNames)
          .filter((name) => map.get(name)?.main_ingredients.includes('pasta'))
        expect(pasta).toHaveLength(0)
      }
    })

    it('can drop the fish requirement altogether', () => {
      // A household that eats no fish must still get a week, and must not be
      // pushed into the basic-menu fallback by a catalogue with no fish in it.
      const noFish = catalog().filter((d) => !d.main_ingredients.includes('fish'))
      for (const items of run(noFish, rules({ fishMinDays: 0 }), 5)) {
        expect(items).toHaveLength(14)
        expect(items.every((item) => item.meal_type !== 'dinner' || item.main)).toBe(true)
      }
    })
  })

  describe('block D — not in the evening', () => {
    it('keeps every excluded ingredient off the dinner plate', () => {
      const dishes = production()
      const map = byName(dishes)
      const exclusions: Ingredient[] = ['pasta', 'meat']
      for (const items of run(dishes, rules({ dinnerExclusions: exclusions }))) {
        for (const dinner of items.filter((item) => item.meal_type === 'dinner')) {
          const ingredients = dinnerIngredients(map, dinner)
          for (const excluded of exclusions) expect(ingredients).not.toContain(excluded)
        }
      }
    })

    it('lets pasta into the evening when nothing is excluded', () => {
      const dishes = catalog()
      const map = byName(dishes)
      const pastaDinners = run(dishes, rules({ dinnerExclusions: [], pastaMaxPerWeek: 7 }))
        .flatMap((items) => items.filter((item) => item.meal_type === 'dinner'))
        .filter((dinner) => dinnerIngredients(map, dinner).includes('pasta'))

      // The seed catalogue has no pasta dish flagged for dinner, so this proves
      // the exclusion list is not the only thing keeping pasta out — meal_type is.
      expect(pastaDinners).toHaveLength(0)
    })
  })

  it('still fills seven complete days for the founder household', () => {
    for (const items of run(production(), DEFAULT_RULES)) {
      expect(items).toHaveLength(14)
      for (const day of new Set(items.map((item) => item.day))) {
        expect(items.filter((item) => item.day === day)).toHaveLength(2)
      }
    }
  })
})

describe('generateWeeklyMenu — degradation is reported, not swallowed', () => {
  const generate = (dishes: DishIdea[], rules?: HouseholdRules) =>
    generateWeeklyMenu({ dishIdeas: dishes, weekStart: WEEK_START, rules })

  it('says nothing is wrong when nothing is', () => {
    const result = generate(catalog())
    expect(result.degraded).toBe(false)
    expect(result.unmet).toEqual([])
  })

  it('still returns a full week when it degrades', () => {
    // A degraded week beats no week. What must not happen is handing it over in
    // silence, which is what the app did before.
    const noFish = catalog().filter((dish) => !dish.main_ingredients.includes('fish'))
    const result = generate(noFish)

    expect(result.items).toHaveLength(14)
    expect(result.degraded).toBe(true)
  })

  it('names the missing minimum when the catalogue is short', () => {
    const noFish = catalog().filter((dish) => !dish.main_ingredients.includes('fish'))
    const result = generate(noFish)

    expect(result.unmet.map((r) => r.label)).toContain('Platos de pescado')
    const fish = result.unmet.find((r) => r.label === 'Platos de pescado')!
    expect(fish.have).toBe(0)
    expect(fish.need).toBe(DEFAULT_RULES.fishMinDays)
  })

  it('reports the legume shortfall that a raised stepper creates', () => {
    // The case found on the founder household's real catalogue: asking for three
    // legume lunches with two legume dishes. It used to fall back 200 times out
    // of 200 and say nothing.
    const dishes = catalog()
    const legumes = dishes.filter((d) => d.main_ingredients.includes('legume'))
    const trimmed = dishes.filter(
      (d) => !d.main_ingredients.includes('legume') || legumes.indexOf(d) < 2
    )

    const result = generate(trimmed, { ...DEFAULT_RULES, legumeMinLunches: 3 })

    expect(result.degraded).toBe(true)
    const legume = result.unmet.find((r) => r.label.includes('legumbre'))
    expect(legume).toBeDefined()
    expect(legume!.need).toBe(3)
    expect(legume!.have).toBeLessThan(3)
  })

  it('reports the missing dinner starters a two-course dinner needs', () => {
    // The founder household in production: every starter is flagged for lunch,
    // so turning on two-course dinners cannot work and the user deserves to know
    // before the week comes out wrong.
    const lunchOnlyStarters = catalog().map((dish) =>
      dish.category === 'starter' ? { ...dish, meal_type: 'lunch' as const } : dish
    )
    const result = generate(lunchOnlyStarters, { ...DEFAULT_RULES, dinnerCourses: 2 })

    expect(result.degraded).toBe(true)
    expect(result.unmet.map((r) => r.label)).toContain('Primeros para cenas')
  })

})
