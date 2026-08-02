// Backend errors arrive in English (RPC exceptions, Supabase Auth);
// map the known ones to Spanish before showing them to the user.
const KNOWN_ERRORS: Array<[string, string]> = [
  ['Invalid or expired invite code', 'Código de invitación no válido o caducado'],
  ['You already belong to a household', 'Ya perteneces a un hogar'],
  ['Invalid family code', 'Código familiar no válido'],
  ['Household name is required', 'El nombre del hogar es obligatorio'],
  ['Not authenticated', 'No has iniciado sesión'],
  ['Email rate limit exceeded', 'Se ha superado el límite de envío de emails. Espera unos minutos e inténtalo de nuevo'],
  ['you can only request this after', 'Por seguridad, espera un momento antes de pedir otro código'],
  ['Error sending confirmation email', 'No se pudo enviar el email. Inténtalo de nuevo en unos minutos'],
  ['Error sending magic link email', 'No se pudo enviar el email. Inténtalo de nuevo en unos minutos'],
  ['Token has expired or is invalid', 'El código no es válido o ha caducado. Pide uno nuevo'],
  ['Invalid token', 'El código no es válido. Revísalo e inténtalo de nuevo'],
  ['Email link is invalid or has expired', 'El código ha caducado. Pide uno nuevo'],
]

export function translateError(message: string, fallback: string): string {
  for (const [en, es] of KNOWN_ERRORS) {
    if (message.includes(en)) return es
  }
  return message || fallback
}

/**
 * Extract a message string from an unknown thrown value. Handles both real
 * Error instances and plain objects like Supabase's PostgrestError (which is
 * NOT an Error subclass, so `err instanceof Error` misses its `message`).
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}
