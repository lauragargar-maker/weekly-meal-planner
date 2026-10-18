/**
 * The "Receta recomendada" link on a dish. docs/shopping-list-spec.md §4.1–§4.2.
 */

/** Same limit as the database's `dish_ideas_recipe_url_valid` CHECK. */
export const RECIPE_URL_MAX_LENGTH = 500

/**
 * The sites the starter catalogue links to, by host, with the name a person
 * knows them by. Anything else shows its bare host.
 */
const KNOWN_SITES: Record<string, string> = {
  'directoalpaladar.com': 'Directo al Paladar',
  'bonviveur.es': 'Bon Viveur',
  'cocinaabierta.co': 'Cocina Abierta',
  'recetasderechupete.com': 'Recetas de Rechupete',
  'hogarmania.com': 'Hogarmanía',
  'cocinatis.com': 'Cocinatis',
  'drive.google.com': 'Google Drive',
  'docs.google.com': 'Google Docs',
}

/**
 * The link as it will be stored, or null if it cannot be. docs/shopping-list-spec.md §4.2.
 *
 * Any web link is accepted — a cooking site, a file in Google Drive, a blog on
 * plain http — and one pasted without its scheme ("bonviveur.es/…") gets
 * `https://` in front. Only http and https get through: the link becomes an
 * `href`, and a `javascript:` one would run code in whoever opens the dish
 * sheet. The database's CHECK draws the same line.
 */
export const normalizeRecipeUrl = (value: string): string | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  if (withScheme.length > RECIPE_URL_MAX_LENGTH) return null
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.hostname.includes('.') ? withScheme : null
  } catch {
    return null
  }
}

/** Whether a typed link can be stored (see `normalizeRecipeUrl`). */
export const isValidRecipeUrl = (value: string): boolean => normalizeRecipeUrl(value) !== null

/** The host without "www.", or '' for something that is not a link. */
export const recipeDomain = (value: string): string => {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** "Directo al Paladar" for a directoalpaladar.com link; the bare host otherwise. */
export const recipeSiteName = (value: string): string => {
  const host = recipeDomain(value)
  return host ? KNOWN_SITES[host] ?? host : value
}
