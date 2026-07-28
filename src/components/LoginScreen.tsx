import { useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { translateError } from '../lib/errorMessages'
import { trackEvent } from '../lib/analytics'

export default function LoginScreen() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || sending) return

    // Fired on submit attempt (before the request resolves) so the login
    // funnel can measure drop-off between requesting a link and signing in,
    // independent of technical send failures.
    trackEvent('login_link_requested')

    setSending(true)
    setError(null)
    try {
      await signInWithEmail(trimmed)
      setSent(true)
    } catch (err) {
      console.error('Error sending magic link:', err)
      trackEvent('login_link_request_failed', {
        reason: err instanceof Error ? err.message : 'unknown',
      })
      setError(
        translateError(err instanceof Error ? err.message : '', 'No se pudo enviar el enlace de acceso')
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-verde-500 px-7 pt-14 pb-10 md:flex md:items-center md:justify-center md:py-10">
      <div className="w-full max-w-[460px] md:mx-auto">
        <h1 className="inline-block -rotate-3 text-[54px] md:text-[72px] font-extrabold leading-none text-amarillo-500 [text-shadow:4px_4px_0_rgba(38,33,28,0.22)] md:[text-shadow:5px_5px_0_rgba(38,33,28,0.22)]">
          ¡Ñam!
        </h1>

        {sent ? (
          <div className="mt-11 text-center">
            <div
              className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amarillo-500 text-[44px] shadow-pop"
              aria-hidden="true"
            >
              ✉
            </div>
            <h2 className="mt-6 text-[26px] font-extrabold text-white">¡Revisa tu correo!</h2>
            <p className="mt-2 text-base font-bold font-sans text-verde-100">
              Te hemos enviado un enlace de acceso a{' '}
              <span className="font-extrabold text-white">{email.trim()}</span>. Ábrelo en este
              dispositivo para continuar.
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full border-2 border-crema-300 bg-white px-6 text-sm font-extrabold text-tinta-500 transition-colors duration-120 hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-verde-500"
            >
              Usar otro email
            </button>
          </div>
        ) : (
          <>
            <p className="mt-3 text-[19px] md:text-[22px] font-bold leading-[1.35] text-verde-100">
              Qué come tu familia esta semana, sin pensarlo cada día.
            </p>

            <form onSubmit={handleSubmit} className="mt-11">
              <label className="label-nam !text-verde-100" htmlFor="login-email">
                Tu correo
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-full bg-white px-5 py-[15px] md:px-[22px] md:py-4 text-base md:text-[17px] font-bold font-sans text-tinta-900 placeholder:text-tinta-300 focus:outline-none focus:ring-2 focus:ring-tinta-900"
                placeholder="tu@email.com"
              />
              {error && (
                <p className="mt-2 text-sm font-extrabold text-amarillo-500" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="btn-dark mt-3 w-full text-[17px] md:text-[18px] focus:ring-white focus:ring-offset-verde-500 disabled:opacity-70"
              >
                {sending && (
                  <span
                    className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-crema-100/40 border-t-crema-100"
                    aria-hidden="true"
                  />
                )}
                {sending ? 'Enviando enlace…' : 'Enviarme el enlace mágico'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm md:text-[15px] font-bold font-sans text-verde-100">
              Sin contraseñas. Te llega un enlace y entras con un toque.
            </p>

            <p className="mt-9 border-t-2 border-white/25 pt-[18px] text-center text-[15px] font-extrabold text-white">
              ¿Te han dado un código de casa? Entra con tu correo y te lo pediremos después.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
