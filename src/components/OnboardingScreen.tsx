import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { translateError } from '../lib/errorMessages'
import { STARTER_CATALOG } from '../data/starterCatalog'

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
      } else {
        const { error: rpcError } = await supabase.rpc('join_household', {
          family_code: familyCode.trim(),
        })
        if (rpcError) throw rpcError
      }
      await refreshHousehold()
    } catch (err) {
      console.error('Error setting up household:', err)
      setError(
        translateError(err instanceof Error ? err.message : '', 'No se pudo configurar tu hogar')
      )
    } finally {
      setSubmitting(false)
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 px-3 py-2 text-sm font-medium rounded-lg border ${
      active
        ? 'bg-primary-600 text-white border-primary-600'
        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
    }`

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Configura tu hogar</h1>
        <p className="text-gray-600 mb-6">
          Tu hogar es el espacio privado para vuestros platos y menús semanales, compartido por
          toda la familia.
        </p>

        <div className="flex gap-2 mb-6" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            className={tabClass(mode === 'create')}
            onClick={() => switchMode('create')}
          >
            Crear un hogar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'join'}
            className={tabClass(mode === 'join')}
            onClick={() => switchMode('join')}
          >
            Unirme a mi familia
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'create' ? (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="household-name">
                Nombre del hogar
              </label>
              <input
                id="household-name"
                type="text"
                required
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                placeholder="p. ej. Casa García"
              />

              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="invite-code">
                Código de invitación
              </label>
              <input
                id="invite-code"
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-1"
                placeholder="Tu código de la beta"
              />
              <p className="text-xs text-gray-500 mb-4">
                Necesitas un código de invitación del equipo de WeeklyMenu para entrar en la beta.
              </p>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 mb-4">
                <input
                  type="checkbox"
                  checked={seedCatalog}
                  onChange={(e) => setSeedCatalog(e.target.checked)}
                  className="mt-0.5 text-primary-600"
                />
                <span className="text-sm text-gray-800">
                  Empezar con el catálogo de platos sugerido
                  <span className="block text-xs text-gray-500">
                    {STARTER_CATALOG.length} platos de cocina casera española. Podrás editarlos o
                    borrarlos cuando quieras.
                  </span>
                </span>
              </label>
            </>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="family-code">
                Código familiar
              </label>
              <input
                id="family-code"
                type="text"
                required
                value={familyCode}
                onChange={(e) => setFamilyCode(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-1"
                placeholder="p. ej. 4F7A2C9B"
              />
              <p className="text-xs text-gray-500 mb-4">
                Pídele el código familiar a quien creó vuestro hogar: aparece en la parte superior
                de su app.
              </p>
            </>
          )}

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting
              ? 'Configurando...'
              : mode === 'create'
                ? 'Crear hogar'
                : 'Unirme al hogar'}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-500 flex items-center justify-between">
          <span>{session?.user?.email}</span>
          <button onClick={() => signOut()} className="text-primary-600 hover:text-primary-700 font-medium">
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}
