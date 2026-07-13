import { useState } from 'react'
import { useAuth } from '../lib/auth-context'
import { translateError } from '../lib/errorMessages'

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

    setSending(true)
    setError(null)
    try {
      await signInWithEmail(trimmed)
      setSent(true)
    } catch (err) {
      console.error('Error sending magic link:', err)
      setError(
        translateError(err instanceof Error ? err.message : '', 'No se pudo enviar el enlace de acceso')
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Menú Semanal</h1>

        {sent ? (
          <div>
            <p className="text-gray-700 mb-4">
              Te hemos enviado un enlace de acceso a{' '}
              <span className="font-medium">{email.trim()}</span>. Ábrelo en este dispositivo para
              continuar.
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Usar otro email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-gray-600 mb-6">
              Entra con tu email: sin contraseñas, te enviamos un enlace de acceso.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
              placeholder="tu@email.com"
            />
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending ? 'Enviando enlace...' : 'Enviarme el enlace de acceso'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
