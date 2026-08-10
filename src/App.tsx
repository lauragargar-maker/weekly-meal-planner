import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useAuth } from './lib/auth-context'
import { WeeklyMenu, DishIdea, NewDishIdea, Household } from './types'
import MenuAgendaView from './components/MenuAgendaView'
import CatalogView from './components/CatalogView'
import FamilyView from './components/FamilyView'
import CatalogChecklist from './components/CatalogChecklist'
import WeekNav from './components/WeekNav'
import BottomNav from './components/BottomNav'
import { DESTINATIONS, Destination } from './components/destinations'
import FeedbackSheet, { FeedbackScreen } from './components/FeedbackSheet'
import { IconFeedback } from './components/icons'
import { generateWeeklyMenu } from './utils/menuGenerator'
import { isCatalogReady } from './utils/catalogCheck'
import { parseRules } from './lib/householdRules'
import { describeDegradedMenu } from './lib/degradedMenu'
import { STARTER_CATALOG } from './data/starterCatalog'
import { identifyHousehold, trackEvent } from './lib/analytics'
import { WEEK_RANGE, formatLocalDate, weekEndFor, weekKeyFor, weekStartFor } from './utils/weekStart'

/**
 * The "¡Ñam!" wordmark. It used to be the way back to the weekly plan; now that
 * there are three explicit destinations it is only branding — tapping it does
 * nothing. See `specs/navigation.md`.
 */
function Wordmark({ as: Tag }: { as: 'h1' | 'div' }) {
  return (
    <Tag className="inline-block -rotate-2 text-[28px] font-extrabold leading-none text-rojo-500 lg:text-[34px]">
      ¡Ñam!
    </Tag>
  )
}

/** What the feedback payload calls each destination. */
const FEEDBACK_SCREEN: Record<Destination, FeedbackScreen> = {
  agenda: 'semana',
  catalog: 'platos',
  family: 'familia',
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
  // Every week the session has looked at, keyed by its `week_start`. Keyed by
  // the date and not by the offset on purpose: it is what the realtime payloads
  // carry, and an offset stops meaning the same week once midnight rolls the
  // calendar over.
  const [menusByWeek, setMenusByWeek] = useState<Record<string, WeeklyMenu>>({})
  const [weekOffset, setWeekOffset] = useState(0)
  const [loadingWeek, setLoadingWeek] = useState<string | null>(null)
  const [dishIdeas, setDishIdeas] = useState<DishIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [view, setView] = useState<Destination>('agenda')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // Tagged with the week it was produced for, so the warning does not follow the
  // user onto a week it says nothing about.
  const [degraded, setDegraded] = useState<{ title: string; detail: string; weekStart: string } | null>(null)
  const isGeneratingMenuRef = useRef(false)

  const displayedWeekKey = weekKeyFor(weekOffset)
  const displayedMenu = menusByWeek[displayedWeekKey] ?? null
  // History is shown, never edited or regenerated.
  const readOnly = weekOffset < 0

  const storeMenu = useCallback((menu: WeeklyMenu) => {
    setMenusByWeek((prev) => ({ ...prev, [menu.week_start]: menu }))
  }, [])

  // The realtime effect subscribes once per household, so it reads the loaded
  // weeks through a ref rather than closing over a stale copy.
  const menusByWeekRef = useRef(menusByWeek)
  useEffect(() => {
    menusByWeekRef.current = menusByWeek
  }, [menusByWeek])

  useEffect(() => {
    identifyHousehold(householdId)
  }, [householdId])

  /**
   * Each destination starts at the top; only coming back from a sheet keeps the
   * scroll position, and a sheet never changes the destination.
   */
  const goTo = (destination: Destination) => {
    if (destination === view) return
    setView(destination)
    window.scrollTo({ top: 0 })
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
      const weekEnd = weekEndFor(weekStart)

      const result = generateWeeklyMenu({ dishIdeas: dishes, weekStart, rules })

      // The menu is saved either way — a degraded week beats no week — but the
      // household is told, instead of receiving something that breaks the rules
      // it just set and never hearing about it.
      setDegraded(
        result.degraded
          ? { ...describeDegradedMenu(result.unmet), weekStart: formatLocalDate(weekStart) }
          : null
      )
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
        storeMenu(updateData as WeeklyMenu)
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
          storeMenu(updateData as WeeklyMenu)
          setError(null)
          return
        }
        throw error
      }

      storeMenu(data as WeeklyMenu)
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
  }, [householdId, rules, storeMenu])

  const loadCurrentMenu = useCallback(async (shouldGenerateIfMissing = false) => {
    try {
      const weekStart = weekStartFor(0)

      const { data, error } = await supabase
        .from('weekly_menus')
        .select('*')
        .eq('household_id', householdId)
        .eq('week_start', formatLocalDate(weekStart))
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        storeMenu(data as WeeklyMenu)
        setError(null)
      } else if (shouldGenerateIfMissing && dishIdeas.length > 0 && !isGeneratingMenuRef.current) {
        await generateNewMenu(weekStart, dishIdeas)
      }
    } catch (err) {
      console.error('Error loading menu:', err)
      setError(err instanceof Error ? err.message : 'No se pudo cargar el menú')
    }
  }, [householdId, dishIdeas, generateNewMenu, storeMenu])

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
          // Only the current week is fetched up front, and only it is generated
          // when missing. Past and future weeks load on demand, when navigated to.
          const weekStart = weekStartFor(0)
          const weekStartFormatted = formatLocalDate(weekStart)

          const { data: menuData, error: menuError } = await supabase
            .from('weekly_menus')
            .select('*')
            .eq('household_id', householdId)
            .eq('week_start', weekStartFormatted)
            .maybeSingle()

          if (menuError && menuError.code !== 'PGRST116') throw menuError

          if (menuData) {
            storeMenu(menuData as WeeklyMenu)
          } else if (dishesData && dishesData.length > 0 && !isGeneratingMenuRef.current) {
            isGeneratingMenuRef.current = true
            try {
              const weekEnd = weekEndFor(weekStart)

              const result = generateWeeklyMenu({
                dishIdeas: dishesData as DishIdea[],
                weekStart,
                rules: rulesRef.current,
              })
              setDegraded(
                result.degraded
                  ? { ...describeDegradedMenu(result.unmet), weekStart: weekStartFormatted }
                  : null
              )

              const newMenuData = {
                household_id: householdId,
                week_start: weekStartFormatted,
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
                storeMenu(insertedMenu as WeeklyMenu)
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
          if (!mounted || isGeneratingMenuRef.current) return

          const changedWeekStart = (payload.new as Partial<WeeklyMenu> | null)?.week_start
          if (!changedWeekStart) return

          // Refresh only weeks this session has already loaded. Deliberately a
          // membership test and not a range check: a week nobody is looking at
          // is not worth a fetch, and this needs no edit if the navigation
          // range is ever widened.
          if (!(changedWeekStart in menusByWeekRef.current)) return

          const { data } = await supabase
            .from('weekly_menus')
            .select('*')
            .eq('household_id', householdId)
            .eq('week_start', changedWeekStart)
            .maybeSingle()
          if (data && mounted) storeMenu(data as WeeklyMenu)
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
  }, [householdId, storeMenu])

  const handleWeekNav = useCallback(async (direction: -1 | 1) => {
    const newOffset = weekOffset + direction
    if (newOffset < WEEK_RANGE.min || newOffset > WEEK_RANGE.max) return

    setWeekOffset(newOffset)
    trackEvent('week_viewed', { offset: newOffset })

    const weekStart = weekStartFor(newOffset)
    const weekKey = formatLocalDate(weekStart)
    if (menusByWeek[weekKey]) return

    // Kept alongside `week_viewed` so the existing Amplitude series is not
    // broken. It fires under the same condition it always did — reaching next
    // week for the first time — even though the name no longer covers the
    // navigation as a whole.
    if (newOffset === 1) trackEvent('next_week_menu_viewed')

    setLoadingWeek(weekKey)
    try {
      const { data, error } = await supabase
        .from('weekly_menus')
        .select('*')
        .eq('household_id', householdId)
        .eq('week_start', weekKey)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error

      // A missing week is only filled in going forward. Backwards, nothing
      // saved means nothing was planned, and inventing a menu for days already
      // lived would be inventing history.
      if (data) {
        storeMenu(data as WeeklyMenu)
      } else if (newOffset > 0) {
        await generateNewMenu(weekStart, dishIdeas, 'next_week')
      }
    } catch (err) {
      console.error('Error loading week menu:', err)
      setError(err instanceof Error ? err.message : 'No se pudo cargar el menú de esa semana')
      setWeekOffset(weekOffset)
    } finally {
      setLoadingWeek(null)
    }
  }, [weekOffset, menusByWeek, dishIdeas, generateNewMenu, householdId, storeMenu])

  const updateMenuItem = useCallback(async (
    dayISO: string,
    mealType: 'lunch' | 'dinner',
    dishSlot: 'starter' | 'main' | 'single',
    newDishName: string,
    selectedCategory: 'starter' | 'main' | 'single'
  ) => {
    const activeMenu = menusByWeek[displayedWeekKey]
    if (!activeMenu || readOnly) return

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

    storeMenu({ ...activeMenu, menu_items: updatedItems })

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
      storeMenu(activeMenu)
    }
  }, [menusByWeek, displayedWeekKey, readOnly, dishIdeas, storeMenu])

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

  // The full-screen error is for "nothing loaded at all". It stays tied to the
  // current week: an empty past week is a normal state, not a broken app.
  if (error && !menusByWeek[weekKeyFor(0)]) {
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

  const catalogReady = isCatalogReady(dishIdeas, rules)

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[1280px] px-[22px] pt-4 pb-[calc(76px+env(safe-area-inset-bottom))] lg:px-10 lg:pt-7 md:pb-7 lg:pb-11">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 lg:gap-6">
            {/* On the agenda the logo is the page h1; the other views bring their own. */}
            <Wordmark as={view === 'agenda' ? 'h1' : 'div'} />

            {/* Above 768px the three destinations live here instead of in the bottom bar. */}
            <nav aria-label="Principal" className="hidden items-center gap-4 md:flex">
              {DESTINATIONS.map(({ id, label }) => {
                const isActive = id === view
                return (
                  <button
                    key={id}
                    onClick={() => goTo(id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`border-b-[3px] pb-[3px] text-[15px] font-extrabold transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 ${
                      isActive
                        ? 'border-rojo-500 text-rojo-600'
                        : 'border-transparent text-tinta-500 hover:border-crema-300'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {view === 'agenda' && displayedMenu && !readOnly && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="btn-dark hidden lg:inline-flex">
                ✎ Editar la semana
              </button>
            )}
            <span className="hidden text-[13px] font-extrabold text-tinta-500 md:inline">
              {household.name}
            </span>
            {session?.user && (
              <button
                onClick={() => setFeedbackOpen(true)}
                aria-label="Contarnos qué tal"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-tinta-900 bg-white text-tinta-900 shadow-[3px_3px_0_#f6ecd8] transition-transform duration-120 active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
              >
                <IconFeedback />
              </button>
            )}
          </div>
        </header>

        <main className="mt-3.5 lg:mt-6">
          {error && (
            <div className="mb-4 rounded-2xl border-2 border-amarillo-300 bg-amarillo-100 p-4">
              <p className="text-sm font-bold font-sans text-amarillo-700">{error}</p>
            </div>
          )}

          {degraded?.weekStart === displayedWeekKey && view === 'agenda' && !isEditing && (
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
                      onClick={() => goTo('family')}
                      className="rounded-full bg-tinta-900 px-4 py-1.5 text-[13px] font-extrabold text-crema-100 transition-colors duration-120 hover:bg-tinta-700 focus:outline-none focus:ring-2 focus:ring-tinta-900 focus:ring-offset-2"
                    >
                      Cambiar reglas
                    </button>
                    <button
                      onClick={() => goTo('catalog')}
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
              onRegenerateWeek={() => generateNewMenu(weekStartFor(0), dishIdeas)}
            />
          ) : (
            <>
              {/* Outside the agenda component so that a week with no menu saved
                  is still navigable — otherwise an empty past week traps you. */}
              {!isEditing && (
                <WeekNav
                  weekOffset={weekOffset}
                  canGoBack={weekOffset > WEEK_RANGE.min}
                  canGoForward={weekOffset < WEEK_RANGE.max}
                  onNavigate={handleWeekNav}
                />
              )}

              {loadingWeek ? (
                <div className="card mt-4 py-12 text-center" role="status" aria-live="polite">
                  <div className="mx-auto h-14 w-14 rounded-full border-4 border-crema-300 border-t-verde-500 animate-spin motion-reduce:animate-pulse" />
                  <p className="mt-4 text-lg font-extrabold">
                    {/* Going back only ever fetches; going forward may generate. */}
                    {readOnly ? 'Buscando esa semana…' : 'Montando la próxima semana…'}
                  </p>
                </div>
              ) : displayedMenu ? (
                <MenuAgendaView
                  menu={displayedMenu}
                  dishIdeas={dishIdeas}
                  onUpdateDish={updateMenuItem}
                  onAddNewDish={handleAddNewDish}
                  readOnly={readOnly}
                  isEditing={isEditing}
                  onToggleEditing={setIsEditing}
                />
              ) : readOnly ? (
                <div className="card mx-auto mt-4 max-w-md text-center">
                  <div
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-crema-200 text-[30px]"
                    aria-hidden="true"
                  >
                    🗓
                  </div>
                  <h2 className="mt-[18px] text-lg font-extrabold">
                    De esta semana no guardasteis nada
                  </h2>
                  <p className="mt-2 text-sm font-bold font-sans text-tinta-500">
                    Aquí aparecen los menús de semanas anteriores, tal y como quedaron.
                  </p>
                </div>
              ) : (
                <div className="card mx-auto mt-4 max-w-md text-center">
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
                        onClick={() => generateNewMenu(weekStartFor(weekOffset), dishIdeas)}
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
                      <button onClick={() => goTo('catalog')} className="btn-primary mt-4 w-full">
                        Añadir platos
                      </button>
                      <button onClick={handleSeedCatalog} className="btn-secondary mt-2 w-full">
                        Usar el catálogo sugerido
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <BottomNav active={view} onNavigate={goTo} />

      {feedbackOpen && session?.user && (
        <FeedbackSheet
          screen={FEEDBACK_SCREEN[view]}
          householdId={household.id}
          userId={session.user.id}
          onClose={() => setFeedbackOpen(false)}
        />
      )}
    </div>
  )
}

export default App
