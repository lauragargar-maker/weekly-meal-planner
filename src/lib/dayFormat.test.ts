import { describe, expect, it } from 'vitest'
import { DishIdea, Ingredient, MenuItem } from '../types'
import {
  addFirstCourse,
  coursesOf,
  eligibleDishesFor,
  formatControlFor,
  removeFirstCourse,
  replaceCourse,
  ruleWarningFor,
} from './dayFormat'
import { DEFAULT_RULES, HouseholdRules } from './householdRules'

const lunch = (fields: Partial<MenuItem>): MenuItem => ({
  day: '2026-08-21',
  meal_type: 'lunch',
  ...fields,
})

const dinner = (fields: Partial<MenuItem>): MenuItem => ({
  day: '2026-08-21',
  meal_type: 'dinner',
  ...fields,
})

const dish = (name: string, ingredients: Ingredient[]): DishIdea => ({
  id: name,
  household_id: 'h',
  name,
  category: 'main',
  meal_type: 'both',
  day_type: 'anyday',
  main_ingredients: ingredients,
  created_at: '',
  updated_at: '',
})

const tagged = (name: string, tags: Partial<DishIdea>): DishIdea => ({
  ...dish(name, []),
  ...tags,
})

const rules = (overrides: Partial<HouseholdRules> = {}): HouseholdRules => ({
  ...DEFAULT_RULES,
  ...overrides,
})

const FRIDAY = '2026-08-21'
const SATURDAY = '2026-08-22'

describe('coursesOf', () => {
  it('reads a one-dish lunch as a single main course', () => {
    expect(coursesOf(lunch({ single: 'Cocido' }))).toEqual([
      { slot: 'single', dish: 'Cocido', role: 'Plato principal' },
    ])
  })

  it('orders a two-course meal first, second', () => {
    expect(coursesOf(dinner({ starter: 'Crema de calabacín', main: 'Tortilla francesa' }))).toEqual([
      { slot: 'starter', dish: 'Crema de calabacín', role: 'Primero' },
      { slot: 'main', dish: 'Tortilla francesa', role: 'Segundo' },
    ])
  })

  it('treats a lone main as the dish of the meal, not as a second course', () => {
    // Every dinner of a one-course household is stored like this, and so is a
    // lunch that has just had its first course removed.
    expect(coursesOf(dinner({ main: 'Sopa de fideos' }))).toEqual([
      { slot: 'main', dish: 'Sopa de fideos', role: 'Plato principal' },
    ])
  })

  it('survives a meal with no dish at all', () => {
    // The basic fallback menu can leave one behind when the catalogue is thin.
    expect(coursesOf(dinner({}))).toEqual([])
    expect(coursesOf(null)).toEqual([])
  })
})

describe('formatControlFor', () => {
  it('offers adding when there is one course and removing when there are two', () => {
    expect(formatControlFor(lunch({ single: 'Cocido' }))).toBe('add')
    expect(formatControlFor(lunch({ starter: 'Puré', main: 'Cocido' }))).toBe('remove')
  })

  it('offers neither on a meal with no dish', () => {
    expect(formatControlFor(dinner({}))).toBeNull()
  })
})

describe('addFirstCourse', () => {
  it('pushes the dish that was there down to second', () => {
    expect(addFirstCourse(lunch({ single: 'Cocido' }), 'Puré de verduras')).toEqual(
      lunch({ starter: 'Puré de verduras', main: 'Cocido', single: undefined })
    )
  })

  it('moves the existing dish out of `single` so the rules still see it', () => {
    // `single` alongside a starter would hide the main course from every
    // ingredient rule, which reads `single ?? main`.
    const result = addFirstCourse(lunch({ single: 'Cocido' }), 'Puré de verduras')
    expect(result.single).toBeUndefined()
    expect(result.main).toBe('Cocido')
  })

  it('works on a dinner, which never uses `single`', () => {
    expect(addFirstCourse(dinner({ main: 'Tortilla francesa' }), 'Crema de calabacín')).toEqual(
      dinner({ starter: 'Crema de calabacín', main: 'Tortilla francesa', single: undefined })
    )
  })

  it('leaves the day and meal untouched', () => {
    const result = addFirstCourse(lunch({ single: 'Cocido' }), 'Puré')
    expect(result.day).toBe('2026-08-21')
    expect(result.meal_type).toBe('lunch')
  })

  it('does nothing to a meal that already has two courses', () => {
    const item = lunch({ starter: 'Puré', main: 'Cocido' })
    expect(addFirstCourse(item, 'Ensalada')).toBe(item)
  })

  it('does nothing to a meal with no dish', () => {
    const item = dinner({})
    expect(addFirstCourse(item, 'Ensalada')).toBe(item)
  })
})

describe('removeFirstCourse', () => {
  it('drops the first course and keeps the second', () => {
    expect(removeFirstCourse(lunch({ starter: 'Puré', main: 'Cocido' }))).toEqual(
      lunch({ starter: undefined, main: 'Cocido', single: undefined })
    )
  })

  it('does nothing to a meal that only has one course', () => {
    const item = lunch({ single: 'Cocido' })
    expect(removeFirstCourse(item)).toBe(item)
  })

  it('gives back the same dishes after adding and removing, in `main`', () => {
    // Deliberately not the exact inverse: a lunch that started as `single`
    // comes back as `main`. Both mean "the main course" to the rules and to the
    // day sheet, and rewriting the field would only add a way to get it wrong.
    const original = lunch({ single: 'Cocido' })
    const roundTrip = removeFirstCourse(addFirstCourse(original, 'Puré de verduras'))
    expect(coursesOf(roundTrip)).toEqual([
      { slot: 'main', dish: 'Cocido', role: 'Plato principal' },
    ])
    expect(formatControlFor(roundTrip)).toBe('add')
  })
})

describe('replaceCourse', () => {
  it('swaps the dish without touching the format', () => {
    const item = lunch({ starter: 'Puré', main: 'Cocido' })
    expect(replaceCourse(item, 'starter', 'Ensalada de tomate')).toEqual(
      lunch({ starter: 'Ensalada de tomate', main: 'Cocido' })
    )
  })

  it('never invents a second dish, whatever is chosen', () => {
    // The old editor added a random starter when a `main`-category dish was
    // chosen for a one-dish lunch. Nothing regenerates itself any more.
    const result = replaceCourse(lunch({ single: 'Cocido' }), 'single', 'Paella')
    expect(coursesOf(result)).toHaveLength(1)
    expect(result.starter).toBeUndefined()
  })
})

describe('eligibleDishesFor', () => {
  it('keeps a dish tagged for that meal, and one tagged for both', () => {
    const dishes = [
      tagged('Merluza', { meal_type: 'dinner' }),
      tagged('Cocido', { meal_type: 'lunch' }),
      tagged('Ensalada', { meal_type: 'both' }),
    ]
    expect(eligibleDishesFor(dishes, 'dinner', FRIDAY).map(d => d.name)).toEqual([
      'Merluza',
      'Ensalada',
    ])
  })

  it('respects the weekday / weekend tag in both directions', () => {
    const dishes = [
      tagged('Paella', { day_type: 'weekendday' }),
      tagged('Pasta rápida', { day_type: 'weekday' }),
      tagged('Tortilla', { day_type: 'anyday' }),
    ]
    expect(eligibleDishesFor(dishes, 'lunch', FRIDAY).map(d => d.name)).toEqual([
      'Pasta rápida',
      'Tortilla',
    ])
    expect(eligibleDishesFor(dishes, 'lunch', SATURDAY).map(d => d.name)).toEqual([
      'Paella',
      'Tortilla',
    ])
  })

  it('offers every course, because the category filter is gone', () => {
    // A soup filed as a starter can still be the whole dinner: §4 leaves only
    // the ingredient chips.
    const dishes = [
      tagged('Crema de calabacín', { category: 'starter' }),
      tagged('Pollo asado', { category: 'main' }),
      tagged('Cocido', { category: 'single' }),
    ]
    expect(eligibleDishesFor(dishes, 'dinner', FRIDAY)).toHaveLength(3)
  })

  it('still offers a dish the house rules argue against', () => {
    // The rules warn (`ruleWarningFor`); they no longer hide. The old editor
    // dropped every pasta main at dinner and left no way to choose it.
    const dishes = [tagged('Macarrones', { main_ingredients: ['pasta'] })]
    expect(eligibleDishesFor(dishes, 'dinner', FRIDAY)).toHaveLength(1)
  })
})

const noContext = { otherMealIngredients: [], siblingCourseIngredients: [] }

describe('ruleWarningFor', () => {
  it('names the household exclusion at dinner', () => {
    expect(
      ruleWarningFor(dish('Macarrones', ['pasta']), rules(), { mealType: 'dinner', ...noContext })
    ).toBe('tu regla: nada de pasta por la noche')
  })

  it('says nothing about that same dish at lunch', () => {
    expect(
      ruleWarningFor(dish('Macarrones', ['pasta']), rules(), { mealType: 'lunch', ...noContext })
    ).toBeNull()
  })

  it('warns when the dish repeats the other meal on the same axis', () => {
    expect(
      ruleWarningFor(dish('Merluza al horno', ['fish']), rules(), {
        mealType: 'dinner',
        otherMealIngredients: ['fish'],
        siblingCourseIngredients: [],
      })
    ).toBe('tu regla: no repetir pescado el mismo día')
  })

  it('stays quiet when the repeat is on an axis the household turned off', () => {
    expect(
      ruleWarningFor(dish('Merluza al horno', ['fish']), rules({ noRepeatProtein: false }), {
        mealType: 'dinner',
        otherMealIngredients: ['fish'],
        siblingCourseIngredients: [],
      })
    ).toBeNull()
  })

  it('does not read two proteins as a repeat: the axis is the ingredient', () => {
    // "Don't repeat the protein group" means meat then meat, not protein then
    // protein — collapsing them would fire on almost every day.
    expect(
      ruleWarningFor(dish('Pollo asado', ['meat']), rules(), {
        mealType: 'dinner',
        otherMealIngredients: ['fish'],
        siblingCourseIngredients: [],
      })
    ).toBeNull()
  })

  it('asks for vegetables only when neither dinner course brings any', () => {
    const vegetableRules = rules({ dinnerCourses: 2, vegetableEveryDinner: true })
    expect(
      ruleWarningFor(dish('Tortilla francesa', ['egg']), vegetableRules, {
        mealType: 'dinner',
        otherMealIngredients: [],
        siblingCourseIngredients: ['vegetable'],
      })
    ).toBeNull()
    expect(
      ruleWarningFor(dish('Tortilla francesa', ['egg']), vegetableRules, {
        mealType: 'dinner',
        otherMealIngredients: [],
        siblingCourseIngredients: [],
      })
    ).toBe('tu regla: verdura en todas las cenas')
  })

  it('ignores the vegetable rule when dinner is a single course', () => {
    // Stored state can still say true from a household that switched back.
    expect(
      ruleWarningFor(dish('Tortilla francesa', ['egg']), rules({ vegetableEveryDinner: true }), {
        mealType: 'dinner',
        ...noContext,
      })
    ).toBeNull()
  })

  it('shows one note at a time, the exclusion first', () => {
    expect(
      ruleWarningFor(dish('Espaguetis carbonara', ['pasta', 'meat']), rules(), {
        mealType: 'dinner',
        otherMealIngredients: ['meat'],
        siblingCourseIngredients: [],
      })
    ).toBe('tu regla: nada de pasta por la noche')
  })

  it('says nothing about a dish that breaks no rule', () => {
    expect(
      ruleWarningFor(dish('Crema de calabacín', ['vegetable']), rules(), {
        mealType: 'dinner',
        otherMealIngredients: ['meat'],
        siblingCourseIngredients: [],
      })
    ).toBeNull()
  })

  it('says nothing about an unlabelled dish, as every other rule does', () => {
    expect(
      ruleWarningFor(dish('Sobras', []), rules(), {
        mealType: 'dinner',
        otherMealIngredients: ['pasta'],
        siblingCourseIngredients: [],
      })
    ).toBeNull()
  })
})
