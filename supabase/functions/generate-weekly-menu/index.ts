import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DishIdea {
  id: string
  name: string
  category: 'starter' | 'main' | 'single'
  meal_type: 'lunch' | 'dinner' | 'both'
  // OUT OF DATE since the main_ingredients migration (2026-08): the column this
  // reads no longer exists, and this copy of the generator does not know about
  // rice, potato, or dishes with several ingredients. The function is paused —
  // do not reactivate it without porting the changes from src/utils/menuGenerator.ts.
  main_ingredient?: 'pasta' | 'meat' | 'fish' | 'egg' | 'legume' | 'vegetable'
}

interface MenuItem {
  day: string
  meal_type: 'lunch' | 'dinner'
  starter?: string
  main?: string
  single?: string
}

function generateWeeklyMenu(dishIdeas: DishIdea[], weekStart: Date): MenuItem[] {
  const menuItems: MenuItem[] = []
  
  const starters = dishIdeas.filter(d => d.category === 'starter' && (d.meal_type === 'lunch' || d.meal_type === 'both'))
  const mains = dishIdeas.filter(d => d.category === 'main' && (d.meal_type === 'lunch' || d.meal_type === 'both'))
  const singleCourses = dishIdeas.filter(d => d.category === 'single' && (d.meal_type === 'lunch' || d.meal_type === 'both'))
  const dinnerMains = dishIdeas.filter(d => d.category === 'main' && (d.meal_type === 'dinner' || d.meal_type === 'both'))
  
  // Shuffle arrays for randomness
  const shuffledStarters = [...starters].sort(() => Math.random() - 0.5)
  const shuffledMains = [...mains].sort(() => Math.random() - 0.5)
  const shuffledSingleCourses = [...singleCourses].sort(() => Math.random() - 0.5)
  const shuffledDinnerMains = [...dinnerMains].sort(() => Math.random() - 0.5)
  
  let starterIndex = 0
  let mainIndex = 0
  let singleIndex = 0
  let dinnerMainIndex = 0
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    const dayISO = date.toISOString().split('T')[0]
    
    // Lunch: alternate between starter+main and single-course
    const useSingleCourse = i % 2 === 0 && shuffledSingleCourses.length > 0
    
    if (useSingleCourse) {
      const singleCourse = shuffledSingleCourses[singleIndex % shuffledSingleCourses.length]
      menuItems.push({
        day: dayISO,
        meal_type: 'lunch',
        single: singleCourse.name,
      })
      singleIndex++
    } else {
      const starter = shuffledStarters[starterIndex % shuffledStarters.length]
      const main = shuffledMains[mainIndex % shuffledMains.length]
      menuItems.push({
        day: dayISO,
        meal_type: 'lunch',
        starter: starter.name,
        main: main.name,
      })
      starterIndex++
      mainIndex++
    }
    
    // Dinner: main course only
    const dinnerMain = shuffledDinnerMains[dinnerMainIndex % shuffledDinnerMains.length]
    menuItems.push({
      day: dayISO,
      meal_type: 'dinner',
      main: dinnerMain.name,
    })
    dinnerMainIndex++
  }
  
  return menuItems
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get next week's Saturday (week starts on next Saturday)
    const today = new Date()
    const weekStart = new Date(today)
    const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday
    // Calculate days until next Saturday
    const daysUntilSaturday = dayOfWeek === 6 ? 7 : (6 - dayOfWeek + 7) % 7
    weekStart.setDate(today.getDate() + daysUntilSaturday)
    weekStart.setHours(0, 0, 0, 0)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    // Check if menu already exists
    const { data: existingMenu } = await supabaseClient
      .from('weekly_menus')
      .select('id')
      .eq('week_start', weekStart.toISOString().split('T')[0])
      .single()

    if (existingMenu) {
      return new Response(
        JSON.stringify({ error: 'Menu for this week already exists' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Get all dish ideas
    const { data: dishIdeas, error: dishError } = await supabaseClient
      .from('dish_ideas')
      .select('*')

    if (dishError) throw dishError

    if (!dishIdeas || dishIdeas.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No dish ideas available' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Generate menu
    const menuItems = generateWeeklyMenu(dishIdeas as DishIdea[], weekStart)

    // Insert menu
    const { data, error } = await supabaseClient
      .from('weekly_menus')
      .insert({
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        menu_items: menuItems,
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, menu: data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

