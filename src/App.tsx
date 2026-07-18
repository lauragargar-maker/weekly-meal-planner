import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { WeeklyMenu, DishIdea } from './types'
import MenuAgendaView from './components/MenuAgendaView'
import { generateWeeklyMenu } from './utils/menuGenerator'
import { SETTINGS } from './config'

/** Return the Saturday that starts the current week period (Sat–Fri). */
const getCurrentWeekSaturday = (): Date => {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun … 6=Sat
  const daysBack = (dayOfWeek + 1) % 7 // Sat=0, Sun=1, Mon=2, … Fri=6
  const saturday = new Date(today)
  saturday.setDate(today.getDate() - daysBack)
  saturday.setHours(0, 0, 0, 0)
  return saturday
}

const getNextWeekSaturday = (): Date => {
  const next = getCurrentWeekSaturday()
  next.setDate(next.getDate() + 7)
  return next
}

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function App() {
  const [currentMenu, setCurrentMenu] = useState<WeeklyMenu | null>(null)
  const [nextWeekMenu, setNextWeekMenu] = useState<WeeklyMenu | null>(null)
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0)
  const [isLoadingNextWeek, setIsLoadingNextWeek] = useState(false)
  const [dishIdeas, setDishIdeas] = useState<DishIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isGeneratingMenuRef = useRef(false)

  const canAccessNextWeek = (): boolean => {
    const dayOfWeek = new Date().getDay()
    // Sat(6) starts a new week — only unlock Wed(3)–Fri(5)
    return dayOfWeek >= SETTINGS.upcomingWeekUnlockDay && dayOfWeek !== 6
  }

  const loadDishIdeas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dish_ideas')
        .select('*')
        .order('name')

      if (error) throw error
      setDishIdeas(data as DishIdea[] || [])
    } catch (err) {
      console.error('Error loading dish ideas:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dish ideas')
    }
  }, [])

  const generateNewMenu = useCallback(async (
    weekStart: Date,
    dishes: DishIdea[],
    setMenu: (menu: WeeklyMenu) => void = setCurrentMenu
  ) => {
    if (dishes.length === 0) {
      setError('No dish ideas available. Please add dishes first.')
      return
    }

    if (isGeneratingMenuRef.current) {
      console.log('Menu generation already in progress, skipping...')
      return
    }

    isGeneratingMenuRef.current = true
    try {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      const menuItems = generateWeeklyMenu({ dishIdeas: dishes, weekStart })

      const menuData = {
        week_start: formatLocalDate(weekStart),
        week_end: formatLocalDate(weekEnd),
        menu_items: menuItems,
      }

      const { data: existingMenu } = await supabase
        .from('weekly_menus')
        .select('id')
        .eq('week_start', formatLocalDate(weekStart))
        .maybeSingle()

      if (existingMenu) {
        console.log('🔄 Updating existing menu...')
        const { data: updateData, error: updateError } = await supabase
          .from('weekly_menus')
          .update({
            week_end: menuData.week_end,
            menu_items: menuData.menu_items,
            updated_at: new Date().toISOString()
          })
          .eq('week_start', formatLocalDate(weekStart))
          .select()
          .single()

        if (updateError) throw updateError
        setMenu(updateData as WeeklyMenu)
        setError(null)
        return
      }

      console.log('🆕 Inserting new menu...')
      const { data, error } = await supabase
        .from('weekly_menus')
        .insert(menuData)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          console.log('⚠️ Duplicate detected, updating instead...')
          const { data: updateData, error: updateError } = await supabase
            .from('weekly_menus')
            .update({
              week_end: menuData.week_end,
              menu_items: menuData.menu_items,
              updated_at: new Date().toISOString()
            })
            .eq('week_start', formatLocalDate(weekStart))
            .select()
            .single()

          if (updateError) throw updateError
          setMenu(updateData as WeeklyMenu)
          setError(null)
          return
        }
        throw error
      }

      setMenu(data as WeeklyMenu)
      setError(null)
    } catch (err) {
      console.error('Error generating menu:', err)
      if (err instanceof Error && !err.message.includes('duplicate key')) {
        setError(err instanceof Error ? err.message : 'Failed to generate menu')
      }
    } finally {
      isGeneratingMenuRef.current = false
    }
  }, [])

  const loadCurrentMenu = useCallback(async (shouldGenerateIfMissing = false) => {
    try {
      const weekStart = getCurrentWeekSaturday()
      const weekStartFormatted = formatLocalDate(weekStart)

      const { data, error } = await supabase
        .from('weekly_menus')
        .select('*')
        .eq('week_start', weekStartFormatted)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setCurrentMenu(data as WeeklyMenu)
        setError(null)
      } else if (shouldGenerateIfMissing && dishIdeas.length > 0 && !isGeneratingMenuRef.current) {
        await generateNewMenu(weekStart, dishIdeas, setCurrentMenu)
      }
    } catch (err) {
      console.error('Error loading menu:', err)
      setError(err instanceof Error ? err.message : 'Failed to load menu')
    }
  }, [dishIdeas, generateNewMenu])

  useEffect(() => {
    let mounted = true
    let menuChannel: ReturnType<typeof supabase.channel> | null = null
    let dishChannel: ReturnType<typeof supabase.channel> | null = null

    const initializeData = async () => {
      try {
        setLoading(true)

        const { data: dishesData, error: dishesError } = await supabase
          .from('dish_ideas')
          .select('*')
          .order('name')

        if (dishesError) throw dishesError
        if (mounted) {
          setDishIdeas(dishesData as DishIdea[] || [])
        }

        if (mounted) {
          const weekStart = getCurrentWeekSaturday()
          const weekStartFormatted = formatLocalDate(weekStart)
          console.log('📅 Querying menu (initial load) with week_start:', {
            weekStartDate: weekStart,
            weekStartFormatted,
            weekStartISO: weekStart.toISOString().split('T')[0],
            weekStartDay: weekStart.getDay(),
            weekStartDayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekStart.getDay()],
          })

          const { data: menuData, error: menuError } = await supabase
            .from('weekly_menus')
            .select('*')
            .eq('week_start', weekStartFormatted)
            .maybeSingle()

          if (menuError && menuError.code !== 'PGRST116') throw menuError

          if (menuData) {
            setCurrentMenu(menuData as WeeklyMenu)
          } else if (dishesData && dishesData.length > 0 && !isGeneratingMenuRef.current) {
            isGeneratingMenuRef.current = true
            try {
              const weekEnd = new Date(weekStart)
              weekEnd.setDate(weekStart.getDate() + 6)

              const menuItems = generateWeeklyMenu({ dishIdeas: dishesData as DishIdea[], weekStart })

              const newMenuData = {
                week_start: formatLocalDate(weekStart),
                week_end: formatLocalDate(weekEnd),
                menu_items: menuItems,
              }

              const { data: insertedMenu, error: insertError } = await supabase
                .from('weekly_menus')
                .insert(newMenuData)
                .select()
                .single()

              if (insertError && !insertError.message.includes('duplicate key')) {
                throw insertError
              }

              if (insertedMenu && mounted) {
                setCurrentMenu(insertedMenu as WeeklyMenu)
              }
            } catch (err) {
              console.error('Error generating menu:', err)
            } finally {
              if (mounted) {
                isGeneratingMenuRef.current = false
              }
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load data')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeData()

    menuChannel = supabase
      .channel('weekly_menus_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekly_menus' },
        async (payload) => {
          if (mounted && !isGeneratingMenuRef.current) {
            const currentWeekStart = formatLocalDate(getCurrentWeekSaturday())
            const nextWeekStart = formatLocalDate(getNextWeekSaturday())
            const changedWeekStart = (payload.new as Partial<WeeklyMenu>)?.week_start

            if (changedWeekStart === currentWeekStart) {
              const { data } = await supabase
                .from('weekly_menus')
                .select('*')
                .eq('week_start', currentWeekStart)
                .maybeSingle()
              if (data && mounted) setCurrentMenu(data as WeeklyMenu)
            } else if (changedWeekStart === nextWeekStart) {
              const { data } = await supabase
                .from('weekly_menus')
                .select('*')
                .eq('week_start', nextWeekStart)
                .maybeSingle()
              if (data && mounted) setNextWeekMenu(data as WeeklyMenu)
            }
          }
        }
      )
      .subscribe()

    dishChannel = supabase
      .channel('dish_ideas_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dish_ideas' },
        async () => {
          if (mounted) {
            const { data } = await supabase
              .from('dish_ideas')
              .select('*')
              .order('name')
            if (data && mounted) {
              setDishIdeas(data as DishIdea[] || [])
            }
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      if (menuChannel) supabase.removeChannel(menuChannel)
      if (dishChannel) supabase.removeChannel(dishChannel)
    }
  }, [])

  const handleWeekNav = useCallback(async (direction: -1 | 1) => {
    const newOffset = (weekOffset + direction) as 0 | 1
    if (newOffset < 0 || newOffset > 1) return

    setWeekOffset(newOffset)

    if (newOffset === 1 && !nextWeekMenu) {
      setIsLoadingNextWeek(true)
      try {
        const nextWeekStart = getNextWeekSaturday()
        const { data, error } = await supabase
          .from('weekly_menus')
          .select('*')
          .eq('week_start', formatLocalDate(nextWeekStart))
          .maybeSingle()

        if (error && error.code !== 'PGRST116') throw error

        if (data) {
          setNextWeekMenu(data as WeeklyMenu)
        } else {
          await generateNewMenu(nextWeekStart, dishIdeas, setNextWeekMenu)
        }
      } catch (err) {
        console.error('Error loading next week menu:', err)
        setError(err instanceof Error ? err.message : 'Failed to load next week menu')
        setWeekOffset(0)
      } finally {
        setIsLoadingNextWeek(false)
      }
    }
  }, [weekOffset, nextWeekMenu, dishIdeas, generateNewMenu])

  const updateMenuItem = useCallback(async (
    dayISO: string,
    mealType: 'lunch' | 'dinner',
    dishSlot: 'starter' | 'main' | 'single',
    newDishName: string,
    selectedCategory: 'starter' | 'main' | 'single'
  ) => {
    const activeMenu = weekOffset === 0 ? currentMenu : nextWeekMenu
    const setActiveMenu = weekOffset === 0 ? setCurrentMenu : setNextWeekMenu
    if (!activeMenu) return

    const updatedItems = activeMenu.menu_items.map((item) => {
      if (item.day !== dayISO || item.meal_type !== mealType) return item

      if (dishSlot === 'main' && selectedCategory === 'single') {
        return { ...item, single: newDishName, starter: undefined, main: undefined }
      }

      if (dishSlot === 'single' && selectedCategory === 'main') {
        const compatibleStarters = dishIdeas.filter(
          (d) => d.category === 'starter' && (d.meal_type === 'both' || d.meal_type === mealType)
        )
        const randomStarter = compatibleStarters.length > 0
          ? compatibleStarters[Math.floor(Math.random() * compatibleStarters.length)].name
          : undefined
        return { ...item, main: newDishName, starter: randomStarter, single: undefined }
      }

      return { ...item, [dishSlot]: newDishName }
    })

    const updatedMenu = { ...activeMenu, menu_items: updatedItems }
    setActiveMenu(updatedMenu)

    try {
      await supabase
        .from('weekly_menus')
        .update({
          menu_items: updatedItems,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeMenu.id)
    } catch (err) {
      console.error('Error updating menu item:', err)
      setActiveMenu(activeMenu)
    }
  }, [currentMenu, nextWeekMenu, weekOffset, dishIdeas])

  const handleAddNewDish = useCallback(async (dishData: Omit<DishIdea, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase.from('dish_ideas').insert(dishData)
      if (error) throw error
    } catch (err) {
      console.error('Error adding dish:', err)
      setError(err instanceof Error ? err.message : 'Failed to add dish')
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error && !currentMenu) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              setError(null)
              loadDishIdeas().then(() => loadCurrentMenu(true))
            }}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const displayedMenu = weekOffset === 0 ? currentMenu : nextWeekMenu

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Weekly Meal Planning</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">{error}</p>
          </div>
        )}

        {isLoadingNextWeek ? (
          <div className="card text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading next week's menu...</p>
          </div>
        ) : displayedMenu ? (
          <MenuAgendaView
            menu={displayedMenu}
            dishIdeas={dishIdeas}
            onUpdateDish={updateMenuItem}
            onAddNewDish={handleAddNewDish}
            weekOffset={weekOffset}
            canAccessNextWeek={canAccessNextWeek()}
            onNavigate={handleWeekNav}
          />
        ) : (
          <div className="card text-center">
            <p className="text-gray-600 mb-4">No menu available for this week.</p>
            <button
              onClick={() => generateNewMenu(getCurrentWeekSaturday(), dishIdeas, setCurrentMenu)}
              className="btn-primary"
            >
              Generate Menu
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
