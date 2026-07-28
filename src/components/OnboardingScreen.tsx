import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { getErrorMessage, translateError } from '../lib/errorMessages'
import { STARTER_CATALOG } from '../data/starterCatalog'
import { trackEvent } from '../lib/analytics'

type Mode = 'create' | 'join'

export default function OnboardingScreen() {
  const { session, signOut, refreshHousehold } = useAuth()
  const [mode, setMode] = useState<Mode>('create')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [familyCode, setFamilyCode] = useState('')
  const [seedCatalog, setSeedCatalog] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'create') {
        const { data: householdId, error: rpcError } = await supabase.rpc(
          'redeem_invite_and_create_household',
          {
            invite_code: inviteCode.trim(),
            household_name: householdName.trim(),
          }
        )
        if (rpcError) throw rpcError

        if (seedCatalog && householdId) {
          const { error: seedError } = await supabase
            .from('dish_ideas')
            .insert(STARTER_CATALOG.map((dish) => ({ ...dish, household_id: householdId })))
          // The household exists either way; dishes can always be added by hand.
          if (seedError) console.error('Error seeding starter catalog:', seedError)
        }
        trackEvent('household_created', { seeded_catalog: seedCatalog })
      } else {
        const { error: rpcError } = await supabase.rpc('join_household', {
          family_code: familyCode.trim(),
        })
        if (rpcError) throw rpcError
        trackEvent('household_joined')
      }
      await refreshHousehold()
    } catch (err) {
      console.error('Error setting up household:', err)
      const message = getErrorMessage(err)
      trackEvent('household_setup_failed', {
        mode,
        reason: message || 'unknown',
      })
      setError(translateError(message, 'No se pudo configurar tu hogar'))
    } finally {
      setSubmitting(false)
    }
  }

  const radioClass = (selected: boolean) =>
    `mt-0.5 h-[22px] w-[22px] flex-none rounded-full ${
      selected ? 'border-[7px] border-verde-500' : 'border-2 border-crema-400'
    }`

  return (
    <div className="min-h-screen bg-crema-100 px-7 pt-6 pb-9 md:flex md:items-center md:justify-center">
      <div className="w-full max-w-md md:max-w-lg md:mx-auto">
        <h1 className="text-[30px] md:text-[34px] font-extrabold leading-[1.15]">
          Configura tu hogar
        </h1>
        <p className="mt-2.5 text-[15px] font-bold font-sans leading-[1.4] text-tinta-500">
          Tu hogar es el espacio privado para vuestros platos y menús semanales, compartido por
          toda la familia.
        </p>

        <div className="mt-6 flex gap-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            className={`chip flex-1 justify-center min-h-[44px] ${mode === 'create' ? 'chip-on' : ''}`}
            onClick={() => switchMode('create')}
          >
            Crear un hogar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'join'}
            className={`chip flex-1 justify-center min-h-[44px] ${mode === 'join' ? 'chip-on' : ''}`}
            onClick={() => switchMode('join')}
          >
            Unirme a mi familia
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          {mode === 'create' ? (
            <>
              <label className="label-nam" htmlFor="household-name">
                Nombre del hogar
              </label>
              <input
                id="household-name"
                type="text"
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="input-hero"
                placeholder="p. ej. Casa García"
              />

              <label className="label-nam mt-6" htmlFor="invite-code">
                Código de invitación
              </label>
              <input
                id="invite-code"
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="input-hero"
                placeholder="Tu código de la beta"
              />
              <p className="help-nam">
                Necesitas un código de invitación del equipo de ¡Ñam! para entrar en la beta.
              </p>

              <p className="label-nam mt-8">Vuestros platos</p>
              <div className="flex flex-col gap-2">
                <label
                  className={`relative flex cursor-pointer items-start gap-3 rounded-card bg-white p-[18px] transition-colors duration-120 ${
                    seedCatalog
                      ? 'border-[3px] border-tinta-900 shadow-pop-sm'
                      : 'border-2 border-crema-300 hover:bg-crema-100'
                  }`}
                >
                  <span className="absolute -top-3 right-3.5 rotate-[4deg] rounded-full bg-amarillo-500 px-3 py-0.5 text-xs font-extrabold text-tinta-900">
                    RECOMENDADO
                  </span>
                  <input
                    type="radio"
                    name="seed-catalog"
                    className="sr-only"
                    checked={seedCatalog}
                    onChange={() => setSeedCatalog(true)}
                  />
                  <span className={radioClass(seedCatalog)} aria-hidden="true" />
                  <span>
                    <span className="block text-[17px] font-extrabold">
                      Usar los platos de siempre
                    </span>
                    <span className="mt-1 block text-sm font-bold font-sans leading-[1.4] text-tinta-500">
                      {STARTER_CATALOG.length} platos de cocina casera española. Podrás editarlos o
                      borrarlos cuando quieras.
                    </span>
                  </span>
                </label>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-card bg-white p-4 transition-colors duration-120 ${
                    !seedCatalog
                      ? 'border-[3px] border-tinta-900 shadow-pop-sm'
                      : 'border-2 border-crema-300 hover:bg-crema-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="seed-catalog"
                    className="sr-only"
                    checked={!seedCatalog}
                    onChange={() => setSeedCatalog(false)}
                  />
                  <span className={radioClass(!seedCatalog)} aria-hidden="true" />
                  <span>
                    <span className="block text-base font-extrabold text-tinta-500">
                      Prefiero elegirlos yo
                    </span>
                    <span className="mt-1 block text-[13px] font-bold font-sans text-tinta-500">
                      Empezaréis con el catálogo vacío.
                    </span>
                  </span>
                </label>
              </div>
            </>
          ) : (
            <>
              <label className="label-nam" htmlFor="family-code">
                Código familiar
              </label>
              <input
                id="family-code"
                type="text"
                required
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value)}
                className="input-hero"
                placeholder="p. ej. 4F7A2C9B"
              />
              <p className="help-nam">
                Pídele el código familiar a quien creó vuestro hogar: aparece en la parte superior
                de su app.
              </p>
            </>
          )}

          {error && (
            <p className="error-nam" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full mt-8">
            {submitting && (
              <span
                className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
            )}
            {submitting ? 'Configurando…' : mode === 'create' ? 'Crear hogar' : 'Unirme al hogar'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-[13px] font-bold font-sans text-tinta-500">
          <span>{session?.user?.email}</span>
          <button
            onClick={() => signOut()}
            className="font-extrabold text-verde-600 hover:text-verde-700"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}
