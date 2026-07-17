import { DishIdea } from '../types'
import { getCatalogRequirements } from '../utils/catalogCheck'

/** Shows which minimums the dish catalog still misses to generate a full week. */
export default function CatalogChecklist({ dishIdeas }: { dishIdeas: DishIdea[] }) {
  const requirements = getCatalogRequirements(dishIdeas)

  return (
    <div className="text-left max-w-sm mx-auto">
      <p className="text-sm font-medium text-gray-700 mb-2">
        Para generar un menú completo, tu catálogo necesita como mínimo:
      </p>
      <ul className="space-y-1">
        {requirements.map((req) => (
          <li key={req.label} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true">{req.met ? '✅' : '⬜'}</span>
            <span className={req.met ? 'text-gray-500' : 'text-gray-800 font-medium'}>
              {req.label}: {req.have}/{req.need}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
