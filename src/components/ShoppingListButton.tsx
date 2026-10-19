import { IconCart } from './icons'

interface ShoppingListButtonProps {
  /** Items still to buy on a list in progress; null when there is none in progress. */
  pending: number | null
  onClick: () => void
}

/**
 * The way into the shopping list from Semana (docs/shopping-list-spec.md §5.1).
 * With a list in progress it shows how much is left to buy and opens it;
 * otherwise it has no count and leads to the day picker.
 */
export default function ShoppingListButton({ pending, onClick }: ShoppingListButtonProps) {
  const label =
    pending === null
      ? 'Lista de la compra'
      : `Lista de la compra, ${pending} ${pending === 1 ? 'artículo pendiente' : 'artículos pendientes'}`
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-11 flex-none items-center gap-1.5 rounded-full border-2 border-tinta-900 bg-white pl-3 pr-3.5 text-[15px] font-extrabold text-tinta-900 shadow-[3px_3px_0_#f6ecd8] transition-transform duration-120 active:translate-y-[2px] active:shadow-none focus:outline-none focus:ring-2 focus:ring-verde-500 focus:ring-offset-2"
    >
      <IconCart size={20} />
      <span>Lista</span>
      {pending !== null && pending > 0 && (
        <span
          aria-hidden="true"
          className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-rojo-600 px-1.5 font-sans text-[13px] font-extrabold text-white"
        >
          {pending}
        </span>
      )}
    </button>
  )
}
