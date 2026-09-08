import { useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { translateError } from '../lib/errorMessages'
import { trackEvent } from '../lib/analytics'

export default function LoginScreen() {
  const { signInWithEmail, verifyCode } = useAuth()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestCode = async (): Promise<boolean> => {
    // Fired on submit attempt (before the request resolves) so the login
    // funnel can measure drop-off between requesting a code and signing in,
    // independent of technical send failures. Renamed from
    // `login_link_requested` once magic links gave way to codes; the two names
    // are stitched back together as a merged event in Amplitude.
    trackEvent('login_otp_requested')

    setSending(true)
    setError(null)
    try {
      await signInWithEmail(email.trim())
      return true
    } catch (err) {
      console.error('Error sending sign-in code:', err)
      trackEvent('login_otp_request_failed', {
        reason: err instanceof Error ? err.message : 'unknown',
      })
      setError(
        translateError(err instanceof Error ? err.message : '', 'No se pudo enviar el código de acceso')
      )
      return false
    } finally {
      setSending(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || sending) return
    if (await requestCode()) {
      setCode('')
      setStep('code')
    }
  }

  const handleResend = async () => {
    if (sending) return
    setCode('')
    await requestCode()
  }

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed || verifying) return

    setVerifying(true)
    setError(null)
    try {
      // On success the auth listener in AuthProvider picks up the new session
      // and AuthGate routes onwards, so there is nothing to do here.
      await verifyCode(email.trim(), trimmed)
    } catch (err) {
      console.error('Error verifying sign-in code:', err)
      setError(
        translateError(err instanceof Error ? err.message : '', 'No se pudo comprobar el código')
      )
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-verde-500 px-7 pt-14 pb-10 md:flex md:items-center md:justify-center md:py-10">
      <div className="w-full max-w-[460px] md:mx-auto">
        <h1 className="inline-block -rotate-3 text-[54px] md:text-[72px] font-extrabold leading-none text-amarillo-500 [text-shadow:4px_4px_0_rgba(38,33,28,0.22)] md:[text-shadow:5px_5px_0_rgba(38,33,28,0.22)]">
          ¡Ñam!
        </h1>

        {step === 'code' ? (
          <div className="mt-11 text-center">
            <div
              className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-amarillo-500 text-[44px] shadow-pop"
              aria-hidden="true"
            >
              ✉
            </div>
            <h2 className="mt-6 text-[26px] font-extrabold text-white">¡Revisa tu correo!</h2>
            <p className="mt-2 text-base font-bold font-sans text-verde-100">
              Te hemos enviado un código de 6 dígitos a{' '}
              <span className="font-extrabold text-white">{email.trim()}</span>.
            </p>

            <form onSubmit={handleCodeSubmit} className="mt-8">
              <label className="label-nam !text-verde-100" htmlFor="login-code">
                Tu código
              </label>
              <input
                id="login-code"
                type="text"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-2 w-full rounded-full bg-white px-5 py-[15px] md:px-[22px] md:py-4 text-center text-[26px] md:text-[30px] font-extrabold font-sans tracking-[0.35em] text-tinta-900 placeholder:tracking-[0.2em] placeholder:text-tinta-300 focus:outline-none focus:ring-2 focus:ring-tinta-900"
                placeholder="123456"
              />
              {error && (
                <p className="mt-2 text-sm font-extrabold text-amarillo-500" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={verifying || !code.trim()}
                className="btn-dark mt-3 w-full text-[17px] md:text-[18px] focus:ring-white focus:ring-offset-verde-500 disabled:opacity-70"
              >
                {verifying && (
                  <span
                    className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-crema-100/40 border-t-crema-100"
                    aria-hidden="true"
                  />
                )}
                {verifying ? 'Comprobando…' : 'Entrar'}
              </button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3">
              <button
                onClick={handleResend}
                disabled={sending}
                className="text-[15px] font-extrabold text-white underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-verde-500 disabled:opacity-70"
              >
                {sending ? 'Enviando…' : 'Enviarme otro código'}
              </button>
              <button
                onClick={() => {
                  setStep('email')
                  setError(null)
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border-2 border-crema-300 bg-white px-6 text-sm font-extrabold text-tinta-500 transition-colors duration-120 hover:bg-crema-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-verde-500"
              >
                Usar otro email
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-3 text-[19px] md:text-[22px] font-bold leading-[1.35] text-verde-100">
              Qué come tu familia esta semana, sin pensarlo cada día.
            </p>

            <form onSubmit={handleEmailSubmit} className="mt-11">
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
                {sending ? 'Enviando código…' : 'Enviarme el código'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm md:text-[15px] font-bold font-sans text-verde-100">
              Sin contraseñas. Te llega un código de 6 dígitos y entras.
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
