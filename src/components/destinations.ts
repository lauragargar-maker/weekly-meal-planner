import { IconSemana, IconPlatos, IconFamilia } from './icons'

/** The three places the app can be. The view state in `App.tsx` uses these ids. */
export type Destination = 'agenda' | 'catalog' | 'family'

/**
 * Always in this order, on mobile and on desktop: the bottom bar and the header
 * tabs in `App.tsx` render the same list. See `specs/navigation.md`.
 */
export const DESTINATIONS: {
  id: Destination
  label: string
  Icon: (props: { size?: number }) => JSX.Element
}[] = [
  { id: 'agenda', label: 'Semana', Icon: IconSemana },
  { id: 'catalog', label: 'Platos', Icon: IconPlatos },
  { id: 'family', label: 'Familia', Icon: IconFamilia },
]
