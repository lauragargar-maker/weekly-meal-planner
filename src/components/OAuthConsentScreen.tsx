import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'
import { getErrorMessage } from '../lib/errorMessages'
import { Household } from '../types'

interface Details {
  clientName: string
  email: string
  /** Host the person is sent back to. Any assistant can register itself under any name; this cannot be made up. */
  returnsTo: string | null
}

/**
 * The fields of the authorization this screen reads. The SDK renamed some of
 * them between releases (`client_name` became `name`) and added the
 * already-approved answer, so both spellings are read rather than trusting
 * whichever the installed types describe.
 */
interface AuthorizationAnswer {
  redirect_url?: string
  redirect_uri?: string
  client?: { name?: string; client_name?: string }
  user?: { email?: string }
}

const hostOf = (uri: string | undefined): string | null => {
  try {
    return uri ? new URL(uri).host : null
  } catch {
    return null
  }
}

/**
 * "¿Dejas que este asistente entre en tu casa?"
 *
 * Supabase Auth, acting as the OAuth server, sends the person here when an AI
 * assistant asks to connect to the ¡Ñam! MCP server. AuthGate only renders this
 * once they are signed in and have a household, so by now the question is just
 * yes or no.
 *
 * What is being granted is said in full, because it is more than the tools the
 * assistant will show: the token it receives is this person's own session, good
 * for everything they can do in the app.
 */
export default function OAuthConsentScreen({
  authorizationId,
  household,
}: {
  authorizationId: string
  household: Household
}) {
  const [details, setDetails] = useState<Details | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deciding, setDeciding] = useState<'approve' | 'deny' | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: raw, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      if (cancelled) return
      const data = raw as AuthorizationAnswer | null
      if (detailsError || !data) {
        setError('Esta solicitud ya no es válida. Vuelve a tu asistente y conéctalo otra vez.')
        return
      }
      // Already approved for this assistant before: Supabase answers with where
      // to go instead of with what to ask.
      if (data.redirect_url) {
        window.location.href = data.redirect_url
        return
      }
      const clientName = data.client?.name || data.client?.client_name || 'Un asistente'
      setDetails({ clientName, email: data.user?.email ?? '', returnsTo: hostOf(data.redirect_uri) })
      trackEvent('oauth_consent_viewed', { client: clientName })
    })()
    return () => {
      cancelled = true
    }
  }, [authorizationId])

  const decide = async (decision: 'approve' | 'deny') => {
    if (deciding) return
    setDeciding(decision)
    setError(null)
    try {
      const { data, error: decisionError } =
        decision === 'approve'
          ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
          : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true })
      if (decisionError || !data?.redirect_url) throw decisionError ?? new Error('Sin dirección de vuelta')
      trackEvent(decision === 'approve' ? 'oauth_consent_approved' : 'oauth_consent_denied', {
        client: details?.clientName,
      })
      window.location.href = data.redirect_url
    } catch (err) {
      console.error('Error deciding the authorization:', getErrorMessage(err))
      setError('No se pudo completar. Vuelve a tu asistente y conéctalo otra vez.')
      setDeciding(null)
    }
  }

  return (
    <div className="min-h-screen bg-crema-100 flex items-center justify-center p-7">
      <div className="card w-full max-w-md">
        {!details && !error && (
          <div className="py-6 text-center" role="status" aria-live="polite">
            <div className="mx-auto h-12 w-12 rounded-full border-4 border-crema-300 border-t-verde-500 animate-spin motion-reduce:animate-pulse" />
            <p className="mt-4 text-base font-bold font-sans text-tinta-500">Un momento…</p>
          </div>
        )}

        {details && (
          <>
            <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-tinta-300">
              Conectar un asistente
            </p>
            <h1 className="mt-2 text-2xl font-extrabold text-tinta-900">
              ¿Dejas que {details.clientName} entre en {household.name}?
            </h1>
            <p className="mt-3 text-[15px] font-bold font-sans leading-[1.45] text-tinta-500">
              Podrá ver y cambiar en tu nombre todo lo que tú puedes en ¡Ñam!: el menú, los platos,
              la lista de la compra y los ajustes de la casa.
            </p>
            <p className="mt-2 text-[13px] font-bold font-sans leading-[1.4] text-tinta-500">
              Acepta solo si has sido tú quien acaba de conectarlo
              {details.returnsTo ? ` (al aceptar volverás a ${details.returnsTo})` : ''}. Has entrado
              como {details.email}.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => decide('approve')}
                disabled={deciding !== null}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deciding === 'approve' ? 'Conectando…' : 'Permitir'}
              </button>
              <button
                onClick={() => decide('deny')}
                disabled={deciding !== null}
                className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                No permitir
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="error-nam" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
