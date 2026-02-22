import { DishIdea, MenuItem } from '../types'

interface MenuGenerationOptions {
  dishIdeas: DishIdea[]
  weekStart: Date
}

type Ingredient = DishIdea['main_ingredient']

const MAX_ATTEMPTS = 200

const extractWords = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

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

const getDish = (map: Map<string, DishIdea>, name?: string): DishIdea | undefined =>
  name ? map.get(name) : undefined

const getLunchIngredient = (map: Map<string, DishIdea>, menuItem?: MenuItem): Ingredient => {
  if (!menuItem) return undefined
  if (menuItem.single) return getDish(map, menuItem.single)?.main_ingredient
  return getDish(map, menuItem.main)?.main_ingredient
}

const buildDayWords = (map: Map<string, DishIdea>, dayISO: string, items: MenuItem[]): Set<string> => {
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
      const ingredient = getLunchIngredient(map, item)
      if (ingredient === 'fish') {
        fishDays.add(item.day)
      }
    }
    if (item.meal_type === 'dinner') {
      if (getDish(map, item.main)?.main_ingredient === 'fish') {
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
  requiresLegumeLunch: boolean,
): boolean => {
  const legumeCount = items
    .filter(item => item.meal_type === 'lunch')
    .filter(item => getLunchIngredient(map, item) === 'legume').length

  if (requiresLegumeLunch && legumeCount !== 1) return false

  const fishDays = computeFishDays(map, items)
  if (fishDays.size < 2) return false

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

    const dinnerDish = getDish(map, dinner.main)
    if (!dinnerDish || dinnerDish.main_ingredient === 'pasta') return false

    const lunchIngredient = getLunchIngredient(map, lunch)
    const dinnerIngredient = dinnerDish.main_ingredient

    if (lunchIngredient === 'fish' && dinnerIngredient === 'fish') return false
    if (lunchIngredient === 'egg' && dinnerIngredient === 'egg') return false

    const words = buildDayWords(map, dayISO, items)
    const totalWords =
      (lunch.starter ? extractWords(lunch.starter).length : 0) +
      (lunch.main ? extractWords(lunch.main).length : 0) +
      (lunch.single ? extractWords(lunch.single).length : 0) +
      extractWords(dinner.main).length

    if (words.size !== totalWords) return false
  }

  return true
}

const pickLunch = (
  map: Map<string, DishIdea>,
  dayISO: string,
  isLegumeDay: boolean,
  legumeRequired: boolean,
  starters: DishIdea[],
  mains: DishIdea[],
  singles: DishIdea[],
  usedDishes: Set<string>,
): { menuItem: MenuItem; ingredient: Ingredient; words: Set<string>; names: string[] } | null => {
  const options: Array<{
    menuItem: MenuItem
    ingredient: Ingredient
    words: Set<string>
    names: string[]
  }> = []

  for (const single of shuffleArray(singles)) {
    const isLegume = single.main_ingredient === 'legume'
    if (isLegumeDay) {
      if (!isLegume) continue
    } else if (legumeRequired && isLegume) {
      continue
    }
    if (usedDishes.has(single.name)) continue
    const words = new Set(extractWords(single.name))
    options.push({
      menuItem: { day: dayISO, meal_type: 'lunch', single: single.name },
      ingredient: single.main_ingredient,
      words,
      names: [single.name],
    })
  }

  for (const mainDish of shuffleArray(mains)) {
    const isLegume = mainDish.main_ingredient === 'legume'
    if (isLegumeDay) {
      if (!isLegume) continue
    } else if (legumeRequired && isLegume) {
      continue
    }

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
        ingredient: mainDish.main_ingredient,
        words: combinedWords,
        names: [starter.name, mainDish.name],
      })
      break
    }
  }

  if (isLegumeDay && options.every(option => option.ingredient !== 'legume')) {
    return null
  }

  return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null
}

const pickDinner = (
  map: Map<string, DishIdea>,
  dayISO: string,
  lunchIngredient: Ingredient,
  existingWords: Set<string>,
  dinnerMains: DishIdea[],
  usedDishes: Set<string>,
): { menuItem: MenuItem; words: Set<string>; name: string } | null => {
  for (const candidate of shuffleArray(dinnerMains)) {
    if (candidate.main_ingredient === 'pasta') continue
    if (lunchIngredient === 'fish' && candidate.main_ingredient === 'fish') continue
    if (lunchIngredient === 'egg' && candidate.main_ingredient === 'egg') continue
    if (hasWordOverlap(existingWords, candidate.name)) continue
    if (usedDishes.has(candidate.name)) continue

    const words = new Set(extractWords(candidate.name))
    return {
      menuItem: {
        day: dayISO,
        meal_type: 'dinner',
        main: candidate.name,
      },
      words,
      name: candidate.name,
    }
  }

  return null
}

const ensureFishDays = (
  map: Map<string, DishIdea>,
  menuItems: MenuItem[],
  legumeDayISO: string | null,
  starters: DishIdea[],
  fishLunchOptions: DishIdea[],
  fishDinnerOptions: DishIdea[],
  usedDishes: Set<string>,
): boolean => {
  const fishDays = computeFishDays(map, menuItems)
  if (fishDays.size >= 2) return true

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

    const lunchIngredient = getLunchIngredient(map, lunchItem)
    const lunchWords = buildDayWords(map, dayISO, [lunchItem])

    for (const candidate of shuffleArray(fishDinnerOptions)) {
      if (candidate.main_ingredient !== 'fish') continue
      if (lunchIngredient === 'fish') continue
      if (lunchIngredient === 'egg' && candidate.main_ingredient === 'egg') continue
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
    if (legumeDayISO && legumeDayISO === dayISO) return false

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

    for (const candidate of shuffleArray(fishLunchOptions)) {
      if (candidate.main_ingredient !== 'fish') continue
      if (usedDishes.has(candidate.name)) continue

      if (candidate.category === 'single') {
        if (hasWordOverlap(dinnerWords, candidate.name)) continue
        menuItems[lunchIndex] = {
          day: dayISO,
          meal_type: 'lunch',
          single: candidate.name,
        }
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

        for (const starter of shuffleArray(starters)) {
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
      const updatedFishDays = computeFishDays(map, menuItems)
      if (updatedFishDays.size >= 2) {
        return true
      }
    }
  }

  return computeFishDays(map, menuItems).size >= 2
}

const generateBasicMenu = (dishIdeas: DishIdea[], weekStart: Date): MenuItem[] => {
  const starters = dishIdeas.filter(d => d.category === 'starter')
  const mains = dishIdeas.filter(d => d.category === 'main')
  const singleCourses = dishIdeas.filter(d => d.category === 'single')
  const dinnerMains = mains.filter(d => d.main_ingredient !== 'pasta')
  const used = new Set<string>()

  const menuItems: MenuItem[] = []
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + dayIndex)
    const dayISO = formatLocalDate(date)

    const useSingle = singleCourses.length > 0 && Math.random() < 0.5
    if (useSingle) {
      const singleCandidates = shuffleArray(singleCourses.filter(d => !used.has(d.name)))
      const single = (singleCandidates[0] ?? shuffleArray(singleCourses)[0]) ?? null
      menuItems.push({
        day: dayISO,
        meal_type: 'lunch',
        single: single?.name,
      })
      if (single?.name) used.add(single.name)
    } else {
      const starterCandidates = shuffleArray(starters.filter(d => !used.has(d.name)))
      const starter = (starterCandidates[0] ?? shuffleArray(starters)[0]) ?? null
      const mainCandidates = shuffleArray(mains.filter(d => !used.has(d.name)))
      const main = (mainCandidates[0] ?? shuffleArray(mains)[0]) ?? null
      menuItems.push({
        day: dayISO,
        meal_type: 'lunch',
        starter: starter?.name,
        main: main?.name,
      })
      if (starter?.name) used.add(starter.name)
      if (main?.name) used.add(main.name)
    }

    const dinnerCandidates = shuffleArray(dinnerMains.filter(d => !used.has(d.name)))
    const dinnerMain = (dinnerCandidates[0] ?? shuffleArray(dinnerMains)[0] ?? shuffleArray(mains)[0]) ?? null
    menuItems.push({
      day: dayISO,
      meal_type: 'dinner',
      main: dinnerMain?.name,
    })
    if (dinnerMain?.name) used.add(dinnerMain.name)
  }

  return menuItems
}

export function generateWeeklyMenu({ dishIdeas, weekStart }: MenuGenerationOptions): MenuItem[] {
  const dishMap = new Map<string, DishIdea>(dishIdeas.map(dish => [dish.name, dish]))

  const starters = dishIdeas.filter(d => d.category === 'starter' && (d.meal_type === 'lunch' || d.meal_type === 'both'))
  const mains = dishIdeas.filter(d => d.category === 'main' && (d.meal_type === 'lunch' || d.meal_type === 'both'))
  const singleCourses = dishIdeas.filter(d => d.category === 'single' && (d.meal_type === 'lunch' || d.meal_type === 'both'))
  const dinnerMains = dishIdeas.filter(
    d => d.category === 'main' && (d.meal_type === 'dinner' || d.meal_type === 'both') && d.main_ingredient !== 'pasta',
  )

  const legumeLunchAvailable =
    [...singleCourses, ...mains].some(d => d.main_ingredient === 'legume')

  if (dinnerMains.length === 0) {
    console.warn('No dinner mains available (without pasta). Returning basic menu.')
    return generateBasicMenu(dishIdeas, weekStart)
  }

  if (!dishIdeas.some(d => d.main_ingredient === 'fish')) {
    console.warn('No fish dishes available. Returning basic menu.')
    return generateBasicMenu(dishIdeas, weekStart)
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const menuItems: MenuItem[] = []
    const usedDishes = new Set<string>()
    const legumeDayIndex = legumeLunchAvailable ? Math.floor(Math.random() * 7) : null
    let legumeDayISO: string | null = null
    let success = true

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + dayIndex)
      const dayISO = formatLocalDate(date)
      const isLegumeDay = legumeDayIndex === dayIndex

      const lunchChoice = pickLunch(
        dishMap,
        dayISO,
        Boolean(isLegumeDay),
        Boolean(legumeLunchAvailable),
        starters,
        mains,
        singleCourses,
        usedDishes,
      )

      if (!lunchChoice) {
        success = false
        break
      }

      menuItems.push(lunchChoice.menuItem)
      lunchChoice.names.forEach(name => usedDishes.add(name))

      if (lunchChoice.ingredient === 'legume') {
        legumeDayISO = dayISO
      }

      const dinnerChoice = pickDinner(
        dishMap,
        dayISO,
        lunchChoice.ingredient,
        new Set(lunchChoice.words),
        dinnerMains,
        usedDishes,
      )

      if (!dinnerChoice) {
        success = false
        break
      }

      menuItems.push(dinnerChoice.menuItem)
      usedDishes.add(dinnerChoice.name)
    }

    if (!success) {
      continue
    }

    if (legumeLunchAvailable && !legumeDayISO) {
      continue
    }
    const fishLunchOptions = dishIdeas.filter(
      d =>
        d.main_ingredient === 'fish' &&
        (d.meal_type === 'lunch' || d.meal_type === 'both') &&
        (d.category === 'single' || d.category === 'main'),
    )
    const fishDinnerOptions = dinnerMains.filter(d => d.main_ingredient === 'fish')

    if (
      !ensureFishDays(
        dishMap,
        menuItems,
        legumeDayISO,
        starters,
        fishLunchOptions,
        fishDinnerOptions,
        usedDishes,
      )
    ) {
      continue
    }

    if (!validateMenu(dishMap, menuItems, Boolean(legumeLunchAvailable))) {
      continue
    }

    console.log(`✅ Weekly menu generated after ${attempt + 1} attempt(s)`)
    return menuItems
  }

  console.warn('Unable to satisfy all constraints. Returning basic menu.')
  return generateBasicMenu(dishIdeas, weekStart)
}

/**
 * Formats a date to display as day name
 * Week starts on Saturday (day 6)
 */
export function formatDayName(date: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const day = new Date(date).getDay()
  return days[day]
}

/**
 * Formats a date to display as short date
 */
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}


