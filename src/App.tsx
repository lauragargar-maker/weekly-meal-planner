import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useAuth } from './lib/auth-context'
import { WeeklyMenu, DishIdea, NewDishIdea, Household } from './types'
import MenuAgendaView from './components/MenuAgendaView'
import CatalogView from './components/CatalogView'
import FamilyView from './components/FamilyView'
import CatalogChecklist from './components/CatalogChecklist'
import FeedbackButton from './components/FeedbackButton'
import { generateWeeklyMenu } from './utils/menuGenerator'
import { isCatalogReady } from './utils/catalogCheck'
import { parseRules } from './lib/householdRules'
import { describeDegradedMenu } from './lib/degradedMenu'
import { STARTER_CATALOG } from './data/starterCatalog'
import { SETTINGS } from './config'
import { identifyHousehold, trackEvent } from './lib/analytics'

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

/** The "¡Ñam!" wordmark, which doubles as the way back to the weekly plan. */
function Wordmark({ as: Tag, onClick }: { as: 'h1' | 'div'; onClick: () => void }) {
  return (
    <Tag className="contents">
      <button
        onClick={onClick}
        aria-label="Ir al plan semanal"
        className="inline-block -rotate-2 text-[28px] font-extrabold leading-none text-rojo-500 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 lg:text-[34px]"
      >
        ¡Ñam!
      </button>
    </Tag>
  )
}

function App({ household }: { household: Household }) {
  const { session } = useAuth()
  const householdId = household.id
  // Re-parsed whenever the stored value changes, which is what makes "Regenerar
  // esta semana" pick up a rule the user just edited.
  const rules = useMemo(() => parseRules(household.rules), [household.rules])

  // The realtime effect below subscribes once per household and must not be torn
  // down every time a setting changes. Reading the rules through a ref keeps it
  // from generating a menu with whatever they were on first render.
  const rulesRef = useRef(rules)
  useEffect(() => {
    rulesRef.current = rules
  }, [rules])
  const [currentMenu, setCurrentMenu] = useState<WeeklyMenu | null>(null)
  const [nextWeekMenu, setNextWeekMenu] = useState<WeeklyMenu | null>(null)
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0)
  const [isLoadingNextWeek, setIsLoadingNextWeek] = useState(false)
  const [dishIdeas, setDishIdeas] = useState<DishIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [view, setView] = useState<'agenda' | 'catalog' | 'family'>('agenda')
  const [degraded, setDegraded] = useState<{ title: string; detail: string } | null>(null)
  const isGeneratingMenuRef = useRef(false)

  useEffect(() => {
    identifyHousehold(householdId)
  }, [householdId])

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
        .eq('household_id', householdId)
        .order('name')

      if (error) throw error
      setDishIdeas(data as DishIdea[] || [])
    } catch (err) {
      console.error('Error loading dish ideas:', err)
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los platos')
    }
  }, [householdId])

  const generateNewMenu = useCallback(async (
    weekStart: Date,
    dishes: DishIdea[],
    setMenu: (menu: WeeklyMenu) => void = setCurrentMenu,
    trigger: 'manual' | 'next_week' = 'manual'
  ) => {
    if (dishes.length === 0) {
      setError('No hay platos en el catálogo. Añade platos primero.')
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

      const result = generateWeeklyMenu({ dishIdeas: dishes, weekStart, rules })

      // The menu is saved either way — a degraded week beats no week — but the
      // household is told, instead of receiving something that breaks the rules
      // it just set and never hearing about it.
      setDegraded(result.degraded ? describeDegradedMenu(result.unmet) : null)
      if (result.degraded) {
        trackEvent('menu_degraded', {
          unmet: result.unmet.map((r) => r.label).join(', ') || 'rule_combination',
        })
      }

      const menuData = {
        household_id: householdId,
        week_start: formatLocalDate(weekStart),
        week_end: formatLocalDate(weekEnd),
        menu_items: result.items,
      }

      const { data: existingMenu } = await supabase
        .from('weekly_menus')
        .select('id')
        .eq('household_id', householdId)
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
          .eq('household_id', householdId)
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
            .eq('household_id', householdId)
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
      trackEvent('menu_generated', { week_start: menuData.week_start, trigger })
    } catch (err) {
      console.error('Error generating menu:', err)
      if (err instanceof Error && !err.message.includes('duplicate key')) {
        setError(err instanceof Error ? err.message : 'No se pudo generar el menú')
      }
    } finally {
      isGeneratingMenuRef.current = false
    }
  }, [householdId, rules])

  const loadCurrentMenu = useCallback(async (shouldGenerateIfMissing = false) => {
    try {
      const weekStart = getCurrentWeekSaturday()
      const weekStartFormatted = formatLocalDate(weekStart)

      const { data, error } = await supabase
        .from('weekly_menus')
        .select('*')
        .eq('household_id', householdId)
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
      setError(err instanceof Error ? err.message : 'No se pudo cargar el menú')
    }
  }, [householdId, dishIdeas, generateNewMenu])

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
          .eq('household_id', householdId)
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
            .eq('household_id', householdId)
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

              const result = generateWeeklyMenu({
                dishIdeas: dishesData as DishIdea[],
                weekStart,
                rules: rulesRef.current,
              })
              setDegraded(result.degraded ? describeDegradedMenu(result.unmet) : null)

              const newMenuData = {
                household_id: householdId,
                week_start: formatLocalDate(weekStart),
                week_end: formatLocalDate(weekEnd),
                menu_items: result.items,
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
                trackEvent('menu_generated', {
                  week_start: newMenuData.week_start,
                  trigger: 'auto_initial_load',
                })
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
          setError(err instanceof Error ? err.message : 'No se pudieron cargar los datos')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeData()

    menuChannel = supabase
      .channel(`weekly_menus_changes_${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_menus',
          filter: `household_id=eq.${householdId}`,
        },
        async (payload) => {
          if (mounted && !isGeneratingMenuRef.current) {
            const currentWeekStart = formatLocalDate(getCurrentWeekSaturday())
            const nextWeekStart = formatLocalDate(getNextWeekSaturday())
            const changedWeekStart = (payload.new as Partial<WeeklyMenu> | null)?.week_start

            if (changedWeekStart === currentWeekStart) {
              const { data } = await supabase
                .from('weekly_menus')
                .select('*')
                .eq('household_id', householdId)
                .eq('week_start', currentWeekStart)
                .maybeSingle()
              if (data && mounted) setCurrentMenu(data as WeeklyMenu)
            } else if (changedWeekStart === nextWeekStart) {
              const { data } = await supabase
                .from('weekly_menus')
                .select('*')
                .eq('household_id', householdId)
                .eq('week_start', nextWeekStart)
                .maybeSingle()
              if (data && mounted) setNextWeekMenu(data as WeeklyMenu)
            }
          }
        }
      )
      .subscribe()

    dishChannel = supabase
      .channel(`dish_ideas_changes_${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dish_ideas',
          filter: `household_id=eq.${householdId}`,
        },
        async () => {
          if (mounted) {
            const { data } = await supabase
              .from('dish_ideas')
              .select('*')
              .eq('household_id', householdId)
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
  }, [householdId])

  const handleWeekNav = useCallback(async (direction: -1 | 1) => {
    const newOffset = (weekOffset + direction) as 0 | 1
    if (newOffset < 0 || newOffset > 1) return

    setWeekOffset(newOffset)

    if (newOffset === 1 && !nextWeekMenu) {
      trackEvent('next_week_menu_viewed')
      setIsLoadingNextWeek(true)
      try {
        const nextWeekStart = getNextWeekSaturday()
        const { data, error } = await supabase
          .from('weekly_menus')
          .select('*')
          .eq('household_id', householdId)
          .eq('week_start', formatLocalDate(nextWeekStart))
          .maybeSingle()

        if (error && error.code !== 'PGRST116') throw error

        if (data) {
          setNextWeekMenu(data as WeeklyMenu)
        } else {
          await generateNewMenu(nextWeekStart, dishIdeas, setNextWeekMenu, 'next_week')
        }
      } catch (err) {
        console.error('Error loading next week menu:', err)
        setError(err instanceof Error ? err.message : 'No se pudo cargar el menú de la próxima semana')
        setWeekOffset(0)
      } finally {
        setIsLoadingNextWeek(false)
      }
    }
  }, [weekOffset, nextWeekMenu, dishIdeas, generateNewMenu, householdId])

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
      trackEvent('menu_item_edited', {
        meal_type: mealType,
        dish_slot: dishSlot,
        selected_category: selectedCategory,
      })
    } catch (err) {
      console.error('Error updating menu item:', err)
      setActiveMenu(activeMenu)
    }
  }, [currentMenu, nextWeekMenu, weekOffset, dishIdeas])

  const handleAddNewDish = useCallback(async (dishData: NewDishIdea) => {
    try {
      const { error } = await supabase
        .from('dish_ideas')
        .insert({ ...dishData, household_id: householdId })
      if (error) throw error
      trackEvent('dish_added', { category: dishData.category })
    } catch (err) {
      console.error('Error adding dish:', err)
      setError(err instanceof Error ? err.message : 'No se pudo añadir el plato')
    }
  }, [householdId])

  const handleSaveDish = useCallback(async (dishData: NewDishIdea, dishId?: string) => {
    try {
      if (dishId) {
        const { error } = await supabase
          .from('dish_ideas')
          .update({ ...dishData, updated_at: new Date().toISOString() })
          .eq('id', dishId)
          .eq('household_id', householdId)
        if (error) throw error
        trackEvent('dish_edited', { category: dishData.category })
      } else {
        const { error } = await supabase
          .from('dish_ideas')
          .insert({ ...dishData, household_id: householdId })
        if (error) throw error
        trackEvent('dish_added', { category: dishData.category })
      }
      await loadDishIdeas()
    } catch (err) {
      console.error('Error saving dish:', err)
      setError(err instanceof Error ? err.message : 'No se pudo guardar el plato')
    }
  }, [householdId, loadDishIdeas])

  const handleDeleteDish = useCallback(async (dishId: string) => {
    try {
      const { error } = await supabase
        .from('dish_ideas')
        .delete()
        .eq('id', dishId)
        .eq('household_id', householdId)
      if (error) throw error
      trackEvent('dish_deleted')
      await loadDishIdeas()
    } catch (err) {
      console.error('Error deleting dish:', err)
      setError(err instanceof Error ? err.message : 'No se pudo borrar el plato')
    }
  }, [householdId, loadDishIdeas])

  const handleSeedCatalog = useCallback(async () => {
    // Don't duplicate dishes the household already has.
    const existingNames = new Set(dishIdeas.map((d) => d.name.toLowerCase()))
    const missing = STARTER_CATALOG.filter((d) => !existingNames.has(d.name.toLowerCase()))
    if (missing.length === 0) return
    try {
      const { error } = await supabase
        .from('dish_ideas')
        .insert(missing.map((dish) => ({ ...dish, household_id: householdId })))
      if (error) throw error
      await loadDishIdeas()
      trackEvent('catalog_seeded', { dish_count: missing.length })
    } catch (err) {
      console.error('Error seeding starter catalog:', err)
      setError('No se pudo añadir el catálogo sugerido')
    }
  }, [dishIdeas, householdId, loadDishIdeas])

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-full border-4 border-crema-300 border-t-verde-500 animate-spin motion-reduce:animate-pulse" />
          <p className="mt-4 text-lg font-extrabold">Montando vuestra semana…</p>
          <p className="mt-1 text-sm font-bold font-sans text-tinta-500">Un segundo, que lo tenemos casi.</p>
        </div>
      </div>
    )
  }

  if (error && !currentMenu) {
    return (
      <div className="min-h-screen flex items-center justify-center p-7">
        <div className="card max-w-md border-[3px] border-rojo-500 text-center" role="alert">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rojo-100 text-[30px] font-extrabold text-rojo-500"
            aria-hidden="true"
          >
            !
          </div>
          <h2 className="mt-[18px] text-lg font-extrabold text-rojo-500">Algo se ha torcido</h2>
          <p className="mt-2 text-sm font-bold font-sans text-tinta-500">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              setError(null)
              loadDishIdeas()
                .then(() => loadCurrentMenu(true))
                .finally(() => setLoading(false))
            }}
            className="btn-dark mt-5"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const displayedMenu = weekOffset === 0 ? currentMenu : nextWeekMenu
  const catalogReady = isCatalogReady(dishIdeas, rules)

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1280px] px-[22px] pt-4 pb-7 lg:px-10 lg:pt-7 lg:pb-11">
        {!isEditing && (
          <header className="flex items-start justify-between gap-4 lg:items-center">
            <div className="flex items-baseline gap-3">
              {/* On the agenda the logo is the page h1; the other views bring their own. */}
              <Wordmark as={view === 'agenda' ? 'h1' : 'div'} onClick={() => setView('agenda')} />
              {view === 'agenda' && (
                <span className="hidden text-[15px] font-extrabold text-tinta-500 lg:inline">
                  {household.name} · código {household.join_code}
                </span>
              )}
            </div>

            <nav className="flex items-center gap-2 lg:gap-3">
              <button
                onClick={() => setView(view === 'catalog' ? 'agenda' : 'catalog')}
                aria-current={view === 'catalog' ? 'page' : undefined}
                className={`btn-secondary !px-4 !py-2 !min-h-[40px] !text-sm ${
                  view === 'catalog' ? '!border-tinta-900 !text-tinta-900' : ''
                }`}
              >
                Platos
              </button>
              <button
                onClick={() => setView(view === 'family' ? 'agenda' : 'family')}
                aria-current={view === 'family' ? 'page' : undefined}
                className={`btn-secondary !px-4 !py-2 !min-h-[40px] !text-sm ${
                  view === 'family' ? '!border-tinta-900 !text-tinta-900' : ''
                }`}
              >
                Familia
              </button>
              {view === 'agenda' && displayedMenu && (
                <button onClick={() => setIsEditing(true)} className="btn-dark hidden lg:inline-flex">
                  ✎ Editar la semana
                </button>
              )}
            </nav>
          </header>
        )}

        <main className={isEditing ? '' : 'mt-3.5 lg:mt-6'}>
          {error && (
            <div className="mb-4 rounded-2xl border-2 border-amarillo-300 bg-amarillo-100 p-4">
              <p className="text-sm font-bold font-sans text-amarillo-700">{error}</p>
            </div>
          )}

          {degraded && view === 'agenda' && !isEditing && (
            <div
              className="mb-4 rounded-2xl border-2 border-amarillo-500 bg-amarillo-100 p-4"
              role="status"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-amarillo-500 text-sm font-extrabold text-tinta-900"
                  aria-hidden="true"
                >
                  !
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-amarillo-700">{degraded.title}</p>
                  <p className="mt-1 text-[13px] font-bold font-sans leading-[1.4] text-amarillo-700">
                    {degraded.detail}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      onClick={() => setView('family')}
                      className="rounded-full bg-tinta-900 px-4 py-1.5 text-[13px] font-extrabold text-crema-100 transition-colors duration-120 hover:bg-tinta-700 focus:outline-none focus:ring-2 focus:ring-tinta-900 focus:ring-offset-2"
                    >
                      Cambiar reglas
                    </button>
                    <button
                      onClick={() => setView('catalog')}
                      className="rounded-full border-2 border-tinta-900 px-4 py-1.5 text-[13px] font-extrabold text-tinta-900 transition-colors duration-120 hover:bg-amarillo-300 focus:outline-none focus:ring-2 focus:ring-tinta-900 focus:ring-offset-2"
                    >
                      Añadir platos
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'catalog' ? (
            <CatalogView
              dishIdeas={dishIdeas}
              householdName={household.name}
              onSaveDish={handleSaveDish}
              onDeleteDish={handleDeleteDish}
            />
          ) : view === 'family' ? (
            <FamilyView
              household={household}
              onRegenerateWeek={() =>
                generateNewMenu(getCurrentWeekSaturday(), dishIdeas, setCurrentMenu)
              }
            />
          ) : isLoadingNextWeek ? (
            <div className="card py-12 text-center" role="status" aria-live="polite">
              <div className="mx-auto h-14 w-14 rounded-full border-4 border-crema-300 border-t-verde-500 animate-spin motion-reduce:animate-pulse" />
              <p className="mt-4 text-lg font-extrabold">Montando la próxima semana…</p>
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
              isEditing={isEditing}
              onToggleEditing={setIsEditing}
            />
          ) : (
            <div className="card mx-auto max-w-md text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-crema-200 text-[30px]"
                aria-hidden="true"
              >
                🍽
              </div>
              <h2 className="mt-[18px] text-lg font-extrabold">
                Aún no hay plan para esta semana
              </h2>
              {catalogReady ? (
                <>
                  <p className="mt-2 text-sm font-bold font-sans text-tinta-500">
                    Vuestro catálogo ya da para una semana entera.
                  </p>
                  <button
                    onClick={() => generateNewMenu(getCurrentWeekSaturday(), dishIdeas, setCurrentMenu)}
                    className="btn-primary mt-4 w-full"
                  >
                    Generar menú
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm font-bold font-sans text-tinta-500">
                    {dishIdeas.length === 0
                      ? 'Necesitáis al menos 20 platos en el catálogo para montar la semana.'
                      : `Lleváis ${dishIdeas.length} ${dishIdeas.length === 1 ? 'plato' : 'platos'}. Faltan algunos mínimos para montar la semana.`}
                  </p>
                  <div className="mt-4 text-left">
                    <CatalogChecklist dishIdeas={dishIdeas} rules={rules} />
                  </div>
                  <button onClick={() => setView('catalog')} className="btn-primary mt-4 w-full">
                    Añadir platos
                  </button>
                  <button onClick={handleSeedCatalog} className="btn-secondary mt-2 w-full">
                    Usar el catálogo sugerido
                  </button>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {session?.user && <FeedbackButton householdId={household.id} userId={session.user.id} />}
    </div>
  )
}

export default App
