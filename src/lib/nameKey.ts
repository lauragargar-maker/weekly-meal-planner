/**
 * The key two names are compared by: "Tomate", "tomate " and "TOMATE" are the
 * same ingredient, and so are "Calabacín" and "calabacin". Used for the
 * household's ingredient catalogue (`ingredients.name_key`, unique per
 * household), for finding a menu's dish by name, and for merging shopping-list
 * items. See docs/shopping-list-spec.md §3.6.
 *
 * Accents go, but the ñ stays: "año" and "ano" are different words, and a
 * Spanish speaker would never type one for the other.
 *
 * The database stores what this returns and never recomputes it, so changing
 * it means migrating every `name_key` already written.
 */
export const toKey = (name: string): string =>
  name
    // Compose first, so a ñ typed as n + combining tilde is caught below too.
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    // Protect the ñ before NFD splits it into n + combining tilde.
    .replace(/ñ/g, '\uE000')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\uE000/g, 'ñ')

/** The name as the user meant it: trimmed and with single spaces, case kept. */
export const cleanName = (name: string): string => name.trim().replace(/\s+/g, ' ')
