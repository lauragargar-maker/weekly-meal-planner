import { StoreSection } from '../types'

/**
 * The supermarket sections, in the order the shopping list walks them.
 * docs/shopping-list-spec.md §3.5.
 *
 * As with `INGREDIENTS`, a new section goes at the END: the list's order is
 * the household's route through the shop, and it should not move under them.
 * The database's CHECK (`ingredients_section_allowed`) lists the same values.
 *
 * "Alimentación" rather than "Despensa" on purpose: "despensa" would read as
 * "what we already have at home", which is what `is_staple` means.
 */
export const STORE_SECTIONS: { value: StoreSection; label: string }[] = [
  { value: 'produce', label: 'Fruta y verdura' },
  { value: 'meat', label: 'Carnicería' },
  { value: 'fish', label: 'Pescadería' },
  { value: 'deli', label: 'Charcutería y quesos' },
  { value: 'dairy_eggs', label: 'Lácteos y huevos' },
  { value: 'bakery', label: 'Panadería' },
  { value: 'grocery', label: 'Alimentación' },
  { value: 'frozen', label: 'Congelados' },
  { value: 'drinks', label: 'Bebidas' },
  { value: 'household', label: 'Droguería y hogar' },
  { value: 'other', label: 'Otros' },
]

const LABELS = new Map(STORE_SECTIONS.map(({ value, label }) => [value, label]))

export const sectionLabel = (section: StoreSection): string => LABELS.get(section) ?? section

export const isStoreSection = (value: string): value is StoreSection => LABELS.has(value as StoreSection)
