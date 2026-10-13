export interface Household {
  id: string
  name: string
  /** Short code family members use to join this household. */
  join_code: string
  /**
   * Raw JSONB as stored. Always read it through `parseRules()` rather than
   * directly: `{}` is a household on defaults, and every field falls back on its
   * own so a rule added later reaches old rows without a backfill.
   */
  rules: unknown
  /** When the starter shopping ingredients were applied (spec §6.2). Null until then. */
  ingredients_seeded_at?: string | null
  /** When the household went through the guided ingredients flow (spec §5.3). */
  shopping_guide_seen_at?: string | null
}

/**
 * Both the food group and its subtype: flattening these to carb/protein/veg
 * would lose "pasta twice a week" and "no meat at dinner".
 */
export type Ingredient =
  | 'pasta'
  | 'rice'
  | 'potato'
  | 'meat'
  | 'fish'
  | 'egg'
  | 'legume'
  | 'dairy'
  | 'vegetable'

export interface DishIdea {
  id: string
  household_id: string
  name: string
  category: 'starter' | 'main' | 'single'
  meal_type: 'lunch' | 'dinner' | 'both'
  day_type: 'weekday' | 'weekendday' | 'anyday'
  /**
   * Every ingredient the dish brings to the table, unordered — lasagna is both
   * pasta and meat. An empty array means "unlabelled", and an unlabelled dish is
   * invisible to every rule.
   */
  main_ingredients: Ingredient[]
  /**
   * A recipe on a cooking site, shown in the dish sheet as "Ver receta en …".
   * Always https. Optional so the starter catalogue and older rows need no value.
   */
  recipe_url?: string | null
  created_at: string
  updated_at: string
}

// Shape used by forms that create a dish; ownership and timestamps are set by the app/DB.
export type NewDishIdea = Omit<DishIdea, 'id' | 'household_id' | 'created_at' | 'updated_at'>

/**
 * The supermarket section a shopping ingredient is bought in. The order the
 * list shows them in lives in `src/lib/storeSections.ts`.
 */
export type StoreSection =
  | 'produce'
  | 'meat'
  | 'fish'
  | 'deli'
  | 'dairy_eggs'
  | 'bakery'
  | 'grocery'
  | 'frozen'
  | 'drinks'
  | 'household'
  | 'other'

/**
 * What has to be in the kitchen to cook a dish — "Chuletas de cerdo", "Sal".
 * Not to be confused with `Ingredient`, the food group the generator's rules
 * read (`main_ingredients`). One row per household and name: whether it is a
 * staple and where it is bought are the household's call, not the dish's.
 */
export interface ShoppingIngredient {
  id: string
  household_id: string
  name: string
  /** `toKey(name)`; unique per household. */
  name_key: string
  section: StoreSection
  /** "Básico de casa": always at home, so it never reaches the shopping list. */
  is_staple: boolean
}

/** Links a dish to one of the household's shopping ingredients. */
export interface DishIngredient {
  dish_id: string
  ingredient_id: string
  household_id: string
  /** Where it sits in the dish sheet, in the order it was added. */
  position: number
}

export interface WeeklyMenu {
  id: string
  household_id: string
  week_start: string
  week_end: string
  menu_items: MenuItem[]
  created_at: string
  updated_at: string
}

export interface MenuItem {
  day: string // ISO date string
  meal_type: 'lunch' | 'dinner'
  starter?: string // dish name
  main?: string // dish name
  single?: string // dish name (for single-course meals)
}

export type ViewMode = 'list' | 'agenda'
