import { HouseholdRules } from '../lib/householdRules'
import { INGREDIENTS } from '../lib/ingredients'
import { Ingredient } from '../types'
import { RuleCard, RuleChips, RuleChoice, RuleStepper, RuleSwitch } from './RuleControls'

/**
 * All four rule blocks, editable. The onboarding asks a subset of these (blocks
 * A, C and D) across its two rule steps; block B lives only here, on purpose —
 * it is the rule nobody knows they want until it is broken, and asking about it
 * up front costs attention without earning any.
 */

/** Only the ingredients it makes sense to keep off the evening menu. */
const DINNER_EXCLUDABLE: Ingredient[] = ['pasta', 'rice', 'potato', 'meat', 'legume']

export default function HouseholdRulesEditor({
  rules,
  onChange,
  disabled,
}: {
  rules: HouseholdRules
  onChange: (rules: HouseholdRules) => void
  disabled?: boolean
}) {
  const set = <K extends keyof HouseholdRules>(key: K, value: HouseholdRules[K]) =>
    onChange({ ...rules, [key]: value })

  const toggleExclusion = (ingredient: Ingredient) =>
    set(
      'dinnerExclusions',
      rules.dinnerExclusions.includes(ingredient)
        ? rules.dinnerExclusions.filter((i) => i !== ingredient)
        : [...rules.dinnerExclusions, ingredient]
    )

  const excludableOptions = DINNER_EXCLUDABLE.map((value) => ({
    value,
    label: INGREDIENTS.find((i) => i.value === value)?.label ?? value,
  }))

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-6 disabled:opacity-60">
      <section className="flex flex-col gap-3">
        <RuleChoice
          label="En la comida queremos…"
          value={rules.lunchStructure}
          onChange={(value) => set('lunchStructure', value)}
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
          label="En la cena queremos…"
          value={rules.dinnerCourses === 2 ? 'two' : 'one'}
          onChange={(value) => set('dinnerCourses', value === 'two' ? 2 : 1)}
          options={[
            { value: 'one', title: 'Un plato', example: 'Ej: Tortilla francesa' },
            { value: 'two', title: 'Dos platos', example: 'Ej: Brócoli y tortilla' },
          ]}
        />
      </section>

      <section>
        <h3 className="label-nam">No repetir en el mismo día</h3>
        <RuleCard>
          <RuleSwitch
            title="No repetir el hidrato"
            help="Entre comida y cena: pasta, arroz, patata."
            checked={rules.noRepeatCarb}
            onChange={(checked) => set('noRepeatCarb', checked)}
          />
          <RuleSwitch
            title="No repetir la proteína"
            help="Entre comida y cena: carne, pescado, huevo, legumbre."
            checked={rules.noRepeatProtein}
            onChange={(checked) => set('noRepeatProtein', checked)}
          />
        </RuleCard>
      </section>

      <section>
        <h3 className="label-nam">Cada semana</h3>
        <RuleCard>
          <RuleStepper
            title="Pescado al menos…"
            suffix="días a la semana"
            value={rules.fishMinDays}
            onChange={(value) => set('fishMinDays', value)}
          />
          <RuleStepper
            title="Legumbre al menos…"
            suffix="comidas a la semana"
            value={rules.legumeMinLunches}
            onChange={(value) => set('legumeMinLunches', value)}
          />
          <RuleStepper
            title="Pasta como mucho…"
            suffix="veces a la semana"
            value={rules.pastaMaxPerWeek}
            onChange={(value) => set('pastaMaxPerWeek', value)}
          />
        </RuleCard>

        {/* Not painted disabled when dinner has one course: not painted at all.
            Requiring vegetables in a single dish is restrictive and hard to
            explain, and a greyed-out row invites the question anyway. */}
        {rules.dinnerCourses === 2 && (
          <div className="mt-2">
            <RuleCard>
              <RuleSwitch
                title="Verdura en todas las cenas"
                help="Uno de los dos platos de la cena será verdura."
                checked={rules.vegetableEveryDinner}
                onChange={(checked) => set('vegetableEveryDinner', checked)}
              />
            </RuleCard>
          </div>
        )}
      </section>

      <RuleChips
        title="En la cena, nada de…"
        help="Puedes marcar varios o ninguno."
        options={excludableOptions}
        selected={rules.dinnerExclusions}
        onToggle={toggleExclusion}
      />
    </fieldset>
  )
}
