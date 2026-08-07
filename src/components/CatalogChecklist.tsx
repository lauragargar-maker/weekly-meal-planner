import { DishIdea } from '../types'
import { HouseholdRules } from '../lib/householdRules'
import { getCatalogRequirements } from '../utils/catalogCheck'

/**
 * Shows which minimums the dish catalog still misses to generate a full week.
 *
 * The list depends on the household's rules, so it changes when they do: turning
 * on two-course dinners adds a line that was not there a moment ago.
 */
export default function CatalogChecklist({
  dishIdeas,
  rules,
}: {
  dishIdeas: DishIdea[]
  rules?: HouseholdRules
}) {
  const requirements = getCatalogRequirements(dishIdeas, rules)
  const allMet = requirements.every((req) => req.met)

  return (
    <div className="card mx-auto max-w-sm text-left">
      <p className="label-nam">Para un menú completo necesitáis</p>
      <ul className="mt-2 flex flex-col gap-2.5">
        {requirements.map((req) => (
          <li key={req.label} className="flex min-h-[32px] items-center gap-3">
            <span
              aria-hidden="true"
              className={`grid h-6 w-6 flex-none place-items-center rounded-full text-xs font-extrabold ${
                req.met
                  ? 'bg-verde-500 text-white'
                  : 'border-2 border-crema-300 bg-crema-200 text-transparent'
              }`}
            >
              ✓
            </span>
            <span
              className={`flex-1 text-sm font-bold font-sans ${
                req.met ? 'text-tinta-300' : 'text-tinta-900'
              }`}
            >
              {req.label}
            </span>
            <span className="text-sm font-extrabold text-tinta-500">
              {req.have}/{req.need}
            </span>
          </li>
        ))}
        {requirements
          .filter((req) => !req.met && req.hint)
          .slice(0, 1)
          .map((req) => (
            <li key={`${req.label}-hint`} className="text-[13px] font-bold font-sans text-tinta-500">
              {req.hint}
            </li>
        ))}
      </ul>
      {allMet && (
        <p className="mt-3 text-[13px] font-extrabold text-verde-700">
          ¡Listo para generar la semana!
        </p>
      )}
    </div>
  )
}
