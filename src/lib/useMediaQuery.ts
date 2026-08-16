import { useEffect, useState } from 'react'

/**
 * A media query React can branch on.
 *
 * Most of the app switches layout with Tailwind's `lg:` prefixes and never needs
 * this. The day editor does: `specs/edit-day.md` §0 gives mobile and desktop two
 * different containers — a modal sheet and a panel inside the week grid — and
 * rendering both and hiding one with CSS would mean two dialogs, two pickers and
 * two copies of the step state, only one of which the user is looking at.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    // Resizing across the breakpoint has to move the open day from one container
    // to the other, so this listens rather than reading once on mount.
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}
