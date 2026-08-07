import { useState, useRef, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { getErrorMessage, translateError } from '../lib/errorMessages'
import { HouseholdRules, parseRules } from '../lib/householdRules'
import { trackEvent } from '../lib/analytics'
import { Household } from '../types'
import HouseholdRulesEditor from './HouseholdRulesEditor'

interface FamilyViewProps {
  household: Household
  /** Regenerates the current week with whatever the rules now say. */
  onRegenerateWeek?: () => Promise<void>
}

/** "123456" → "123 456", for display only. */
const formatJoinCode = (code: string): string =>
  code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code

export default function FamilyView({ household, onRegenerateWeek }: FamilyViewProps) {
  const { session, signOut, refreshHousehold } = useAuth()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(household.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const savedRules = useMemo(() => parseRules(household.rules), [household.rules])
  const [draftRules, setDraftRules] = useState<HouseholdRules>(savedRules)
  const [savingRules, setSavingRules] = useState(false)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  // Reset the draft when the stored rules change under us — another member
  // editing them, or our own save landing.
  useEffect(() => {
    setDraftRules(savedRules)
  }, [savedRules])

  const rulesChanged = useMemo(
    () => JSON.stringify(draftRules) !== JSON.stringify(savedRules),
    [draftRules, savedRules]
  )

  const saveRules = async () => {
    if (savingRules || !rulesChanged) return
    setSavingRules(true)
    setRulesError(null)
    try {
      const { error: updateError } = await supabase
        .from('households')
        .update({ rules: draftRules })
        .eq('id', household.id)
      if (updateError) throw updateError
      await refreshHousehold()
      trackEvent('household_rules_saved')
      setToast('Ajustes guardados')
    } catch (err) {
      console.error('Error saving household rules:', err)
      setRulesError(translateError(getErrorMessage(err), 'No se pudieron guardar los ajustes'))
    } finally {
      setSavingRules(false)
    }
  }

  const regenerate = async () => {
    if (!onRegenerateWeek || regenerating) return
    setRegenerating(true)
    try {
      await onRegenerateWeek()
      trackEvent('week_regenerated')
      setToast('Semana regenerada')
    } catch (err) {
      console.error('Error regenerating week:', err)
      setRulesError(translateError(getErrorMessage(err), 'No se pudo regenerar la semana'))
    } finally {
      setRegenerating(false)
    }
  }

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingName])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const startEditing = () => {
    setName(household.name)
    setError(null)
    setEditingName(true)
  }

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    if (trimmed === household.name) {
      setEditingName(false)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const { error: updateError } = await supabase
        .from('households')
        .update({ name: trimmed })
        .eq('id', household.id)
      if (updateError) throw updateError
      await refreshHousehold()
      setEditingName(false)
    } catch (err) {
      console.error('Error renaming household:', err)
      setError(translateError(getErrorMessage(err), 'No se pudo cambiar el nombre'))
    } finally {
      setSaving(false)
    }
  }

  const shareCode = async () => {
    // Shared and copied in the same grouped form the screen shows, so what the
    // other person receives matches what the sender is looking at. join_household
    // strips everything that is not a digit, so the space is harmless.
    const code = formatJoinCode(household.join_code)
    const text = `Únete a ${household.name} en ¡Ñam! con el código ${code}`
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(code)
      setToast('Código copiado')
    } catch (err) {
      // The user dismissing the share sheet lands here too; only report real failures.
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Error sharing join code:', err)
      setToast('No se pudo compartir el código')
    }
  }

  return (
    <div>
      <header>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveName()
                }
                if (e.key === 'Escape') setEditingName(false)
              }}
              readOnly={saving}
              aria-label="Nombre de la casa"
              className="flex-1 rounded-[14px] border-2 border-tinta-900 bg-white px-3 py-2 text-xl font-extrabold text-tinta-900 focus:outline-none focus:ring-2 focus:ring-verde-500 lg:text-2xl"
            />
            <button
              onClick={saveName}
              disabled={saving}
              aria-label="Guardar el nombre"
              className="flex-none rounded-xl bg-verde-600 px-3.5 py-2 text-white transition-colors duration-120 hover:bg-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {saving ? (
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                '✓'
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold lg:text-[30px]">{household.name}</h1>
            <button
              onClick={startEditing}
              aria-label="Editar el nombre de la casa"
              className="text-tinta-300 hover:text-tinta-500 focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2 rounded-full p-1 lg:text-xl"
            >
              ✎
            </button>
          </div>
        )}
        {error && (
          <p className="error-nam" role="alert">
            {error}
          </p>
        )}
      </header>

      {/* Single column while the members list is pending; becomes grid-cols-2 when it lands. */}
      <div className="mt-4 max-w-[620px] lg:mt-6">
        <div className="rounded-card bg-amarillo-500 py-[18px] px-5 shadow-pop-sm lg:py-6 lg:px-[26px]">
          <p className="text-[13px] font-extrabold tracking-[0.08em] text-amarillo-700">
            CÓDIGO DE LA CASA
          </p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <p
              className="text-[32px] font-extrabold tracking-[0.08em] text-tinta-900 lg:text-[40px]"
              aria-label={`Código de la casa: ${household.join_code.split('').join(' ')}`}
            >
              {formatJoinCode(household.join_code)}
            </p>
            <button
              onClick={shareCode}
              className="flex-none rounded-full bg-tinta-900 px-[18px] py-2 text-sm font-extrabold text-crema-100 transition-colors duration-120 hover:bg-tinta-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-tinta-900 lg:px-6 lg:py-2.5 lg:text-[15px]"
            >
              Compartir
            </button>
          </div>
          <p className="mt-2 text-[13px] font-bold font-sans text-amarillo-700 lg:text-sm">
            Con este código tu familia entra a ver el plan.
          </p>
        </div>
      </div>

      <section className="mt-8 max-w-[620px]">
        <h2 className="label-nam !mb-0">Ajustes de la casa</h2>
        <p className="mt-1 text-[13px] font-bold font-sans leading-[1.4] text-tinta-500">
          Así se arman los menús. Los cambios se aplican a partir de la próxima semana que
          se genere: las que ya están hechas no se tocan.
        </p>

        <div className="mt-4">
          <HouseholdRulesEditor
            rules={draftRules}
            onChange={setDraftRules}
            disabled={savingRules}
          />
        </div>

        {rulesError && (
          <p className="error-nam" role="alert">
            {rulesError}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={saveRules}
            disabled={!rulesChanged || savingRules}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:bg-crema-400 disabled:text-crema-100"
          >
            {savingRules && (
              <span
                className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
            )}
            {savingRules ? 'Guardando…' : rulesChanged ? 'Guardar ajustes' : 'Ajustes guardados'}
          </button>

          {/* Regenerating is never automatic: it would wipe any hand edits, and
              going from one dinner course to two cannot retroactively invent the
              dish that is missing. */}
          {onRegenerateWeek && (
            <button
              onClick={regenerate}
              disabled={regenerating || rulesChanged}
              className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {regenerating ? 'Regenerando…' : 'Regenerar esta semana'}
            </button>
          )}
          {rulesChanged && onRegenerateWeek && (
            <p className="text-center text-[13px] font-bold font-sans text-tinta-500">
              Guarda los ajustes para poder regenerar con ellos.
            </p>
          )}
        </div>
      </section>

      <div className="mt-8">
        <button
          onClick={() => signOut()}
          className="rounded-full px-3.5 py-2.5 text-[15px] font-extrabold text-verde-500 underline decoration-2 underline-offset-4 transition-colors duration-120 hover:text-verde-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
        >
          Cerrar sesión
        </button>
        <p className="mt-1 px-3.5 text-[13px] font-bold font-sans text-tinta-500">
          {session?.user?.email}
        </p>
      </div>

      {toast && (
        <div
          className="anim-toast fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-tinta-900 px-5 py-3 text-sm font-extrabold text-crema-100 shadow-toast"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
