import { useState } from 'react'
import { useAuth } from '../lib/auth-context'

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
      setError(err instanceof Error ? err.message : 'Failed to send the sign-in link')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Weekly Meal Planning</h1>

        {sent ? (
          <div>
            <p className="text-gray-700 mb-4">
              We sent a sign-in link to <span className="font-medium">{email.trim()}</span>.
              Open it on this device to continue.
            </p>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-gray-600 mb-6">
              Sign in with your email — no password needed, we'll send you a link.
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
              placeholder="you@example.com"
            />
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending ? 'Sending link...' : 'Send sign-in link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
