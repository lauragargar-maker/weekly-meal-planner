import { DESTINATIONS, Destination } from './destinations'

interface BottomNavProps {
  active: Destination
  onNavigate: (destination: Destination) => void
}

/**
 * Fixed bottom bar, mobile only (`md:hidden` — above 768px the same three
 * destinations live in the header as tabs). Presentation only: it reads the
 * active destination and asks for a new one, it knows nothing about routes or
 * data.
 *
 * It is never hidden while a sheet is open, only covered by the sheet's scrim,
 * so the layout does not jump — see `specs/navigation.md` §3.
 */
export default function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 rounded-t-[20px] border-t-2 border-tinta-900 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex h-[60px] items-stretch gap-1 px-1.5 py-1.5">
        {DESTINATIONS.map(({ id, label, Icon }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center justify-center gap-[3px] rounded-[14px] transition-colors duration-120 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-verde-500 ${
                isActive ? 'bg-amarillo-100 text-rojo-600' : 'text-tinta-500'
              }`}
            >
              <Icon />
              <span className="text-xs font-extrabold leading-none">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
