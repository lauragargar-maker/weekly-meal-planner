import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { getErrorMessage, translateError } from '../lib/errorMessages'
import { STARTER_CATALOG } from '../data/starterCatalog'
import { trackEvent } from '../lib/analytics'
import { DEFAULT_RULES, HouseholdRules } from '../lib/householdRules'
import { INGREDIENTS } from '../lib/ingredients'
import { DishIdea, Ingredient, NewDishIdea } from '../types'
import AddDishModal from './AddDishModal'
import JoinCodeInput from './JoinCodeInput'
import OnboardingDishStep from './OnboardingDishStep'
import OnboardingHeader from './OnboardingHeader'
import { RuleCard, RuleChips, RuleChoice, RuleStepper, RuleSwitch } from './RuleControls'

/**
 * Six views in one component (handoff/specs/onboarding-v2.md).
 *
 * Only three of them are numbered, and they are the three that configure the
 * house. Whoever joins an existing one never sees "paso N de 3", because there
 * is nothing for them to configure.
 *
 * The household is not created until the last step. The alternative — creating
 * it on the "crear un hogar" screen, where the invite code is checked — would
 * leave anybody who abandons at step 2 with a household that has no rules and no
 * dishes, and AuthGate would never route them back here to finish.
 */

type View = 'branch' | 'create' | 'step1' | 'step2' | 'step3' | 'join'

/** Which ingredients it makes sense to keep off the evening menu. */
const DINNER_EXCLUDABLE: Ingredient[] = ['pasta', 'rice', 'potato', 'meat', 'legume']

export default function OnboardingScreen() {
  const { session, signOut, refreshHousehold } = useAuth()

  const [view, setView] = useState<View>('branch')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [checkingCode, setCheckingCode] = useState(false)

  const [rules, setRules] = useState<HouseholdRules>(DEFAULT_RULES)
  const [discarded, setDiscarded] = useState<Set<string>>(new Set())
  const [ownDishes, setOwnDishes] = useState<NewDishIdea[]>([])
  const [showAddDish, setShowAddDish] = useState(false)

  const [familyCode, setFamilyCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const offeredDishes = useMemo(() => [...STARTER_CATALOG, ...ownDishes], [ownDishes])
  const keptDishes = useMemo(
    () => offeredDishes.filter((dish) => !discarded.has(dish.name)),
    [offeredDishes, discarded]
  )

  const go = (next: View) => {
    setError(null)
    setView(next)
    // Without this you arrive at step 3 halfway down the dish list, because the
    // page keeps the scroll position of the step you just left.
    window.scrollTo(0, 0)
  }

  const toggleDish = (name: string) =>
    setDiscarded((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const toggleExclusion = (ingredient: Ingredient) =>
    setRules((current) => ({
      ...current,
      dinnerExclusions: current.dinnerExclusions.includes(ingredient)
        ? current.dinnerExclusions.filter((i) => i !== ingredient)
        : [...current.dinnerExclusions, ingredient],
    }))

  /**
   * Checked here, before three steps of work, and NOT redeemed: redemption
   * happens at the end. A code exhausted in between still fails there, which is
   * why the final step reports that error rather than trusting this check.
   */
  const checkInviteCode = async () => {
    if (checkingCode) return
    setCheckingCode(true)
    setInviteError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('validate_invite_code', {
        invite_code: inviteCode.trim(),
      })
      if (rpcError) throw rpcError
      if (data === true) {
        go('step1')
        return
      }
      setInviteError(
        'Este código no nos suena. Revísalo o ponte en contacto con nosotros.'
      )
    } catch (err) {
      console.error('Error validating invite code:', err)
      setInviteError(translateError(getErrorMessage(err), 'No se pudo comprobar el código'))
    } finally {
      setCheckingCode(false)
    }
  }

  const createHousehold = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: householdId, error: rpcError } = await supabase.rpc(
        'redeem_invite_and_create_household',
        { invite_code: inviteCode.trim(), household_name: householdName.trim() }
      )
      if (rpcError) throw rpcError

      // Rules and dishes are written after the household exists rather than
      // inside the RPC. If either fails the house is still usable: the rules fall
      // back to defaults and dishes can be added by hand, which beats blocking
      // entry over a settings row.
      const { error: rulesError } = await supabase
        .from('households')
        .update({ rules })
        .eq('id', householdId)
      if (rulesError) console.error('Error saving initial rules:', rulesError)

      if (keptDishes.length > 0) {
        const { error: seedError } = await supabase
          .from('dish_ideas')
          .insert(keptDishes.map((dish) => ({ ...dish, household_id: householdId })))
        if (seedError) console.error('Error seeding catalog:', seedError)
      }

      trackEvent('household_created', {
        dish_count: keptDishes.length,
        discarded_count: discarded.size,
        own_dishes: ownDishes.length,
      })
      await refreshHousehold()
    } catch (err) {
      console.error('Error creating household:', err)
      const message = getErrorMessage(err)
      trackEvent('household_setup_failed', { mode: 'create', reason: message || 'unknown' })
      setError(translateError(message, 'No se pudo crear tu hogar'))
    } finally {
      setSubmitting(false)
    }
  }

  const joinHousehold = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('join_household', {
        family_code: familyCode,
      })
      if (rpcError) throw rpcError
      trackEvent('household_joined')
      await refreshHousehold()
    } catch (err) {
      console.error('Error joining household:', err)
      const message = getErrorMessage(err)
      trackEvent('household_setup_failed', { mode: 'join', reason: message || 'unknown' })
      setError(translateError(message, 'No se pudo entrar en la casa'))
    } finally {
      setSubmitting(false)
    }
  }

  const houseLabel = householdName.trim().toUpperCase() || 'TU CASA'
  const canCreate = householdName.trim() !== '' && inviteCode.trim() !== ''

  return (
    <div className="min-h-screen bg-crema-100">
      <div className="mx-auto w-full max-w-md px-[22px] pt-6 pb-8">
        {view === 'branch' && (
          <Branch
            email={session?.user?.email}
            onCreate={() => go('create')}
            onJoin={() => go('join')}
          />
        )}

        {view === 'create' && (
          <>
            <OnboardingHeader label="Crear un hogar" onBack={() => go('branch')} />
            <h1 className="mt-5 text-[26px] font-extrabold leading-[1.15]">Tu casa</h1>
            <p className="mt-2 text-sm font-bold font-sans text-tinta-500">
              El plan semanal de comidas, sin preocupaciones.
            </p>

            <label className="label-nam mt-6" htmlFor="household-name">
              Nombre de la casa
            </label>
            <input
              id="household-name"
              type="text"
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              className="input-hero"
              placeholder="p. ej. Casa García"
            />

            <label className="label-nam mt-6" htmlFor="invite-code">
              Código de la beta
            </label>
            <input
              id="invite-code"
              type="text"
              value={inviteCode}
              onChange={(event) => {
                setInviteCode(event.target.value.toUpperCase())
                setInviteError(null)
              }}
              className={`input-hero tracking-[0.18em] ${
                inviteError ? '!border-2 !border-rojo-500 !shadow-none' : ''
              }`}
              aria-invalid={Boolean(inviteError)}
            />
            {inviteError && (
              <p className="error-nam" role="alert">
                {inviteError}
              </p>
            )}
            <p className="help-nam">
              Por ahora esta app está disponible sólo por invitación. Si no lo tienes, pide el
              código de la beta al equipo de ¡Ñam!
            </p>

            <button
              type="button"
              onClick={checkInviteCode}
              disabled={!canCreate || checkingCode}
              className="btn-primary mt-8 w-full disabled:cursor-not-allowed disabled:bg-crema-400 disabled:text-crema-100"
            >
              {checkingCode && <Spinner />}
              {checkingCode ? 'Comprobando…' : 'Seguir'}
            </button>
          </>
        )}

        {view === 'step1' && (
          <>
            <OnboardingHeader
              label={`${houseLabel} · Paso 1 de 3`}
              step={1}
              onBack={() => go('create')}
            />
            <h1 className="mt-5 text-[26px] font-extrabold leading-[1.15]">
              ¿Cómo son tus comidas?
            </h1>
            <p className="mt-2 text-sm font-bold font-sans leading-[1.4] text-tinta-500">
              Así la propuesta de platos semanales se adapta a tus gustos. Siempre podrás
              cambiarlo en los ajustes.
            </p>

            <div className="mt-6 flex flex-col gap-5">
              <RuleChoice
                label="En la comida quiero…"
                value={rules.lunchStructure}
                onChange={(value) => setRules({ ...rules, lunchStructure: value })}
                options={[
                  { value: 'single', title: 'Plato único', example: 'Arroz a la cubana, lentejas, cocido…' },
                  { value: 'courses', title: 'Primero y segundo', example: 'Ensalada y merluza, sopa y filete…' },
                  {
                    value: 'either',
                    title: 'Indistinto',
                    example: 'Unos días uno, otros dos. Más variedad.',
                    badge: 'RECOMENDADO',
                  },
                ]}
              />
              <RuleChoice
                label="En la cena quiero…"
                layout="side-by-side"
                value={rules.dinnerCourses === 2 ? 'two' : 'one'}
                onChange={(value) => setRules({ ...rules, dinnerCourses: value === 'two' ? 2 : 1 })}
                options={[
                  { value: 'one', title: 'Un plato', example: 'Ej: Tortilla francesa' },
                  { value: 'two', title: 'Dos platos', example: 'Ej: Brócoli y tortilla' },
                ]}
              />
            </div>

            <button type="button" onClick={() => go('step2')} className="btn-primary mt-8 w-full">
              Seguir a las reglas
            </button>
          </>
        )}

        {view === 'step2' && (
          <>
            <OnboardingHeader
              label={`${houseLabel} · Paso 2 de 3`}
              step={2}
              onBack={() => go('step1')}
            />
            <h1 className="mt-5 text-[26px] font-extrabold leading-[1.15]">
              ¿Qué comes cada semana?
            </h1>
            <p className="mt-2 text-sm font-bold font-sans leading-[1.4] text-tinta-500">
              Así la propuesta de platos semanales se adapta a tus gustos. Siempre podrás
              cambiarlo en los ajustes.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <RuleCard>
                <RuleStepper
                  title="Pescado al menos…"
                  suffix="días a la semana"
                  value={rules.fishMinDays}
                  onChange={(value) => setRules({ ...rules, fishMinDays: value })}
                />
                <RuleStepper
                  title="Legumbre al menos…"
                  suffix="comidas a la semana"
                  value={rules.legumeMinLunches}
                  onChange={(value) => setRules({ ...rules, legumeMinLunches: value })}
                />
                <RuleStepper
                  title="Pasta como mucho…"
                  suffix="veces a la semana"
                  value={rules.pastaMaxPerWeek}
                  onChange={(value) => setRules({ ...rules, pastaMaxPerWeek: value })}
                />
              </RuleCard>

              {/* Only exists with a two-course dinner. With one dish it is not
                  painted disabled — it is not painted, and nothing else moves. */}
              {rules.dinnerCourses === 2 && (
                <RuleCard>
                  <RuleSwitch
                    title="Verdura en todas las cenas"
                    help="Uno de los dos platos de la cena será verdura."
                    checked={rules.vegetableEveryDinner}
                    onChange={(checked) => setRules({ ...rules, vegetableEveryDinner: checked })}
                  />
                </RuleCard>
              )}

              <RuleChips
                title="En la cena, nada de…"
                help="Puedes marcar varios o ninguno."
                options={DINNER_EXCLUDABLE.map((value) => ({
                  value,
                  label: INGREDIENTS.find((i) => i.value === value)?.label ?? value,
                }))}
                selected={rules.dinnerExclusions}
                onToggle={toggleExclusion}
              />
            </div>

            <button type="button" onClick={() => go('step3')} className="btn-primary mt-8 w-full">
              Seguir a los platos
            </button>
          </>
        )}

        {view === 'step3' && (
          <>
            <OnboardingHeader
              label={`${houseLabel} · Paso 3 de 3`}
              step={3}
              onBack={() => go('step2')}
            />
            <OnboardingDishStep
              dishes={offeredDishes}
              discarded={discarded}
              onToggle={toggleDish}
              rules={rules}
              // Going back keeps the discards: they live in this component's
              // state, not in the step.
              onChangeRules={() => go('step2')}
              onAddDish={() => setShowAddDish(true)}
              onSubmit={createHousehold}
              submitting={submitting}
              seedCount={STARTER_CATALOG.length}
            />
            {error && (
              <p className="error-nam" role="alert">
                {error}
              </p>
            )}
          </>
        )}

        {view === 'join' && (
          <>
            <OnboardingHeader label="Unirme a un hogar" onBack={() => go('branch')} />
            <h1 className="mt-5 text-[26px] font-extrabold leading-[1.15]">El código de la casa</h1>
            <p className="mt-2 text-sm font-bold font-sans leading-[1.4] text-tinta-500">
              Seis dígitos. Los tiene cualquiera que ya esté dentro, en la pantalla Familia.
            </p>

            <div className="mt-6">
              <JoinCodeInput value={familyCode} onChange={setFamilyCode} disabled={submitting} />
            </div>

            {error && (
              <p className="error-nam" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={joinHousehold}
              disabled={familyCode.replace(/\D/g, '').length !== 6 || submitting}
              className="btn-primary mt-8 w-full disabled:cursor-not-allowed disabled:bg-crema-400 disabled:text-crema-100"
            >
              {submitting && <Spinner />}
              {submitting ? 'Entrando…' : 'Entrar en la casa'}
            </button>
          </>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 text-[13px] font-bold font-sans text-tinta-500">
          {/* The branch screen already greets the user by email; repeating it
              here would show the same address twice on one screen. */}
          <span className="truncate">{view === 'branch' ? '' : session?.user?.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex-none font-extrabold text-verde-600 underline decoration-2 underline-offset-4 hover:text-verde-700"
          >
            Salir
          </button>
        </div>
      </div>

      {showAddDish && (
        <AddDishModal
          variant="catalog"
          dishIdeas={offeredDishes.map((dish, index) => ({
            ...dish,
            id: `pending-${index}`,
            household_id: '',
            created_at: '',
            updated_at: '',
          })) as DishIdea[]}
          onClose={() => setShowAddDish(false)}
          onSaveDish={(dishData) => {
            setOwnDishes((current) => [...current, dishData])
            setShowAddDish(false)
          }}
        />
      )}
    </div>
  )
}

function Spinner() {
  return (
    <span
      className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white"
      aria-hidden="true"
    />
  )
}

/**
 * Two paths, not a radiogroup: each card states what its path costs — two
 * minutes, or a code somebody has to give you — which is the whole reason this
 * screen exists instead of a segmented control.
 */
function Branch({
  email,
  onCreate,
  onJoin,
}: {
  email?: string
  onCreate: () => void
  onJoin: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-[44px] font-extrabold leading-none text-rojo-500 -rotate-3">¡Ñam!</p>
        {email && (
          <p className="mt-3 text-[15px] font-bold font-sans text-tinta-500">Hola, {email}</p>
        )}
      </div>

      <h1 className="text-center text-[22px] font-extrabold leading-[1.2]">
        ¿Empiezas una casa nueva o te unes a una?
      </h1>

      <div className="flex flex-col gap-3">
        <div className="rounded-card border-[3px] border-tinta-900 bg-white p-[18px] shadow-pop">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full bg-verde-500 text-[22px] font-extrabold text-white"
            aria-hidden="true"
          >
            +
          </span>
          <h2 className="mt-3 text-[19px] font-extrabold">Crear un hogar</h2>
          <p className="mt-1 text-[13px] font-bold font-sans leading-[1.4] text-tinta-500">
            Planifica comidas sanas, en 2 minutos todo listo para empezar.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="btn-primary mt-4 box-border min-h-14 w-full text-[17px]"
          >
            Crear un hogar
          </button>
        </div>

        <div className="rounded-card border-2 border-crema-300 bg-white p-[18px]">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full bg-crema-200 text-xl"
            aria-hidden="true"
          >
            ⌂
          </span>
          <h2 className="mt-3 text-[19px] font-extrabold">Unirme a un hogar</h2>
          <p className="mt-1 text-[13px] font-bold font-sans leading-[1.4] text-tinta-500">
            Necesitas el código de 6 dígitos de la casa, pídelo a los otros miembros.
          </p>
          {/* Not `.btn-secondary`: in testing its thin border read as a label
              rather than a button. Same height as the primary. */}
          <button
            type="button"
            onClick={onJoin}
            className="mt-4 box-border flex min-h-14 w-full items-center justify-center rounded-full border-[3px] border-tinta-900 bg-crema-100 text-[17px] font-extrabold text-tinta-900 shadow-[4px_4px_0_#f0e2c8] transition-transform duration-120 hover:bg-crema-200 active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
          >
            Unirme a mi hogar
          </button>
        </div>
      </div>
    </div>
  )
}
