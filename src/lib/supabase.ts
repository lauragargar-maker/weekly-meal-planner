import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
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

