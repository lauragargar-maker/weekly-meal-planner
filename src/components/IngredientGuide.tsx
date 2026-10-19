import { useEffect, useRef, useState } from 'react'
import { DishIdea, DishIngredient, ShoppingIngredient } from '../types'
import { IngredientDraft } from '../lib/dishIngredients'
import { normalizeRecipeUrl } from '../lib/recipeLinks'
import { DishToComplete } from '../lib/shoppingList'
import { trackEvent } from '../lib/analytics'
import ShoppingIngredientsEditor from './ShoppingIngredientsEditor'
import RecipeUrlField from './RecipeUrlField'

export type GuideStart = 'intro' | 'light' | 'steps'

/** How the guide was left: finished, cut short, declined, or closed without a list. */
export type GuideExit = 'done' | 'later' | 'not_now' | 'closed'

export type FreshIngredients = { catalog: ShoppingIngredient[]; links: DishIngredient[] } | null

export interface GuideResult {
  exit: GuideExit
  completed: number
  skipped: number
  /** The household's ingredients after the last save, when something was saved. */
  fresh: FreshIngredients
}

interface IngredientGuideProps {
  dishes: DishToComplete[]
  /** 'intro' the first time, 'light' afterwards, 'steps' from the list's "Completar". */
  start: GuideStart
  /** True when finishing remakes a list that already exists, not a new one. */
  remakesList: boolean
  catalog: ShoppingIngredient[]
  onSaveDish: (dish: DishIdea, ingredients: IngredientDraft[], recipeUrl: string | null) => Promise<FreshIngredients>
  /** Generates the list unless `exit` is 'closed'. Rejects if that fails. */
  onFinish: (result: GuideResult) => Promise<void>
  /** True while the guide fills the screen; false while it is only the light notice. */
  onFullScreen: (full: boolean) => void
}

const DishList = ({ dishes }: { dishes: DishToComplete[] }) => (
  <ul className="flex flex-col gap-2">
    {dishes.map((d) => (
      <li key={d.name} className="rounded-[18px] border-2 border-crema-300 bg-white px-3.5 py-2.5">
        <p className="text-[17px] font-extrabold leading-tight">{d.name}</p>
        <p className="font-sans text-[13px] font-bold text-tinta-500">
          {d.when}
          {!d.dish && ' · ya no está en tus platos'}
        </p>
      </li>
    ))}
  </ul>
)

/**
 * "¿Qué lleva cada plato?" (docs/shopping-list-spec.md §5.3): what happens
 * when the days chosen for a list include dishes with no ingredients. The
 * first time, an introduction and one step per dish; afterwards, a light
 * notice that offers the same steps. The editor's own help says what a
 * staple is, which is the tip the spec asks for on the first step. Every way out but closing makes the list
 * with whatever is there by then.
 */
export default function IngredientGuide({
  dishes,
  start,
  remakesList,
  catalog,
  onSaveDish,
  onFinish,
  onFullScreen,
}: IngredientGuideProps) {
  // Only dishes still in Platos get a step; the rest are named and left out.
  const steps = dishes.filter((d): d is DishToComplete & { dish: DishIdea } => d.dish !== null)
  const [screen, setScreen] = useState<'intro' | 'light' | 'step'>(
    start === 'steps' && steps.length > 0 ? 'step' : start === 'intro' && steps.length > 0 ? 'intro' : 'light'
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [drafts, setDrafts] = useState<IngredientDraft[]>([])
  const [recipeUrl, setRecipeUrl] = useState(steps[0]?.dish.recipe_url ?? '')
  const [liveCatalog, setLiveCatalog] = useState(catalog)
  const [counts, setCounts] = useState({ completed: 0, skipped: 0 })
  const [fresh, setFresh] = useState<FreshIngredients>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<'save' | 'list' | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    trackEvent('ingredient_guide_started', {
      missing_dish_count: dishes.length,
      mode: start === 'intro' && steps.length > 0 ? 'full' : 'light',
    })
    // Once per guide shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    topRef.current?.focus()
  }, [screen, stepIndex])

  useEffect(() => {
    onFullScreen(screen !== 'light')
  }, [screen, onFullScreen])

  const finish = async (exit: GuideExit, result = { ...counts, fresh }) => {
    setBusy(true)
    setFailure(null)
    try {
      await onFinish({ exit, ...result })
    } catch (err) {
      console.error('Error making the shopping list after the guide:', err)
      setFailure('list')
      setBusy(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) finish('closed')
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  const current = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1
  const trimmedUrl = recipeUrl.trim()
  const normalizedUrl = normalizeRecipeUrl(trimmedUrl)
  const urlInvalid = trimmedUrl !== '' && normalizedUrl === null

  const goToStep = (index: number) => {
    setStepIndex(index)
    setDrafts([])
    setRecipeUrl(steps[index].dish.recipe_url ?? '')
    setFailure(null)
  }

  /** Saves the current dish if it has something to save. Null if the save failed. */
  const saveCurrent = async (): Promise<{ completed: number; skipped: number; fresh: FreshIngredients } | null> => {
    if (drafts.length === 0 || urlInvalid) return { ...counts, skipped: counts.skipped + 1, fresh }
    setBusy(true)
    setFailure(null)
    try {
      const saved = await onSaveDish(current.dish, drafts, normalizedUrl)
      trackEvent('ingredient_guide_dish_saved', { ingredient_count: drafts.length })
      if (saved) setLiveCatalog(saved.catalog)
      return { ...counts, completed: counts.completed + 1, fresh: saved ?? fresh }
    } catch (err) {
      console.error('Error saving dish ingredients from the guide:', err)
      setFailure('save')
      return null
    } finally {
      setBusy(false)
    }
  }

  const advance = async (skip: boolean) => {
    const next = skip ? { ...counts, skipped: counts.skipped + 1, fresh } : await saveCurrent()
    if (!next) return
    setCounts({ completed: next.completed, skipped: next.skipped })
    setFresh(next.fresh)
    if (isLast) await finish('done', next)
    else goToStep(stepIndex + 1)
  }

  const finishLater = async () => {
    const next = await saveCurrent()
    if (!next) return
    // Not reaching this dish counts it, and every one after it, as skipped.
    await finish('later', { ...next, skipped: next.skipped + steps.length - stepIndex - 1 })
  }

  const listFailed = failure === 'list' && (
    <p className="error-nam !mt-0" role="alert">
      No se pudo hacer la lista. Revisa la conexión y vuelve a probar.
    </p>
  )

  if (screen === 'light') {
    const count = dishes.length
    return (
      <div
        className="anim-scrim fixed inset-0 z-30 flex items-end justify-center bg-[rgba(38,33,28,0.5)] lg:items-center lg:p-7"
        onClick={(e) => {
          if (e.target === e.currentTarget && !busy) finish('closed')
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-light-title"
          className="anim-sheet flex max-h-full w-full flex-col gap-4 overflow-y-auto rounded-t-sheet bg-crema-100 px-[22px] pb-[calc(22px+env(safe-area-inset-bottom))] pt-6 lg:max-w-[480px] lg:rounded-sheet lg:px-8 lg:pb-7"
        >
          <div ref={topRef} tabIndex={-1} className="focus:outline-none">
            <h2 id="guide-light-title" className="text-2xl font-extrabold leading-tight">
              {count === 1 ? '1 plato no tiene ingredientes' : `${count} platos no tienen ingredientes`}
            </h2>
          </div>
          <DishList dishes={dishes} />
          <p className="font-sans text-sm font-bold leading-snug text-tinta-500">
            Si no {count === 1 ? 'lo completas, sus ingredientes no saldrán' : 'los completas, sus ingredientes no saldrán'} en la
            lista.
          </p>
          {listFailed}
          <div className="flex flex-col gap-1">
            {steps.length > 0 && (
              <button onClick={() => setScreen('step')} disabled={busy} className="btn-primary w-full">
                {steps.length === 1 ? 'Completarlo ahora' : 'Completarlos ahora'}
              </button>
            )}
            <button
              onClick={() => finish('not_now')}
              disabled={busy}
              className={
                steps.length > 0
                  ? 'w-full rounded-full py-3 text-[15px] font-extrabold text-tinta-500 hover:text-tinta-700 focus:outline-none focus:ring-2 focus:ring-verde-500'
                  : 'btn-primary w-full'
              }
            >
              {busy ? 'Haciendo la lista…' : 'Generar igualmente'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-crema-100 lg:items-center lg:justify-center lg:overflow-hidden lg:bg-[rgba(38,33,28,0.5)] lg:p-7"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) finish('closed')
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        className="flex min-h-full w-full flex-col lg:max-h-full lg:min-h-0 lg:max-w-[560px] lg:overflow-hidden lg:rounded-sheet lg:bg-crema-100 lg:shadow-[0_24px_60px_rgba(38,33,28,0.45)]"
      >
        {screen === 'intro' ? (
          <>
            <header className="flex items-start gap-2 px-[22px] pt-5 lg:px-8 lg:pt-7">
              <div ref={topRef} tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
                <h2 id="guide-title" className="text-2xl font-extrabold leading-tight">
                  ¿Qué lleva cada plato?
                </h2>
              </div>
              <button
                onClick={() => finish('closed')}
                disabled={busy}
                aria-label="Cerrar"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-crema-300 bg-white text-lg font-extrabold text-tinta-900 focus:outline-none focus:ring-2 focus:ring-verde-500"
              >
                ✕
              </button>
            </header>
            <div className="flex flex-col gap-4 px-[22px] pb-4 pt-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8">
              <p className="font-sans text-[15px] font-bold leading-snug text-tinta-700">
                Para hacer la lista necesitamos saber qué lleva cada plato. Los platos del catálogo de Ñam ya vienen
                completos; te {steps.length === 1 ? 'falta' : 'faltan'}{' '}
                <strong className="text-tinta-900">
                  {steps.length} {steps.length === 1 ? 'plato tuyo' : 'platos tuyos'}
                </strong>
                .
              </p>
              <DishList dishes={dishes} />
              <p className="font-sans text-sm font-bold leading-snug text-tinta-500">
                Te llevará un par de minutos y solo hay que hacerlo una vez por plato.
              </p>
            </div>
            <footer className="sticky bottom-0 mt-auto flex flex-col gap-1 border-t-2 border-crema-300 bg-white px-[22px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5 lg:px-8">
              {listFailed}
              <button onClick={() => setScreen('step')} disabled={busy} className="btn-primary w-full">
                Empezar
              </button>
              <button
                onClick={() => finish('not_now')}
                disabled={busy}
                className="w-full rounded-full py-3 text-[15px] font-extrabold text-tinta-500 hover:text-tinta-700 focus:outline-none focus:ring-2 focus:ring-verde-500"
              >
                {busy ? 'Haciendo la lista…' : 'Ahora no, generar sin ellos'}
              </button>
            </footer>
          </>
        ) : (
          <>
            <header className="flex flex-col gap-2.5 px-[22px] pt-5 lg:px-8 lg:pt-7">
              <div className="flex items-center justify-between gap-3">
                <p className="font-sans text-[13px] font-extrabold uppercase tracking-[0.08em] text-tinta-500">
                  Plato {stepIndex + 1} de {steps.length}
                </p>
                <button
                  onClick={finishLater}
                  disabled={busy}
                  className="flex min-h-[44px] items-center font-sans text-sm font-extrabold text-verde-600 underline decoration-2 underline-offset-4 hover:text-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-500"
                >
                  Terminar más tarde
                </button>
              </div>
              <div
                className="h-2 rounded-full bg-crema-300"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={stepIndex + 1}
                aria-label="Platos por completar"
              >
                <div
                  className="h-full rounded-full bg-verde-600 transition-[width] duration-200"
                  style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                />
              </div>
              <div ref={topRef} tabIndex={-1} className="pt-1 focus:outline-none">
                <h2 id="guide-title" className="text-2xl font-extrabold leading-tight">
                  {current.dish.name}
                </h2>
                <p className="font-sans text-[13px] font-bold text-tinta-500">{current.when}</p>
              </div>
            </header>
            <div key={current.dish.id} className="anim-step flex flex-col px-[22px] pb-4 pt-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8">
              <ShoppingIngredientsEditor value={drafts} onChange={setDrafts} catalog={liveCatalog} />
              <RecipeUrlField id="guide-recipe-url" value={recipeUrl} onChange={setRecipeUrl} />
            </div>
            <footer className="sticky bottom-0 mt-auto flex flex-col gap-3 border-t-2 border-crema-300 bg-white px-[22px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5 lg:px-8">
              {failure === 'save' && (
                <p className="error-nam !mt-0" role="alert">
                  No se pudo guardar este plato. Revisa la conexión y vuelve a probar.
                </p>
              )}
              {listFailed}
              <div className="flex gap-3">
                <button onClick={() => advance(true)} disabled={busy} className="btn-secondary flex-1 !px-3">
                  Saltar este plato
                </button>
                <button
                  onClick={() => advance(false)}
                  disabled={busy || drafts.length === 0 || urlInvalid}
                  className="btn-primary flex-1 !px-3"
                >
                  {busy
                    ? 'Guardando…'
                    : !isLast
                      ? 'Siguiente'
                      : remakesList
                        ? 'Guardar y rehacer la lista'
                        : 'Guardar y hacer la lista'}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
