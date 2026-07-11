export interface Household {
  id: string
  name: string
  /** Short code family members use to join this household. */
  join_code: string
}

export interface DishIdea {
  id: string
  household_id: string
  name: string
  category: 'starter' | 'main' | 'single'
  meal_type: 'lunch' | 'dinner' | 'both'
  day_type: 'weekday' | 'weekendday' | 'anyday'
  main_ingredient?: 'pasta' | 'meat' | 'fish' | 'egg' | 'legume' | 'vegetable'
  created_at: string
  updated_at: string
}

// Shape used by forms that create a dish; ownership and timestamps are set by the app/DB.
export type NewDishIdea = Omit<DishIdea, 'id' | 'household_id' | 'created_at' | 'updated_at'>

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
