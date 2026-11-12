/**
 * Where Supabase Auth sends someone to approve an assistant.
 *
 * The same value has to be set as the "Authorization Path" of the OAuth server
 * in each Supabase project (Authentication > OAuth Server); see SETUP.md.
 */
export const OAUTH_CONSENT_PATH = '/oauth/consent'

/** The pending authorization the page was opened for, if it was opened for one. */
export const pendingAuthorizationId = (location: Pick<Location, 'pathname' | 'search'>): string | null => {
  if (location.pathname.replace(/\/$/, '') !== OAUTH_CONSENT_PATH) return null
  return new URLSearchParams(location.search).get('authorization_id')
}

/** The address assistants connect to, or null while the feature is switched off. */
export const mcpServerUrl = (supabaseUrl: string, enabled: string | undefined): string | null =>
  enabled === 'true' && supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/mcp` : null
