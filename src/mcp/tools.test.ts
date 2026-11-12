import { describe, expect, it } from 'vitest'
import { coursesOf } from '../lib/dayFormat'
import { memoryStore, seedMenu, type MemoryStore } from './testStore'
import { madridToday } from './time'
import { TOOLS, runTool } from './tools'

// Thursday 12 November 2026. Its week runs Monday 9 – Sunday 15.
const today = new Date(2026, 10, 12, 12)
const WEEK = '2026-11-09'
const NEXT_WEEK = '2026-11-16'

const call = async (store: MemoryStore, name: string, args: Record<string, unknown> = {}) => {
  const result = await runTool(name, args, { store, today })
  if (!result) throw new Error(`no such tool: ${name}`)
  return result
}

const weekWith = (store: MemoryStore) =>
  seedMenu(store, WEEK, [
    { day: '2026-11-12', meal_type: 'lunch', single: 'Arroz a la cubana' },
    { day: '2026-11-12', meal_type: 'dinner', main: 'Boquerones' },
    { day: '2026-11-13', meal_type: 'lunch', starter: 'Brócoli', main: 'Chuletas de cerdo' },
    { day: '2026-11-13', meal_type: 'dinner', main: 'Alitas de pollo' },
  ])

const meal = (store: MemoryStore, day: string, type: 'lunch' | 'dinner', week = WEEK) =>
  store.menus.get(week)!.menu_items.find(item => item.day === day && item.meal_type === type)

describe('madridToday', () => {
  it('reads the calendar day in Spain, not in UTC', () => {
    // 23:30 UTC on Sunday is already Monday in Madrid (UTC+1 in November).
    const date = madridToday(new Date('2026-11-15T23:30:00Z'))
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 16])
  })

  it('follows summer time', () => {
    // 22:30 UTC in July is 00:30 the next day in Madrid (UTC+2).
    const date = madridToday(new Date('2026-07-05T22:30:00Z'))
    expect(date.getDate()).toBe(6)
  })
})

describe('tool definitions', () => {
  it('use names every MCP client accepts', () => {
    for (const tool of TOOLS) expect(tool.name).toMatch(/^[a-z_]+$/)
    expect(new Set(TOOLS.map(tool => tool.name)).size).toBe(TOOLS.length)
  })
})

describe('ver_menu', () => {
  it('shows the week with today and the ISO date of each day', async () => {
    const store = memoryStore()
    weekWith(store)
    const { text } = await call(store, 'ver_menu')
    expect(text).toContain('Hoy es jueves 12 de noviembre')
    expect(text).toContain('Jueves 12 de noviembre (2026-11-12) — HOY')
    expect(text).toContain('Comida: Arroz a la cubana')
    expect(text).toContain('Comida: Brócoli (primero) + Chuletas de cerdo (segundo)')
    expect(text).toContain('Lunes 9 de noviembre (2026-11-09)\n  Comida: sin plato')
  })

  it('says so when the week has no menu, without creating one', async () => {
    const store = memoryStore()
    const { text, isError } = await call(store, 'ver_menu', { semana: 'siguiente' })
    expect(text).toContain('no tiene menú')
    expect(isError).toBeFalsy()
    expect(store.menus.size).toBe(0)
  })

  it('rejects a week it does not know', async () => {
    const result = await call(memoryStore(), 'ver_menu', { semana: 'dentro de un mes' })
    expect(result.isError).toBe(true)
  })
})

describe('listar_platos', () => {
  it('filters by name without minding accents or case', async () => {
    const { text } = await call(memoryStore(), 'listar_platos', { buscar: 'BROCOLI' })
    expect(text).toContain('- Brócoli · primero · comida · cualquier día · Verdura')
    expect(text).toMatch(/^1 platos/)
  })

  it('filters by meal, keeping the dishes that serve both', async () => {
    const { text } = await call(memoryStore(), 'listar_platos', { comida: 'cena' })
    expect(text).toContain('Boquerones')
    expect(text).toContain('Alitas de pollo')
    expect(text).not.toContain('Arroz a la cubana')
  })
})

describe('ver_reglas', () => {
  it('reads stored rules through parseRules', async () => {
    const { text } = await call(memoryStore({ dinnerCourses: 2, vegetableEveryDinner: true }), 'ver_reglas')
    expect(text).toContain('En la cena: dos platos')
    expect(text).toContain('Verdura en todas las cenas')
    expect(text).toContain('nada de: pasta')
  })
})

describe('cambiar_plato', () => {
  it('replaces the dish and keeps the slot it was in', async () => {
    const store = memoryStore()
    weekWith(store)
    const result = await call(store, 'cambiar_plato', { dia: '2026-11-12', comida: 'cena', plato: 'alitas de pollo' })
    expect(result.isError).toBeFalsy()
    expect(meal(store, '2026-11-12', 'dinner')).toEqual({ day: '2026-11-12', meal_type: 'dinner', main: 'Alitas de pollo' })
    // The lunch `single` stays a single: picking a dish never changes the format.
    await call(store, 'cambiar_plato', { dia: '2026-11-12', comida: 'comida', plato: 'Cocido' })
    expect(meal(store, '2026-11-12', 'lunch')).toEqual({ day: '2026-11-12', meal_type: 'lunch', single: 'Cocido' })
  })

  it('asks which course when the meal has two', async () => {
    const store = memoryStore()
    weekWith(store)
    const args = { dia: '2026-11-13', comida: 'comida', plato: 'Bonito con tomate' }
    const unclear = await call(store, 'cambiar_plato', args)
    expect(unclear.isError).toBe(true)
    expect(unclear.text).toContain('Brócoli (primero)')
    await call(store, 'cambiar_plato', { ...args, posicion: 'segundo' })
    expect(meal(store, '2026-11-13', 'lunch')).toMatchObject({ starter: 'Brócoli', main: 'Bonito con tomate' })
  })

  it('only takes dishes of the catalogue, and suggests the closest', async () => {
    const store = memoryStore()
    weekWith(store)
    const result = await call(store, 'cambiar_plato', { dia: '2026-11-12', comida: 'cena', plato: 'chuletas' })
    expect(result.isError).toBe(true)
    expect(result.text).toContain('Chuletas de cerdo')
    expect(meal(store, '2026-11-12', 'dinner')?.main).toBe('Boquerones')
  })

  it('makes the change and warns when it breaks a house rule', async () => {
    const store = memoryStore()
    weekWith(store)
    // Lunch that day is rice and egg; the default rules forbid repeating the protein.
    const dishes = await store.dishes()
    const eggDinner = dishes.find(d => d.main_ingredients.includes('egg') && d.meal_type !== 'lunch')!
    const result = await call(store, 'cambiar_plato', { dia: '2026-11-12', comida: 'cena', plato: eggDinner.name })
    expect(result.isError).toBeFalsy()
    expect(result.text).toContain('no repetir huevo el mismo día')
    expect(meal(store, '2026-11-12', 'dinner')?.main).toBe(eggDinner.name)
  })

  it('fills a meal the week was missing', async () => {
    const store = memoryStore()
    weekWith(store)
    await call(store, 'cambiar_plato', { dia: '2026-11-10', comida: 'cena', plato: 'Boquerones' })
    expect(meal(store, '2026-11-10', 'dinner')).toEqual({ day: '2026-11-10', meal_type: 'dinner', main: 'Boquerones' })
    const days = store.menus.get(WEEK)!.menu_items.map(item => item.day)
    expect(days).toEqual([...days].sort())
  })

  it('leaves past weeks and far weeks alone', async () => {
    const store = memoryStore()
    seedMenu(store, '2026-11-02', [{ day: '2026-11-05', meal_type: 'dinner', main: 'Boquerones' }])
    const past = await call(store, 'cambiar_plato', { dia: '2026-11-05', comida: 'cena', plato: 'Alitas de pollo' })
    expect(past.isError).toBe(true)
    expect(past.text).toContain('semana pasada')
    const far = await call(store, 'cambiar_plato', { dia: '2026-11-25', comida: 'cena', plato: 'Alitas de pollo' })
    expect(far.isError).toBe(true)
    expect(store.menus.get('2026-11-02')!.menu_items[0].main).toBe('Boquerones')
  })

  it('rejects dates that are not dates', async () => {
    const store = memoryStore()
    for (const dia of ['mañana', '2026-02-31', 20261112]) {
      const result = await call(store, 'cambiar_plato', { dia, comida: 'cena', plato: 'Boquerones' })
      expect(result.isError).toBe(true)
    }
  })

  it('reapplies on top of an edit made in the app meanwhile', async () => {
    const store = memoryStore()
    weekWith(store)
    store.beforeSave = () => {
      const menu = store.menus.get(WEEK)!
      store.menus.set(WEEK, {
        ...menu,
        updated_at: 'edited-in-app',
        menu_items: menu.menu_items.map(item =>
          item.day === '2026-11-13' && item.meal_type === 'dinner' ? { ...item, main: 'Bonito con tomate' } : item
        ),
      })
    }
    await call(store, 'cambiar_plato', { dia: '2026-11-12', comida: 'cena', plato: 'Alitas de pollo' })
    expect(meal(store, '2026-11-12', 'dinner')?.main).toBe('Alitas de pollo')
    expect(meal(store, '2026-11-13', 'dinner')?.main).toBe('Bonito con tomate')
  })
})

describe('first course', () => {
  it('adds one, moving the dish that was there to second', async () => {
    const store = memoryStore()
    weekWith(store)
    await call(store, 'anadir_primer_plato', { dia: '2026-11-12', comida: 'comida', plato: 'Brócoli' })
    expect(meal(store, '2026-11-12', 'lunch')).toMatchObject({ starter: 'Brócoli', main: 'Arroz a la cubana' })
    expect(meal(store, '2026-11-12', 'lunch')?.single).toBeUndefined()
  })

  it('removes it, keeping the second', async () => {
    const store = memoryStore()
    weekWith(store)
    await call(store, 'quitar_primer_plato', { dia: '2026-11-13', comida: 'comida' })
    expect(coursesOf(meal(store, '2026-11-13', 'lunch')).map(c => c.dish)).toEqual(['Chuletas de cerdo'])
  })

  it('refuses when the meal is not in the right shape', async () => {
    const store = memoryStore()
    weekWith(store)
    const add = await call(store, 'anadir_primer_plato', { dia: '2026-11-13', comida: 'comida', plato: 'Brócoli' })
    const remove = await call(store, 'quitar_primer_plato', { dia: '2026-11-12', comida: 'cena' })
    expect(add.isError).toBe(true)
    expect(remove.isError).toBe(true)
  })
})

describe('intercambiar_dias', () => {
  it('swaps both meals of the two days, and again to undo', async () => {
    const store = memoryStore()
    weekWith(store)
    const before = structuredClone(store.menus.get(WEEK)!.menu_items)
    const args = { dia_a: '2026-11-12', dia_b: '2026-11-13' }
    await call(store, 'intercambiar_dias', args)
    expect(meal(store, '2026-11-12', 'dinner')?.main).toBe('Alitas de pollo')
    expect(meal(store, '2026-11-13', 'lunch')?.single).toBe('Arroz a la cubana')
    await call(store, 'intercambiar_dias', args)
    expect(store.menus.get(WEEK)!.menu_items).toEqual(before)
  })

  it('needs two days of the same week', async () => {
    const store = memoryStore()
    weekWith(store)
    const result = await call(store, 'intercambiar_dias', { dia_a: '2026-11-12', dia_b: '2026-11-17' })
    expect(result.isError).toBe(true)
  })
})

describe('generar_menu', () => {
  it('creates a week that has none', async () => {
    const store = memoryStore()
    const result = await call(store, 'generar_menu', { semana: 'siguiente' })
    expect(result.isError).toBeFalsy()
    const menu = store.menus.get(NEXT_WEEK)!
    expect(menu.week_end).toBe('2026-11-22')
    expect(menu.menu_items.length).toBeGreaterThanOrEqual(13)
    expect(menu.menu_items.every(item => item.day >= NEXT_WEEK && item.day <= '2026-11-22')).toBe(true)
  })

  it('does not replace an existing week without confirmation', async () => {
    const store = memoryStore()
    weekWith(store)
    const refused = await call(store, 'generar_menu')
    expect(refused.isError).toBe(true)
    expect(refused.text).toContain('confirmar_reemplazo')
    expect(store.menus.get(WEEK)!.menu_items).toHaveLength(4)

    const done = await call(store, 'generar_menu', { confirmar_reemplazo: true })
    expect(done.isError).toBeFalsy()
    expect(store.menus.get(WEEK)!.menu_items.length).toBeGreaterThan(4)
  })

  it('never generates the past', async () => {
    const result = await call(memoryStore(), 'generar_menu', { semana: 'anterior' })
    expect(result.isError).toBe(true)
  })

  it('says so when the rules could not be met', async () => {
    // Fish every single day is more than this catalogue can give.
    const store = memoryStore({ fishMinDays: 7, legumeMinLunches: 7, pastaMaxPerWeek: 0 })
    const result = await call(store, 'generar_menu')
    expect(store.menus.get(WEEK)).toBeDefined()
    expect(result.text).toContain('Aviso para la persona')
  })
})

describe('ver_lista_compra', () => {
  it('lists what is left to buy by section', async () => {
    const store = memoryStore()
    const item = (name: string, section: 'produce' | 'fish', checked: boolean) => ({
      id: name,
      list_id: 'l1',
      household_id: 'h1',
      ingredient_id: null,
      name,
      section,
      origin: 'menu' as const,
      sources: [],
      checked,
      checked_by: null,
      checked_at: null,
      created_at: '',
    })
    store.shopping = {
      list: {
        id: 'l1',
        household_id: 'h1',
        days: ['2026-11-12', '2026-11-13'],
        skipped_days: [],
        missing_dishes: ['Cocido'],
        fingerprint: '',
        generated_by: null,
        generated_at: '',
      },
      items: [item('Tomate', 'produce', false), item('Merluza', 'fish', false), item('Cebolla', 'produce', true)],
    }
    const { text } = await call(store, 'ver_lista_compra')
    expect(text).toContain('Faltan 2 de 3 productos')
    expect(text).toContain('- Tomate')
    expect(text).not.toContain('- Cebolla')
    expect(text).toContain('Cocido')
  })

  it('says there is none', async () => {
    const { text } = await call(memoryStore(), 'ver_lista_compra')
    expect(text).toContain('no tiene lista')
  })
})
