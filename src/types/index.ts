export interface DishIdea {
  id: string
  name: string
  category: 'starter' | 'main' | 'single'
  meal_type: 'lunch' | 'dinner' | 'both'
  day_type: 'weekday' | 'weekendday' | 'anyday'
  main_ingredient?: 'pasta' | 'meat' | 'fish' | 'egg' | 'legume' | 'vegetable'
  created_at: string
  updated_at: string
}

export interface WeeklyMenu {
  id: string
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

