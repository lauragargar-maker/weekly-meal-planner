import { useCallback, useEffect, useMemo, useState } from 'react'
import { DishIdea, DishIngredient, ShoppingIngredient, WeeklyMenu } from '../types'
import { ListInputs, ListStatus, formatRange, listFingerprint, menuItemsByDay } from '../lib/shoppingList'
import { ShoppingListState } from '../lib/useShoppingList'
import ShoppingDayPicker from './ShoppingDayPicker'
import ShoppingListView from './ShoppingListView'

export type ShoppingMode = 'picker' | 'list'

interface ShoppingOverlayProps {
  mode: ShoppingMode
  onModeChange: (mode: ShoppingMode) => void
  shopping: ShoppingListState
  status: ListStatus | null
  userId: string | null
  dishes: DishIdea[]
  links: DishIngredient[]
  catalog: ShoppingIngredient[]
  /** Changes whenever a menu the app holds changes, so the menus here are re-read. */
  menusVersion: string
  onShowNextWeek: () => void
  onGoToPlatos: () => void
  onClose: () => void
}

/**
 * The shopping list's two screens over Semana: the day picker and the list.
 * It owns what both need from outside — this week's and next week's menus,
 * read fresh rather than taken from Semana, which only loads the weeks it has
 * shown — and works out whether the list has gone stale (§5.7).
 */
export default function ShoppingOverlay({
  mode,
  onModeChange,
  shopping,
  status,
  userId,
  dishes,
  links,
  catalog,
  menusVersion,
  onShowNextWeek,
  onGoToPlatos,
  onClose,
}: ShoppingOverlayProps) {
  const [menus, setMenus] = useState<WeeklyMenu[] | null>(null)
  const { fetchMenus, generate, list } = shopping

  const loadMenus = useCallback(async () => {
    try {
      const fresh = await fetchMenus()
      setMenus(fresh)
      return fresh
    } catch (err) {
      console.error('Error loading menus for the shopping list:', err)
      setMenus([])
      return []
    }
  }, [fetchMenus])

  useEffect(() => {
    loadMenus()
  }, [loadMenus, menusVersion])

  const inputsFor = useCallback(
    (fresh: WeeklyMenu[]): ListInputs => ({ menusByDay: menuItemsByDay(fresh), dishes, links, catalog }),
    [dishes, links, catalog]
  )

  const stale = useMemo(() => {
    if (!list || !menus || status !== 'active') return false
    return listFingerprint([...list.days, ...list.skipped_days], inputsFor(menus)) !== list.fingerprint
  }, [list, menus, status, inputsFor])

  const handleGenerate = async (days: string[]) => {
    // Read again: the picker may have been open a while.
    const fresh = await loadMenus()
    await generate(days, inputsFor(fresh), 'new')
    onModeChange('list')
  }

  const handleRegenerate = async () => {
    if (!list) return
    const fresh = await loadMenus()
    await generate([...list.days, ...list.skipped_days], inputsFor(fresh), 'regenerate')
  }

  if (mode === 'list' && list && status) {
    return (
      <ShoppingListView
        list={list}
        items={shopping.items}
        status={status}
        stale={stale}
        userId={userId}
        catalog={catalog}
        actions={shopping}
        saveError={shopping.saveError}
        onClearSaveError={shopping.clearSaveError}
        onRegenerate={handleRegenerate}
        onChooseDays={() => onModeChange('picker')}
        onCompleteMissing={onGoToPlatos}
        onClose={onClose}
      />
    )
  }

  return (
    <ShoppingDayPicker
      menus={menus}
      previousRange={list && status && status !== 'active' ? formatRange(list.days) : null}
      replacesActiveList={status === 'active'}
      onGenerate={handleGenerate}
      onOpenPrevious={() => onModeChange('list')}
      onShowNextWeek={onShowNextWeek}
      // With a list in progress the picker was reached from it, so going back returns there.
      onClose={status === 'active' ? () => onModeChange('list') : onClose}
    />
  )
}
