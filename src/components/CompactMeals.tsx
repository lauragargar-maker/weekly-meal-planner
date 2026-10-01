import { MenuItem } from '../types'
import { dishesOf } from '../lib/dayFormat'

/**
 * One line per meal, courses joined with "·". Used on the secondary day cards
 * of the week, and on the list of days to swap with, so that a day reads the
 * same wherever it is shown.
 */
export default function CompactMeals({ lunch, dinner }: { lunch: MenuItem | null; dinner: MenuItem | null }) {
  const lunchDishes = dishesOf(lunch)
  const dinnerDishes = dishesOf(dinner)
  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm font-bold font-sans leading-[1.3]">
      {/* The sun and the moon are the only thing telling lunch from dinner here,
          and they are decorative: now that the card is a button, its contents are
          read out, so the distinction has to exist in text too. */}
      {lunchDishes.length > 0 && (
        <p className="flex gap-2">
          <span className="flex-none text-amarillo-500" aria-hidden="true">☀</span>
          <span className="text-tinta-900">
            <span className="sr-only">Comida: </span>
            {lunchDishes.join(' · ')}
          </span>
        </p>
      )}
      {dinnerDishes.length > 0 && (
        <p className="flex gap-2">
          <span className="flex-none text-verde-500" aria-hidden="true">☾</span>
          <span className="text-tinta-500">
            <span className="sr-only">Cena: </span>
            {dinnerDishes.join(' · ')}
          </span>
        </p>
      )}
    </div>
  )
}
