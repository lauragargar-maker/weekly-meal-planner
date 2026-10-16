import { describe, expect, it } from 'vitest'
import { DishIdea, DishIngredient, MenuItem, ShoppingIngredient, ShoppingListItem } from '../types'
import { toKey } from './nameKey'
import {
  ListInputs,
  buildShoppingList,
  defaultSelection,
  dishesOfDay,
  formatListText,
  formatRange,
  formatSources,
  groupBySection,
  itemsForReplacement,
  listFingerprint,
  listStatus,
  menuItemsByDay,
  selectableDays,
} from './shoppingList'

// Tuesday 13 October 2026.
const TUESDAY = new Date(2026, 9, 13, 18, 30)

const ingredient = (id: string, name: string, fields: Partial<ShoppingIngredient> = {}): ShoppingIngredient => ({
  id,
  household_id: 'h',
  name,
  name_key: toKey(name),
  section: 'produce',
  is_staple: false,
  ...fields,
})

const dish = (id: string, name: string): DishIdea => ({
  id,
  household_id: 'h',
  name,
  category: 'main',
  meal_type: 'both',
  day_type: 'anyday',
  main_ingredients: ['vegetable'],
  created_at: '',
  updated_at: '',
})

const catalog = [
  ingredient('lentejas', 'Lentejas', { section: 'grocery' }),
  ingredient('zanahoria', 'Zanahoria'),
  ingredient('cebolla', 'Cebolla', { is_staple: true }),
  ingredient('merluza', 'Merluza', { section: 'fish' }),
  ingredient('limon', 'Limón'),
]

const dishes = [dish('d-lentejas', 'Lentejas con verduras'), dish('d-merluza', 'Merluza a la romana'), dish('d-pisto', 'Pisto de mamá')]

const links: DishIngredient[] = [
  ...['lentejas', 'zanahoria', 'cebolla'].map((id, position) => ({ dish_id: 'd-lentejas', ingredient_id: id, household_id: 'h', position })),
  ...['merluza', 'limon', 'zanahoria'].map((id, position) => ({ dish_id: 'd-merluza', ingredient_id: id, household_id: 'h', position })),
]

const menu = (items: MenuItem[]) => menuItemsByDay([{ menu_items: items }])

const inputs = (items: MenuItem[]): ListInputs => ({ menusByDay: menu(items), dishes, links, catalog })

const item = (fields: Partial<ShoppingListItem>): ShoppingListItem => ({
  id: fields.name ?? 'x',
  list_id: 'l',
  household_id: 'h',
  ingredient_id: null,
  name: 'x',
  section: 'other',
  origin: 'menu',
  sources: [],
  checked: false,
  checked_by: null,
  checked_at: null,
  created_at: '',
  ...fields,
})

describe('selectableDays and defaultSelection', () => {
  it('offers today up to the Sunday of next week', () => {
    const days = selectableDays(TUESDAY)
    expect(days[0]).toBe('2026-10-13')
    expect(days[days.length - 1]).toBe('2026-10-25')
  })

  it('on a Sunday still reaches the end of next week', () => {
    const days = selectableDays(new Date(2026, 9, 18))
    expect(days[days.length - 1]).toBe('2026-10-25')
  })

  it('preselects the five days starting tomorrow', () => {
    expect(defaultSelection(TUESDAY)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
  })

  it('keeps the preselection inside the selectable range on every weekday', () => {
    for (let offset = 0; offset < 7; offset++) {
      const day = new Date(2026, 9, 12 + offset)
      const selectable = new Set(selectableDays(day))
      for (const d of defaultSelection(day)) expect(selectable.has(d)).toBe(true)
    }
  })

  it('crosses month boundaries', () => {
    expect(defaultSelection(new Date(2026, 9, 30))).toEqual(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'])
  })
})

describe('dishesOfDay', () => {
  it('lists lunch before dinner and every course', () => {
    expect(
      dishesOfDay([
        { day: 'd', meal_type: 'dinner', main: 'Merluza' },
        { day: 'd', meal_type: 'lunch', starter: 'Gazpacho', main: 'Pollo' },
      ])
    ).toEqual([
      { name: 'Gazpacho', meal: 'lunch' },
      { name: 'Pollo', meal: 'lunch' },
      { name: 'Merluza', meal: 'dinner' },
    ])
  })
})

describe('buildShoppingList', () => {
  it('merges an ingredient shared by several dishes into one item with every source, and leaves out staples', () => {
    const draft = buildShoppingList(
      ['2026-10-14', '2026-10-15'],
      inputs([
        { day: '2026-10-14', meal_type: 'lunch', single: 'Lentejas con verduras' },
        { day: '2026-10-15', meal_type: 'dinner', main: 'Merluza a la romana' },
      ])
    )
    expect(draft.items.map((i) => i.name).sort()).toEqual(['Lentejas', 'Limón', 'Merluza', 'Zanahoria'])
    expect(draft.items.find((i) => i.name === 'Zanahoria')?.sources).toEqual([
      { dish: 'Lentejas con verduras', day: '2026-10-14', meal: 'lunch' },
      { dish: 'Merluza a la romana', day: '2026-10-15', meal: 'dinner' },
    ])
    expect(draft.items.find((i) => i.name === 'Cebolla')).toBeUndefined()
  })

  it('counts a dish planned twice as two sources of one item', () => {
    const draft = buildShoppingList(
      ['2026-10-14', '2026-10-16'],
      inputs([
        { day: '2026-10-14', meal_type: 'lunch', single: 'Lentejas con verduras' },
        { day: '2026-10-16', meal_type: 'lunch', single: 'Lentejas con verduras' },
      ])
    )
    expect(draft.items.find((i) => i.name === 'Lentejas')?.sources).toHaveLength(2)
  })

  it('skips days with no menu and reports them', () => {
    const draft = buildShoppingList(
      ['2026-10-19', '2026-10-14'],
      inputs([{ day: '2026-10-14', meal_type: 'lunch', single: 'Lentejas con verduras' }])
    )
    expect(draft.days).toEqual(['2026-10-14'])
    expect(draft.skippedDays).toEqual(['2026-10-19'])
  })

  it('finds dishes ignoring case and accents, and reports those without ingredients or no longer in Platos', () => {
    const draft = buildShoppingList(
      ['2026-10-14'],
      inputs([
        { day: '2026-10-14', meal_type: 'lunch', starter: 'LENTEJAS CON VERDURAS', main: 'Pisto de mamá' },
        { day: '2026-10-14', meal_type: 'dinner', main: 'Tortilla del abuelo' },
      ])
    )
    expect(draft.items.map((i) => i.name)).toContain('Lentejas')
    expect(draft.missingDishes).toEqual(['Pisto de mamá', 'Tortilla del abuelo'])
  })
})

describe('listFingerprint', () => {
  const day = '2026-10-14'
  const base = [{ day, meal_type: 'lunch' as const, single: 'Lentejas con verduras' }]

  it('is stable for the same menu', () => {
    expect(listFingerprint([day], inputs(base))).toBe(listFingerprint([day], inputs(base)))
  })

  it('changes when a dish changes', () => {
    expect(listFingerprint([day], inputs(base))).not.toBe(
      listFingerprint([day], inputs([{ day, meal_type: 'lunch', single: 'Merluza a la romana' }]))
    )
  })

  it('changes when a skipped day gets a menu', () => {
    const days = [day, '2026-10-19']
    expect(listFingerprint(days, inputs(base))).not.toBe(
      listFingerprint(days, inputs([...base, { day: '2026-10-19', meal_type: 'dinner', main: 'Merluza a la romana' }]))
    )
  })

  it('changes when a dish’s bought ingredients change, but not when a staple is added', () => {
    const before = listFingerprint([day], inputs(base))
    const withStaple = { menusByDay: menu(base), dishes, catalog, links: [...links, { dish_id: 'd-lentejas', ingredient_id: 'cebolla', household_id: 'h', position: 9 }] }
    expect(listFingerprint([day], withStaple)).toBe(before)
    const withLimon = { ...withStaple, links: [...links, { dish_id: 'd-lentejas', ingredient_id: 'limon', household_id: 'h', position: 9 }] }
    expect(listFingerprint([day], withLimon)).not.toBe(before)
  })
})

describe('listStatus', () => {
  const list = { days: ['2026-10-14', '2026-10-18'] }

  it('is in progress while a day is still ahead and something is unticked', () => {
    expect(listStatus(list, [item({ checked: true }), item({ checked: false })], TUESDAY)).toBe('active')
  })

  it('closes when everything is ticked', () => {
    expect(listStatus(list, [item({ checked: true })], TUESDAY)).toBe('all_checked')
  })

  it('an empty list stays in progress', () => {
    expect(listStatus(list, [], TUESDAY)).toBe('active')
  })

  it('is still in progress on its last day, and expires the day after', () => {
    expect(listStatus(list, [item({})], new Date(2026, 9, 18, 23, 0))).toBe('active')
    expect(listStatus(list, [item({})], new Date(2026, 9, 19, 0, 5))).toBe('expired')
  })

  it('expired wins over all ticked', () => {
    expect(listStatus(list, [item({ checked: true })], new Date(2026, 9, 20))).toBe('expired')
  })
})

describe('itemsForReplacement', () => {
  const draft = [
    { ingredient_id: 'lentejas', name: 'Lentejas', section: 'grocery' as const, sources: [] },
    { ingredient_id: 'zanahoria', name: 'Zanahoria', section: 'produce' as const, sources: [] },
  ]
  const previous = [
    item({ ingredient_id: 'lentejas', name: 'Lentejas', checked: true }),
    item({ ingredient_id: 'merluza', name: 'Merluza', checked: true }),
    item({ name: 'Papel de cocina', origin: 'manual', checked: false, section: 'household' }),
    item({ name: 'Yogures', origin: 'manual', checked: true, section: 'dairy_eggs' }),
  ]

  it('from a list in progress keeps ticks on what is still needed, and every hand-added item', () => {
    const next = itemsForReplacement(draft, previous, 'active')
    expect(next.find((i) => i.name === 'Lentejas')?.checked).toBe(true)
    expect(next.find((i) => i.name === 'Zanahoria')?.checked).toBe(false)
    expect(next.find((i) => i.name === 'Merluza')).toBeUndefined()
    expect(next.filter((i) => i.origin === 'manual').map((i) => [i.name, i.checked])).toEqual([
      ['Papel de cocina', false],
      ['Yogures', true],
    ])
  })

  it('from a closed list carries no ticks, and only the hand-added items left unbought', () => {
    const next = itemsForReplacement(draft, previous, 'expired')
    expect(next.every((i) => !i.checked)).toBe(true)
    expect(next.filter((i) => i.origin === 'manual').map((i) => i.name)).toEqual(['Papel de cocina'])
  })

  it('with no previous list is just the draft', () => {
    expect(itemsForReplacement(draft, [], null)).toHaveLength(2)
  })
})

describe('grouping and text', () => {
  const items = [
    item({ name: 'Zanahoria', section: 'produce' }),
    item({ name: 'Ajo tierno', section: 'produce', checked: true }),
    item({ name: 'Calabacín', section: 'produce' }),
    item({ name: 'Merluza', section: 'fish' }),
    item({ name: 'Papel de cocina', section: 'household', origin: 'manual' }),
  ]

  it('groups by section in shop order, pending first and alphabetical', () => {
    const groups = groupBySection(items)
    expect(groups.map((g) => g.label)).toEqual(['Fruta y verdura', 'Pescadería', 'Droguería y hogar'])
    expect(groups[0].items.map((i) => i.name)).toEqual(['Calabacín', 'Zanahoria', 'Ajo tierno'])
  })

  it('copies only what is still to buy', () => {
    expect(formatListText({ days: ['2026-10-14', '2026-10-18'] }, items)).toBe(
      '🛒 Lista de la compra · mié 14 – dom 18 oct\n\n' +
        'FRUTA Y VERDURA\n- Calabacín\n- Zanahoria\n\n' +
        'PESCADERÍA\n- Merluza\n\n' +
        'DROGUERÍA Y HOGAR\n- Papel de cocina'
    )
  })

  it('describes where an item comes from', () => {
    const source = (dish: string, day: string) => ({ dish, day, meal: 'lunch' as const })
    expect(formatSources(item({ sources: [source('Lentejas', '2026-10-14'), source('Cocido', '2026-10-16')] }))).toBe(
      'Lentejas (mié) · Cocido (vie)'
    )
    expect(
      formatSources(item({ sources: [source('Lentejas', '2026-10-14'), source('Cocido', '2026-10-16'), source('Paella', '2026-10-17')] }))
    ).toBe('Lentejas (mié) y 2 más')
    expect(formatSources(item({ origin: 'manual' }))).toBe('Añadido a mano')
  })

  it('formats ranges across months', () => {
    expect(formatRange(['2026-10-30', '2026-11-02'])).toBe('vie 30 oct – lun 2 nov')
    expect(formatRange(['2026-10-14'])).toBe('mié 14 oct')
  })
})
