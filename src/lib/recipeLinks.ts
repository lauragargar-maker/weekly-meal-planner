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
}

/**
 * Whether a typed link can be stored: https only (the CHECK rejects anything
 * else) and something a browser can actually open.
 */
export const isValidRecipeUrl = (value: string): boolean => {
  const url = value.trim()
  if (url.length === 0 || url.length > RECIPE_URL_MAX_LENGTH) return false
  if (!url.startsWith('https://')) return false
  try {
    return new URL(url).hostname.includes('.')
  } catch {
    return false
  }
}

/** "Directo al Paladar" for a directoalpaladar.com link; the bare host otherwise. */
export const recipeSiteName = (value: string): string => {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '')
    return KNOWN_SITES[host] ?? host
  } catch {
    return value
  }
}
