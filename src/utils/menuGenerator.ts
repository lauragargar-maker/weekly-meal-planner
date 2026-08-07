import { DishIdea, Ingredient, MenuItem } from '../types'
import {
  CARB_AXIS,
  DEFAULT_RULES,
  HouseholdRules,
  PROTEIN_AXIS,
  requiresVegetableAtDinner,
} from '../lib/householdRules'
import { CatalogRequirement, getUnmetRequirements } from './catalogCheck'

export interface MenuGenerationResult {
  items: MenuItem[]
  /**
   * The rules could not be satisfied and this is the basic menu, which ignores
   * most of them. Never let this pass unmentioned: the household configured
   * something and did not get it.
   */
  degraded: boolean
  /**
   * Which catalogue requirements the household's own rules are missing. Empty
   * while `degraded` is true means the counts all add up and the combination
   * itself is the problem — usually day types, or too little room to avoid
   * repeating a dish.
   */
  unmet: CatalogRequirement[]
}

interface MenuGenerationOptions {
  dishIdeas: DishIdea[]
  weekStart: Date
  /**
   * Optional only until the household's stored rules are wired through the app.
   * Falling back to DEFAULT_RULES is not the same as today's behaviour: the
   * protein rule is on and the legume count becomes a minimum. Both changes are
   * intended, and documented in docs/beta-plan.md.
   */
  rules?: HouseholdRules
}

const MAX_ATTEMPTS = 200

/**
 * Food group per ingredient. Lives in code, not in the database: it enables
 * "don't repeat the protein group" and "don't repeat the carb" without touching
 * data or UI. Legumes count as protein — a plate of lentils is the protein dish
 * of the meal, not its side.
 */
export const INGREDIENT_GROUP: Record<Ingredient, 'carb' | 'protein' | 'vegetable'> = {
  pasta: 'carb',
  rice: 'carb',
  potato: 'carb',
  meat: 'protein',
  fish: 'protein',
  egg: 'protein',
  legume: 'protein',
  vegetable: 'vegetable',
}

const has = (dish: DishIdea | undefined, ingredient: Ingredient): boolean =>
  Boolean(dish?.main_ingredients?.includes(ingredient))

/** A dish carries several ingredients now, so "the same" becomes "they overlap". */
const shareIngredient = (a: Ingredient[], b: Ingredient[], only: Ingredient[]): boolean =>
  only.some(ingredient => a.includes(ingredient) && b.includes(ingredient))

/**
 * Block B: does this pairing repeat something the household asked not to repeat?
 *
 * Both axes off means no cross-check at all, which is a valid choice — it is
 * roughly what the app did before fish and egg were special-cased.
 */
const repeatsWithinDay = (
  rules: HouseholdRules,
  lunch: Ingredient[],
  dinner: Ingredient[],
): boolean => {
  if (rules.noRepeatCarb && shareIngredient(lunch, dinner, CARB_AXIS)) return true
  if (rules.noRepeatProtein && shareIngredient(lunch, dinner, PROTEIN_AXIS)) return true
  return false
}

/** Block D: kept off the evening menu by the household's own list. */
const isExcludedAtDinner = (rules: HouseholdRules, dish: DishIdea): boolean =>
  rules.dinnerExclusions.some(ingredient => has(dish, ingredient))

/**
 * The words that make two dishes feel like the same dish on the same day.
 *
 * Accents are folded rather than stripped: the old version deleted them along
 * with every other non-ASCII character, so "calabacín" became "calabac" + "n"
 * and "jamón" became "jam" + "n". Eight dishes then shared a meaningless "n" and
 * could never be served together.
 *
 * Words of three letters or fewer are dropped, because "de", "con", "la" and "y"
 * are not what anybody means by repeating an ingredient — "de" alone appeared in
 * 20 of the 64 starter dishes and blocked most of their combinations.
 */
export const extractWords = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3)

const shuffleArray = <T>(array: T[]): T[] => {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const isWeekendDay = (date: Date): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6
}

const isDishCompatibleWithDay = (dish: DishIdea, weekend: boolean): boolean => {
  if (dish.day_type === 'anyday') return true
  if (dish.day_type === 'weekendday') return weekend
  return !weekend // weekday
}

const getDish = (map: Map<string, DishIdea>, name?: string): DishIdea | undefined =>
  name ? map.get(name) : undefined

const ingredientsOf = (dish?: DishIdea): Ingredient[] => dish?.main_ingredients ?? []

const getLunchIngredients = (map: Map<string, DishIdea>, menuItem?: MenuItem): Ingredient[] => {
  if (!menuItem) return []
  if (menuItem.single) return ingredientsOf(getDish(map, menuItem.single))
  return ingredientsOf(getDish(map, menuItem.main))
}

const buildDayWords = (_map: Map<string, DishIdea>, dayISO: string, items: MenuItem[]): Set<string> => {
  const words = new Set<string>()
  for (const item of items.filter(menuItem => menuItem.day === dayISO)) {
    if (item.starter) {
      extractWords(item.starter).forEach(word => words.add(word))
    }
    if (item.main) {
      extractWords(item.main).forEach(word => words.add(word))
    }
    if (item.single) {
      extractWords(item.single).forEach(word => words.add(word))
    }
  }
  return words
}

const computeFishDays = (map: Map<string, DishIdea>, items: MenuItem[]): Set<string> => {
  const fishDays = new Set<string>()
  for (const item of items) {
    if (item.meal_type === 'lunch') {
      if (getLunchIngredients(map, item).includes('fish')) {
        fishDays.add(item.day)
      }
    }
    if (item.meal_type === 'dinner') {
      if (has(getDish(map, item.main), 'fish')) {
        fishDays.add(item.day)
      }
    }
  }
  return fishDays
}

const hasWordOverlap = (words: Set<string>, text: string): boolean =>
  extractWords(text).some(word => words.has(word))

const validateMenu = (
  map: Map<string, DishIdea>,
  items: MenuItem[],
  rules: HouseholdRules,
): boolean => {
  const legumeCount = items
    .filter(item => item.meal_type === 'lunch')
    .filter(item => getLunchIngredients(map, item).includes('legume')).length

  // A MINIMUM, where this used to demand exactly one and reject a week with two.
  // That is what excluded households eating legumes several times a week.
  if (legumeCount < rules.legumeMinLunches) return false

  const fishDays = computeFishDays(map, items)
  if (fishDays.size < rules.fishMinDays) return false

  // Block C: pasta is a ceiling, counted per dish across the whole week, so a
  // lunch of soup and lasagna spends two of the household's allowance.
  const pastaCount = items
    .flatMap(item => [item.starter, item.main, item.single])
    .filter((name): name is string => Boolean(name))
    .filter(name => has(getDish(map, name), 'pasta')).length

  if (pastaCount > rules.pastaMaxPerWeek) return false

  const dayIsos = Array.from(new Set(items.map(item => item.day)))

  const usedNames = new Set<string>()
  for (const item of items) {
    const names: string[] = []
    if (item.starter) names.push(item.starter)
    if (item.main) names.push(item.main)
    if (item.single) names.push(item.single)
    for (const name of names) {
      if (usedNames.has(name)) return false
      usedNames.add(name)
    }
  }

  for (const dayISO of dayIsos) {
    const lunch = items.find(item => item.day === dayISO && item.meal_type === 'lunch')
    const dinner = items.find(item => item.day === dayISO && item.meal_type === 'dinner')
    if (!lunch || !dinner?.main) return false

    const hasSingle = Boolean(lunch.single)
    const hasCombo = Boolean(lunch.starter && lunch.main)
    if (!(hasSingle || hasCombo)) return false
    if (hasSingle && hasCombo) return false
    // Block A: the household may have asked for one shape or the other.
    if (rules.lunchStructure === 'single' && !hasSingle) return false
    if (rules.lunchStructure === 'courses' && !hasCombo) return false

    const dinnerStarter = dinner.starter ? getDish(map, dinner.starter) : undefined
    if (rules.dinnerCourses === 2 && !dinnerStarter) return false
    if (rules.dinnerCourses === 1 && dinner.starter) return false

    const dinnerDish = getDish(map, dinner.main)
    if (!dinnerDish || isExcludedAtDinner(rules, dinnerDish)) return false
    if (dinnerStarter && isExcludedAtDinner(rules, dinnerStarter)) return false

    if (
      requiresVegetableAtDinner(rules) &&
      !has(dinnerDish, 'vegetable') &&
      !has(dinnerStarter, 'vegetable')
    ) {
      return false
    }

    // The main course is what an ingredient rule reads, for dinner as for lunch:
    // "no repitas pasta" is about the dish that carries the meal, not about a
    // salad on the side.
    const lunchIngredients = getLunchIngredients(map, lunch)
    const dinnerIngredients = ingredientsOf(dinnerDish)
    if (repeatsWithinDay(rules, lunchIngredients, dinnerIngredients)) return false

    const words = buildDayWords(map, dayISO, items)
    const totalWords = [
      lunch.starter,
      lunch.main,
      lunch.single,
      dinner.starter,
      dinner.main,
    ].reduce((total, name) => total + (name ? extractWords(name).length : 0), 0)

    if (words.size !== totalWords) return false
  }

  return true
}

const pickLunch = (
  _map: Map<string, DishIdea>,
  dayISO: string,
  /**
   * This day was drawn to carry one of the household's required legume lunches.
   * Other days are free to serve legumes too: the rule is a minimum, so there is
   * no reason to keep them out elsewhere.
   */
  isLegumeDay: boolean,
  starters: DishIdea[],
  mains: DishIdea[],
  singles: DishIdea[],
  usedDishes: Set<string>,
  rules: HouseholdRules,
): { menuItem: MenuItem; ingredients: Ingredient[]; words: Set<string>; names: string[] } | null => {
  const options: Array<{
    menuItem: MenuItem
    ingredients: Ingredient[]
    words: Set<string>
    names: string[]
  }> = []

  // Block A. 'either' collects both shapes and lets the random pick below decide,
  // which is what the app has always done — and what serves neither interviewee:
  // one always eats a starter and a main, the other always a single dish.
  const allowsSingle = rules.lunchStructure !== 'courses'
  const allowsCourses = rules.lunchStructure !== 'single'

  for (const single of allowsSingle ? shuffleArray(singles) : []) {
    if (isLegumeDay && !has(single, 'legume')) continue
    if (usedDishes.has(single.name)) continue
    const words = new Set(extractWords(single.name))
    options.push({
      menuItem: { day: dayISO, meal_type: 'lunch', single: single.name },
      ingredients: ingredientsOf(single),
      words,
      names: [single.name],
    })
  }

  for (const mainDish of allowsCourses ? shuffleArray(mains) : []) {
    if (isLegumeDay && !has(mainDish, 'legume')) continue

    for (const starter of shuffleArray(starters)) {
      if (usedDishes.has(starter.name) || usedDishes.has(mainDish.name)) continue
      const starterWords = new Set(extractWords(starter.name))
      if (hasWordOverlap(starterWords, mainDish.name)) continue

      const combinedWords = new Set([...starterWords, ...extractWords(mainDish.name)])
      options.push({
        menuItem: {
          day: dayISO,
          meal_type: 'lunch',
          starter: starter.name,
          main: mainDish.name,
        },
        ingredients: ingredientsOf(mainDish),
        words: combinedWords,
        names: [starter.name, mainDish.name],
      })
      break
    }
  }

  if (isLegumeDay && options.every(option => !option.ingredients.includes('legume'))) {
    return null
  }

  return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null
}

/**
 * Block A: dinner is one dish or two, and when it is two the generator composes
 * it the way it composes lunch — a starter and a main.
 *
 * That is the part with teeth. Until now dinners were drawn only from `main`
 * dishes, so the vegetable dishes filed as starters were unreachable in the
 * evening; a household asking for vegetables at dinner would have been told its
 * catalogue was short while half of what it needed sat there unused.
 */
const pickDinner = (
  _map: Map<string, DishIdea>,
  dayISO: string,
  lunchIngredients: Ingredient[],
  existingWords: Set<string>,
  dinnerMains: DishIdea[],
  dinnerStarters: DishIdea[],
  usedDishes: Set<string>,
  rules: HouseholdRules,
): { menuItem: MenuItem; words: Set<string>; names: string[] } | null => {
  const needsVegetable = requiresVegetableAtDinner(rules)

  for (const main of shuffleArray(dinnerMains)) {
    if (isExcludedAtDinner(rules, main)) continue
    if (repeatsWithinDay(rules, lunchIngredients, ingredientsOf(main))) continue
    if (hasWordOverlap(existingWords, main.name)) continue
    if (usedDishes.has(main.name)) continue

    const mainWords = new Set(extractWords(main.name))

    if (rules.dinnerCourses === 1) {
      if (needsVegetable && !has(main, 'vegetable')) continue
      return {
        menuItem: { day: dayISO, meal_type: 'dinner', main: main.name },
        words: mainWords,
        names: [main.name],
      }
    }

    // The vegetable can come from either course, so a main that already brings
    // it frees the starter to be anything.
    const vegetableStillNeeded = needsVegetable && !has(main, 'vegetable')

    for (const starter of shuffleArray(dinnerStarters)) {
      if (usedDishes.has(starter.name)) continue
      if (starter.name === main.name) continue
      if (isExcludedAtDinner(rules, starter)) continue
      if (vegetableStillNeeded && !has(starter, 'vegetable')) continue
      if (hasWordOverlap(existingWords, starter.name)) continue
      if (hasWordOverlap(mainWords, starter.name)) continue

      return {
        menuItem: {
          day: dayISO,
          meal_type: 'dinner',
          starter: starter.name,
          main: main.name,
        },
        words: new Set([...mainWords, ...extractWords(starter.name)]),
        names: [starter.name, main.name],
      }
    }
  }

  return null
}

const ensureFishDays = (
  map: Map<string, DishIdea>,
  menuItems: MenuItem[],
  /** Days already carrying a required legume lunch; their lunch must not move. */
  legumeDayISOs: Set<string>,
  starters: DishIdea[],
  fishLunchOptions: DishIdea[],
  fishDinnerOptions: DishIdea[],
  usedDishes: Set<string>,
  weekendDays: Set<string>,
  rules: HouseholdRules,
): boolean => {
  const fishDays = computeFishDays(map, menuItems)
  if (fishDays.size >= rules.fishMinDays) return true

  const dayIsos = Array.from(new Set(menuItems.map(item => item.day))).filter(
    day => !fishDays.has(day),
  )

  const tryAddFishToDinner = (dayISO: string): boolean => {
    const lunchItem = menuItems.find(item => item.day === dayISO && item.meal_type === 'lunch')
    const dinnerIndex = menuItems.findIndex(item => item.day === dayISO && item.meal_type === 'dinner')
    if (!lunchItem || dinnerIndex === -1) return false

    const currentDinnerName = menuItems[dinnerIndex].main
    if (currentDinnerName) {
      usedDishes.delete(currentDinnerName)
    }

    const lunchIngredients = getLunchIngredients(map, lunchItem)
    const lunchWords = buildDayWords(map, dayISO, [lunchItem])
    const weekend = weekendDays.has(dayISO)

    for (const candidate of shuffleArray(fishDinnerOptions)) {
      if (!isDishCompatibleWithDay(candidate, weekend)) continue
      if (!has(candidate, 'fish')) continue
      // The swap has to respect the same rules as a first-pass pick, or the day
      // it repairs breaks a different rule and validateMenu throws the whole
      // week away.
      if (isExcludedAtDinner(rules, candidate)) continue
      if (repeatsWithinDay(rules, lunchIngredients, ingredientsOf(candidate))) continue
      if (hasWordOverlap(lunchWords, candidate.name)) continue
      if (usedDishes.has(candidate.name)) continue

      menuItems[dinnerIndex].main = candidate.name
      usedDishes.add(candidate.name)
      return true
    }

    if (currentDinnerName) {
      usedDishes.add(currentDinnerName)
    }

    return false
  }

  const tryAddFishToLunch = (dayISO: string): boolean => {
    // Replacing this lunch would drop a legume the week is counting on.
    if (legumeDayISOs.has(dayISO)) return false

    const lunchIndex = menuItems.findIndex(item => item.day === dayISO && item.meal_type === 'lunch')
    const dinnerItem = menuItems.find(item => item.day === dayISO && item.meal_type === 'dinner')
    if (lunchIndex === -1) return false

    const lunchItem = menuItems[lunchIndex]
    const originalLunchNames: string[] = []
    if (lunchItem.single) {
      originalLunchNames.push(lunchItem.single)
    } else {
      if (lunchItem.starter) originalLunchNames.push(lunchItem.starter)
      if (lunchItem.main) originalLunchNames.push(lunchItem.main)
    }
    originalLunchNames.forEach(name => usedDishes.delete(name))

    const dinnerWords = dinnerItem ? new Set(extractWords(dinnerItem.main ?? '')) : new Set<string>()
    const weekend = weekendDays.has(dayISO)
    const dayStarters = starters.filter(d => isDishCompatibleWithDay(d, weekend))

    for (const candidate of shuffleArray(fishLunchOptions)) {
      if (!isDishCompatibleWithDay(candidate, weekend)) continue
      if (!has(candidate, 'fish')) continue
      if (usedDishes.has(candidate.name)) continue

      if (candidate.category === 'single') {
        if (hasWordOverlap(dinnerWords, candidate.name)) continue
        menuItems[lunchIndex] = { day: dayISO, meal_type: 'lunch', single: candidate.name }
        usedDishes.add(candidate.name)
        return true
      }

      if (candidate.category === 'main') {
        const currentStarter = lunchItem.starter ? getDish(map, lunchItem.starter) : undefined
        if (currentStarter && lunchItem.main) {
          if (usedDishes.has(candidate.name)) continue
          const starterWords = new Set(extractWords(currentStarter.name))
          if (!hasWordOverlap(starterWords, candidate.name) && !hasWordOverlap(dinnerWords, candidate.name)) {
            menuItems[lunchIndex] = {
              day: dayISO,
              meal_type: 'lunch',
              starter: currentStarter.name,
              main: candidate.name,
            }
            usedDishes.add(currentStarter.name)
            usedDishes.add(candidate.name)
            return true
          }
        }

        for (const starter of shuffleArray(dayStarters)) {
          if (usedDishes.has(starter.name) || usedDishes.has(candidate.name)) continue
          const starterWords = new Set(extractWords(starter.name))
          if (hasWordOverlap(starterWords, candidate.name)) continue
          if (hasWordOverlap(dinnerWords, candidate.name)) continue
          menuItems[lunchIndex] = {
            day: dayISO,
            meal_type: 'lunch',
            starter: starter.name,
            main: candidate.name,
          }
          usedDishes.add(starter.name)
          usedDishes.add(candidate.name)
          return true
        }
      }
    }

    originalLunchNames.forEach(name => usedDishes.add(name))
    return false
  }

  for (const dayISO of dayIsos) {
    if (tryAddFishToDinner(dayISO) || tryAddFishToLunch(dayISO)) {
      if (computeFishDays(map, menuItems).size >= rules.fishMinDays) {
        return true
      }
    }
  }

  return computeFishDays(map, menuItems).size >= rules.fishMinDays
}

const generateBasicMenu = (
  dishIdeas: DishIdea[],
  weekStart: Date,
  rules: HouseholdRules,
): MenuItem[] => {
  const used = new Set<string>()
  const menuItems: MenuItem[] = []

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + dayIndex)
    const dayISO = formatLocalDate(date)
    const weekend = isWeekendDay(date)
    const dayDishes = dishIdeas.filter(d => isDishCompatibleWithDay(d, weekend))

    const starters = dayDishes.filter(d => d.category === 'starter')
    const mains = dayDishes.filter(d => d.category === 'main')
    const singleCourses = dayDishes.filter(d => d.category === 'single')
    const dinnerMains = mains.filter(d => !isExcludedAtDinner(rules, d))

    const useSingle = singleCourses.length > 0 && Math.random() < 0.5
    if (useSingle) {
      const singleCandidates = shuffleArray(singleCourses.filter(d => !used.has(d.name)))
      const single = (singleCandidates[0] ?? shuffleArray(singleCourses)[0]) ?? null
      menuItems.push({ day: dayISO, meal_type: 'lunch', single: single?.name })
      if (single?.name) used.add(single.name)
    } else {
      const starterCandidates = shuffleArray(starters.filter(d => !used.has(d.name)))
      const starter = (starterCandidates[0] ?? shuffleArray(starters)[0]) ?? null
      const mainCandidates = shuffleArray(mains.filter(d => !used.has(d.name)))
      const main = (mainCandidates[0] ?? shuffleArray(mains)[0]) ?? null
      menuItems.push({ day: dayISO, meal_type: 'lunch', starter: starter?.name, main: main?.name })
      if (starter?.name) used.add(starter.name)
      if (main?.name) used.add(main.name)
    }

    const dinnerCandidates = shuffleArray(dinnerMains.filter(d => !used.has(d.name)))
    const dinnerMain = (dinnerCandidates[0] ?? shuffleArray(dinnerMains)[0] ?? shuffleArray(mains)[0]) ?? null
    menuItems.push({ day: dayISO, meal_type: 'dinner', main: dinnerMain?.name })
    if (dinnerMain?.name) used.add(dinnerMain.name)
  }

  return menuItems
}

export function generateWeeklyMenu({
  dishIdeas,
  weekStart,
  rules = DEFAULT_RULES,
}: MenuGenerationOptions): MenuGenerationResult {
  const degrade = (reason: string): MenuGenerationResult => {
    console.warn(`${reason} Returning basic menu.`)
    return {
      items: generateBasicMenu(dishIdeas, weekStart, rules),
      degraded: true,
      unmet: getUnmetRequirements(dishIdeas, rules),
    }
  }

  const dishMap = new Map<string, DishIdea>(dishIdeas.map(dish => [dish.name, dish]))

  // Pre-compute which ISO dates fall on weekends for the 7-day window
  const weekendDays = new Set<string>()
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    if (isWeekendDay(date)) weekendDays.add(formatLocalDate(date))
  }

  // All-dish pools (unfiltered by day type) — day-specific filtering happens per iteration
  const allStarters = dishIdeas.filter(d => d.category === 'starter' && (d.meal_type === 'lunch' || d.meal_type === 'both'))
  const allMains = dishIdeas.filter(d => d.category === 'main' && (d.meal_type === 'lunch' || d.meal_type === 'both'))
  const allSingleCourses = dishIdeas.filter(d => d.category === 'single' && (d.meal_type === 'lunch' || d.meal_type === 'both'))
  const allDinnerMains = dishIdeas.filter(
    d =>
      d.category === 'main' &&
      (d.meal_type === 'dinner' || d.meal_type === 'both') &&
      !isExcludedAtDinner(rules, d),
  )
  // Only consulted for two-course dinners. This is the pool the app never used:
  // starters flagged for dinner, which is where most vegetable dishes live.
  const allDinnerStarters = dishIdeas.filter(
    d =>
      d.category === 'starter' &&
      (d.meal_type === 'dinner' || d.meal_type === 'both') &&
      !isExcludedAtDinner(rules, d),
  )

  if (rules.dinnerCourses === 2 && allDinnerStarters.length === 0) {
    return degrade('Two-course dinners were asked for, but no starter is available at dinner.')
  }

  if (allDinnerMains.length === 0) {
    return degrade("No dinner mains available for this household's exclusions.")
  }

  if (rules.fishMinDays > 0 && !dishIdeas.some(d => has(d, 'fish'))) {
    return degrade('No fish dishes available.')
  }

  // Deliberately NOT clamped to what the catalogue can supply. Asking for three
  // legume lunches with two legume dishes is unsatisfiable, and clamping would
  // quietly hand back a week with two as if the rule had been met. Today it
  // exhausts the attempts and falls back; M2b is what turns that into a message
  // naming the rule that could not be kept.
  const legumeDaysNeeded = Math.min(rules.legumeMinLunches, 7)

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const menuItems: MenuItem[] = []
    const usedDishes = new Set<string>()
    // Which days carry the required legume lunches. Redrawn every attempt, so a
    // draw that lands on a day with no compatible legume dish — Cocido and
    // Lentejas are often weekday-only — is retried rather than fatal.
    const legumeDayIndices = new Set(
      shuffleArray([0, 1, 2, 3, 4, 5, 6]).slice(0, legumeDaysNeeded),
    )
    const legumeDayISOs = new Set<string>()
    let success = true

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + dayIndex)
      const dayISO = formatLocalDate(date)
      const weekend = weekendDays.has(dayISO)
      const isLegumeDay = legumeDayIndices.has(dayIndex)

      // Filter dish pools to only those compatible with this day's weekday/weekend type
      const dayStarters = allStarters.filter(d => isDishCompatibleWithDay(d, weekend))
      const dayMains = allMains.filter(d => isDishCompatibleWithDay(d, weekend))
      const daySingleCourses = allSingleCourses.filter(d => isDishCompatibleWithDay(d, weekend))
      const dayDinnerMains = allDinnerMains.filter(d => isDishCompatibleWithDay(d, weekend))
      const dayDinnerStarters = allDinnerStarters.filter(d => isDishCompatibleWithDay(d, weekend))

      const lunchChoice = pickLunch(
        dishMap,
        dayISO,
        isLegumeDay,
        dayStarters,
        dayMains,
        daySingleCourses,
        usedDishes,
        rules,
      )

      if (!lunchChoice) {
        success = false
        break
      }

      menuItems.push(lunchChoice.menuItem)
      lunchChoice.names.forEach(name => usedDishes.add(name))

      if (lunchChoice.ingredients.includes('legume')) {
        legumeDayISOs.add(dayISO)
      }

      const dinnerChoice = pickDinner(
        dishMap,
        dayISO,
        lunchChoice.ingredients,
        new Set(lunchChoice.words),
        dayDinnerMains,
        dayDinnerStarters,
        usedDishes,
        rules,
      )

      if (!dinnerChoice) {
        success = false
        break
      }

      menuItems.push(dinnerChoice.menuItem)
      dinnerChoice.names.forEach(name => usedDishes.add(name))
    }

    if (!success) {
      continue
    }

    if (legumeDayISOs.size < legumeDaysNeeded) {
      continue
    }

    const fishLunchOptions = dishIdeas.filter(
      d =>
        has(d, 'fish') &&
        (d.meal_type === 'lunch' || d.meal_type === 'both') &&
        (d.category === 'single' || d.category === 'main'),
    )
    const fishDinnerOptions = allDinnerMains.filter(d => has(d, 'fish'))

    if (
      !ensureFishDays(
        dishMap,
        menuItems,
        legumeDayISOs,
        allStarters,
        fishLunchOptions,
        fishDinnerOptions,
        usedDishes,
        weekendDays,
        rules,
      )
    ) {
      continue
    }

    if (!validateMenu(dishMap, menuItems, rules)) {
      continue
    }

    console.log(`✅ Weekly menu generated after ${attempt + 1} attempt(s)`)
    return { items: menuItems, degraded: false, unmet: [] }
  }

  return degrade(`Unable to satisfy all constraints after ${MAX_ATTEMPTS} attempts.`)
}

/**
 * Formats a date to display as day name. Indexed by `getDay()`, so it is
 * independent of which weekday opens the week.
 */
export function formatDayName(date: string): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const day = new Date(date).getDay()
  return days[day]
}

/**
 * Formats a date to display as short date
 */
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}


