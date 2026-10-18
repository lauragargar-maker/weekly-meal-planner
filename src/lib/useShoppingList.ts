import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { trackEvent } from './analytics'
import { ShoppingIngredient, ShoppingList, ShoppingListItem, StoreSection, WeeklyMenu } from '../types'
import { formatLocalDate, weekStartFor } from '../utils/weekStart'
import { guessIngredient } from '../data/starterIngredients'
import { cleanName, toKey } from './nameKey'
import { ListInputs, buildShoppingList, itemsForReplacement, listFingerprint, listStatus } from './shoppingList'

/** Same limit as the database's CHECK on `shopping_list_items.name`. */
export const ITEM_NAME_MAX_LENGTH = 60

interface Options {
  householdId: string
  userId: string | null
  /** The household's ingredient catalogue, to reuse an ingredient typed by hand. */
  catalog: ShoppingIngredient[]
  /** Called after an ingredient became a staple, so Platos reloads. */
  onIngredientsChanged: () => void
}

/**
 * The household's shopping list and everything that changes it.
 * docs/shopping-list-spec.md §5.
 *
 * Ticks are applied on screen first and saved after (§5.9); a failed save
 * puts the item back and reports it. Other members' changes arrive through
 * Supabase realtime and simply reload the list — it is short, and a reload
 * cannot get out of step the way patching rows one by one can.
 */
export function useShoppingList({ householdId, userId, catalog, onIngredientsChanged }: Options) {
  const [list, setList] = useState<ShoppingList | null>(null)
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const listRef = useRef<ShoppingList | null>(null)
  listRef.current = list

  const reload = useCallback(async () => {
    try {
      const { data: listData, error: listError } = await supabase
        .from('shopping_lists')
        .select('*')
        .eq('household_id', householdId)
        .maybeSingle()
      if (listError) throw listError
      if (!listData) {
        setList(null)
        setItems([])
        return
      }
      const { data: itemData, error: itemError } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('list_id', (listData as ShoppingList).id)
        .order('created_at')
      if (itemError) throw itemError
      setList(listData as ShoppingList)
      setItems((itemData ?? []) as ShoppingListItem[])
    } catch (err) {
      // A household whose database lacks the tables yet just has no list.
      console.error('Error loading shopping list:', err)
    } finally {
      setLoaded(true)
    }
  }, [householdId])

  useEffect(() => {
    reload()
    // Several rows change at once when a list is replaced; one reload is enough.
    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleReload = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(reload, 250)
    }
    const channel = supabase
      .channel(`shopping_list_${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_lists', filter: `household_id=eq.${householdId}` },
        scheduleReload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_list_items', filter: `household_id=eq.${householdId}` },
        scheduleReload
      )
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [householdId, reload])

  const fail = useCallback((message: string, err: unknown) => {
    console.error(message, err)
    setSaveError('No se pudo guardar. Revisa la conexión.')
  }, [])

  /**
   * The menus of this week and the next, read only (§5.2): the picker shows
   * them and the staleness check compares against them. Never generates one.
   */
  const fetchMenus = useCallback(async (): Promise<WeeklyMenu[]> => {
    const { data, error } = await supabase
      .from('weekly_menus')
      .select('*')
      .eq('household_id', householdId)
      .in('week_start', [formatLocalDate(weekStartFor(0)), formatLocalDate(weekStartFor(1))])
    if (error) throw error
    return (data ?? []) as WeeklyMenu[]
  }, [householdId])

  /**
   * Makes the list for `days`, replacing the current one (§5.4, §5.6). The
   * list row is updated in place, so it keeps its id and members watching it
   * see the change rather than a deletion.
   */
  const generate = useCallback(
    async (days: string[], inputs: ListInputs, trigger: 'new' | 'regenerate') => {
      const draft = buildShoppingList(days, inputs)
      const previous = listRef.current
      const previousStatus = previous ? listStatus(previous, items, new Date()) : null
      const nextItems = itemsForReplacement(draft.items, previous ? items : [], previousStatus)
      const fingerprint = listFingerprint([...draft.days, ...draft.skippedDays], inputs)

      const { data: listRow, error: listError } = await supabase
        .from('shopping_lists')
        .upsert(
          {
            household_id: householdId,
            days: draft.days,
            skipped_days: draft.skippedDays,
            missing_dishes: draft.missingDishes,
            fingerprint,
            generated_by: userId,
            generated_at: new Date().toISOString(),
          },
          { onConflict: 'household_id' }
        )
        .select('*')
        .single()
      if (listError) throw listError
      const saved = listRow as ShoppingList

      const { error: deleteError } = await supabase.from('shopping_list_items').delete().eq('list_id', saved.id)
      if (deleteError) throw deleteError
      if (nextItems.length > 0) {
        const { error: insertError } = await supabase.from('shopping_list_items').insert(
          nextItems.map((item) => ({
            ...item,
            list_id: saved.id,
            household_id: householdId,
            checked_by: item.checked ? userId : null,
            checked_at: item.checked ? new Date().toISOString() : null,
          }))
        )
        if (insertError) throw insertError
      }

      trackEvent('shopping_list_generated', {
        trigger,
        previous: previousStatus ?? 'none',
        days_selected: days.length,
        days_included: draft.days.length,
        days_skipped: draft.skippedDays.length,
        item_count: nextItems.length,
        missing_dish_count: draft.missingDishes.length,
      })
      await reload()
    },
    [householdId, userId, items, reload]
  )

  const toggle = useCallback(
    async (item: ShoppingListItem) => {
      const checked = !item.checked
      const patch = {
        checked,
        checked_by: checked ? userId : null,
        checked_at: checked ? new Date().toISOString() : null,
      }
      const before = items
      const after = items.map((i) => (i.id === item.id ? { ...i, ...patch } : i))
      setItems(after)
      const { error } = await supabase.from('shopping_list_items').update(patch).eq('id', item.id)
      if (error) {
        setItems(before)
        fail('Error ticking shopping item:', error)
        return
      }
      trackEvent('shopping_item_checked', { checked, origin: item.origin })
      if (checked && after.every((i) => i.checked)) {
        const list = listRef.current
        const daysLeft = list ? list.days.filter((day) => day >= formatLocalDate(new Date())).length : 0
        trackEvent('shopping_list_completed', { item_count: after.length, days_left: daysLeft })
      }
    },
    [items, userId, fail]
  )

  /**
   * Adds something by hand (§5.5, D5). A name already on the list is not added
   * twice: it is unticked if it was ticked. Returns what happened, for the
   * screen to say so.
   */
  const addManual = useCallback(
    async (rawName: string): Promise<'added' | 'exists' | 'reopened' | 'failed'> => {
      const list = listRef.current
      const name = cleanName(rawName).slice(0, ITEM_NAME_MAX_LENGTH)
      if (!list || !name) return 'failed'
      const key = toKey(name)
      const existing = items.find((item) => toKey(item.name) === key)
      if (existing) {
        if (!existing.checked) return 'exists'
        await toggle(existing)
        return 'reopened'
      }
      const known = catalog.find((ingredient) => ingredient.name_key === key)
      const row = {
        list_id: list.id,
        household_id: householdId,
        ingredient_id: known?.id ?? null,
        name: known?.name ?? name.charAt(0).toLocaleUpperCase('es') + name.slice(1),
        section: known?.section ?? guessIngredient(name).section,
        origin: 'manual' as const,
        sources: [],
        checked: false,
      }
      const { data, error } = await supabase.from('shopping_list_items').insert(row).select('*').single()
      if (error) {
        fail('Error adding shopping item:', error)
        return 'failed'
      }
      setItems((current) => [...current, data as ShoppingListItem])
      trackEvent('shopping_item_added_manually', { from_catalog: Boolean(known) })
      return 'added'
    },
    [items, catalog, householdId, toggle, fail]
  )

  /**
   * Takes an item off the list. With `markStaple` its ingredient also becomes
   * a staple everywhere; `fingerprint` is then the list's fingerprint with
   * that staple applied, so a change made from the list itself does not read
   * as the menu having changed (§5.7).
   */
  const removeItem = useCallback(
    async (item: ShoppingListItem, markStaple = false, fingerprint?: string) => {
      const before = items
      setItems(items.filter((i) => i.id !== item.id))
      const { error } = await supabase.from('shopping_list_items').delete().eq('id', item.id)
      if (error) {
        setItems(before)
        fail('Error removing shopping item:', error)
        return
      }
      if (markStaple && item.ingredient_id) {
        const { error: stapleError } = await supabase
          .from('ingredients')
          .update({ is_staple: true })
          .eq('id', item.ingredient_id)
          .eq('household_id', householdId)
        if (stapleError) {
          fail('Error marking ingredient as staple:', stapleError)
          return
        }
        const list = listRef.current
        if (list && fingerprint) {
          setList({ ...list, fingerprint })
          const { error: listError } = await supabase.from('shopping_lists').update({ fingerprint }).eq('id', list.id)
          if (listError) console.error('Error updating shopping list fingerprint:', listError)
        }
        onIngredientsChanged()
      }
      trackEvent('shopping_item_removed', { marked_staple: markStaple })
    },
    [items, householdId, onIngredientsChanged, fail]
  )

  const setSection = useCallback(
    async (item: ShoppingListItem, section: StoreSection) => {
      const before = items
      setItems(items.map((i) => (i.id === item.id ? { ...i, section } : i)))
      const { error } = await supabase.from('shopping_list_items').update({ section }).eq('id', item.id)
      if (error) {
        setItems(before)
        fail('Error moving shopping item:', error)
      }
    },
    [items, fail]
  )

  const clearChecked = useCallback(async () => {
    const list = listRef.current
    if (!list) return
    const before = items
    setItems(items.filter((i) => !i.checked))
    const { error } = await supabase.from('shopping_list_items').delete().eq('list_id', list.id).eq('checked', true)
    if (error) {
      setItems(before)
      fail('Error clearing ticked items:', error)
    }
  }, [items, fail])

  return {
    list,
    items,
    loaded,
    saveError,
    clearSaveError: () => setSaveError(null),
    reload,
    fetchMenus,
    generate,
    toggle,
    addManual,
    removeItem,
    setSection,
    clearChecked,
  }
}

export type ShoppingListState = ReturnType<typeof useShoppingList>
