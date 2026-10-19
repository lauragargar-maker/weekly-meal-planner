import { useCallback, useEffect, useMemo, useState } from 'react'
import { DishIdea, DishIngredient, ShoppingIngredient, WeeklyMenu } from '../types'
import {
  DishToComplete,
  ListInputs,
  ListStatus,
  dishesToComplete,
  formatRange,
  listFingerprint,
  menuItemsByDay,
} from '../lib/shoppingList'
import { IngredientDraft } from '../lib/dishIngredients'
import { trackEvent } from '../lib/analytics'
import { ShoppingListState } from '../lib/useShoppingList'
import ShoppingDayPicker from './ShoppingDayPicker'
import ShoppingListView from './ShoppingListView'
import IngredientGuide, { FreshIngredients, GuideResult, GuideStart } from './IngredientGuide'

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
  /** Saves a dish's ingredients and recipe from the guided flow, and returns the reloaded ingredients. */
  onCompleteDish: (dish: DishIdea, ingredients: IngredientDraft[], recipeUrl: string | null) => Promise<FreshIngredients>
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
  onCompleteDish,
  menusVersion,
  onShowNextWeek,
  onGoToPlatos,
  onClose,
}: ShoppingOverlayProps) {
  const [menus, setMenus] = useState<WeeklyMenu[] | null>(null)
  // The guided flow (§5.3), while it is open: for which days, and what it is for.
  const [guide, setGuide] = useState<{
    days: string[]
    dishes: DishToComplete[]
    start: GuideStart
    inputs: ListInputs
    fromList: boolean
  } | null>(null)
  // While the guide fills the screen, the picker under it is hidden rather
  // than unmounted, so the days chosen survive closing the guide.
  const [guideFull, setGuideFull] = useState(false)
  const { fetchMenus, fetchGuideSeen, markGuideSeen, generate, list } = shopping

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
    const inputs = inputsFor(fresh)
    const toComplete = dishesToComplete(days, inputs)
    if (toComplete.length > 0) {
      const seen = await fetchGuideSeen()
      setGuide({ days, dishes: toComplete, start: seen ? 'light' : 'intro', inputs, fromList: false })
      return
    }
    await generate(days, inputs, 'new')
    onModeChange('list')
  }

  // "Completar" on the list: the guide's steps straight away, then the list is remade.
  const handleCompleteMissing = async () => {
    if (!list) return
    try {
      await completeMissing(list)
    } catch (err) {
      console.error('Error completing the dishes missing from the list:', err)
    }
  }

  const completeMissing = async (list: NonNullable<typeof shopping.list>) => {
    const fresh = await loadMenus()
    const days = [...list.days, ...list.skipped_days]
    const inputs = inputsFor(fresh)
    const toComplete = dishesToComplete(days, inputs)
    if (!toComplete.some((d) => d.dish)) {
      // Nothing left to complete here: either done already, so remake the
      // list, or only dishes that are gone from Platos.
      if (toComplete.length === 0) await generate(days, inputs, 'regenerate')
      else onGoToPlatos()
      return
    }
    setGuide({ days, dishes: toComplete, start: 'steps', inputs, fromList: true })
  }

  const handleGuideFinish = async ({ exit, completed, skipped, fresh }: GuideResult) => {
    if (!guide) return
    markGuideSeen()
    trackEvent('ingredient_guide_finished', { completed, skipped, exit })
    if (exit !== 'closed') {
      const inputs = fresh ? { ...guide.inputs, ...fresh } : guide.inputs
      await generate(guide.days, inputs, guide.fromList ? 'regenerate' : 'new')
      onModeChange('list')
    }
    setGuide(null)
  }

  // Marking a staple from the list changes what the list is built from, but
  // the list already reflects it; carry the fingerprint along so no "menu
  // changed" notice appears. A list that was already stale stays stale.
  const removeItem: ShoppingListState['removeItem'] = async (item, markStaple = false) => {
    const ingredientId = item.ingredient_id
    if (!markStaple || !ingredientId || !list || !menus || stale) return shopping.removeItem(item, markStaple)
    const withStaple = catalog.map((i) => (i.id === ingredientId ? { ...i, is_staple: true } : i))
    const fingerprint = listFingerprint([...list.days, ...list.skipped_days], { ...inputsFor(menus), catalog: withStaple })
    return shopping.removeItem(item, true, fingerprint)
  }

  const handleRegenerate = async () => {
    if (!list) return
    const fresh = await loadMenus()
    await generate([...list.days, ...list.skipped_days], inputsFor(fresh), 'regenerate')
  }

  const guideView = guide && (
    <IngredientGuide
      dishes={guide.dishes}
      start={guide.start}
      remakesList={guide.fromList}
      catalog={catalog}
      onSaveDish={onCompleteDish}
      onFinish={handleGuideFinish}
      onFullScreen={setGuideFull}
    />
  )

  // From the list, the guide takes its place; it is remade at the end anyway.
  if (guide?.fromList) return guideView

  if (mode === 'list' && list && status) {
    return (
      <ShoppingListView
        list={list}
        items={shopping.items}
        status={status}
        stale={stale}
        userId={userId}
        catalog={catalog}
        actions={{ ...shopping, removeItem }}
        saveError={shopping.saveError}
        onClearSaveError={shopping.clearSaveError}
        onRegenerate={handleRegenerate}
        onChooseDays={() => onModeChange('picker')}
        onCompleteMissing={handleCompleteMissing}
        onClose={onClose}
      />
    )
  }

  // From the picker, the guide opens over it, so closing the guide returns
  // to the days as they were chosen.
  return (
    <>
      <ShoppingDayPicker
        covered={!guide ? 'none' : guideFull ? 'full' : 'sheet'}
        menus={menus}
        previousRange={list && status && status !== 'active' ? formatRange(list.days) : null}
        replacesActiveList={status === 'active'}
        onGenerate={handleGenerate}
        onOpenPrevious={() => onModeChange('list')}
        onShowNextWeek={onShowNextWeek}
        onClose={onClose}
      />
      {guideView}
    </>
  )
}
