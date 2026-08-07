import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES, parseRules, requiresVegetableAtDinner } from './householdRules'

/**
 * The column is JSONB with no constraints, so this is the only thing standing
 * between whatever is stored and the generator.
 */
describe('parseRules', () => {
  it('treats an empty object as a household on defaults', () => {
    expect(parseRules({})).toEqual(DEFAULT_RULES)
  })

  it('survives null, undefined and outright junk', () => {
    expect(parseRules(null)).toEqual(DEFAULT_RULES)
    expect(parseRules(undefined)).toEqual(DEFAULT_RULES)
    expect(parseRules('nonsense')).toEqual(DEFAULT_RULES)
    expect(parseRules(42)).toEqual(DEFAULT_RULES)
  })

  it('falls back field by field, so a rule added later reaches old rows', () => {
    // The reason there is no backfill migration: a household stored before
    // `pastaMaxPerWeek` existed must come back complete, not half-built.
    const stored = { fishMinDays: 5 }
    expect(parseRules(stored)).toEqual({ ...DEFAULT_RULES, fishMinDays: 5 })
  })

  it('clamps steppers into 0-7 instead of trusting what is stored', () => {
    expect(parseRules({ fishMinDays: 99 }).fishMinDays).toBe(7)
    expect(parseRules({ legumeMinLunches: -3 }).legumeMinLunches).toBe(0)
    expect(parseRules({ pastaMaxPerWeek: 2.6 }).pastaMaxPerWeek).toBe(3)
  })

  it('rejects stepper values that are not usable numbers', () => {
    expect(parseRules({ fishMinDays: 'dos' }).fishMinDays).toBe(DEFAULT_RULES.fishMinDays)
    expect(parseRules({ fishMinDays: NaN }).fishMinDays).toBe(DEFAULT_RULES.fishMinDays)
    expect(parseRules({ fishMinDays: Infinity }).fishMinDays).toBe(DEFAULT_RULES.fishMinDays)
  })

  it('keeps only ingredients it recognises in the dinner exclusions', () => {
    expect(parseRules({ dinnerExclusions: ['pasta', 'unicornio', 'meat'] }).dinnerExclusions).toEqual([
      'pasta',
      'meat',
    ])
    expect(parseRules({ dinnerExclusions: [] }).dinnerExclusions).toEqual([])
    expect(parseRules({ dinnerExclusions: 'pasta' }).dinnerExclusions).toEqual(
      DEFAULT_RULES.dinnerExclusions
    )
  })

  it('only accepts the three lunch shapes', () => {
    expect(parseRules({ lunchStructure: 'single' }).lunchStructure).toBe('single')
    expect(parseRules({ lunchStructure: 'banquete' }).lunchStructure).toBe(
      DEFAULT_RULES.lunchStructure
    )
  })

  it('reads dinner courses as one unless it is exactly two', () => {
    expect(parseRules({ dinnerCourses: 2 }).dinnerCourses).toBe(2)
    expect(parseRules({ dinnerCourses: 3 }).dinnerCourses).toBe(1)
    expect(parseRules({ dinnerCourses: '2' }).dinnerCourses).toBe(1)
  })
})

describe('requiresVegetableAtDinner', () => {
  it('needs two courses for the rule to mean anything', () => {
    const rules = parseRules({ dinnerCourses: 2, vegetableEveryDinner: true })
    expect(requiresVegetableAtDinner(rules)).toBe(true)
  })

  it('ignores the stored flag when dinner is a single course', () => {
    // A household that turned two courses back off keeps the flag stored; it
    // must not silently constrain their single dish.
    const rules = parseRules({ dinnerCourses: 1, vegetableEveryDinner: true })
    expect(rules.vegetableEveryDinner).toBe(true)
    expect(requiresVegetableAtDinner(rules)).toBe(false)
  })
})
