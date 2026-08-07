import { CatalogRequirement } from '../utils/catalogCheck'

/**
 * Turns a degraded generation into something a household can act on.
 *
 * The point of the whole exercise: the generator used to swallow this in a
 * `console.warn`, hand back a menu that broke the settings the user had just
 * chosen, and say nothing. Whatever comes out of here has to name the problem
 * and point at the fix.
 */
export function describeDegradedMenu(unmet: CatalogRequirement[]): {
  title: string
  detail: string
} {
  if (unmet.length === 0) {
    // Counts all add up, so it is the combination: day types, or too little
    // slack to get through a week without repeating a dish.
    return {
      title: 'Hemos hecho el plan, pero no cumple todas vuestras reglas',
      detail:
        'Tenéis platos suficientes, pero vuestras reglas no encajan entre sí esta semana. ' +
        'Prueba a suavizar alguna en Familia → Ajustes de la casa, o a añadir más platos.',
    }
  }

  // The biggest gap first: it is the one most likely to be what actually blocked
  // the generator, and fixing it is the best use of the user's next five minutes.
  const worst = [...unmet].sort((a, b) => b.need - b.have - (a.need - a.have))[0]
  const others = unmet.length - 1

  return {
    title: `Faltan platos: ${worst.label.toLowerCase()}`,
    detail:
      `Con vuestras reglas hacen falta ${worst.need} y tenéis ${worst.have}. ` +
      (worst.hint ?? 'Añade más platos o suaviza la regla en Familia → Ajustes de la casa.') +
      (others > 0 ? ` Hay ${others} ${others === 1 ? 'mínimo más' : 'mínimos más'} sin cubrir.` : ''),
  }
}
